/* Website lead forms — shared model (browser + server). Version 2.
 * A field's `key` is its permanent posted name (never tied to position or label). Legacy forms used `id` for
 * that; `normalizeFields` copies it into `key`, so every live embed keeps posting the same names. */

export type FieldType = "text" | "email" | "tel" | "url" | "textarea" | "select" | "radio" | "multiselect" | "checkbox" | "range" | "hidden" | "file";
export type FieldMaps = "name" | "email" | "phone" | "company" | "message" | "custom" | "wa_opt_in" | "consent";

export type FormField = {
  key: string;
  /** Legacy alias of `key` (old forms and code read `id`). Always equal to `key` after normalising. */
  id: string;
  /** Older posted names that are still accepted for this field (after a key was renamed). */
  aliases?: string[];
  type: FieldType;
  label: string;
  help?: string;
  placeholder?: string;
  required: boolean;
  maps: FieldMaps;
  options?: string[];
  default?: string;
  /** Text length (text-like fields) or number of choices (multiselect). */
  min?: number;
  max?: number;
  /** Custom error message shown when this field fails validation. */
  error?: string;
  /** Pre-fill from this URL parameter, e.g. "service" for ?service=… */
  param?: string;
  /** Checkbox: the value sent when ticked. */
  checked_value?: string;
  /** File: allowed extensions (e.g. ["pdf","doc","docx"]) and max size in MB. */
  accept?: string[];
  max_mb?: number;
};

export type SpamSettings = { ip_limit: number; email_limit: number; window_min: number; min_seconds: number };
export type AutoReply = { enabled: boolean; subject: string; body: string; from_name: string; reply_to: string; mailbox_id: string };
export type FormStyle = { radius: "square" | "rounded" | "pill"; font: "inherit" | "system"; theme: "light" | "dark" };

export type FormSettings = {
  version: 2;
  title: string; intro: string; button: string; success_title: string; success_text: string; error_text: string; redirect: string; accent: string;
  tags: string[]; stage: "new" | "contacted" | "qualified" | "won" | "lost";
  notify: boolean; notify_to: string[]; notify_subject: string;
  captcha: boolean; show_branding: boolean; custom_css: string;
  allowed_origins: string[];
  spam: SpamSettings;
  auto_reply: AutoReply;
  style: FormStyle;
  /** @deprecated v1 single tag — read only for upgrading. */
  tag?: string;
};
export type LeadFormRow = { id: string; owner_id: string; business_id: string; name: string; fields: FormField[]; settings: Partial<FormSettings>; submissions: number; created_at: string; server_key_hash?: string | null };

export const FIELD_TYPES: FieldType[] = ["text", "email", "tel", "url", "textarea", "select", "radio", "multiselect", "checkbox", "range", "hidden", "file"];
export const FIELD_MAPS: FieldMaps[] = ["name", "email", "phone", "company", "message", "custom", "wa_opt_in", "consent"];
export const STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;
export const SPAM_DEFAULTS: SpamSettings = { ip_limit: 5, email_limit: 3, window_min: 10, min_seconds: 3 };
export const FILE_TYPES = ["pdf", "doc", "docx", "png", "jpg", "jpeg", "txt"] as const;

export const DEFAULT_FIELDS: FormField[] = [
  { key: "name", id: "name", type: "text", label: "Your name", required: true, maps: "name" },
  { key: "email", id: "email", type: "email", label: "Email", required: true, maps: "email" },
  { key: "phone", id: "phone", type: "tel", label: "Phone", required: false, maps: "phone" },
  { key: "message", id: "message", type: "textarea", label: "How can we help?", required: false, maps: "message" },
];

/** "Work email (required)" → "work_email". Always a-z0-9_, starts with a letter, max 40. */
export function slugKey(label: string): string {
  const s = String(label ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return /^[a-z]/.test(s) ? s : `f_${s || "field"}`.slice(0, 40);
}
/** A key unique within `taken` (adds _2, _3 …). */
export function uniqueKey(base: string, taken: Iterable<string>): string {
  const t = new Set(taken); let k = slugKey(base), n = 2;
  while (t.has(k)) k = `${slugKey(base).slice(0, 36)}_${n++}`;
  return k;
}
const cleanKey = (k: unknown) => String(k ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);

/** Upgrade any stored field list (v1 or v2) to v2 without changing posted names. */
export function normalizeFields(raw: unknown): FormField[] {
  const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_FIELDS;
  const taken = new Set<string>();
  return (list as Record<string, unknown>[]).slice(0, 40).map((f) => {
    let key = cleanKey(f.key ?? f.id);
    if (!key || taken.has(key)) key = uniqueKey(String(f.label ?? "field"), taken);
    taken.add(key);
    const type = (FIELD_TYPES as string[]).includes(String(f.type)) ? (f.type as FieldType) : "text";
    const maps = (FIELD_MAPS as string[]).includes(String(f.maps)) ? (f.maps as FieldMaps) : "custom";
    const num = (v: unknown) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Math.round(Number(v))));
    const out: FormField = {
      key, id: key, type, maps,
      label: String(f.label ?? "").slice(0, 300) || "Field",
      required: Boolean(f.required),
      ...(Array.isArray(f.aliases) && f.aliases.length ? { aliases: [...new Set((f.aliases as unknown[]).map(cleanKey).filter((a) => a && a !== key))].slice(0, 5) } : {}),
      ...(f.help ? { help: String(f.help).slice(0, 300) } : {}),
      ...(f.placeholder ? { placeholder: String(f.placeholder).slice(0, 120) } : {}),
      ...(Array.isArray(f.options) ? { options: (f.options as unknown[]).map((o) => String(o).replace(/\s+/g, " ").trim().slice(0, 120)).filter(Boolean).slice(0, 30) } : {}),
      ...(f.default !== undefined && f.default !== "" ? { default: String(f.default).slice(0, 500) } : {}),
      ...(num(f.min) !== undefined ? { min: num(f.min) } : {}),
      ...(num(f.max) !== undefined ? { max: num(f.max) } : {}),
      ...(f.error ? { error: String(f.error).slice(0, 200) } : {}),
      ...(f.param ? { param: String(f.param).replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 40) } : {}),
      ...(type === "checkbox" ? { checked_value: String(f.checked_value ?? "yes").slice(0, 40) || "yes" } : {}),
      ...(type === "file" ? { accept: (Array.isArray(f.accept) && f.accept.length ? (f.accept as string[]) : ["pdf", "doc", "docx"]).map((x) => String(x).toLowerCase().replace(/^\./, "")).filter((x) => (FILE_TYPES as readonly string[]).includes(x)), max_mb: Math.min(25, Math.max(1, Number(f.max_mb) || 10)) } : {}),
    };
    return out;
  });
}

