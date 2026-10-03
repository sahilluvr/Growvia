import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bot, MapPin, Search, Star, TrendingUp } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { timeAgo } from "@/lib/format";
import { competitorData, MAX_COMPETITORS, type Biz, type Row } from "@/lib/competitors/core";
import { mapsReady } from "@/lib/local/maps";
import { AddCompetitor, AddSuggestion, RefreshCompetitors } from "./client";
import { planFor } from "@/lib/billing/plan";
import { LIMITS, PLAN_INFO, nextPlan } from "@/lib/billing/catalog";

export const metadata: Metadata = { title: "Competitors" };

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
/** One number per column so the table can highlight who's winning. Lower is better for positions. */
function stats(r: Row) {
  const mapsFound = r.maps.filter((m) => m.position != null);
  const top10 = r.google.filter((g) => g.position != null && g.position <= 10);
  return {
    rating: r.rating, reviews: r.reviews, perMonth: r.perMonth,
    maps: avg(mapsFound.map((m) => m.position!)), mapsFound: mapsFound.length, mapsTotal: r.maps.length,
    google: top10.length, googleTotal: r.google.length, ai: r.aiRate,
  };
}
type S = ReturnType<typeof stats>;
const COLS: { key: keyof S; label: string; icon: React.ElementType; better: "high" | "low"; show: (s: S) => string; hint: string }[] = [
  { key: "rating", label: "Rating", icon: Star, better: "high", show: (s) => (s.rating != null ? `${s.rating}★` : "–"), hint: "Google rating" },
  { key: "reviews", label: "Reviews", icon: Star, better: "high", show: (s) => (s.reviews != null ? s.reviews.toLocaleString("en-IN") : "–"), hint: "Google reviews" },
  { key: "perMonth", label: "New reviews / mo", icon: TrendingUp, better: "high", show: (s) => (s.perMonth != null ? String(s.perMonth) : "–"), hint: "Speed of new reviews (after 2 weeks of tracking)" },
  { key: "maps", label: "Maps position", icon: MapPin, better: "low", show: (s) => (s.maps != null ? `#${s.maps}${s.mapsTotal ? ` · ${s.mapsFound}/${s.mapsTotal}` : ""}` : s.mapsTotal ? `– · 0/${s.mapsTotal}` : "–"), hint: "Average Google Maps position across your tracked searches · searches where they appear" },
  { key: "google", label: "Google top 10", icon: Search, better: "high", show: (s) => (s.googleTotal ? `${s.google}/${s.googleTotal}` : "–"), hint: "Your tracked keywords where they're on Google's first page" },
  { key: "ai", label: "AI mentions", icon: Bot, better: "high", show: (s) => (s.ai != null ? `${s.ai}%` : "–"), hint: "How often ChatGPT, Gemini & co. name them for your questions" },
];

