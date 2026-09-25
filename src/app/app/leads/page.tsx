import type { Metadata } from "next";
import { early, repo, requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { LeadsBoard } from "./LeadsBoard";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const leadsP = early(repo().listLeads());
  const seqP = early(Promise.resolve(supabaseServer().from("sequences").select("id, name").order("created_at", { ascending: false })).then((r) => r.data ?? []));
  const { business } = await requireBusiness();
  const [leads, sequences] = await Promise.all([leadsP, seqP]);
  return (
    <>
      <PageHeader title="Leads" sub="Every enquiry in one place. Move leads through your pipeline until they become customers." />
      <LeadsBoard leads={leads} sequences={sequences} formUrl={`${siteOrigin()}/f/${business.id}`} />
    </>
  );
}
