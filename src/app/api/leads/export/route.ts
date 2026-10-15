import { requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { leadsCsv, type LeadRowCsv, type SubRow } from "@/lib/leads-csv";

export const dynamic = "force-dynamic";

/** CSV of this project's leads, with every form answer, hidden values, UTMs, consent and file links. */
export async function GET() {
  const { business } = await requireBusiness();
  const db = supabaseServer();
  const { data: leads } = await db.from("leads").select("id, name, email, phone, company, source, stage, value, tags, created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(10000);
  const { data: subs } = await db.from("lead_submissions").select("id, lead_id, form_name, answers, labels, consent, hidden, page, referrer, utm, files, created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20000);
  const csv = leadsCsv((leads ?? []) as LeadRowCsv[], (subs ?? []) as SubRow[], (id, key) => `${siteOrigin()}/api/forms/file?sub=${id}&key=${encodeURIComponent(key)}`);
  return new Response("\uFEFF" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="growvia-leads-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
