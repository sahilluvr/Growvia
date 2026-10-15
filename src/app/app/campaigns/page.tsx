import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ArrowUpRight } from "lucide-react";
import { early, repo, requireBusiness } from "@/lib/data";
import { PageHeader } from "@/components/app/PageHeader";
import { ActionButton } from "@/components/app/bits";
import { createCampaignAction } from "@/app/actions";
import { CONTENT_META } from "@/lib/format";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const campaignsP = early(repo().listCampaigns());
  const { business } = await requireBusiness();
  const campaigns = await campaignsP;
  const used = new Set(campaigns.map((c) => c.name));
  const ideas = business.plan!.opportunities.filter((o) => !used.has(o.title));

  return (
    <>
      <PageHeader title="Campaigns" sub="Each campaign is a set of ready-to-post content built around one growth opportunity." />

      <div className="grid gap-3 md:grid-cols-2">
        {campaigns.map((c) => {
          const total = Object.values(c.counts).reduce((a, b) => a + b, 0);
          return (
            <Link key={c.id} href={`/app/campaigns/${c.id}`} className="card group p-5 transition-shadow hover:shadow-frame">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-semibold tracking-tight">{c.name}</div>
                  <div className="mt-0.5 line-clamp-1 text-[13px] text-stone-500">{c.objective}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium capitalize ${c.status === "active" ? "bg-ink text-lime" : "bg-mist text-stone-600"}`}>{c.status}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.channels.map((ch) => <span key={ch} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-stone-600">{ch}</span>)}
              </div>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-mist">
                {(["published", "scheduled", "approved"] as const).map((s) => (
                  <span key={s} className={s === "published" ? "bg-lime-500" : s === "scheduled" ? "bg-amber-400" : "bg-sky-400"} style={{ width: `${total ? (c.counts[s] / total) * 100 : 0}%` }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-stone-500">
                {(["draft", "approved", "scheduled", "published"] as const).map((s) => <span key={s}>{c.counts[s]} {CONTENT_META[s].label.toLowerCase()}</span>)}
                <span className="ml-auto inline-flex items-center gap-1 text-ink opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowUpRight className="h-3.5 w-3.5" /></span>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="mt-8">
        <h2 className="text-[16px] font-semibold tracking-tight">Start a new campaign</h2>
        <p className="mt-1 text-[14px] text-stone-500">Pick an opportunity from your plan. Your Creator drafts everything in seconds.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {ideas.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-stone-400/60 bg-white p-4">
              <div className="min-w-0">
                <div className="text-[15px] font-medium">{o.title}</div>
                <div className="text-[13px] text-stone-500">{o.why}</div>
              </div>
              <ActionButton action={createCampaignAction.bind(null, o.id)} className="btn-primary h-9 shrink-0 px-3.5 text-[13px]"><Plus className="h-3.5 w-3.5" /> Create</ActionButton>
            </div>
          ))}
          {!ideas.length && <p className="text-[14px] text-stone-500">You&apos;ve launched every opportunity in your plan. Refresh your plan from the Growth plan page for more.</p>}
        </div>
      </section>
    </>
  );
}
