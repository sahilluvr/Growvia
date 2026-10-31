import { describe, expect, it, vi } from "vitest";
import { normalizeFields, normalizeSettings, splitTags, normalizeOrigins, linkSegments, slugKey, uniqueKey, type FormField } from "@/lib/forms-model";
import { validate, prefillFrom } from "@/lib/forms-validate";
import { leadsCsv } from "@/lib/leads-csv";

vi.mock("@/lib/data", () => ({ siteOrigin: () => "https://usegrowvia.com" }));

// The acceptance form ("QA – Contact").
const QA: FormField[] = normalizeFields([
  { key: "full_name", type: "text", label: "Full name", required: true, maps: "name" },
  { key: "work_email", type: "email", label: "Work email", required: true, maps: "email" },
  { key: "company", type: "text", label: "Company", required: false, maps: "company" },
  { key: "phone", type: "tel", label: "Phone", required: false, maps: "phone" },
  { key: "services", type: "multiselect", label: "Services", required: false, maps: "custom", options: ["AI agents", "Web development", "SEO"] },
  { key: "budget", type: "range", label: "Budget", required: false, maps: "custom", options: ["Under $25k", "$25k–$50k", "$50k–$100k"], default: "$25k–$50k" },
  { key: "project_details", type: "textarea", label: "Project details", required: true, maps: "message", min: 10, error: "Tell us a bit more (10+ characters)" },
  { key: "consent", type: "checkbox", label: "I agree to the [privacy policy](https://acme.com/privacy)", required: true, maps: "consent", checked_value: "yes" },
  { key: "website", type: "url", label: "Website", required: false, maps: "custom" },
  { key: "cv", type: "file", label: "CV", required: false, maps: "custom", accept: ["pdf"], max_mb: 10 },
  { key: "form_type", type: "hidden", label: "Form type", required: false, maps: "custom", default: "contact" },
  { key: "service", type: "hidden", label: "Service", required: false, maps: "custom", param: "service" },
]);
const ok = { full_name: "Alex Carter", work_email: "alex@carter.com", project_details: "We need an AI support agent", consent: "yes" };

