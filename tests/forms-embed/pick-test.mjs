import { build } from "/home/claude/Growvia/node_modules/esbuild/lib/main.js";
await build({ entryPoints: ["/home/claude/Growvia/src/lib/email/pick.ts"], bundle: true, platform: "node", format: "esm", outfile: "/home/claude/ft/pick.mjs" });
const { mailboxForProject } = await import("./pick.mjs");
const boxes = [
  { id: "gmail-growvia", from_email: "teamusegrowvia@gmail.com", from_name: "RedBlink", business_id: "growvia", status: "connected", created_at: "1" },
  { id: "redblink", from_email: "hello@redblink.com", from_name: "RedBlink", business_id: "redblink", status: "connected", created_at: "2" },
  { id: "legacy", from_email: "old@x.com", business_id: null, status: "connected", created_at: "0" },
];
const db = (list) => ({ from: () => {
  let rows = [...list];
  const q = { select: () => q, eq: (k, v) => (rows = rows.filter((r) => r[k] === v), q), is: (k, v) => (rows = rows.filter((r) => r[k] === v), q),
    order: () => q, limit: (n) => (rows = rows.slice(0, n), q), maybeSingle: async () => ({ data: rows[0] ?? null }), then: (f) => f({ data: rows }) };
  return q; } });
const B = (id) => boxes.find((b) => b.id === id);
const cases = [
  ["Client project has its own mailbox, campaign still points at Growvia Gmail → uses client's", db(boxes), "redblink", B("gmail-growvia"), "redblink"],
  ["Client project has NO mailbox, campaign points at another project's Gmail → refused", db(boxes.filter((b) => b.id !== "redblink")), "redblink", B("gmail-growvia"), null],
  ["Client project has no mailbox, only an unassigned old one → old one (nothing breaks)", db(boxes.filter((b) => b.id !== "redblink")), "redblink", B("legacy"), "legacy"],
  ["Chosen mailbox is the project's own → used", db(boxes), "redblink", B("redblink"), "redblink"],
  ["Project has its own, unassigned old one chosen → project's own", db(boxes), "redblink", B("legacy"), "redblink"],
  ["Growvia project emails stay on Growvia Gmail", db(boxes), "growvia", B("gmail-growvia"), "gmail-growvia"],
  ["No mailbox chosen, project has none, only another project's → refused", db(boxes.filter((b) => b.id !== "redblink" && b.id !== "legacy")), "redblink", null, null],
];
let pass = 0;
for (const [name, d, biz, chosen, want] of cases) {
  const r = await mailboxForProject(d, biz, chosen);
  const got = r.ok ? r.mailbox.id : null;
  const ok = got === want; pass += ok;
  console.log(ok ? "PASS" : "FAIL", "|", name, "|", got ?? (r.ok ? "" : "refused: " + r.error.slice(0, 50)));
}
console.log(pass, "/", cases.length, "passed");
