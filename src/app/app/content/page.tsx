import Link from "next/link";
import type { Metadata } from "next";
import { early, projectIdNow, repo, requireBusiness } from "@/lib/data";
import { PageHeader } from "@/components/app/PageHeader";
import { ContentCard } from "@/components/app/ContentCard";
import type { ContentItem } from "@/lib/data/types";
import { supabaseServer } from "@/lib/data/supabase";
import { postingContext } from "@/lib/social/linked";
import { AUTO_POST } from "@/lib/social/autopost";

export const metadata: Metadata = { title: "Content" };

type Group = "draft" | "approved" | "scheduled" | "published";
const GROUPS: { status: Group; title: string; empty: string }[] = [
  { status: "draft", title: "Needs your review", empty: "Nothing waiting for review." },
  { status: "approved", title: "Approved — ready to schedule", empty: "Approve drafts to see them here." },
  { status: "scheduled", title: "Scheduled & planned", empty: "Nothing scheduled yet." },
  { status: "published", title: "Posted", empty: "Mark content as posted once it's live." },
];
/** Planned (reminder-only) items sit with the scheduled ones so the calendar is in one place. */
const groupOf = (c: ContentItem): Group => (c.status === "approved" && c.scheduled_at ? "scheduled" : c.status);

export default async function ContentPage({ searchParams }: { searchParams: { s?: string } }) {
  const r = repo();
  const dataP = early(Promise.all([r.listContent(), r.listCampaigns()]));
  const pid = projectIdNow();
  const ctxP = early(pid ? postingContext(supabaseServer(), pid) : Promise.resolve(null));
  const { business } = await requireBusiness();
  const [[content, campaigns], ctx] = await Promise.all([dataP, ctxP.then((c) => c ?? postingContext(supabaseServer(), business.id))]);
  const connected = new Set(ctx.accounts.filter((a) => a.status === "connected").map((a) => a.provider));
  const unconnected = [...new Set(content.filter((c) => c.status !== "published" && AUTO_POST[c.channel] && !connected.has(AUTO_POST[c.channel].provider)).map((c) => c.channel))];
  const names = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));
  const filter = GROUPS.find((g) => g.status === searchParams.s)?.status;

  return (
    <>
      <PageHeader title="Content" sub="Everything your Creator has drafted, across all campaigns." />
      {unconnected.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p><b>{unconnected.join(", ")} {unconnected.length === 1 ? "isn't" : "aren't"} connected.</b> Content for {unconnected.length === 1 ? "it" : "them"} can be planned with a reminder, but won&apos;t post automatically until you connect.</p>
          <Link href={unconnected.every((c) => c === "Google Business") ? "/app/local" : "/app/channels"} className="btn-primary h-9 shrink-0 px-4 text-[13px]">Connect accounts</Link>
        </div>
      )}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link href="/app/content" className={`rounded-full border px-3.5 py-1.5 text-[13px] ${!filter ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>All · {content.length}</Link>
        {GROUPS.map((g) => (
          <Link key={g.status} href={`/app/content?s=${g.status}`} className={`rounded-full border px-3.5 py-1.5 text-[13px] ${filter === g.status ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>
            {g.title.split(" — ")[0]} · {content.filter((c) => groupOf(c) === g.status).length}
          </Link>
        ))}
      </div>
      <div className="grid gap-10">
        {GROUPS.filter((g) => !filter || g.status === filter).map((g) => {
          let items = content.filter((c) => groupOf(c) === g.status);
          if (g.status === "scheduled") items = [...items].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
          return (
            <section key={g.status}>
              <h2 className="mb-3 text-[16px] font-semibold tracking-tight">{g.title} <span className="font-normal text-stone-400">· {items.length}</span></h2>
              {items.length ? (
                <div className="grid gap-3 lg:grid-cols-2">{items.map((i) => <ContentCard key={i.id} item={i} showCampaign={names[i.campaign_id]} accounts={ctx.accounts} post={ctx.linked[i.id]} />)}</div>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-5 text-[14px] text-stone-500">{g.empty}</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
