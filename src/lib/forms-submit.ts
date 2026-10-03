import "server-only";
import { createHash } from "crypto";
import { adminClient } from "./server/admin";
import { verifyCaptcha, captchaOn } from "./captcha";
import { fieldsOf, loadForm, settingsOf } from "./forms";
import { leadVars, personalize, textToHtml } from "./email/render";
import { notify, p, rows, sendTo } from "./notify";
import { siteOrigin } from "./data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

export type SubmitCtx = { ip?: string | null; ua?: string | null; page?: string | null; referrer?: string | null; utm?: Record<string, string>; captcha?: string | null };

/** Saves a website-form enquiry as a lead, alerts the team and sends the auto-reply. */
export async function submitForm(formId: string, data: Record<string, string>, ctx: SubmitCtx): Promise<{ ok: true; redirect?: string; success: { title: string; text: string } } | { ok: false; error: string; status?: number }> {
  const db = adminClient();
  if (!db) return { ok: false, error: "This form isn't available right now.", status: 503 };
  const loaded = await loadForm(db, formId);
  if (!loaded) return { ok: false, error: "Form not found.", status: 404 };
  const { form, business } = loaded;
  const s = settingsOf(form.settings, business.name);
  const success = { title: s.success_title, text: s.success_text };
  if (clip(data._gv_hp ?? data.website_hp, 200)) return { ok: true, success }; // bots fill hidden fields — pretend it worked

  if (captchaOn && s.captcha) {
    const v = await verifyCaptcha(ctx.captcha, ctx.ip);
    if (!v.ok) return { ok: false, error: v.error, status: 400 };
  }

  const ipHash = ctx.ip ? createHash("sha256").update(`gv:${ctx.ip}`).digest("hex").slice(0, 16) : null;
  if (ipHash) {
    const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("meta->>ip", ipHash).gt("created_at", new Date(Date.now() - 10 * 60000).toISOString());
    if ((count ?? 0) >= 5) return { ok: false, error: "Too many messages from this device — please try again in a few minutes.", status: 429 };
  }

  const fields = fieldsOf(form.fields);
  const val = (f: { id: string }) => clip(data[f.id], 2000);
  const missing = fields.find((f) => f.required && !val(f) && f.type !== "checkbox");
  if (missing) return { ok: false, error: `Please fill in “${missing.label}”.`, status: 400 };
  const get = (m: string) => { const f = fields.find((x) => x.maps === m); return f ? val(f) : ""; };
  const name = clip(get("name") || data.name, 120);
  if (!name) return { ok: false, error: "Please enter your name.", status: 400 };
  const email = clip(get("email") || data.email, 200).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "That email doesn't look right.", status: 400 };
  const phone = clip(get("phone") || data.phone, 40);
  const company = clip(get("company"), 120);
  const message = clip(get("message") || data.message, 2000);
  const extras = fields.filter((f) => f.maps === "custom" && val(f)).map((f) => `${f.label}: ${val(f)}`);
  const waOpt = fields.some((f) => f.maps === "wa_opt_in" && ["on", "true", "yes", "1"].includes(val(f).toLowerCase()));
  const notes = [message, ...extras].filter(Boolean).join("\n");
  const meta = { form_id: form.id, form: form.name, page: clip(ctx.page, 500) || null, referrer: clip(ctx.referrer, 500) || null, utm: ctx.utm ?? {}, ip: ipHash, ua: clip(ctx.ua, 200) || null };

  // Same email again → update that lead instead of creating a duplicate.
  const { data: existing } = email ? await db.from("leads").select("id, notes, tags").eq("business_id", business.id).ilike("email", email).limit(1).maybeSingle() : { data: null };
  let leadId: string;
  if (existing) {
    leadId = existing.id;
    await db.from("leads").update({ notes: [existing.notes, `— ${new Date().toISOString().slice(0, 10)} via ${form.name}:\n${notes}`].filter(Boolean).join("\n\n").slice(0, 8000), tags: [...new Set([...(existing.tags ?? []), s.tag].filter(Boolean))], ...(phone ? { phone } : {}), ...(waOpt ? { wa_opt_in: true } : {}) }).eq("id", existing.id);
  } else {
    const { data: lead, error } = await db.from("leads").insert({ owner_id: business.owner_id, business_id: business.id, name, email: email || null, phone: phone || null, company: company || null, source: "Website form", stage: "new", notes: notes || null, tags: s.tag ? [s.tag] : [], meta, form_id: form.id, wa_opt_in: waOpt }).select("id").single();
    if (error || !lead) return { ok: false, error: "Couldn't save your message — please try again.", status: 500 };
    leadId = lead.id;
  }
  await Promise.all([
    db.from("activity").insert({ owner_id: business.owner_id, business_id: business.id, agent: "Lead Finder", text: `New enquiry from ${name} via ${form.name}${meta.page ? ` (${new URL(meta.page).pathname})` : ""}.`, tag: "+1 lead" }),
    db.from("lead_forms").update({ submissions: (form.submissions ?? 0) + 1 }).eq("id", form.id),
  ]);

  const origin = siteOrigin();
  if (s.notify) {
    await notify({
      ownerId: business.owner_id, businessId: business.id, type: "new_lead", subject: `New lead: ${name} — ${business.name}`, title: `New enquiry from ${name}`,
      body: rows([["Name", name], ...(email ? [["Email", email] as [string, string]] : []), ...(phone ? [["Phone", phone] as [string, string]] : []), ...(company ? [["Company", company] as [string, string]] : []), ["Form", form.name], ...(meta.page ? [["Page", meta.page] as [string, string]] : []), ...(ctx.utm?.utm_source ? [["Campaign", [ctx.utm.utm_source, ctx.utm.utm_medium, ctx.utm.utm_campaign].filter(Boolean).join(" / ")] as [string, string]] : [])]) + (notes ? p(notes.replace(/</g, "&lt;").replace(/\n/g, "<br>")) : ""),
      cta: { label: "Open the lead", url: `${origin}/app/leads/${leadId}` },
    });
  }
  if (s.auto_reply.enabled && email) {
    const { data: owner } = await db.from("profiles").select("email").eq("id", business.owner_id).maybeSingle();
    const vars = leadVars({ name, company }, { business_name: business.name, city: business.city ?? "" });
    await sendTo({ ownerId: business.owner_id, businessId: business.id, type: "form_auto_reply", to: email, subject: personalize(s.auto_reply.subject, vars), title: personalize(s.auto_reply.subject, vars), body: textToHtml(personalize(s.auto_reply.body, vars)), replyTo: owner?.email ?? undefined, dedupe: `${form.id}:${email}:${new Date().toISOString().slice(0, 13)}` });
  }
  return { ok: true, success, redirect: /^https?:\/\//.test(s.redirect) ? s.redirect : undefined };
}
