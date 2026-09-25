import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { fmtDate, timeAgo } from "@/lib/format";
import { ChannelIcon } from "@/components/icons/Brand";
import { Composer, PostActions } from "./client";

export const metadata: Metadata = { title: "Publish" };

type Post = { id: string; caption: string; link: string | null; media: { url: string; type: string }[]; targets: string[]; status: string; scheduled_at: string | null; published_at: string | null; created_at: string; results: { account_id: string; provider: string; name: string; ok: boolean; permalink?: string; error?: string }[] };
const TINT: Record<string, string> = { draft: "bg-mist text-stone-600", scheduled: "bg-amber-50 text-amber-700", publishing: "bg-sky-50 text-sky-700", published: "bg-lime/25 text-lime-800", partial: "bg-amber-50 text-amber-700", failed: "bg-red-50 text-red-700" };

export default async function PublishPage({ searchParams }: { searchParams: { content?: string } }) {
  const db = supabaseServer();
  const contentId = searchParams.content && /^[0-9a-f-]{36}$/i.test(searchParams.content) ? searchParams.content : null;
  const [, { data: accounts }, { data: posts }, { data: item }] = await Promise.all([
    requireBusiness(),
    db.from("channel_accounts").select("id, provider, name, username, picture").in("provider", ["facebook", "instagram"]).order("provider"),
    db.from("social_posts").select("*").order("created_at", { ascending: false }).limit(60),
    contentId ? db.from("content_items").select("id, channel, title, body").eq("id", contentId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const accs = accounts ?? [];
  const names = Object.fromEntries(accs.map((a) => [a.id, a]));
  const list = (posts ?? []) as Post[];
  const groups: [string, Post[]][] = [
    ["Scheduled", list.filter((p) => p.status === "scheduled" || p.status === "publishing").sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))],
    ["Needs attention", list.filter((p) => p.status === "failed" || p.status === "partial")],
    ["Published", list.filter((p) => p.status === "published")],
    ["Drafts", list.filter((p) => p.status === "draft")],
  ];
  return (
    <>
      <PageHeader title="Publish" sub="Write once, post to Facebook and Instagram right now or on a schedule — no copy-pasting." />
      {!accs.length && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-amber-900"><b>Connect Facebook or Instagram first</b> to publish from Growvia.</p>
          <Link href="/app/channels" className="btn-primary h-10 px-4 text-[14px]">Connect accounts</Link>
        </div>
      )}
      <Composer accounts={accs} prefill={item ? { contentItemId: item.id, caption: item.body.replace(/^Caption:\s*/im, "") } : null} />
      <div className="mt-8 grid gap-8">
        {groups.filter(([, g]) => g.length).map(([title, g]) => (
          <section key={title}>
            <h2 className="mb-3 text-[16px] font-semibold tracking-tight">{title} <span className="font-normal text-stone-400">· {g.length}</span></h2>
            <div className="grid gap-3 md:grid-cols-2">
              {g.map((p) => (
                <article key={p.id} className="card flex gap-4 p-4">
                  {p.media[0] ? (
                    p.media[0].type === "video" ? <video src={p.media[0].url} className="h-24 w-24 shrink-0 rounded-xl bg-mist object-cover" muted /> : <img src={p.media[0].url} alt="" className="h-24 w-24 shrink-0 rounded-xl bg-mist object-cover" />
                  ) : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-mist text-[11px] text-stone-400">Text</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex -space-x-1">{p.targets.map((t) => names[t] && <span key={t} className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-mist" title={names[t].name}><ChannelIcon channel={names[t].provider} className="h-3.5 w-3.5" /></span>)}</div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium capitalize ${TINT[p.status]}`}>{p.status}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[14px]">{p.caption || <span className="text-stone-400">(no caption)</span>}</p>
                    <p className="mt-1 text-[12px] text-stone-500">{p.status === "scheduled" && p.scheduled_at ? `Goes out ${fmtDate(p.scheduled_at)}` : p.published_at ? `Published ${timeAgo(p.published_at)}` : `Created ${timeAgo(p.created_at)}`}</p>
                    <ul className="mt-1.5 grid gap-0.5 text-[12px]">
                      {p.results.map((r) => (
                        <li key={r.account_id} className={r.ok ? "text-lime-800" : "text-red-700"}>
                          {r.ok ? <a href={r.permalink} target="_blank" className="inline-flex items-center gap-1 hover:underline">✓ {r.name} <ExternalLink className="h-3 w-3" /></a> : `✗ ${r.name}: ${r.error}`}
                        </li>
                      ))}
                    </ul>
                    <PostActions id={p.id} status={p.status} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
