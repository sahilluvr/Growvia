import Link from "next/link";
import type { Metadata } from "next";
import { early, repo, requireBusiness } from "@/lib/data";
import { PageHeader } from "@/components/app/PageHeader";
import { ContentCard } from "@/components/app/ContentCard";
import type { ContentStatus } from "@/lib/data/types";

export const metadata: Metadata = { title: "Content" };

const GROUPS: { status: ContentStatus; title: string; empty: string }[] = [
  { status: "draft", title: "Needs your review", empty: "Nothing waiting for review." },
  { status: "approved", title: "Approved — ready to schedule", empty: "Approve drafts to see them here." },
  { status: "scheduled", title: "Scheduled", empty: "Nothing scheduled yet." },
  { status: "published", title: "Posted", empty: "Mark content as posted once it's live." },
];

export default async function ContentPage({ searchParams }: { searchParams: { s?: string } }) {
  const r = repo();
  const dataP = early(Promise.all([r.listContent(), r.listCampaigns()]));
  await requireBusiness();
  const [content, campaigns] = await dataP;
  const names = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));
  const filter = GROUPS.find((g) => g.status === searchParams.s)?.status;

  return (
    <>
      <PageHeader title="Content" sub="Everything your Creator has drafted, across all campaigns." />
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link href="/app/content" className={`rounded-full border px-3.5 py-1.5 text-[13px] ${!filter ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>All · {content.length}</Link>
        {GROUPS.map((g) => (
          <Link key={g.status} href={`/app/content?s=${g.status}`} className={`rounded-full border px-3.5 py-1.5 text-[13px] ${filter === g.status ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>
            {g.title.split(" — ")[0]} · {content.filter((c) => c.status === g.status).length}
          </Link>
        ))}
      </div>
      <div className="grid gap-10">
        {GROUPS.filter((g) => !filter || g.status === filter).map((g) => {
          let items = content.filter((c) => c.status === g.status);
          if (g.status === "scheduled") items = [...items].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
          return (
            <section key={g.status}>
              <h2 className="mb-3 text-[16px] font-semibold tracking-tight">{g.title} <span className="font-normal text-stone-400">· {items.length}</span></h2>
              {items.length ? (
                <div className="grid gap-3 lg:grid-cols-2">{items.map((i) => <ContentCard key={i.id} item={i} showCampaign={names[i.campaign_id]} />)}</div>
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
