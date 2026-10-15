import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_FIELDS, normalizeFields, normalizeSettings, type FormField, type FormSettings, type LeadFormRow } from "./forms-model";

/* Website lead forms (server/data side). The model lives in forms-model.ts so the browser can share it. */
export * from "./forms-model";

/** v2 settings for a stored form (v1 forms are upgraded on read). */
export const settingsOf = (s: Partial<FormSettings> | null | undefined, businessName: string): FormSettings => normalizeSettings(s, businessName);
export const fieldsOf = (f: unknown): FormField[] => normalizeFields(f);

/** Finds a form by its id — or, for older links, by the project id (its first form, created if needed). */
export async function loadForm(db: SupabaseClient, id: string): Promise<{ form: LeadFormRow; business: { id: string; owner_id: string; name: string; segment: string; city: string | null; offer: string | null } } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let { data: form } = await db.from("lead_forms").select("*").eq("id", id).maybeSingle();
  if (!form) {
    const { data: biz } = await db.from("businesses").select("id, owner_id").eq("id", id).maybeSingle();
    if (!biz) return null;
    ({ data: form } = await db.from("lead_forms").select("*").eq("business_id", biz.id).order("created_at").limit(1).maybeSingle());
    if (!form) ({ data: form } = await db.from("lead_forms").insert({ owner_id: biz.owner_id, business_id: biz.id, name: "Website form", fields: DEFAULT_FIELDS, settings: { version: 2 } }).select("*").single());
  }
  if (!form) return null;
  const { data: business } = await db.from("businesses").select("id, owner_id, name, segment, city, offer").eq("id", form.business_id).maybeSingle();
  return business ? { form: { ...(form as LeadFormRow), fields: normalizeFields((form as LeadFormRow).fields) }, business } : null;
}

/** Custom CSS is placed inside a <style> tag, so it must never be able to close it or open HTML. */
export const cleanCss = (css: unknown) => String(css ?? "").replace(/</g, "").slice(0, 10000);
