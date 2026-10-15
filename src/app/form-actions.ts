"use server";
import { checkLimit } from "@/lib/billing/plan";
import { dbErr } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { DEFAULT_FIELDS, type FormField, type FormSettings, cleanCss, normalizeFields, normalizeSettings, normalizeOrigins, splitTags, plainLabel } from "@/lib/forms";
import { EMAIL_RE } from "@/lib/forms-validate";
import { hashKey, newServerKey } from "@/lib/forms-guard";
import { sendAutoReply } from "@/lib/forms-submit";
import { aiReady, geminiJson } from "@/lib/ai/gemini";

type FormState = { ok?: boolean; error?: string; message?: string; id?: string } | undefined;

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  return { business, db: supabaseServer() };
}

export async function createFormAction(name = "Untitled form"): Promise<FormState> {
  const { business, db } = await me();
  const gate = await checkLimit(business.owner_id, "forms", 1, db);
  if (!gate.ok) return { error: `${gate.error} Your form still collects unlimited leads.` };
  const nm = String(name ?? "").trim().slice(0, 80) || "Untitled form";
  const settings = { ...normalizeSettings({}, business.name, { isNew: true }), title: nm };
  const { data, error } = await db.from("lead_forms").insert({ owner_id: business.owner_id, business_id: business.id, name: nm, fields: DEFAULT_FIELDS, settings }).select("id").single();
  if (error || !data) return { error: dbErr(error, "Couldn't create the form.") };
  revalidatePath("/app/forms");
  return { ok: true, id: data.id };
}

/** Copies fields, settings, texts, tags and notifications. New id; no server key (generate a new one). */
export async function duplicateFormAction(id: string): Promise<FormState> {
  const { business, db } = await me();
  const gate = await checkLimit(business.owner_id, "forms", 1, db);
  if (!gate.ok) return { error: gate.error };
  const { data: src } = await db.from("lead_forms").select("name, fields, settings").eq("id", id).maybeSingle();
  if (!src) return { error: "Form not found." };
  const { data, error } = await db.from("lead_forms").insert({ owner_id: business.owner_id, business_id: business.id, name: `${src.name} (copy)`.slice(0, 80), fields: src.fields, settings: src.settings }).select("id").single();
  if (error || !data) return { error: dbErr(error, "Couldn't duplicate the form.") };
  revalidatePath("/app/forms");
  return { ok: true, id: data.id, message: "Form duplicated." };
}

