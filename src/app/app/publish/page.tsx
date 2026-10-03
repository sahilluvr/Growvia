import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { fmtDate, timeAgo } from "@/lib/format";
import { ChannelIcon } from "@/components/icons/Brand";
import { Composer, PostActions, type Prefill } from "./client";
import { PlanWeek } from "./ai";
import { photoReady } from "@/lib/social/image";
import { AUTO_POST } from "@/lib/social/autopost";

export const metadata: Metadata = { title: "Publish" };
// Publishing a video can include converting it and waiting for Instagram to process it.
export const maxDuration = 300;

type Post = { options?: { youtube?: { title?: string; privacy?: string } }; id: string; caption: string; link: string | null; media: { url: string; type: string }[]; targets: string[]; status: string; scheduled_at: string | null; published_at: string | null; created_at: string; results: { account_id: string; provider: string; name: string; ok: boolean; permalink?: string; error?: string }[] };
const TINT: Record<string, string> = { draft: "bg-mist text-stone-600", scheduled: "bg-amber-50 text-amber-700", publishing: "bg-sky-50 text-sky-700", published: "bg-lime/25 text-lime-800", partial: "bg-amber-50 text-amber-700", failed: "bg-red-50 text-red-700" };

export default async function PublishPage({ searchParams }: { searchParams: { content?: string; edit?: string; caption?: string; image?: string } }) {
  const db = supabaseServer();
  const contentId = searchParams.content && /^[0-9a-f-]{36}$/i.test(searchParams.content) ? searchParams.content : null;
  const [{ business }, { data: accounts }, { data: posts }, { data: item }] = await Promise.all([
    requireBusiness(),
    db.from("channel_accounts").select("id, provider, name, username, picture, status, meta").in("provider", ["facebook", "instagram", "youtube", "gbp"]).order("provider"),
    db.from("social_posts").select("*").order("created_at", { ascending: false }).limit(60),
    contentId ? db.from("content_items").select("id, channel, title, body").eq("id", contentId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // Only accounts that can post right now; a Business Profile belongs to one project.
  const all = (accounts ?? []).filter((a) => a.provider !== "gbp" || a.meta?.business_id === business.id);
  const accs = all.filter((a) => a.status === "connected").map(({ meta: _m, status: _s, ...a }) => a);
  const needsFix = all.filter((a) => a.status !== "connected");
  const want = item ? AUTO_POST[item.channel]?.provider : null;
  const defaultTargets = want && accs.some((a) => a.provider === want) ? accs.filter((a) => a.provider === want).map((a) => a.id) : accs.filter((a) => a.provider === "facebook" || a.provider === "instagram").map((a) => a.id);
  const editing = searchParams.edit && /^[0-9a-f-]{36}$/i.test(searchParams.edit) ? ((posts ?? []) as Post[]).find((p) => p.id === searchParams.edit && (p.status === "draft" || p.status === "scheduled" || p.status === "failed")) : null;
  const prefill: Prefill | null = editing
    ? { postId: editing.id, caption: editing.caption, media: editing.media.filter((m) => m.type === "image" || m.type === "video") as Prefill["media"], targets: editing.targets, ytTitle: editing.options?.youtube?.title, ytPrivacy: editing.options?.youtube?.privacy }
    : item ? { contentItemId: item.id, caption: item.body.replace(/^Caption:\s*/im, ""), targets: defaultTargets, ytTitle: item.channel === "YouTube" ? item.title.replace(/\s+—\s+YouTube video$/i, "").slice(0, 100) : undefined }
    : searchParams.caption || searchParams.image ? { caption: (searchParams.caption ?? "").slice(0, 2200), media: /^https:\/\/|^http:\/\/localhost/.test(searchParams.image ?? "") ? [{ url: searchParams.image!, type: "image" as const }] : [] } : null;
  const names = Object.fromEntries(all.map((a) => [a.id, a]));
  const list = (posts ?? []) as Post[];
  const groups: [string, Post[]][] = [
    ["Scheduled", list.filter((p) => p.status === "scheduled" || p.status === "publishing").sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))],
    ["Needs attention", list.filter((p) => p.status === "failed" || p.status === "partial")],
    ["Published", list.filter((p) => p.status === "published")],
    ["Drafts", list.filter((p) => p.status === "draft")],
  ];
  return (
    <>
      <PageHeader title="Publish" sub="Write with AI, create on-brand images, and post to Facebook, Instagram, YouTube and Google Business now or on a schedule — no copy-pasting." />
      {needsFix.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <p><b>{needsFix.map((a) => a.name).join(", ")}</b> {needsFix.length === 1 ? "needs" : "need"} reconnecting — scheduled posts to {needsFix.length === 1 ? "it" : "them"} will fail until then.</p>
          <Link href="/app/channels" className="btn-primary h-9 shrink-0 px-4 text-[13px]">Reconnect</Link>
        </div>
      )}
      {!accs.length && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-amber-900"><b>Connect Facebook, Instagram, YouTube or Google Business</b> to publish from Growvia. You can still write posts and create images now — they&apos;re saved as drafts.</p>
          <Link href="/app/channels" className="btn-primary h-10 px-4 text-[14px]">Connect accounts</Link>
        </div>
      )}
      <PlanWeek accounts={accs.filter((a) => a.provider !== "youtube").map((a) => ({ id: a.id, name: a.username ? `@${a.username}` : a.name, provider: a.provider }))} />
      <Composer key={editing?.id ?? "new"} accounts={accs} prefill={prefill} photoReady={photoReady} defaultTargets={defaultTargets} />
      <div className="mt-8 grid gap-8">
        {groups.filter(([, g]) => g.length).map(([title, g]) => (
          <section key={title} id={{ Scheduled: "scheduled", "Needs attention": "attention", Published: "published", Drafts: "drafts" }[title]} className="scroll-mt-6">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <PostActions id={p.id} status={p.status} />
                      {(p.status === "draft" || p.status === "scheduled" || p.status === "failed") && <Link href={`/app/publish?edit=${p.id}`} className="mt-2 text-[12px] font-medium underline decoration-lime decoration-2 underline-offset-4">Edit</Link>}
                      {p.media[0]?.type === "image" && <a href={p.media[0].url} target="_blank" download className="mt-2 text-[12px] text-stone-500 hover:text-ink">Download image</a>}
                    </div>
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