export default async function CompetitorsPage() {
  const { business } = await requireBusiness();
  const db = supabaseServer();
  const b = business as unknown as Biz & { local_state?: unknown }; // requireBusiness already loads the full row
  const d = await competitorData(db, b as Biz);
  const all = d.rows.map((r) => ({ r, s: stats(r) }));
  const best = Object.fromEntries(COLS.map((c) => {
    const vals = all.map((x) => x.s[c.key]).filter((v): v is number => typeof v === "number");
    return [c.key, vals.length > 1 ? (c.better === "high" ? Math.max(...vals) : Math.min(...vals)) : null];
  })) as Record<keyof S, number | null>;
  const myPlan = await planFor(business.owner_id ?? "");
  const cap = Math.min(MAX_COMPETITORS, myPlan.limits.competitors);
  const up = nextPlan(myPlan.plan);
  const at = (b?.local_state as { competitors_at?: string } | null)?.competitors_at;

  return (
    <>
      <PageHeader title="Competitors" sub={`How ${business.name} stacks up on Google Maps, Google Search, reviews and AI answers${at ? ` · ratings checked ${timeAgo(at)}` : ""}.`}>
        {d.competitors.length > 0 && mapsReady && <RefreshCompetitors />}
      </PageHeader>

      {d.competitors.length > 0 && (
        <>
          {/* Scorecard: desktop table */}
          <section className="card hidden overflow-x-auto md:block" data-testid="scorecard">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[12px] text-stone-500">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">Business</th>
                  {COLS.map((c) => <th key={c.key} className="px-3 py-3 text-right font-medium" title={c.hint}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {all.map(({ r, s }) => (
                  <tr key={r.subject.id} className={r.subject.me ? "bg-paper" : ""}>
                    <td className="max-w-[240px] px-5 py-3">
                      {r.subject.me ? <b>{r.subject.name} <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-lime">You</span></b>
                        : <Link href={`/app/competitors/${r.subject.id}`} className="font-medium hover:underline">{r.subject.name}</Link>}
                      {r.subject.website && <div className="truncate text-[12px] text-stone-500">{r.subject.website}</div>}
                    </td>
                    {COLS.map((c) => {
                      const v = s[c.key], win = typeof v === "number" && best[c.key] === v;
                      return <td key={c.key} className={`px-3 py-3 text-right tabular-nums ${win ? "font-semibold text-lime-800" : ""}`}><span className={win ? "rounded-md bg-lime/25 px-1.5 py-0.5" : ""}>{c.show(s)}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-5 py-2.5 text-[12px] text-stone-500">Highlighted = best in each column. Click a competitor for the head-to-head.</p>
          </section>
          {/* Scorecard: phone cards */}
          <div className="grid gap-3 md:hidden">
            {all.map(({ r, s }) => (
              <Link key={r.subject.id} href={r.subject.me ? "/app/local" : `/app/competitors/${r.subject.id}`} className={`card grid gap-2 p-4 ${r.subject.me ? "border-ink" : ""}`}>
                <div className="flex items-center justify-between gap-2"><b className="truncate">{r.subject.name}</b>{r.subject.me ? <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-lime">You</span> : <ArrowRight className="h-4 w-4 text-stone-400" />}</div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  {COLS.map((c) => { const v = s[c.key], win = typeof v === "number" && best[c.key] === v; return <div key={c.key}><div className="text-stone-500">{c.label}</div><div className={`tabular-nums ${win ? "font-semibold text-lime-800" : ""}`}>{c.show(s)}</div></div>; })}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="card grid content-start gap-3 p-5">
          <h2 className="text-[16px] font-semibold tracking-tight">Where they&apos;re beating you — and what to do</h2>
          {d.insights.length ? (
            <ul className="grid gap-2" data-testid="insights">
              {d.insights.slice(0, 8).map((i, k) => (
                <li key={k} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[14px] text-stone-700">{i.text}</p>
                  <Link href={i.href} className="btn-ghost h-8 shrink-0 px-3 text-[12px]">{i.cta} <ArrowRight className="h-3.5 w-3.5" /></Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-stone-500">{d.competitors.length ? "You're ahead everywhere we can measure right now — nice. We'll tell you when that changes." : "Add a few competitors to see where they're ahead of you."}</p>
          )}
          {(!d.has.maps || !d.has.google || !d.has.ai) && (
            <div className="grid gap-1.5 rounded-xl bg-mist p-3 text-[13px] text-stone-700">
              <p className="font-medium text-ink">Get more comparisons</p>
              {!d.has.maps && <p><Link href="/app/local?tab=rankings" className="underline">Track a few Google Maps searches</Link> (e.g. “dentist near me”) — shows who's above you on Maps.</p>}
              {!d.has.google && <p><Link href="/app/seo?tab=keywords" className="underline">Add keywords and check live Google positions</Link> — compares your Google rankings.</p>}
              {!d.has.ai && <p><Link href="/app/seo?tab=geo" className="underline">Ask AI assistants your customers&apos; questions</Link> — shows who ChatGPT & Gemini recommend.</p>}
            </div>
          )}
        </section>

        <aside className="grid content-start gap-5">
          <section className="card grid gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Add a competitor</h2>
            <p className="text-[13px] text-stone-500">Up to {cap} on your plan{up && LIMITS[up].competitors > cap ? <> (<a href="/app/billing#upgrade" className="underline">{PLAN_INFO[up].name} tracks {LIMITS[up].competitors}</a>)</> : null}. Add the website to compare Google positions too.</p>
            <AddCompetitor />
          </section>
          <section className="card grid gap-2 p-5" data-testid="suggestions">
            <h2 className="text-[15px] font-semibold">Suggested for you</h2>
            {d.suggestions.length ? (
              <ul className="grid gap-2">
                {d.suggestions.map((s) => (
                  <li key={`${s.name}${s.website}`} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span><span className="block truncate text-[12px] text-stone-500">Seen in {s.sources.join(", ")}{s.note ? ` · ${s.note}` : ""}</span></span>
                    <AddSuggestion name={s.name} website={s.website} placeId={s.placeId} source={s.sources[0] === "Google Maps" ? "maps" : s.sources[0] === "Google" ? "google" : "ai"} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-stone-500">Growvia suggests businesses that keep appearing next to you in Google Maps, Google and AI answers — track some searches first.</p>}
          </section>
          {!mapsReady && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Admin: add a <b>SERPAPI_KEY</b> in Vercel to track ratings, reviews and Maps positions.</p>}
        </aside>
      </div>
    </>
  );
}