describe("validation (P0.1, P1.4)", () => {
  it("rejects an unticked required consent with a per-field error", () => {
    const r = validate(QA, { ...ok, consent: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields.consent).toMatch(/tick the box/);
  });
  it("uses the custom error text for min length", () => {
    const r = validate(QA, { ...ok, project_details: "hello" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields.project_details).toBe("Tell us a bit more (10+ characters)");
  });
  it("checks email, phone, URL formats and option values", () => {
    const r = validate(QA, { ...ok, work_email: "nope", phone: "abc", website: "not a url", budget: "Lots" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["budget", "phone", "website", "work_email"]);
  });
  it("stores multi-select as an array and rejects unknown options", () => {
    const good = validate(QA, { ...ok, services: ["AI agents", "SEO"] });
    expect(good.ok && good.values.services).toEqual(["AI agents", "SEO"]);
    const bad = validate(QA, { ...ok, services: ["AI agents", "Crypto"] });
    expect(bad.ok).toBe(false);
  });
  it("checks file type (by sniffed type) and size", () => {
    expect(validate(QA, ok, { cv: { name: "cv.pdf", size: 1000, ext: "pdf" } }).ok).toBe(true);
    expect(validate(QA, ok, { cv: { name: "cv.pdf", size: 1000, ext: "docx" } }).ok).toBe(false);
    expect(validate(QA, ok, { cv: { name: "cv.pdf", size: 11 * 1024 * 1024, ext: "pdf" } }).ok).toBe(false);
  });
  it("accepts a fully valid submission", () => { expect(validate(QA, { ...ok, services: ["SEO"], budget: "$25k–$50k", website: "acme.com" }).ok).toBe(true); });
});

describe("stable keys (P0.2)", () => {
  it("legacy forms keep their posted names as keys", () => {
    const legacy = normalizeFields([{ id: "phone", type: "text", label: "Company", required: false, maps: "company" }, { id: "field_5", type: "text", label: "Budget", required: false, maps: "custom" }]);
    expect(legacy.map((f) => f.key)).toEqual(["phone", "field_5"]);
  });
  it("relabel and reorder never change keys; aliases keep old names working", () => {
    const moved = normalizeFields([...QA].reverse().map((f) => ({ ...f, label: `${f.label} (renamed)` })));
    expect(moved.map((f) => f.key).sort()).toEqual(QA.map((f) => f.key).sort());
    const renamed = normalizeFields([{ key: "company_name", aliases: ["phone"], type: "text", label: "Company", required: true, maps: "company" }, { key: "name", type: "text", label: "Name", required: true, maps: "name" }]);
    const r = validate(renamed, { phone: "Acme Inc", name: "A" });
    expect(r.ok && r.values.company_name).toBe("Acme Inc");
  });
  it("new keys are slugs of the label and unique", () => {
    expect(slugKey("Work email (required)")).toBe("work_email_required");
    expect(uniqueKey("Company", ["company"])).toBe("company_2");
  });
});

describe("settings, tags, origins, links", () => {
  it("auto-reply is OFF for new forms, kept ON for untouched legacy forms (P0.5)", () => {
    expect(normalizeSettings({}, "Acme", { isNew: true }).auto_reply.enabled).toBe(false);
    expect(normalizeSettings({}, "Acme").auto_reply.enabled).toBe(true); // v1 default, preserved
    expect(normalizeSettings({ version: 2 } as never, "Acme").auto_reply.enabled).toBe(false);
  });
  it("splits comma tags into separate tags (P1.10)", () => {
    expect(splitTags("redblink, website")).toEqual(["redblink", "website"]);
    expect(normalizeSettings({ tag: "redblink, website" } as never, "Acme").tags).toEqual(["redblink", "website"]);
  });
  it("normalises allowed websites", () => { expect(normalizeOrigins("https://www.acme.com/contact, acme.co.uk junk")).toEqual(["acme.com", "acme.co.uk"]); });
  it("only [text](https://url) becomes a link — no HTML", () => {
    const s = linkSegments('Agree to the [privacy policy](https://acme.com/p) <script>x</script> [bad](javascript:alert(1))');
    expect(s.filter((x) => x.href).map((x) => x.href)).toEqual(["https://acme.com/p"]);
    expect(s.map((x) => x.t).join("")).toContain("<script>x</script>"); // rendered as text by React, never HTML
  });
  it("pre-fills from URL parameters (P1.3)", () => { expect(prefillFrom(QA, "?service=Hire%20engineers&x=1")).toEqual({ service: "Hire engineers" }); });
});

describe("CSV (P1.15)", () => {
  it("has one column per key, joins multi-select, includes UTMs, consent and file links", () => {
    const csv = leadsCsv(
      [{ id: "L1", name: "Alex", email: "a@x.com", phone: null, company: "Acme", source: "Website form", stage: "new", value: 0, tags: ["qa", "website"], created_at: "2026-10-12" }],
      [{ id: "S1", lead_id: "L1", form_name: "QA – Contact", answers: { services: ["AI agents", "SEO"], budget: "$25k–$50k" }, labels: {}, consent: { given: true, at: "2026-10-12T10:00:00Z", text: "I agree" }, hidden: { form_type: "contact", service: "Hire engineers" }, page: "https://acme.com/c", referrer: null, utm: { utm_source: "linkedin", utm_campaign: "qa" }, files: [{ key: "cv", name: "cv.pdf" }], created_at: "2026-10-12" }],
      (s, k) => `https://g/f?sub=${s}&key=${k}`,
    );
    const [head, row] = csv.split("\r\n");
    expect(head).toContain("services"); expect(head).toContain("form_type"); expect(head).toContain("cv (file)"); expect(head).toContain("consent_at"); expect(head).toContain("utm_source");
    expect(row).toContain("AI agents; SEO"); expect(row).toContain("linkedin"); expect(row).toContain("2026-10-12T10:00:00Z"); expect(row).toContain("https://g/f?sub=S1&key=cv"); expect(row).toContain("qa; website");
  });
});
