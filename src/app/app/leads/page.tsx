import type { Metadata } from "next";
import { early, repo, requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { LeadsBoard } from "./LeadsBoard";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: { import?: string; google_error?: string } }) {
  const importId = searchParams.import && /^[0-9a-f-]{36}$/i.test(searchParams.import) ? searchParams.import : null;
  const impP = importId ? early(Promise.resolve(supabaseServer().from("contact_imports").select("id, label, rows").eq("id", importId).maybeSingle()).then((r) => r.data)) : Promise.resolve(null);
  const leadsP = early(repo().listLeads());
  const seqP = early(Promise.resolve(supabaseServer().from("sequences").select("id, name").order("created_at", { ascending: false })).then((r) => r.data ?? []));
  const { business } = await requireBusiness();
  const [leads, sequences, imp] = await Promise.all([leadsP, seqP, impP]);
  return (
    <>
      <PageHeader title="Leads" sub="Every enquiry in one place. Move leads through your pipeline until they become customers." />
      {searchParams.google_error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{searchParams.google_error === "setup" ? "Google sign-in isn't set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel." : searchParams.google_error}</p>}
      {importId && !imp && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">That contact import expired or was already used. Import from Google Contacts again.</p>}
      <LeadsBoard leads={leads} sequences={sequences} formUrl={`${siteOrigin()}/f/${business.id}`} initialImport={imp ? { id: imp.id, label: imp.label ?? "Google Contacts", rows: imp.rows } : undefined} />
    </>
  );
}
