import http from "node:http";
import fs from "node:fs";
import { transformSync } from "/home/claude/Growvia/node_modules/esbuild/lib/main.js";
import { createRequire } from "node:module"; const { forms, embed } = createRequire(import.meta.url)("/home/claude/Growvia/.fttmp/routes.cjs");
const ID = "b29370d3-a621-4f73-96a9-745ccc15a2df";
// real htmlCode() from the form builder
const src = fs.readFileSync("/home/claude/Growvia/src/app/app/forms/client.tsx", "utf8");
const js = transformSync(src.slice(src.indexOf("const esc =")) + "\nexport { htmlCode };", { loader: "ts", format: "esm" }).code;
const { htmlCode } = await import("data:text/javascript," + encodeURIComponent(js));
const fields = [{ id: "name", type: "text", label: "Your name", required: true, maps: "name" }, { id: "email", type: "email", label: "Email", required: true, maps: "email" },
  { id: "field_4", type: "select", label: "Service interested in", required: true, maps: "custom", options: ["SEO", "Ads & Social"] }, { id: "message", type: "textarea", label: "How can we help?", required: true, maps: "message" }];
const snippet = htmlCode("http://127.0.0.1:3100", ID, fields, "GET STARTED", { title: "Thanks — message sent!", text: "RedBlink will get back to you soon." });
fs.writeFileSync("/home/claude/ft/snippet.html", snippet);
const page = (body) => `<!doctype html><html><head><title>Client site</title><style>.gv-select{border:2px solid rgb(255, 0, 0)}</style></head><body><h1>RedBlink — Contact</h1>${body}</body></html>`;
const pages = {
  "/html": page(snippet),
  "/stripped": page(snippet.replace(/<script>[\s\S]*<\/script>/, "")),
  "/inline": page(`<script src="http://127.0.0.1:3100/embed.js" data-growvia-form="${ID}" data-mode="inline" async></script>`),
};
async function toReq(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  return new Request("http://127.0.0.1:3100" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks) });
}
async function send(res, r) { res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); }
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/embed.js") return send(res, await embed.GET());
    const m = u.pathname.match(/^\/api\/forms\/([^/]+)$/);
    if (m) { const r = await toReq(req); const h = forms[req.method]; return send(res, await h(r, { params: { id: m[1] } })); }
    if (u.pathname === "/__calls") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(globalThis.__calls ?? [])); }
    res.writeHead(404); res.end("growvia 404");
  } catch (e) { res.writeHead(500); res.end(String(e.stack)); }
}).listen(3100);
http.createServer((req, res) => { const p = pages[new URL(req.url, "http://x").pathname]; res.writeHead(p ? 200 : 404, { "Content-Type": "text/html" }); res.end(p ?? "client 404"); }).listen(8080);
console.log("up");
