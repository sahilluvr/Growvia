"use server";
import { checkLimit } from "@/lib/billing/plan";
import { dbErr } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { DEFAULT_FIELDS, type FormField, type FormSettings } from "@/lib/forms";
import { aiReady, geminiJson } from "@/lib/ai/gemini";

type FormState = { ok?: boolean; error?: string; message?: string; id?: string } | undefined;

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  return { business, db: supabaseServer() };
}

export async function createFormAction(name = "Website form"): Promise<FormState> {
  const { business, db } = await me();
  const gate = await checkLimit(business.owner_id, "forms", 1, db);
  if (!gate.ok) return { error: `${gate.error} Your form still collects unlimited leads.` };
  const { data, error } = await db.from("lead_forms").insert({ owner_id: business.owner_id, business_id: business.id, name: name.slice(0, 80), fields: DEFAULT_FIELDS, settings: {} }).select("id").single();
  if (error || !data) return { error: dbErr(error, "Couldn't create the form.") };
  revalidatePath("/app/forms");
  return { ok: true, id: data.id };
}

const TYPES = ["text", "email", "tel", "textarea", "select", "checkbox"];
const MAPS = ["name", "email", "phone", "company", "message", "custom", "wa_opt_in"];

export async function saveFormAction(id: string, name: string, fields: FormField[], settings: Partial<FormSettings>): Promise<FormState> {
  const { db } = await me();
  const clean = fields.slice(0, 20).map((f, i) => ({
    id: String(f.id || `field_${i}`).replace(/[^a-z0-9_]/gi, "_").slice(0, 40), type: TYPES.includes(f.type) ? f.type : "text", label: String(f.label ?? "").slice(0, 120) || "Field",
    required: Boolean(f.required), maps: MAPS.includes(f.maps) ? f.maps : "custom", options: Array.isArray(f.options) ? f.options.map((o) => String(o).slice(0, 80)).filter(Boolean).slice(0, 20) : undefined, placeholder: f.placeholder ? String(f.placeholder).slice(0, 120) : undefined,
  })) as FormField[];
  if (!clean.some((f) => f.maps === "name")) return { error: "Keep a “Name” field — every lead needs a name." };
  if (new Set(clean.map((f) => f.id)).size !== clean.length) return { error: "Two fields have the same id." };
  if (settings.redirect && !/^https?:\/\//.test(settings.redirect)) return { error: "The thank-you page must start with https://" };
  if (settings.accent && !/^#[0-9a-f]{6}$/i.test(settings.accent)) return { error: "Pick a colour like #0B0D0C." };
  const s: Partial<FormSettings> = {
    title: settings.title?.slice(0, 120), intro: settings.intro?.slice(0, 400), button: settings.button?.slice(0, 40), success_title: settings.success_title?.slice(0, 120), success_text: settings.success_text?.slice(0, 300),
    redirect: settings.redirect?.slice(0, 500) ?? "", accent: settings.accent, tag: settings.tag?.slice(0, 40) ?? "", notify: settings.notify !== false, captcha: settings.captcha !== false, show_branding: settings.show_branding !== false,
    auto_reply: { enabled: settings.auto_reply?.enabled !== false, subject: (settings.auto_reply?.subject ?? "").slice(0, 200), body: (settings.auto_reply?.body ?? "").slice(0, 4000) },
  };
  const { error } = await db.from("lead_forms").update({ name: name.slice(0, 80) || "Website form", fields: clean, settings: s }).eq("id", id);
  revalidatePath("/app/forms");
  return error ? { error: dbErr(error) } : { ok: true, message: "Saved — your website form updates instantly." };
}

export async function deleteFormAction(id: string): Promise<FormState> {
  const { db } = await me();
  await db.from("lead_forms").delete().eq("id", id);
  revalidatePath("/app/forms");
  return { ok: true };
}

/** AI writes the form's texts and auto-reply in the brand's voice. */
export async function aiFormCopyAction(): Promise<{ title?: string; intro?: string; button?: string; success_title?: string; success_text?: string; subject?: string; body?: string; error?: string }> {
  const { business } = await me();
  if (!aiReady) return { error: "Add GEMINI_API_KEY in Vercel to use AI writing." };
  try {
    const { data } = await geminiJson<Record<string, string>>(`Write short, warm website contact-form copy for this business, in a ${business.voice ?? "Friendly"} voice. No invented facts.
BUSINESS: ${JSON.stringify({ name: business.name, type: business.segment, city: business.city, offer: business.offer, audience: business.audience })}
Return JSON: {"title":"form heading, max 8 words","intro":"1 sentence","button":"2-3 words","success_title":"max 6 words","success_text":"1 sentence","subject":"auto-reply email subject","body":"auto-reply email, 3 short paragraphs, starts with Hi {{first_name}},"}`, { temperature: 0.6 });
    return data;
  } catch (e) { return { error: e instanceof Error ? e.message : "AI failed" }; }
}
