import "server-only";
import { adminClient } from "./server/admin";
import { verifyCaptcha, captchaOn } from "./captcha";
import { loadForm, settingsOf, plainLabel, fillSubject, type FormField, type FormSettings } from "./forms";
import { validate, type FileInfo, type RawInput, type Values } from "./forms-validate";
import { fromGrowvia, hashIp, logBlock, originAllowed, rateLimited, serverKeyOk, tooFast } from "./forms-guard";
import { leadVars, personalize, textToHtml } from "./email/render";
import { notify, rows, sendTo } from "./notify";
import { siteOrigin } from "./data";
import { pushInApp } from "./inapp";
import { sendToLead } from "./email/engine";

export type UploadIn = { name: string; type: string; bytes: Uint8Array };
export type SubmitCtx = { req: Request; ip?: string | null; ua?: string | null; page?: string | null; referrer?: string | null; utm?: Record<string, string>; captcha?: string | null };
export type SubmitResult =
  | { ok: true; redirect?: string; success: { title: string; text: string }; leadId?: string }
  | { ok: false; error: string; status: number; fields?: Record<string, string> };

const clip = (s: unknown, n: number) => String(Array.isArray(s) ? s[0] : s ?? "").trim().slice(0, n);
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export const FILES_BUCKET = "form-uploads";

