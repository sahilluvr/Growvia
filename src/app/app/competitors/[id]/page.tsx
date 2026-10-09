import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Check, ExternalLink, X } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { LineChart } from "@/components/charts/LineChart";
import { competitorData, type Biz } from "@/lib/competitors/core";
import { EditCompetitor } from "../client";

export const metadata: Metadata = { title: "Head-to-head" };

const pos = (p: number | null | undefined, max = 20) => (p == null ? <span className="text-stone-400">not in top {max}</span> : <b>#{p}</b>);

export default async function CompetitorPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { business } = await requireBusiness();
  const db = supabaseServer();
  const d = await competitorData(db, business as unknown as Biz);
  const me = d.rows[0], them = d.rows.find((r) => r.subject.id === params.id);
  const comp = d.competitors.find((c) => c.id === params.id);
  if (!them || !comp) notFound();
  const name = them.subject.name;
  const days = [...new Set([...me.series, ...them.series].map((x) => x.day))].sort();
  const val = (s: typeof me.series, dd: string) => s.find((x) => x.day === dd)?.reviews ?? null;
  const tile = (label: string, mine: string, theirs: string, win: boolean | null) => (
    <div className="card p-4">
      <div className="text-[12px] text-stone-500">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2"><span className="text-[13px] text-stone-500">You</span><span className={`text-[20px] font-semibold tabular-nums ${win === true ? "text-lime-700" : ""}`}>{mine}</span></div>
      <div className="flex items-baseline justify-between gap-2"><span className="truncate text-[13px] text-stone-500">{name}</span><span className={`text-[20px] font-semibold tabular-nums ${win === false ? "text-red-600" : ""}`}>{theirs}</span></div>
    </div>
  );
  const cmp = (a: number | null, c: number | null, high = true) => (a == null || c == null || a === c ? null : high ? a > c : a < c);
  const mapsRows = me.maps.map((m) => ({ keyword: m.keyword, me: m.position, them: them.maps.find((x) => x.keyword === m.keyword)?.position ?? null }));
  const googleRows = them.google.map((g) => ({ keyword: g.keyword, me: me.google.find((x) => x.keyword === g.keyword)?.position ?? null, them: g.position }));
  const aiRows = me.ai.map((a) => ({ prompt: a.prompt, me: a.mentioned, them: them.ai.find((x) => x.prompt === a.prompt)?.mentioned ?? false }));
  const wins = [...mapsRows.map((r) => cmp(r.me ?? 99, r.them ?? 99, false)), ...googleRows.map((r) => cmp(r.me ?? 101, r.them ?? 101, false)), ...aiRows.map((r) => (r.me === r.them ? null : r.me))];
  const insights = d.insights.filter((i) => i.competitor === name);

  return (
    <>
      <Link href="/app/competitors" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Competitors</Link>
      <div className="mb-6 mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tightest sm:text-[34px]">You vs {name}</h1>
          <p className="mt-1 text-[14px] text-stone-500">
            {comp.address ? `${comp.address} · ` : ""}{comp.website ? <a href={`https://${comp.website}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 underline">{comp.website} <ExternalLink className="h-3 w-3" /></a> : "No website added"}
            {comp.place_id && <> · <a href={`https://www.google.com/maps/place/?q=place_id:${comp.place_id}`} target="_blank" rel="noopener" className="underline">Google Maps</a></>}
          </p>
        </div>
        <p className="text-[14px]" data-testid="h2h-score">You win <b className="text-lime-700">{wins.filter((w) => w === true).length}</b> · they win <b className="text-red-600">{wins.filter((w) => w === false).length}</b></p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile("Google rating", me.rating != null ? `${me.rating}★` : "–", them.rating != null ? `${them.rating}★` : "–", cmp(me.rating, them.rating))}
        {tile("Reviews", me.reviews?.toLocaleString("en-IN") ?? "–", them.reviews?.toLocaleString("en-IN") ?? "–", cmp(me.reviews, them.reviews))}
        {tile("New reviews / month", me.perMonth != null ? String(me.perMonth) : "–", them.perMonth != null ? String(them.perMonth) : them.trackingSince ? "tracking…" : "–", cmp(me.perMonth, them.perMonth))}
        {tile("AI mentions", me.aiRate != null ? `${me.aiRate}%` : "–", them.aiRate != null ? `${them.aiRate}%` : "–", cmp(me.aiRate, them.aiRate))}
      </div>

      {insights.length > 0 && (
        <section className="card mt-5 grid gap-2 p-5">
          <h2 className="text-[15px] font-semibold">What to do</h2>
          {insights.map((i, k) => <div key={k} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[14px] text-stone-700">{i.text}</p><Link href={i.href} className="btn-ghost h-8 shrink-0 px-3 text-[12px]">{i.cta}</Link></div>)}
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Google Maps — your tracked searches</h2>
          {mapsRows.length ? (
            <table className="w-full text-left text-[13px]"><thead className="text-[12px] text-stone-500"><tr><th className="py-1.5 font-medium">Search</th><th className="px-2 py-1.5 text-right font-medium">You</th><th className="py-1.5 text-right font-medium">{name}</th></tr></thead>
              <tbody className="divide-y divide-line">{mapsRows.map((r) => { const w = cmp(r.me ?? 99, r.them ?? 99, false); return <tr key={r.keyword} className={w === false ? "bg-red-50/50" : ""}><td className="max-w-[200px] truncate py-2">{r.keyword}</td><td className="px-2 py-2 text-right">{pos(r.me)}</td><td className="py-2 text-right">{pos(r.them)}</td></tr>; })}</tbody></table>
          ) : <p className="text-[13px] text-stone-500"><Link href="/app/local?tab=rankings" className="underline">Track Maps searches</Link> to compare.</p>}
        </section>
        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Google Search — your keywords</h2>
          {!comp.website ? <p className="text-[13px] text-stone-500">Add {name}&apos;s website below to compare Google positions.</p>
            : googleRows.length ? (
              <table className="w-full text-left text-[13px]"><thead className="text-[12px] text-stone-500"><tr><th className="py-1.5 font-medium">Keyword</th><th className="px-2 py-1.5 text-right font-medium">You</th><th className="py-1.5 text-right font-medium">{name}</th></tr></thead>
                <tbody className="divide-y divide-line">{googleRows.map((r) => { const w = cmp(r.me ?? 101, r.them ?? 101, false); return <tr key={r.keyword} className={w === false ? "bg-red-50/50" : ""}><td className="max-w-[200px] truncate py-2">{r.keyword}</td><td className="px-2 py-2 text-right">{pos(r.me, 100)}</td><td className="py-2 text-right">{pos(r.them)}</td></tr>; })}</tbody></table>
            ) : <p className="text-[13px] text-stone-500"><Link href="/app/seo?tab=keywords" className="underline">Check live Google positions</Link> for your keywords to compare.</p>}
        </section>
        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 text-[15px] font-semibold">AI assistants — your customers&apos; questions</h2>
          {aiRows.length ? (
            <table className="w-full text-left text-[13px]"><thead className="text-[12px] text-stone-500"><tr><th className="py-1.5 font-medium">Question</th><th className="px-2 py-1.5 text-center font-medium">You</th><th className="py-1.5 text-center font-medium">{name}</th></tr></thead>
              <tbody className="divide-y divide-line">{aiRows.map((r) => <tr key={r.prompt} className={r.them && !r.me ? "bg-red-50/50" : ""}><td className="max-w-[260px] truncate py-2" title={r.prompt}>{r.prompt}</td><td className="px-2 py-2 text-center">{r.me ? <Check className="mx-auto h-4 w-4 text-lime-700" /> : <X className="mx-auto h-4 w-4 text-stone-300" />}</td><td className="py-2 text-center">{r.them ? <Check className="mx-auto h-4 w-4 text-red-600" /> : <X className="mx-auto h-4 w-4 text-stone-300" />}</td></tr>)}</tbody></table>
          ) : <p className="text-[13px] text-stone-500"><Link href="/app/seo?tab=geo" className="underline">Run AI visibility</Link> to compare.</p>}
        </section>
        <section className="card grid content-start gap-3 p-5">
          <h2 className="text-[15px] font-semibold">Reviews over time</h2>
          {days.length > 1 ? <LineChart title="Google reviews over time" labels={days} series={[{ name: "You", values: days.map((x) => val(me.series, x)) }, { name, values: days.map((x) => val(them.series, x)) }]} />
            : <p className="text-[13px] text-stone-500">Growvia checks ratings and review counts every week — the chart fills in from the second check.</p>}
        </section>
      </div>

      <section className="card mt-5 grid max-w-xl gap-3 p-5">
        <h2 className="text-[15px] font-semibold">Details</h2>
        <EditCompetitor id={comp.id} name={comp.name} website={comp.website} />
      </section>
    </>
  );
}