/** Server-side rules for a form definition (the builder shows the same messages). */
export async function checkDefinition(fields: FormField[], s: FormSettings): Promise<string | null> {
  if (!fields.some((f) => f.maps === "name")) return "Keep a “Name” field — every lead needs a name.";
  if (fields.filter((f) => f.maps === "email").length > 1) return "Only one field can save as the lead's email.";
  const keys = fields.flatMap((f) => [f.key, ...(f.aliases ?? [])]);
  if (new Set(keys).size !== keys.length) return "Two fields use the same key — keys must be unique.";
  for (const f of fields) {
    if (["select", "radio", "multiselect", "range"].includes(f.type) && !(f.options ?? []).length) return `Add the choices for “${plainLabel(f.label)}” (one per line).`;
    if (f.default && ["select", "radio", "range"].includes(f.type) && !(f.options ?? []).includes(f.default)) return `The default for “${plainLabel(f.label)}” must be one of its choices.`;
    if (f.min !== undefined && f.max !== undefined && f.min > f.max) return `“${plainLabel(f.label)}”: the minimum is bigger than the maximum.`;
    if (f.type === "file" && !(f.accept ?? []).length) return `Choose the allowed file types for “${plainLabel(f.label)}”.`;
  }
  if (s.redirect && !/^https?:\/\//.test(s.redirect)) return "The thank-you page must start with https://";
  if (s.auto_reply.enabled && (!s.auto_reply.subject.trim() || !s.auto_reply.body.trim())) return "Write the auto-reply subject and message before switching it on.";
  if (s.auto_reply.reply_to && !EMAIL_RE.test(s.auto_reply.reply_to)) return "The reply-to address doesn't look right.";
  const bad = s.notify_to.find((e) => !EMAIL_RE.test(e));
  if (bad) return `“${bad}” isn't a valid email address for alerts.`;
  return null;
}

export async function saveFormAction(id: string, name: string, fields: FormField[], settings: Partial<FormSettings>): Promise<FormState> {
  const { db, business } = await me();
  const { data: cur } = await db.from("lead_forms").select("fields, settings").eq("id", id).maybeSingle();
  if (!cur) return { error: "Form not found." };
  // Keys never change silently: a renamed key keeps its old name as an alias so live embeds keep working.
  const before = normalizeFields(cur.fields);
  const clean = normalizeFields(fields.slice(0, 40)).map((f) => {
    const old = before.find((b) => b.key === f.key || (f.aliases ?? []).includes(b.key));
    const prevKeys = old && old.key !== f.key ? [old.key, ...(old.aliases ?? [])] : old?.aliases ?? [];
    const aliases = [...new Set([...(f.aliases ?? []), ...prevKeys])].filter((a) => a !== f.key).slice(0, 5);
    return aliases.length ? { ...f, aliases } : { ...f, aliases: undefined };
  });
  const prev = normalizeSettings(cur.settings, business.name);
  const s = normalizeSettings({ ...prev, ...settings, version: 2, tags: splitTags(settings.tags ?? prev.tags), allowed_origins: normalizeOrigins(settings.allowed_origins ?? prev.allowed_origins), notify_to: (settings.notify_to ?? prev.notify_to).map((e) => String(e).trim().toLowerCase()).filter(Boolean).slice(0, 10), custom_css: cleanCss(settings.custom_css ?? prev.custom_css) }, business.name);
  const err = await checkDefinition(clean, s);
  if (err) return { error: err };
  const { error } = await db.from("lead_forms").update({ name: name.trim().slice(0, 80) || "Untitled form", fields: clean, settings: s }).eq("id", id);
  revalidatePath("/app/forms");
  return error ? { error: dbErr(error) } : { ok: true, message: "Saved — your website form updates instantly." };
}

export async function deleteFormAction(id: string): Promise<FormState> {
  const { db } = await me();
  await db.from("lead_forms").delete().eq("id", id);
  revalidatePath("/app/forms");
  return { ok: true };
}

/** New server key (shown once — only its hash is stored). Old key stops working immediately. */
export async function regenerateServerKeyAction(id: string): Promise<FormState & { key?: string }> {
  const { db } = await me();
  const key = newServerKey();
  const { error } = await db.from("lead_forms").update({ server_key_hash: hashKey(key) }).eq("id", id);
  return error ? { error: dbErr(error) } : { ok: true, key, message: "Copy this key now — it won't be shown again." };
}
export async function removeServerKeyAction(id: string): Promise<FormState> {
  const { db } = await me();
  const { error } = await db.from("lead_forms").update({ server_key_hash: null }).eq("id", id);
  return error ? { error: dbErr(error) } : { ok: true, message: "Server key removed." };
}

/** Sends the auto-reply (as currently written in the builder) to the signed-in user. */
export async function testAutoReplyAction(id: string, settings: Partial<FormSettings>): Promise<FormState> {
  const r = repo();
  const user = await r.getUser();
  if (!user) redirect("/login");
  const { business, db } = await me();
  const { data: cur } = await db.from("lead_forms").select("settings").eq("id", id).maybeSingle();
  const s = normalizeSettings({ ...(cur?.settings ?? {}), ...settings, version: 2 }, business.name);
  if (!s.auto_reply.subject.trim() || !s.auto_reply.body.trim()) return { error: "Write the subject and message first." };
  const res = await sendAutoReply(s, { id: business.id, owner_id: business.owner_id, name: business.name, city: business.city ?? null }, id, { name: user.name || "Test", email: user.email }, true);
  return res && (res as { ok?: boolean }).ok === false ? { error: "The test didn't send — check email sending in Settings." } : { ok: true, message: `Test sent to ${user.email}.` };
}

/** AI writes the form's texts and auto-reply in the brand's voice. */
export async function aiFormCopyAction(): Promise<{ title?: string; intro?: string; button?: string; success_title?: string; success_text?: string; subject?: string; body?: string; error?: string }> {
  const { business } = await me();
  if (!aiReady) return { error: "Add GEMINI_API_KEY in the server's environment variables to use AI writing." };
  try {
    const { data } = await geminiJson<Record<string, string>>(`Write short, warm website contact-form copy for this business, in a ${business.voice ?? "Friendly"} voice. No invented facts.
BUSINESS: ${JSON.stringify({ name: business.name, type: business.segment, city: business.city, offer: business.offer, audience: business.audience })}
Return JSON: {"title":"form heading, max 8 words","intro":"1 sentence","button":"2-3 words","success_title":"max 6 words","success_text":"1 sentence","subject":"auto-reply email subject","body":"auto-reply email, 3 short paragraphs, starts with Hi {{first_name}},"}`, { temperature: 0.6 });
    return data;
  } catch (e) { return { error: e instanceof Error ? e.message : "AI failed" }; }
}