/** File signatures — the file name's extension alone is never trusted. */
export function sniff(b: Uint8Array): string | null {
  const eq = (sig: number[]) => sig.every((x, i) => b[i] === x);
  if (eq([0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (eq([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc";
  if (eq([0x50, 0x4b, 0x03, 0x04])) { const txt = new TextDecoder("latin1").decode(b.slice(0, 8000)); return txt.includes("word/") ? "docx" : "zip"; }
  if (eq([0x89, 0x50, 0x4e, 0x47])) return "png";
  if (eq([0xff, 0xd8, 0xff])) return "jpg";
  if (Array.from(b.slice(0, 512)).every((c) => c === 9 || c === 10 || c === 13 || c >= 32)) return "txt";
  return null;
}
const extOf = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? "").toLowerCase();

/** Saves a website-form enquiry: guards → validation → lead + timeline entry → alerts → auto-reply. */
export async function submitForm(formId: string, data: RawInput, uploads: Record<string, UploadIn>, ctx: SubmitCtx): Promise<SubmitResult> {
  const db = adminClient();
  if (!db) return { ok: false, error: "This form isn't available right now.", status: 503 };
  const loaded = await loadForm(db, formId);
  if (!loaded) return { ok: false, error: "Form not found.", status: 404 };
  const { form, business } = loaded;
  const s = settingsOf(form.settings, business.name);
  const fields = form.fields;
  const success = { title: s.success_title, text: s.success_text };
  const ipHash = hashIp(ctx.ip);
  const trusted = serverKeyOk(ctx.req, form); // the site's own backend, with the form's server key

  // 1. Who may post.
  if (!trusted && !originAllowed(ctx.req, s)) { await logBlock(db, form, "origin", ipHash, ctx.req.headers.get("origin") ?? ctx.req.headers.get("referer") ?? "no origin"); return { ok: false, error: "This website isn't allowed to send this form.", status: 403 }; }
  // 2. Bot trap (always on) — pretend it worked so bots don't learn.
  if (clip(data._gv_hp ?? data.website_hp, 200)) { await logBlock(db, form, "honeypot", ipHash); return { ok: true, success }; }
  // 3. Too fast to be a person (only when the embed sent its load time).
  if (!trusted && tooFast(clip(data._gv_t, 20), s)) { await logBlock(db, form, "too_fast", ipHash); return { ok: false, error: "That was very quick — please wait a second and send again.", status: 429 }; }
  // 4. Human check, where it can be shown (Growvia's hosted page and iframe).
  if (!trusted && s.captcha && captchaOn && fromGrowvia(ctx.req)) {
    const v = await verifyCaptcha(ctx.captcha, ctx.ip);
    if (!v.ok) { await logBlock(db, form, "captcha", ipHash); return { ok: false, error: v.error, status: 400 }; }
  }

  // 5. Validate every field (same rules as the browser).
  const fileInfo: Record<string, FileInfo | undefined> = {};
  for (const f of fields.filter((x) => x.type === "file")) { const u = uploads[f.key]; if (u && u.bytes.length) fileInfo[f.key] = { name: u.name, size: u.bytes.length, ext: sniff(u.bytes) ?? `unknown-${extOf(u.name)}` }; }
  const v = validate(fields, data, fileInfo);
  if (!v.ok) return { ok: false, error: v.error, status: 400, fields: v.fields };
  const values: Values = v.values;
  const role = (m: FormField["maps"]) => { const f = fields.find((x) => x.maps === m); const val = f ? values[f.key] : undefined; return Array.isArray(val) ? val.join("; ") : val ?? ""; };
  const name = clip(role("name") || data.name, 120);
  if (!name) { const k = fields.find((f) => f.maps === "name")?.key ?? "name"; return { ok: false, error: "Please enter your name.", status: 400, fields: { [k]: "Please enter your name." } }; }
  const email = clip(role("email"), 200).toLowerCase() || null;
  const phone = clip(role("phone"), 40) || null;
  const company = clip(role("company"), 120) || null;
  const message = clip(role("message"), 5000);

  // 6. Rate limits (per device and per email). Server-key posts come from one server, so only the email limit applies.
  const limited = await rateLimited(db, form.id, s, trusted ? null : ipHash, email);
  if (limited) { await logBlock(db, form, limited, ipHash, email ?? undefined); return { ok: false, error: "Too many messages — please try again in a few minutes.", status: 429 }; }

  // 7. Files → private storage (never public; the app hands out short-lived links).
  const stamp = Date.now().toString(36);
  const files: { key: string; name: string; path: string; size: number; type: string }[] = [];
  for (const f of fields.filter((x) => x.type === "file")) {
    const u = uploads[f.key], info = fileInfo[f.key];
    if (!u || !info) continue;
    const safe = u.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${business.id}/${form.id}/${stamp}-${f.key}-${safe}`;
    const { error } = await db.storage.from(FILES_BUCKET).upload(path, u.bytes, { contentType: u.type || "application/octet-stream", upsert: false });
    if (error) return { ok: false, error: "We couldn't save your file — please try again.", status: 500, fields: { [f.key]: "Upload failed — please try again." } };
    files.push({ key: f.key, name: u.name.slice(0, 120), path, size: u.bytes.length, type: info.ext });
  }

  // 8. What was submitted, kept as data (answers by key, with the labels shown at the time).
  const labels = Object.fromEntries(fields.map((f) => [f.key, plainLabel(f.label)]));
  const answers: Values = Object.fromEntries(fields.filter((f) => f.type !== "hidden" && f.type !== "file" && f.maps !== "consent" && values[f.key] !== undefined && values[f.key] !== "").map((f) => [f.key, values[f.key]]));
  const hidden: Values = Object.fromEntries(fields.filter((f) => f.type === "hidden" && values[f.key]).map((f) => [f.key, values[f.key]]));
  const consentField = fields.find((f) => f.maps === "consent");
  const consent = consentField ? { key: consentField.key, given: Boolean(values[consentField.key]), at: values[consentField.key] ? new Date().toISOString() : null, text: consentField.label } : null;
  const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, clip(ctx.utm?.[k], 200)]).filter(([, x]) => x));
  const page = clip(ctx.page, 500) || null, referrer = clip(ctx.referrer, 500) || null;
  const lines = fields.filter((f) => f.maps === "custom" && f.type !== "hidden" && f.type !== "file" && values[f.key]).map((f) => `${labels[f.key]}: ${Array.isArray(values[f.key]) ? (values[f.key] as string[]).join("; ") : values[f.key]}`);
  const notes = [message, ...lines].filter(Boolean).join("\n");
  const waOpt = fields.some((f) => f.maps === "wa_opt_in" && Boolean(values[f.key]));
  const meta = { form_id: form.id, form: form.name, page, referrer, utm, ip: ipHash, ua: clip(ctx.ua, 200) || null };

  // 9. Same email again → same lead (new timeline entry; earlier answers stay).
  const { data: existing } = email ? await db.from("leads").select("id, notes, tags, phone, company").eq("business_id", business.id).ilike("email", email).limit(1).maybeSingle() : { data: null };
  let leadId: string;
  if (existing) {
    leadId = existing.id;
    await db.from("leads").update({
      notes: [existing.notes, `— ${new Date().toISOString().slice(0, 10)} via ${form.name}:\n${notes}`].filter(Boolean).join("\n\n").slice(0, 8000),
      tags: [...new Set([...(existing.tags ?? []), ...s.tags])].slice(0, 20),
      ...(phone && !existing.phone ? { phone } : {}), ...(company && !existing.company ? { company } : {}), ...(waOpt ? { wa_opt_in: true } : {}),
    }).eq("id", existing.id);
  } else {
    const { data: lead, error } = await db.from("leads").insert({ owner_id: business.owner_id, business_id: business.id, name, email, phone, company, source: "Website form", stage: s.stage, notes: notes || null, tags: s.tags, meta, form_id: form.id, wa_opt_in: waOpt }).select("id").single();
    if (error || !lead) return { ok: false, error: "Couldn't save your message — please try again.", status: 500 };
    leadId = lead.id;
  }
  await db.from("lead_submissions").insert({ lead_id: leadId, form_id: form.id, owner_id: business.owner_id, business_id: business.id, form_name: form.name, email, answers, labels, consent, hidden, page, referrer, utm, files, ip_hash: trusted ? null : ipHash });

  await Promise.all([
    db.from("activity").insert({ owner_id: business.owner_id, business_id: business.id, agent: "Lead Finder", text: `New enquiry from ${name} via ${form.name}.`, tag: "+1 lead" }),
    db.from("lead_forms").update({ submissions: (form.submissions ?? 0) + 1 }).eq("id", form.id),
    pushInApp(db, business.owner_id, { kind: "lead", title: `New lead: ${name}`, body: `From your form “${form.name}”${business.name ? ` · ${business.name}` : ""}`, url: `/app/leads/${leadId}` }).catch(() => null),
  ]);

  // 10. Team alert with every answer.
  if (s.notify) await sendLeadAlert(s, business, form, leadId, { name, email, phone, company }, fields, values, files, page, utm, stamp).catch(() => null);

  // 11. Visitor auto-reply — only when switched on and written.
  if (s.auto_reply.enabled && email && s.auto_reply.subject.trim() && s.auto_reply.body.trim()) {
    const viaMailbox = s.auto_reply.mailbox_id ? await replyFromMailbox(s, business, leadId, { name, company }).catch(() => false) : false;
    if (!viaMailbox) await sendAutoReply(s, business, form.id, { name, company, email }).catch(() => null);
  }

  return { ok: true, success, leadId, redirect: /^https?:\/\//.test(s.redirect) ? s.redirect : undefined };
}


async function sendLeadAlert(s: FormSettings, business: { id: string; owner_id: string; name: string }, form: { id: string; name: string }, leadId: string, who: { name: string; email: string | null; phone: string | null; company: string | null }, fields: FormField[], values: Values, files: { key: string; name: string }[], page: string | null, utm: Record<string, string>, stamp: string) {
  const vars: Record<string, string> = { name: who.name, email: who.email ?? "", phone: who.phone ?? "", company: who.company ?? "", form: form.name, business: business.name };
  const subject = fillSubject(s.notify_subject, vars) || `New lead: ${who.name}`;
  const all: [string, string][] = [
    ...fields.filter((f) => f.type !== "file" && values[f.key] !== undefined && values[f.key] !== "").map((f) => [plainLabel(f.label), Array.isArray(values[f.key]) ? (values[f.key] as string[]).map((x) => `• ${x}`).join("<br>") : String(values[f.key])] as [string, string]),
    ...files.map((f) => [plainLabel(fields.find((x) => x.key === f.key)?.label ?? f.key), `${f.name} (download it from the lead in Growvia)`] as [string, string]),
    ["Form", form.name], ...(page ? [["Page", page] as [string, string]] : []), ...(Object.keys(utm).length ? [["Campaign", Object.entries(utm).map(([k, x]) => `${k.replace("utm_", "")}: ${x}`).join(" · ")] as [string, string]] : []),
  ];
  const body = rows(all);
  const cta = { label: "Open the lead", url: `${siteOrigin()}/app/leads/${leadId}` };
  if (s.notify_to.length) await Promise.all(s.notify_to.slice(0, 10).map((to) => sendTo({ ownerId: business.owner_id, businessId: business.id, type: "new_lead", to, subject, title: `New enquiry from ${who.name}`, body, cta, dedupe: `${leadId}:${to}:${stamp}` })));
  else await notify({ ownerId: business.owner_id, businessId: business.id, type: "new_lead", subject, title: `New enquiry from ${who.name}`, body, cta });
}

/** Used by submissions and by the builder's "send a test to myself". */
export async function sendAutoReply(s: FormSettings, business: { id: string; owner_id: string; name: string; city: string | null }, formId: string, to: { name: string; company?: string | null; email: string }, test = false) {
  const db = adminClient();
  const { data: owner } = db ? await db.from("profiles").select("email").eq("id", business.owner_id).maybeSingle() : { data: null };
  const vars = leadVars({ name: to.name, company: to.company ?? "" }, { business_name: business.name, city: business.city ?? "" });
  const fill = (t: string) => personalize(t.replace(/\{(\w+)\}/g, "{{$1}}").replace(/\{\{\{(\w+)\}\}\}/g, "{{$1}}"), vars);
  return sendTo({
    ownerId: business.owner_id, businessId: business.id, type: "form_auto_reply", to: to.email,
    subject: `${test ? "[Test] " : ""}${fill(s.auto_reply.subject)}`, title: fill(s.auto_reply.subject), body: textToHtml(fill(s.auto_reply.body)),
    replyTo: s.auto_reply.reply_to || owner?.email || undefined, fromName: s.auto_reply.from_name || business.name,
    dedupe: test ? undefined : `${formId}:${to.email}:${new Date().toISOString().slice(0, 13)}`,
  });
}

/** Short-lived download link for an uploaded file (files are never public). */
export async function signedFileUrl(path: string, seconds = 600) {
  const db = adminClient();
  if (!db) return null;
  const { data } = await db.storage.from(FILES_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Auto-reply from a connected mailbox (lands in the shared inbox thread). Falls back to Growvia email if it can't send. */
async function replyFromMailbox(s: FormSettings, business: { id: string; owner_id: string; name: string; city: string | null }, leadId: string, who: { name: string; company: string | null }): Promise<boolean> {
  const db = adminClient();
  if (!db) return false;
  const [{ data: mailbox }, { data: lead }] = await Promise.all([
    db.from("mailboxes").select("*").eq("id", s.auto_reply.mailbox_id).eq("owner_id", business.owner_id).maybeSingle(),
    db.from("leads").select("*").eq("id", leadId).maybeSingle(),
  ]);
  if (!mailbox || !lead) return false;
  const vars = leadVars({ name: who.name, company: who.company ?? "" }, { business_name: business.name, city: business.city ?? "" });
  const fill = (t: string) => personalize(t.replace(/\{(\w+)\}/g, "{{$1}}").replace(/\{\{\{(\w+)\}\}\}/g, "{{$1}}"), vars);
  const r = await sendToLead(db as never, { ownerId: business.owner_id, mailbox: mailbox as never, lead: lead as never, subject: fill(s.auto_reply.subject), body: fill(s.auto_reply.body), ctx: { siteUrl: siteOrigin(), businessName: business.name, city: business.city }, isReply: true });
  return Boolean((r as { ok?: boolean })?.ok);
}
