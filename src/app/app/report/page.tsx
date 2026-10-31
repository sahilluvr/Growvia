import type { Metadata } from "next";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { growthSnapshot } from "@/lib/growth";
import { ReportLive } from "@/components/app/GrowthUI";

export const metadata: Metadata = { title: "Growth Report" };
export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: { welcome?: string; plan?: string; interval?: string } }) {
  const { business } = await requireBusiness();
  const snap = await growthSnapshot(supabaseServer(), business as never);
  const plan = ["pro", "growth", "agency"].includes(searchParams.plan ?? "") ? searchParams.plan : undefined;
  return <ReportLive initial={snap} site={business.website ?? null} welcome={Boolean(searchParams.welcome)} plan={plan} interval={searchParams.interval} />;
}