/** Upgrade stored settings (v1 or v2) to v2. Missing auto-reply on a *stored* form means "on" (that was the v1 default). */
export function normalizeSettings(s: Partial<FormSettings> | null | undefined, businessName: string, opts: { isNew?: boolean } = {}): FormSettings {
  const src = (s ?? {}) as Partial<FormSettings> & { tag?: string };
  const tags = Array.isArray(src.tags) ? src.tags : splitTags(src.tag ?? (src.version ? "" : "website"));
  const ar = (src.auto_reply ?? {}) as Partial<AutoReply>;
  const spam = { ...SPAM_DEFAULTS, ...(src.spam ?? {}) };
  return {
    version: 2,
    title: src.title ?? `Get in touch with ${businessName}`,
    intro: src.intro ?? "",
    button: src.button || "Send message",
    success_title: src.success_title || "Thanks — message sent!",
    success_text: src.success_text || `${businessName} will get back to you soon.`,
    error_text: src.error_text || "Something went wrong — please check the form and try again.",
    redirect: src.redirect ?? "",
    accent: /^#[0-9a-f]{6}$/i.test(src.accent ?? "") ? src.accent! : "#0B0D0C",
    tags,
    stage: (STAGES as readonly string[]).includes(String(src.stage)) ? src.stage! : "new",
    notify: src.notify !== false,
    notify_to: Array.isArray(src.notify_to) ? src.notify_to : [],
    notify_subject: src.notify_subject || "New lead: {name} – {form}",
    captcha: src.captcha === true,
    show_branding: src.show_branding === true,
    custom_css: src.custom_css ?? "",
    allowed_origins: Array.isArray(src.allowed_origins) ? src.allowed_origins : [],
    spam: { ip_limit: clampInt(spam.ip_limit, 1, 100), email_limit: clampInt(spam.email_limit, 1, 50), window_min: clampInt(spam.window_min, 1, 1440), min_seconds: clampInt(spam.min_seconds, 0, 60) },
    auto_reply: {
      enabled: opts.isNew ? false : ar.enabled ?? (src.version ? false : true),
      subject: ar.subject ?? `Thanks for contacting ${businessName}`,
      body: ar.body ?? `Hi {first_name},\n\nThanks for getting in touch with ${businessName} — we've got your message and will reply shortly.\n\nTalk soon,\n${businessName}`,
      from_name: ar.from_name ?? businessName,
      reply_to: ar.reply_to ?? "",
      mailbox_id: ar.mailbox_id ?? "",
    },
    style: { radius: (["square", "rounded", "pill"] as const).includes(src.style?.radius as never) ? src.style!.radius : "rounded", font: src.style?.font === "system" ? "system" : "inherit", theme: src.style?.theme === "dark" ? "dark" : "light" },
  };
}
const clampInt = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));

/** "redblink, website;  QA" → ["redblink","website","qa"] (lowercase, unique, max 10). */
export function splitTags(v: string | string[] | null | undefined): string[] {
  const parts = (Array.isArray(v) ? v : String(v ?? "").split(/[,;\n]/)).map((t) => String(t).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "").slice(0, 40)).filter(Boolean);
  return [...new Set(parts)].slice(0, 10);
}

/** Hosts from "https://www.acme.com/contact, acme.co.uk" → ["acme.com", "acme.co.uk"] (www stripped). */
export function normalizeOrigins(list: string[] | string): string[] {
  const arr = Array.isArray(list) ? list : String(list ?? "").split(/[\s,]+/);
  const hosts = arr.map((x) => { const t = String(x).trim(); if (!t) return ""; try { return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } }).filter((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || h === "localhost");
  return [...new Set(hosts)].slice(0, 20);
}

/** Safe mini-markdown for labels and consent text: only [text](https://url). Everything else is plain text. */
export type Seg = { t: string; href?: string };
export function linkSegments(text: string): Seg[] {
  const out: Seg[] = []; const re = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]{1,500})\)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (m.index > last) out.push({ t: text.slice(last, m.index) }); out.push({ t: m[1], href: m[2] }); last = m.index + m[0].length; }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
export const plainLabel = (text: string) => linkSegments(text).map((s) => s.t).join("");

/** "New lead: {name} – {company} ({form})" with unknown/empty variables tidied away. */
export function fillSubject(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "").replace(/\(\s*\)/g, "").replace(/\s+[–—-]\s*(?=$|\()/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200);
}
