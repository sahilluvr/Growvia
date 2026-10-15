import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fakedb";
import { hashKey } from "@/lib/forms-guard";
import { normalizeFields, normalizeSettings } from "@/lib/forms-model";
import { leadsCsv } from "@/lib/leads-csv";

const sent: { to: string | string[]; subject: string; replyTo?: string; fromName?: string; html: string }[] = [];
let db = fakeDb();
vi.mock("@/lib/server/admin", () => ({ adminClient: () => db }));
vi.mock("../../src/lib/server/admin", () => ({ adminClient: () => db }));
vi.mock("@/lib/data", () => ({ siteOrigin: () => "https://usegrowvia.com" }));
vi.mock("@/lib/mail/system", async (orig) => ({ ...(await orig<object>()), sendSystemEmail: async (m: (typeof sent)[number]) => { sent.push(m); return { ok: true, id: "e1" }; }, systemMailReady: true }));
vi.mock("@/lib/inapp", () => ({ pushInApp: async () => null }));
vi.mock("@/lib/email/engine", () => ({ sendToLead: async () => ({ ok: true }) }));
vi.mock("@/lib/captcha", () => ({ captchaOn: false, verifyCaptcha: async () => ({ ok: true }), TURNSTILE_SITE_KEY: "", TURNSTILE_SCRIPT: "" }));

const { submitForm, sendAutoReply, signedFileUrl } = await import("@/lib/forms-submit");

const FORM = "11111111-1111-4111-8111-111111111111", BIZ = "22222222-2222-4222-8222-222222222222", OWNER = "33333333-3333-4333-8333-333333333333";
const fields = normalizeFields([
  { key: "full_name", type: "text", label: "Full name", required: true, maps: "name" },
  { key: "work_email", type: "email", label: "Work email", required: true, maps: "email" },
  { key: "company", type: "text", label: "Company", required: false, maps: "company" },
  { key: "phone", type: "tel", label: "Phone", required: false, maps: "phone" },
  { key: "services", type: "multiselect", label: "Services", required: false, maps: "custom", options: ["AI agents", "Web development", "SEO"] },
  { key: "budget", type: "range", label: "Budget", required: false, maps: "custom", options: ["Under $25k", "$25k–$50k", "$50k–$100k"], default: "$25k–$50k" },
  { key: "project_details", type: "textarea", label: "Project details", required: true, maps: "message", min: 10, error: "Tell us a bit more (10+ characters)" },
  { key: "consent", type: "checkbox", label: "I agree to the [privacy policy](https://acme.com/privacy)", required: true, maps: "consent" },
  { key: "website", type: "url", label: "Website", required: false, maps: "custom" },
  { key: "cv", type: "file", label: "CV", required: false, maps: "custom", accept: ["pdf"], max_mb: 10 },
  { key: "form_type", type: "hidden", label: "Form type", required: false, maps: "custom", default: "contact" },
  { key: "service", type: "hidden", label: "Service", required: false, maps: "custom", param: "service" },
]);
const settings = { ...normalizeSettings({}, "Acme", { isNew: true }), tags: ["qa", "website"], notify_to: ["ops@acme.com", "sales@acme.com"], notify_subject: "New lead: {name} – {company}", allowed_origins: ["acme.com"] };

function seed() {
  db = fakeDb({
    businesses: [{ id: BIZ, owner_id: OWNER, name: "Acme", segment: "agency", city: "Austin", offer: null }],
    lead_forms: [{ id: FORM, owner_id: OWNER, business_id: BIZ, name: "QA – Contact", fields, settings, submissions: 0, created_at: "2026-10-01", server_key_hash: hashKey("gvf_test") }],
    profiles: [{ id: OWNER, email: "owner@acme.com" }],
  });
  sent.length = 0;
}
const req = (h: Record<string, string> = { origin: "https://acme.com" }) => new Request(`https://usegrowvia.com/api/forms/${FORM}`, { method: "POST", headers: h });
const good = { full_name: "Alex Carter", work_email: "alex@carter.com", company: "Carter Dental", project_details: "We need an AI support agent", consent: "yes" };
const post = (data: Record<string, unknown>, h?: Record<string, string>, extra: Record<string, unknown> = {}) => submitForm(FORM, data as never, {}, { req: req(h), ip: "1.2.3.4", ...extra });

beforeEach(seed);

