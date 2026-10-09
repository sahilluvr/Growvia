import Link from "next/link";
import { Bot, Quote, Search, Users } from "lucide-react";
import { supabaseServer } from "@/lib/data/supabase";
import { LineChart, Sparkline, BarList } from "@/components/charts/LineChart";
import { CopyButton } from "@/components/app/bits";
import { timeAgo } from "@/lib/format";
import { ENGINES } from "@/lib/seo/geo";
import { serpProvider, serpReady } from "@/lib/seo/rankings";
import { pageGeo } from "@/lib/seo/audit";
import { buildReport, cleanRange, reportToken } from "@/lib/seo/report";
import { systemMailReady } from "@/lib/mail/system";
import type { ExpertPanel, SeoPrefs } from "@/lib/seo/types";
import { AiBots, IssueList, type AuditView } from "./views";
import { FileBox, StepButton } from "./client";
import { AddKeywords, AddPrompts, CheckSerp, KeywordIdeas, PromptIdeas, RangePicker, RemoveButton, RunExperts, RunGeo, SendReport, SettingsForm, SyncRankings } from "./client2";
import { ReportView } from "./report-view";

const dFmt = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/* ───────────────────────── Keywords ───────────────────────── */

export async function KeywordsTab({ businessId, gsc }: { businessId: string; gsc: boolean }) {
  const db = supabaseServer();
  const [{ data: kws }, { data: ranks }] = await Promise.all([
    db.from("seo_keywords").select("id, keyword, target_url, source, created_at").eq("business_id", businessId).order("created_at"),
    db.from("seo_rankings").select("keyword_id, day, position, clicks, impressions, source").eq("business_id", businessId).gte("day", ago(90)).order("day").limit(20000),
  ]);
  const rows = (kws ?? []).map((k) => {
    const rs = (ranks ?? []).filter((r) => r.keyword_id === k.id);
    const g = rs.filter((r) => r.source === "gsc" && r.position != null);
    const serp = rs.filter((r) => r.source === "serp").at(-1);
    const at = (days: number) => { const d = ago(days); const r = [...g].reverse().find((x) => x.day <= d); return r ? Number(r.position) : null; };
    const now = g.length ? Number(g.at(-1)!.position) : null;
    const last28 = g.filter((r) => r.day >= ago(28));
    return { ...k, now, d7: now != null && at(7) != null ? at(7)! - now : null, d28: now != null && at(28) != null ? at(28)! - now : null, best: g.length ? Math.min(...g.map((r) => Number(r.position))) : null, clicks: last28.reduce((n, r) => n + r.clicks, 0), impressions: last28.reduce((n, r) => n + r.impressions, 0), spark: g.filter((r) => r.day >= ago(60)).map((r) => Number(r.position)), serp: serp ? (serp.position == null ? "100+" : String(serp.position)) : null, series: g };
  });
  const top3 = rows.filter((r) => r.now != null && r.now <= 3).length, top10 = rows.filter((r) => r.now != null && r.now <= 10).length;
  const chart = [...rows].filter((r) => r.series.length).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
  const days = [...new Set(chart.flatMap((c) => c.series.map((s) => s.day)))].sort();
  const move = (v: number | null) => v == null ? <span className="text-stone-300">—</span> : <span className={v > 0 ? "text-lime-700" : v < 0 ? "text-red-600" : "text-stone-500"}>{v > 0 ? "▲" : v < 0 ? "▼" : "→"}{Math.abs(v).toFixed(1)}</span>;
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Tracked keywords", rows.length], ["In top 3", top3], ["In top 10", top10], ["Clicks (28 days)", rows.reduce((n, r) => n + r.clicks, 0)]].map(([k, v]) => <div key={k as string} className="card p-4"><p className="text-[12px] text-stone-500">{k as string}</p><p className="text-[26px] font-semibold tabular-nums tracking-tight">{v as number}</p></div>)}
      </div>
      {!gsc && <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">Connect Google Search Console (Google Search tab) so positions, clicks and history fill in automatically every day. {serpReady ? "" : "For exact live positions of any keyword, add a SERPAPI_KEY or DataForSEO login."}</p>}
      {chart.length > 0 && (
        <section className="card p-5">
          <h3 className="mb-1 text-[15px] font-semibold">Position over time</h3>
          <p className="mb-3 text-[12px] text-stone-500">Average Google position per day (1 = top). Your 5 most-seen keywords.</p>
          <LineChart title="Keyword positions over time" invert min={1} labels={days} series={chart.map((c) => ({ name: c.keyword, values: days.map((d) => { const r = c.series.find((s) => s.day === d); return r ? Number(r.position) : null; }) }))} />
        </section>
      )}
      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h3 className="text-[15px] font-semibold">Your keywords</h3>
          <div className="flex flex-wrap gap-2">{gsc && <SyncRankings />}{serpReady && rows.length > 0 && <CheckSerp />}</div>
        </div>
        {rows.length ? (
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="text-[12px] text-stone-500"><tr><th className="px-5 py-2 font-medium">Keyword</th><th className="px-2 py-2 text-right font-medium">Position</th><th className="px-2 py-2 text-right font-medium">7 days</th><th className="px-2 py-2 text-right font-medium">28 days</th><th className="px-2 py-2 text-right font-medium">Best</th>{serpReady && <th className="px-2 py-2 text-right font-medium">Live ({serpProvider})</th>}<th className="px-2 py-2 text-right font-medium">Clicks</th><th className="px-2 py-2 text-right font-medium">Shown</th><th className="px-2 py-2 font-medium">Trend</th><th className="px-2 py-2 font-medium">Page</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-[220px] px-5 py-2"><span className="block truncate font-medium">{r.keyword}</span><span className="text-[11px] text-stone-400">{r.source === "manual" ? "added by you" : r.source}</span></td>
                  <td className="px-2 py-2 text-right text-[15px] font-semibold tabular-nums">{r.now?.toFixed(1) ?? <span className="text-[12px] font-normal text-stone-400">not ranking yet</span>}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{move(r.d7)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{move(r.d28)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">{r.best?.toFixed(1) ?? "—"}</td>
                  {serpReady && <td className="px-2 py-2 text-right tabular-nums">{r.serp ?? "—"}</td>}
                  <td className="px-2 py-2 text-right tabular-nums">{r.clicks}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">{r.impressions}</td>
                  <td className="px-2 py-2"><Sparkline values={r.spark} invert /></td>
                  <td className="max-w-[160px] px-2 py-2"><span className="block truncate font-mono text-[11px] text-stone-500">{r.target_url ? new URL(r.target_url).pathname : "—"}</span></td>
                  <td className="px-2 py-2"><RemoveButton id={r.id} kind="keyword" label={r.keyword} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="p-5 text-[14px] text-stone-500">No keywords yet — add some below or pick from suggestions.</p>}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card grid content-start gap-3 p-5"><h3 className="text-[15px] font-semibold">Add keywords</h3><AddKeywords /></section>
        <section className="card grid content-start gap-3 p-5"><h3 className="text-[15px] font-semibold">Top keyword ideas</h3><p className="text-[13px] text-stone-500">From your real Google searches, Google autocomplete and AI — one click to track.</p><KeywordIdeas /></section>
      </div>
    </div>
  );
}

/* ───────────────────────── AI visibility (GEO) ───────────────────────── */

export async function GeoTab({ businessId, businessName, audit, prefs }: { businessId: string; businessName: string; audit: AuditView | null; prefs: SeoPrefs }) {
  const db = supabaseServer();
  const [{ data: prompts }, { data: checks }] = await Promise.all([
    db.from("geo_prompts").select("id, prompt, created_at").eq("business_id", businessId).order("created_at"),
    db.from("geo_checks").select("id, prompt_id, run_id, engine, mentioned, rank, cited, sources, competitors, sentiment, answer, error, created_at").eq("business_id", businessId).gte("created_at", `${ago(120)}T00:00:00Z`).order("created_at", { ascending: false }).limit(3000),
  ]);
  const ok = (checks ?? []).filter((c) => !c.error);
  const lastRun = ok[0]?.run_id;
  const latest = ok.filter((c) => c.run_id === lastRun);
  const rate = (l: typeof ok) => (l.length ? Math.round((l.filter((c) => c.mentioned).length / l.length) * 100) : null);
  const runs = [...new Map(ok.map((c) => [c.run_id, c.created_at.slice(0, 10)])).entries()].reverse();
  const runDays = runs.map(([, d]) => d);
  const readyEngines = ENGINES.filter((e) => e.ready);
  const perEngine = readyEngines.map((e) => ({ name: e.label, values: runs.map(([id]) => rate(ok.filter((c) => c.run_id === id && c.engine === e.id))) })).filter((s) => s.values.some((v) => v != null));
  const sov = new Map<string, number>();
  latest.forEach((c) => (c.competitors ?? []).forEach((n: string) => sov.set(n, (sov.get(n) ?? 0) + 1)));
  (prefs.competitors ?? []).forEach((c) => { const n = latest.filter((x) => (x.answer ?? "").toLowerCase().includes(c.name.toLowerCase())).length; if (n) sov.set(c.name, Math.max(sov.get(c.name) ?? 0, n)); });
  const sovRows = [{ label: `${businessName} (you)`, value: latest.filter((c) => c.mentioned).length, highlight: true }, ...[...sov].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value }))];
  const cited = new Map<string, number>();
  latest.forEach((c) => (c.sources ?? []).forEach((s: string) => { try { const h = new URL(s).hostname.replace(/^www\./, ""); if (!/vertexaisearch|google\.com/.test(h)) cited.set(h, (cited.get(h) ?? 0) + 1); } catch { /* */ } }));
  const pageScores = (audit?.pages ?? []).filter((p) => p.status === 200 && p.html).map((p) => ({ p, g: pageGeo(p) })).sort((a, b) => a.g.score - b.g.score);
  const byPrompt = (id: string) => latest.filter((c) => c.prompt_id === id);
  const errors = (checks ?? []).filter((c) => c.error && c.run_id === (checks ?? [])[0]?.run_id);

  return (
    <div className="grid gap-5">
      <section className="card grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3"><Bot className="mt-0.5 h-5 w-5 text-lime-700" /><div><h2 className="text-[16px] font-semibold tracking-tight">AI visibility — do AI assistants recommend you?</h2><p className="text-[13px] text-stone-500">Growvia asks {readyEngines.map((e) => e.label).join(", ") || "AI assistants"} the questions your customers ask, and records whether they name you, cite your website, and who they recommend instead.</p></div></div>
          {prompts?.length ? <RunGeo /> : null}
        </div>
        {!readyEngines.length && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Add a free GEMINI_API_KEY in Vercel to start. Optional: PERPLEXITY_API_KEY and OPENAI_API_KEY to also check Perplexity and ChatGPT.</p>}
        {latest.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Mentioned", `${rate(latest)}%`, `of ${latest.length} answers`], ["Your site cited", `${Math.round((latest.filter((c) => c.cited).length / latest.length) * 100)}%`, "linked as a source"], ["Avg. position when named", (() => { const r = latest.filter((c) => c.rank); return r.length ? `#${(r.reduce((n, c) => n + c.rank!, 0) / r.length).toFixed(1)}` : "—"; })(), "among businesses listed"], ["Last checked", timeAgo(latest[0].created_at), `${prefs.geo ?? "weekly"} auto-check`]].map(([k, v, s]) => <div key={k} className="rounded-xl bg-paper p-4"><p className="text-[12px] text-stone-500">{k}</p><p className="text-[24px] font-semibold tabular-nums tracking-tight">{v}</p><p className="text-[12px] text-stone-400">{s}</p></div>)}
          </div>
        )}
        {errors.length > 0 && <p className="text-[12px] text-amber-700">Some checks failed last time: {[...new Set(errors.map((e) => `${e.engine}: ${e.error}`))].slice(0, 3).join(" · ")}</p>}
      </section>

      {runs.length > 1 && (
        <section className="card p-5"><h3 className="mb-3 text-[15px] font-semibold">Visibility over time</h3><LineChart title="AI visibility over time" labels={runDays} min={0} max={100} unit="percent" series={perEngine.length ? perEngine : [{ name: "All assistants", values: runs.map(([id]) => rate(ok.filter((c) => c.run_id === id))) }]} /></section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3"><h3 className="text-[15px] font-semibold">Questions tracked ({prompts?.length ?? 0})</h3></div>
        {prompts?.length ? (
          <ul className="divide-y divide-line">
            {prompts.map((p) => {
              const res = byPrompt(p.id);
              return (
                <li key={p.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <p className="min-w-0 flex-1 text-[14px]">{p.prompt}</p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">{res.map((c) => <span key={c.id} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.mentioned ? "bg-lime/25 text-lime-800" : "bg-red-50 text-red-700"}`}>{ENGINES.find((e) => e.id === c.engine)?.label.split(" ")[0] ?? c.engine}: {c.mentioned ? `yes${c.rank ? ` #${c.rank}` : ""}${c.cited ? " · cited" : ""}` : "no"}</span>)}</div>
                    <RemoveButton id={p.id} kind="prompt" label={p.prompt} />
                  </div>
                  {res.length > 0 && (
                    <details className="ml-5 mt-1 text-[13px]">
                      <summary className="cursor-pointer text-stone-500">See answers{res.some((c) => c.competitors?.length) ? ` · also named: ${[...new Set(res.flatMap((c) => c.competitors ?? []))].slice(0, 4).join(", ")}` : ""}</summary>
                      <div className="mt-2 grid gap-3">{res.map((c) => <div key={c.id} className="rounded-xl bg-paper p-3"><p className="mb-1 text-[12px] font-medium">{ENGINES.find((e) => e.id === c.engine)?.label}{c.sentiment && c.sentiment !== "not mentioned" ? ` · ${c.sentiment} about you` : ""}</p><p className="whitespace-pre-line text-stone-700">{(c.answer ?? "").slice(0, 1200)}{(c.answer ?? "").length > 1200 ? "…" : ""}</p>{c.sources?.length ? <p className="mt-1 truncate text-[11px] text-stone-400">Sources: {c.sources.slice(0, 5).join(" · ")}</p> : null}</div>)}</div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="p-5 text-[14px] text-stone-500">Add the questions your customers ask AI — or let Growvia suggest them.</p>}
        <div className="grid gap-4 border-t border-line p-5 lg:grid-cols-2"><PromptIdeas /><AddPrompts /></div>
      </section>

      {latest.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5"><h3 className="mb-1 text-[15px] font-semibold">Share of voice</h3><p className="mb-3 text-[12px] text-stone-500">How often each business was named in the latest check.</p><BarList rows={sovRows} /></section>
          <section className="card p-5"><h3 className="mb-1 text-[15px] font-semibold">Websites AI cites for these questions</h3><p className="mb-3 text-[12px] text-stone-500">Get listed or mentioned on these sites to be recommended more.</p><BarList rows={[...cited].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }))} /></section>
        </div>
      )}

      {audit && (
        <>
          <section className="card grid gap-4 p-5">
            <h3 className="text-[15px] font-semibold">Can AI crawlers read your site? <span className={`ml-1 ${audit.scores.ai != null && audit.scores.ai >= 85 ? "text-lime-700" : "text-amber-600"}`}>{audit.scores.ai}/100</span></h3>
            <AiBots site={audit.site} />
            <IssueList issues={audit.issues.filter((i) => i.category === "ai")} />
          </section>
          <section className="card overflow-x-auto">
            <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Page-by-page AI readiness</h3>
            <table className="w-full min-w-[600px] text-left text-[13px]"><thead className="text-[12px] text-stone-500"><tr><th className="px-5 py-2 font-medium">Page</th><th className="px-2 py-2 text-right font-medium">Score</th><th className="px-5 py-2 font-medium">Add this to get quoted more</th></tr></thead>
              <tbody className="divide-y divide-line">{pageScores.map(({ p, g }) => <tr key={p.url}><td className="max-w-[240px] truncate px-5 py-2 font-mono text-[12px]">{p.url.replace(audit.site.origin, "") || "/"}</td><td className={`px-2 py-2 text-right font-semibold tabular-nums ${g.score >= 70 ? "text-lime-700" : g.score >= 45 ? "text-amber-600" : "text-red-600"}`}>{g.score}</td><td className="px-5 py-2 text-stone-600">{g.missing.join(", ") || "All set"}</td></tr>)}</tbody>
            </table>
          </section>
          {audit.ai?.llmsTxt ? (
            <>
              <p className="text-[14px] text-stone-600">Upload these to your website root (e.g. <span className="font-mono">/llms.txt</span>) — your developer or CMS plugin can do it in minutes.</p>
              <FileBox name="llms.txt" text={audit.ai.llmsTxt} hint="A clean summary + key pages for AI assistants" />
              <FileBox name="robots.txt" text={audit.ai.robotsTxt ?? ""} hint="Allows search engines & AI search crawlers, keeps private paths blocked" />
              <FileBox name="schema.json" text={audit.ai.schema ?? ""} hint={`Paste inside <script type="application/ld+json"> in your home page <head>`} />
            </>
          ) : <StepButton id={audit.id} kind="ai" />}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Experts ───────────────────────── */

export function ExpertsTab({ audit }: { audit: AuditView & { experts?: ExpertPanel | null } }) {
  const p = audit.experts;
  const gradeTone = (g: string) => (g === "A" ? "bg-lime/30 text-lime-800" : g === "B" ? "bg-lime/15 text-lime-800" : g === "C" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700");
  const chip = (v: string) => (v === "now" || v === "high" ? "bg-ink text-white" : "bg-mist text-stone-600");
  if (!p) return (
    <div className="card grid gap-3 p-6"><div className="flex items-start gap-3"><Users className="mt-0.5 h-5 w-5 text-lime-700" /><div><h2 className="text-[16px] font-semibold">Expert panel</h2><p className="text-[14px] text-stone-500">Five specialists review your site — Technical SEO, Content, AI search (GEO), Local/Authority and Conversion — each with a grade and prioritised recommendations.</p></div></div><div><RunExperts id={audit.id} /></div></div>
  );
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] text-stone-500">{p.source === "gemini" ? `AI expert panel (Google Gemini ${p.model ?? ""}) — reviewed ${timeAgo(p.at)} using your audit, keywords and AI-visibility data.` : "Rule-based expert advice."} {p.error}</p><RunExperts id={audit.id} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {p.experts.map((e) => (
          <section key={e.id} className="card grid content-start gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-[16px] font-semibold tracking-tight">{e.role}</h3><p className="text-[12px] text-stone-500">{e.focus}</p></div>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[18px] font-bold ${gradeTone(e.grade)}`} aria-label={`Grade ${e.grade}`}>{e.grade}</span>
            </div>
            <p className="text-[14px] text-stone-700">{e.verdict}</p>
            <ol className="grid gap-2.5">
              {e.recommendations.map((r, i) => (
                <li key={i} className="rounded-xl bg-paper p-3">
                  <p className="text-[14px] font-medium">{r.title}</p>
                  <p className="mt-0.5 text-[13px] text-stone-600">{r.detail}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]"><span className={`rounded-full px-2 py-0.5 ${chip(r.when)}`}>{r.when}</span><span className={`rounded-full px-2 py-0.5 ${chip(r.impact)}`}>{r.impact} impact</span><span className="rounded-full bg-mist px-2 py-0.5 text-stone-600">{r.effort} effort</span></div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Reports ───────────────────────── */

export async function ReportsTab({ businessId, origin, sp }: { businessId: string; origin: string; sp: { preset?: string; from?: string; to?: string } }) {
  const preset = sp.preset ?? "30d";
  const range = cleanRange(preset === "custom" ? sp.from : undefined, preset === "custom" ? sp.to : undefined, preset);
  const r = await buildReport(supabaseServer(), businessId, range);
  if (!r) return null;
  const token = reportToken(businessId, range);
  const url = `${origin}/r/seo-report/${token}`;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePicker from={range.from} to={range.to} preset={preset} />
        <div className="flex flex-wrap items-center gap-2"><CopyButton text={url} label="Copy share link" /><Link href={`/r/seo-report/${token}?print=1`} target="_blank" className="btn-ghost h-9 px-3.5 text-[13px]">PDF</Link><SendReport from={range.from} to={range.to} /></div>
      </div>
      <p className="text-[13px] text-stone-500">{r.range.from} → {r.range.to} · compared with the previous {Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000) + 1} days</p>
      <ReportView r={r} />
    </div>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

export function SettingsTab({ prefs, userEmail }: { prefs: SeoPrefs; userEmail: string }) {
  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 text-[14px] text-stone-600"><Search className="h-4 w-4" /> These settings apply to this project only.</p>
      <SettingsForm prefs={prefs} engines={ENGINES.map((e) => ({ id: e.id, label: e.label, ready: e.ready, key: e.key }))} mailReady={systemMailReady} userEmail={userEmail} />
    </div>
  );
}
