import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Type, ArrowUpRight } from "lucide-react";
import { early, projectIdNow, requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { timeAgo } from "@/lib/format";
import { NewAd } from "./client";

export const metadata: Metadata = { title: "Ad studio" };

export default async function AdsPage() {
  const q = (id: string) => Promise.resolve(supabaseServer().from("ad_projects").select("id, name, url, brief, text_ads, video, video_url, updated_at").eq("business_id", id).order("updated_at", { ascending: false }).limit(60));
  const pid = projectIdNow();
  const adsP = early(pid ? q(pid) : Promise.resolve(null));
  const { business } = await requireBusiness();
  const { data } = (await adsP) ?? await q(business.id);
  type Row = { id: string; name: string; url: string | null; brief: { images?: string[] }; text_ads: Record<string, unknown>; video: { scenes?: unknown[] }; video_url: string | null; updated_at: string };
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader title="Ad studio" sub="Give Growvia a website — get ready-to-run ad copy for Google, Meta, LinkedIn and X, plus short video ads with an AI voice and presenter." />
      <NewAd website={business.website ?? ""} />
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const platforms = Object.keys(r.text_ads ?? {}).filter((k) => k !== "at");
          return (
            <Link key={r.id} href={`/app/ads/${r.id}`} className="card group flex gap-4 p-4 transition-shadow hover:shadow-frame">
              {r.brief?.images?.[0] ? <img src={r.brief.images[0]} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-mist object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-mist text-stone-400"><Clapperboard className="h-6 w-6" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2"><p className="truncate text-[15px] font-semibold">{r.name}</p><ArrowUpRight className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-ink" /></div>
                <p className="truncate text-[12px] text-stone-500">{r.url ? new URL(r.url).host : "No website"} · {timeAgo(r.updated_at)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {platforms.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5"><Type className="h-3 w-3" /> {platforms.length} ad platform{platforms.length === 1 ? "" : "s"}</span>}
                  {Boolean(r.video?.scenes?.length) && <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5"><Clapperboard className="h-3 w-3" /> {r.video_url ? "Video ready" : "Video story"}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {!rows.length && <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-[14px] text-stone-500">No ads yet. Paste a website above — Growvia reads it and writes your first ads.</p>}
    </>
  );
}