describe("acceptance (server)", () => {
  it("1. consent unticked → 400 with per-field error, no lead, no alert", async () => {
    const r = await post({ ...good, consent: "" });
    expect(r.ok).toBe(false); if (!r.ok) { expect(r.status).toBe(400); expect(r.fields?.consent).toBeTruthy(); }
    expect(db.tables.leads ?? []).toHaveLength(0); expect(sent).toHaveLength(0);
  });
  it("2. 5-character project details → 400 with the custom error", async () => {
    const r = await post({ ...good, project_details: "short" });
    expect(!r.ok && r.fields?.project_details).toBe("Tell us a bit more (10+ characters)");
  });
  it("3. renamed key keeps the old posted name working (alias)", async () => {
    (db.tables.lead_forms[0] as { fields: unknown }).fields = normalizeFields((fields as never[]).map((f: { key: string }) => (f.key === "company" ? { ...f, key: "company_name", aliases: ["company"], label: "Organisation" } : f)).reverse());
    const r = await post(good);
    expect(r.ok).toBe(true);
    expect((db.tables.leads[0] as { company: string }).company).toBe("Carter Dental");
  });
  it("4. non-allowed origin → 403 (logged); valid server key → 200", async () => {
    const bad = await post(good, { origin: "https://evil.com" });
    expect(!bad.ok && bad.status).toBe(403);
    expect(db.tables.form_blocks.map((b) => b.reason)).toEqual(["origin"]);
    const ok = await post(good, { origin: "https://evil.com", authorization: "Bearer gvf_test" });
    expect(ok.ok).toBe(true);
  });
  it("5+6. hidden + URL param, UTMs, page, tags as separate values, multi-select array", async () => {
    const r = await post({ ...good, services: ["AI agents", "SEO"], service: "Hire engineers", form_type: "contact" }, undefined, { page: "https://acme.com/contact?service=Hire%20engineers&utm_source=linkedin&utm_campaign=qa", utm: { utm_source: "linkedin", utm_campaign: "qa" } });
    expect(r.ok).toBe(true);
    const lead = db.tables.leads[0] as { tags: string[]; stage: string };
    expect(lead.tags).toEqual(["qa", "website"]); expect(lead.stage).toBe("new");
    const sub = db.tables.lead_submissions[0] as { answers: Record<string, unknown>; hidden: Record<string, string>; utm: Record<string, string>; page: string; consent: { given: boolean; at: string; text: string } };
    expect(sub.answers.services).toEqual(["AI agents", "SEO"]);
    expect(sub.hidden).toEqual({ form_type: "contact", service: "Hire engineers" });
    expect(sub.utm).toEqual({ utm_source: "linkedin", utm_campaign: "qa" });
    expect(sub.page).toContain("service=Hire");
    expect(sub.consent.given).toBe(true); expect(sub.consent.at).toBeTruthy(); expect(sub.consent.text).toContain("privacy policy");
  });
  it("7. PDF upload → stored privately with an expiring link; a fake PDF is rejected", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const r = await submitForm(FORM, good as never, { cv: { name: "cv.pdf", type: "application/pdf", bytes: pdf } }, { req: req(), ip: "1.2.3.5" });
    expect(r.ok).toBe(true);
    const f = (db.tables.lead_submissions[0] as { files: { path: string }[] }).files[0];
    expect(Object.keys(db.files)).toContain(f.path);
    expect(await signedFileUrl(f.path)).toMatch(/expires=600/);
    const exe = await submitForm(FORM, good as never, { cv: { name: "cv.pdf", type: "application/pdf", bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]) } }, { req: req(), ip: "1.2.3.6" });
    expect(!exe.ok && exe.fields?.cv).toBeTruthy();
  });
  it("8. same email twice → one lead, two submissions", async () => {
    await post(good); await post({ ...good, project_details: "Second message, different details" }, undefined, { ip: "9.9.9.9" });
    expect(db.tables.leads).toHaveLength(1); expect(db.tables.lead_submissions).toHaveLength(2);
  });
  it("9. alert to both recipients, right subject, every answer", async () => {
    await post({ ...good, services: ["AI agents", "SEO"] });
    const alerts = sent.filter((m) => /New lead/.test(m.subject));
    expect(alerts.map((m) => m.to).sort()).toEqual(["ops@acme.com", "sales@acme.com"]);
    expect(alerts[0].subject).toBe("New lead: Alex Carter – Carter Dental");
    for (const a of ["Alex Carter", "alex@carter.com", "Carter Dental", "AI agents", "SEO", "We need an AI support agent", "$25k"]) expect(alerts[0].html).toContain(a.replace("$", "$"));
  });
  it("10. auto-reply off on a new form; the test send uses sender name and reply-to", async () => {
    await post(good);
    expect(sent.some((m) => m.to === "alex@carter.com")).toBe(false);
    const s = { ...settings, auto_reply: { ...settings.auto_reply, enabled: true, from_name: "Acme Team", reply_to: "hello@acme.com" } };
    await sendAutoReply(s, { id: BIZ, owner_id: OWNER, name: "Acme", city: "Austin" }, FORM, { name: "Owner", email: "owner@acme.com" }, true);
    const t = sent.find((m) => m.to === "owner@acme.com")!;
    expect(t.fromName).toBe("Acme Team"); expect(t.replyTo).toBe("hello@acme.com"); expect(t.subject).toMatch(/^\[Test\]/);
  });
  it("12. rapid repeats → 429 and logged as blocked", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await post({ ...good, work_email: `p${i}@x.com` }));
    expect(results.filter((r) => !r.ok && r.status === 429)).toHaveLength(1);
    expect(db.tables.form_blocks.map((b) => b.reason)).toContain("rate_ip");
  });
  it("bot trap and too-fast posts are blocked and logged", async () => {
    const hp = await post({ ...good, _gv_hp: "spam" });
    expect(hp.ok).toBe(true); expect(db.tables.leads ?? []).toHaveLength(0);
    const fast = await post({ ...good, _gv_t: String(Date.now()) });
    expect(!fast.ok && fast.status).toBe(429);
    expect(db.tables.form_blocks.map((b) => b.reason)).toEqual(["honeypot", "too_fast"]);
  });
  it("14. CSV contains every field, UTMs, consent + timestamp", async () => {
    await post({ ...good, services: ["AI agents", "SEO"], service: "Hire engineers" }, undefined, { utm: { utm_source: "linkedin" } });
    const csv = leadsCsv(db.tables.leads as never, db.tables.lead_submissions as never, (s, k) => `https://g/${s}/${k}`);
    const head = csv.split("\r\n")[0];
    for (const k of ["full_name", "services", "budget", "project_details", "service", "form_type", "consent", "consent_at", "utm_source"]) expect(head).toContain(k);
    expect(csv).toContain("AI agents; SEO");
  });
});
