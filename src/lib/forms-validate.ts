import { plainLabel, type FormField } from "./forms-model";

/* One validator for the API, the hosted/iframe form, the builder preview and tests. */

export type RawInput = Record<string, string | string[] | undefined>;
export type Values = Record<string, string | string[]>;
export type FileInfo = { name: string; size: number; ext: string };
export type Result = { ok: true; values: Values } | { ok: false; error: string; fields: Record<string, string> };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s().\-]{6,25}$/;
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;
const TEXT_MAX: Partial<Record<FormField["type"], number>> = { text: 300, email: 200, tel: 40, url: 500, textarea: 5000, hidden: 500, select: 200, radio: 200, range: 200 };

/** Reads a field's value from the posted data, accepting its key and any older aliases. */
export function readRaw(f: FormField, data: RawInput): string | string[] | undefined {
  for (const k of [f.key, ...(f.aliases ?? [])]) {
    const v = data[k] ?? data[`${k}[]`];
    if (v !== undefined && v !== null && !(typeof v === "string" && v === "" && k !== f.key)) return v;
  }
  return undefined;
}

export function validate(fields: FormField[], data: RawInput, files: Record<string, FileInfo | undefined> = {}): Result {
  const errors: Record<string, string> = {};
  const values: Values = {};
  const name = (f: FormField) => plainLabel(f.label) || f.key;
  const fail = (f: FormField, msg: string) => { errors[f.key] = f.error || msg; };

  for (const f of fields) {
    let raw = readRaw(f, data);
    // Hidden values and sliders always carry a value: their default when nothing was posted (e.g. server-to-server).
    if ((raw === undefined || raw === "") && f.default && (f.type === "hidden" || f.type === "range")) raw = f.default;
    if (f.type === "file") {
      const file = files[f.key];
      if (!file) { if (f.required) fail(f, `Please attach “${name(f)}”.`); continue; }
      const accept = f.accept?.length ? f.accept : ["pdf", "doc", "docx"];
      if (!accept.includes(file.ext)) { fail(f, `“${name(f)}” must be a ${accept.map((a) => a.toUpperCase()).join(", ")} file.`); continue; }
      if (file.size > (f.max_mb ?? 10) * 1024 * 1024) { fail(f, `“${name(f)}” is too big — the limit is ${f.max_mb ?? 10} MB.`); continue; }
      continue;
    }
    if (f.type === "multiselect") {
      const arr = (Array.isArray(raw) ? raw : typeof raw === "string" && raw ? raw.split(/\s*;\s*|\s*\n\s*/) : []).map((x) => String(x).trim()).filter(Boolean);
      const uniq = [...new Set(arr)];
      if (uniq.some((x) => !(f.options ?? []).includes(x))) { fail(f, `Please choose from the options for “${name(f)}”.`); continue; }
      if (f.required && !uniq.length) { fail(f, `Please choose at least one option for “${name(f)}”.`); continue; }
      if (uniq.length && f.min && uniq.length < f.min) { fail(f, `Please choose at least ${f.min} options for “${name(f)}”.`); continue; }
      if (f.max && uniq.length > f.max) { fail(f, `Please choose at most ${f.max} options for “${name(f)}”.`); continue; }
      if (uniq.length) values[f.key] = uniq;
      continue;
    }
    const v = (Array.isArray(raw) ? raw[0] : raw ?? "").toString().trim();
    if (f.type === "checkbox") {
      const on = ["on", "true", "yes", "1", (f.checked_value ?? "yes").toLowerCase()].includes(v.toLowerCase());
      if (f.required && !on) { fail(f, f.maps === "consent" ? "Please tick the box to agree before sending." : `Please tick “${name(f)}”.`); continue; }
      values[f.key] = on ? f.checked_value ?? "yes" : "";
      continue;
    }
    if (!v) { if (f.required) fail(f, f.type === "select" || f.type === "radio" || f.type === "range" ? `Please choose “${name(f)}”.` : `Please fill in “${name(f)}”.`); continue; }
    const max = Math.min(f.max ?? Infinity, TEXT_MAX[f.type] ?? 2000);
    if (v.length > max) { fail(f, `“${name(f)}” is too long (max ${max} characters).`); continue; }
    if (f.min && ["text", "textarea", "email", "tel", "url"].includes(f.type) && v.length < f.min) { fail(f, `“${name(f)}” needs at least ${f.min} characters.`); continue; }
    if (f.type === "email" && !EMAIL_RE.test(v)) { fail(f, "That email doesn't look right."); continue; }
    if (f.type === "tel" && !PHONE_RE.test(v)) { fail(f, "That phone number doesn't look right."); continue; }
    if (f.type === "url" && !URL_RE.test(/^https?:\/\//i.test(v) ? v : `https://${v}`)) { fail(f, "That web address doesn't look right."); continue; }
    if ((f.type === "select" || f.type === "radio" || f.type === "range") && !(f.options ?? []).includes(v)) { fail(f, `Please choose a valid option for “${name(f)}”.`); continue; }
    values[f.key] = f.type === "url" && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
  }

  const keys = Object.keys(errors);
  if (keys.length) {
    const first = fields.find((f) => f.key === keys[0]);
    return { ok: false, error: keys.length === 1 ? errors[keys[0]] : `Please fix ${keys.length} fields${first ? ` (starting with “${plainLabel(first.label)}”)` : ""}.`, fields: errors };
  }
  return { ok: true, values };
}

/** Value from the page URL for a field that opted in (?service=…). */
export function prefillFrom(fields: FormField[], search: string): Record<string, string | string[]> {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: Record<string, string | string[]> = {};
  for (const f of fields) {
    if (!f.param) continue;
    const vals = q.getAll(f.param).map((x) => x.trim()).filter(Boolean);
    if (!vals.length) continue;
    out[f.key] = f.type === "multiselect" ? vals.flatMap((x) => x.split(/\s*;\s*|\s*,\s*/)).filter((x) => (f.options ?? []).includes(x)) : vals[0].slice(0, 2000);
  }
  return out;
}
