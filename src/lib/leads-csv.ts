/* CSV for leads + their form submissions: base columns, one column per field key, UTMs, consent, files. */
export type SubRow = { lead_id: string; form_name: string | null; answers: Record<string, string | string[]>; labels: Record<string, string>; consent: { given: boolean; at: string | null; text: string } | null; hidden: Record<string, string | string[]>; page: string | null; referrer: string | null; utm: Record<string, string>; files: { key: string; name: string }[]; id: string; created_at: string };
export type LeadRowCsv = { id: string; name: string; email: string | null; phone: string | null; company: string | null; source: string; stage: string; value: number; tags: string[] | null; created_at: string };

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const cell = (v: unknown) => { const s = Array.isArray(v) ? v.join("; ") : v === null || v === undefined ? "" : String(v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s; };

export function leadsCsv(leads: LeadRowCsv[], subs: SubRow[], fileLink: (subId: string, key: string) => string): string {
  const latest = new Map<string, SubRow>();
  for (const s of subs) { const cur = latest.get(s.lead_id); if (!cur || cur.created_at < s.created_at) latest.set(s.lead_id, s); }
  const keys = new Set<string>(), hiddenKeys = new Set<string>(), fileKeys = new Set<string>();
  for (const s of latest.values()) { Object.keys(s.answers ?? {}).forEach((k) => keys.add(k)); Object.keys(s.hidden ?? {}).forEach((k) => hiddenKeys.add(k)); (s.files ?? []).forEach((f) => fileKeys.add(f.key)); }
  const ak = [...keys], hk = [...hiddenKeys].filter((k) => !keys.has(k)), fk = [...fileKeys];
  const head = ["name", "email", "phone", "company", "source", "stage", "value", "tags", "created_at", "form", ...ak, ...hk, ...fk.map((k) => `${k} (file)`), "consent", "consent_at", "page", "referrer", ...UTM];
  const lines = [head.map(cell).join(",")];
  for (const l of leads) {
    const s = latest.get(l.id);
    lines.push([
      l.name, l.email, l.phone, l.company, l.source, l.stage, l.value, (l.tags ?? []).join("; "), l.created_at, s?.form_name ?? "",
      ...ak.map((k) => s?.answers?.[k] ?? ""), ...hk.map((k) => s?.hidden?.[k] ?? ""),
      ...fk.map((k) => (s?.files ?? []).some((f) => f.key === k) ? fileLink(s!.id, k) : ""),
      s?.consent ? (s.consent.given ? "yes" : "no") : "", s?.consent?.at ?? "", s?.page ?? "", s?.referrer ?? "", ...UTM.map((k) => s?.utm?.[k] ?? ""),
    ].map(cell).join(","));
  }
  return lines.join("\r\n");
}
