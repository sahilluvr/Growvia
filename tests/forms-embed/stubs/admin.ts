const form = { id: "b29370d3-a621-4f73-96a9-745ccc15a2df", owner_id: "o", business_id: "b", name: "Website form", submissions: 0, created_at: "",
  fields: [{ id: "name", type: "text", label: "Your name", required: true, maps: "name" }, { id: "email", type: "email", label: "Email", required: true, maps: "email" },
    { id: "field_4", type: "select", label: "Service interested in", required: true, maps: "custom", options: ["SEO", "Ads & Social"] }, { id: "message", type: "textarea", label: "How can we help?", required: true, maps: "message" }],
  settings: { button: "GET STARTED", captcha: true } };
const chain: any = (rows: any) => new Proxy({}, { get: (_t, k) => k === "maybeSingle" || k === "single" ? async () => ({ data: rows }) : k === "then" ? undefined : () => chain(rows) });
export const adminClient = () => ({ from: (t: string) => chain(t === "lead_forms" ? form : t === "businesses" ? { id: "b", owner_id: "o", name: "RedBlink" } : null) });
