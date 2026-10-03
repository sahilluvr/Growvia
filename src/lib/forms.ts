import type { SupabaseClient } from "@supabase/supabase-js";

/* Website lead forms: shared by the builder, the public/embedded form and the submit API. */

export type FormField = { id: string; type: "text" | "email" | "tel" | "textarea" | "select" | "checkbox"; label: string; required: boolean; maps: "name" | "email" | "phone" | "company" | "message" | "custom" | "wa_opt_in"; options?: string[]; placeholder?: string };
export type FormSettings = {
  title: string; intro: string; button: string; success_title: string; success_text: string; redirect: string; accent: string;
  tag: string; notify: boolean; captcha: boolean; show_branding: boolean;
  auto_reply: { enabled: boolean; subject: string; body: string };
};
export type LeadFormRow = { id: string; owner_id: string; business_id: string; name: string; fields: FormField[]; settings: Partial<FormSettings>; submissions: number; created_at: string };

export const DEFAULT_FIELDS: FormField[] = [
  { id: "name", type: "text", label: "Your name", required: true, maps: "name", placeholder: "" },
  { id: "email", type: "email", label: "Email", required: false, maps: "email" },
  { id: "phone", type: "tel", label: "Phone", required: false, maps: "phone" },
  { id: "message", type: "textarea", label: "How can we help?", required: false, maps: "message" },
];

export function settingsOf(s: Partial<FormSettings> | null | undefined, businessName: string): FormSettings {
  return {
    title: `Get in touch with ${businessName}`, intro: "", button: "Send message", success_title: "Thanks — message sent!", success_text: `${businessName} will get back to you soon.`,
    redirect: "", accent: "#0B0D0C", tag: "website", notify: true, captcha: true, show_branding: true,
    ...(s ?? {}),
    auto_reply: { enabled: true, subject: `Thanks for contacting ${businessName}`, body: `Hi {{first_name}},\n\nThanks for getting in touch with ${businessName} — we've got your message and will reply shortly.\n\nTalk soon,\n${businessName}`, ...(s?.auto_reply ?? {}) },
  };
}
export const fieldsOf = (f: FormField[] | null | undefined) => (Array.isArray(f) && f.length ? f : DEFAULT_FIELDS);

/** Finds a form by its id — or, for older links, by the project id (its first form, created if needed). */
export async function loadForm(db: SupabaseClient, id: string): Promise<{ form: LeadFormRow; business: { id: string; owner_id: string; name: string; segment: string; city: string | null; offer: string | null } } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let { data: form } = await db.from("lead_forms").select("*").eq("id", id).maybeSingle();
  if (!form) {
    const { data: biz } = await db.from("businesses").select("id, owner_id").eq("id", id).maybeSingle();
    if (!biz) return null;
    ({ data: form } = await db.from("lead_forms").select("*").eq("business_id", biz.id).order("created_at").limit(1).maybeSingle());
    if (!form) ({ data: form } = await db.from("lead_forms").insert({ owner_id: biz.owner_id, business_id: biz.id, name: "Website form", fields: DEFAULT_FIELDS, settings: {} }).select("*").single());
  }
  if (!form) return null;
  const { data: business } = await db.from("businesses").select("id, owner_id, name, segment, city, offer").eq("id", form.business_id).maybeSingle();
  return business ? { form: form as LeadFormRow, business } : null;
}
