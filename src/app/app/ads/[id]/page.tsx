import { planFor, usageFor } from "@/lib/billing/plan";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { photoReady } from "@/lib/social/image";
import { VOICES } from "@/lib/ai/tts";
import { DEFAULT_SETTINGS, STYLES } from "@/lib/ai/ads";
import { AdStudio, type AdRow } from "./client";

export const metadata: Metadata = { title: "Ad" };
// Saving an export converts it to a standard MP4 (up to ~1 minute for long videos).
export const maxDuration = 300;

export default async function AdPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; warn?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { business } = await requireBusiness();
  const [{ data }, plan, usage] = await Promise.all([
    supabaseServer().from("ad_projects").select("*").eq("id", params.id).maybeSingle(),
    planFor(business.owner_id),
    usageFor(business.owner_id, ["videos"]),
  ]);
  const videoPlan = { watermark: plan.limits.watermark, limit: plan.limits.videos, left: Math.max(0, plan.limits.videos - (usage.videos ?? 0)) };
  if (!data) notFound();
  const ad = data as AdRow;
  ad.video = { ...ad.video, scenes: ad.video?.scenes ?? [], settings: { ...DEFAULT_SETTINGS, ...(ad.video?.settings ?? {}) } };
  return (
    <>
      <Link href="/app/ads" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Ad studio</Link>
      {searchParams.warn && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">{searchParams.warn} The brief below uses your project details — edit it if needed.</p>}
      <AdStudio ad={ad} businessName={business.name} photoReady={photoReady} voices={VOICES} styles={Object.entries(STYLES).map(([id, d]) => ({ id, label: d.split(":")[0] }))} initialTab={searchParams.tab === "video" ? "video" : searchParams.tab === "brief" ? "brief" : "text"} videoPlan={videoPlan} />
    </>
  );
}
