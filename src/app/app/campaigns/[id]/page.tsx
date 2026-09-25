import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CheckCheck, Pause, Play, Flag, Trash2 } from "lucide-react";
import { early, repo, requireBusiness } from "@/lib/data";
import { ActionButton } from "@/components/app/bits";
import { approveAllAction, deleteCampaignAction, setCampaignStatusAction } from "@/app/actions";
import { ContentCard } from "@/components/app/ContentCard";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const dataP = early(/^[0-9a-f-]{36}$/i.test(params.id) ? repo().getCampaign(params.id) : Promise.resolve(null));
  await requireBusiness();
  const data = await dataP;
  if (!data) notFound();
  const { campaign: c, items } = data;
  const drafts = items.filter((i) => i.status === "draft").length;

  return (
    <>
      <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
      <div className="mb-6 mt-3 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tightest sm:text-[34px]">{c.name}</h1>
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium capitalize ${c.status === "active" ? "bg-ink text-lime" : "bg-mist text-stone-600"}`}>{c.status}</span>
          </div>
          <p className="mt-1 text-[15px] text-stone-500">{c.objective} · {c.channels.join(", ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {drafts > 0 && <ActionButton action={approveAllAction.bind(null, c.id)} className="btn-primary h-10 px-4 text-[14px]"><CheckCheck className="h-4 w-4 text-lime" /> Approve all ({drafts})</ActionButton>}
          {c.status === "active" ? (
            <ActionButton action={setCampaignStatusAction.bind(null, c.id, "draft")} className="btn-ghost h-10 px-4 text-[14px]"><Pause className="h-4 w-4" /> Pause</ActionButton>
          ) : (
            <ActionButton action={setCampaignStatusAction.bind(null, c.id, "active")} className="btn-ghost h-10 px-4 text-[14px]"><Play className="h-4 w-4" /> Activate</ActionButton>
          )}
          {c.status !== "completed" && <ActionButton action={setCampaignStatusAction.bind(null, c.id, "completed")} className="btn-ghost h-10 px-4 text-[14px]"><Flag className="h-4 w-4" /> Complete</ActionButton>}
          <ActionButton action={deleteCampaignAction.bind(null, c.id)} confirm={`Delete “${c.name}” and all its content?`} className="btn-ghost h-10 px-4 text-[14px] text-red-600 hover:border-red-300" title="Delete campaign"><Trash2 className="h-4 w-4" /></ActionButton>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((i) => <ContentCard key={i.id} item={i} />)}
      </div>
      <p className="mt-6 text-[13px] text-stone-500">Tip: approve content, schedule a time, then copy it to the channel. Mark it as posted so your results stay accurate. Direct publishing to connected accounts is coming next.</p>
    </>
  );
}
