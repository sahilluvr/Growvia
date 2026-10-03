import Link from "next/link";
import type { Metadata } from "next";
import { Bot, FileText, Globe, Search, Share2, Sparkles, TrendingUp } from "lucide-react";
import { requireBusiness, withProject, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { CopyButton } from "@/components/app/bits";
import { timeAgo, fmtDate } from "@/lib/format";
import { signId } from "@/lib/server/crypto";
import { aiReady } from "@/lib/ai/gemini";
import { gscReady } from "@/lib/google/gsc";
import { CATEGORY_LABEL, type Category } from "@/lib/seo/types";
import { CategoryBars, IssueList, Plan, ScoreRing, SpeedCard, verdict, type AuditView } from "./views";
import { ExpertsTab, GeoTab, KeywordsTab, ReportsTab, SettingsTab } from "./tabs";
import { LineChart } from "@/components/charts/LineChart";
import { pageGeo } from "@/lib/seo/audit";
import type { ExpertPanel, SeoPrefs } from "@/lib/seo/types";
import { GscDisconnect, GscPicker, RunAudit, StepButton, WebsiteForm } from "./client";

export const metadata: Metadata = { title: "SEO & AI search" };
export const maxDuration = 60; // the crawl, speed test and AI each get up to a minute

const TABS = [["overview", "Overview"], ["geo", "AI visibility"], ["keywords", "Keywords"], ["issues", "Issues"], ["experts", "Experts"], ["plan", "Plan"], ["reports", "Reports"], ["pages", "Pages"], ["speed", "Speed"], ["search", "Google Search"], ["settings", "Settings"]] as const;

export default async function SeoPage({ searchParams }: { searchParams: { tab?: string; audit?: string; gsc?: string; gsc_error?: string; cat?: string; preset?: string; from?: string; to?: string } }) {
  const db = supabaseServer();
  const tab = searchParams.tab === "ai" ? "geo" : TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab! : "overview";
  const { business, user, data: [{ data: history }, { data: gscRow }] } = await withProject((id) => Promise.all([
    db.from("seo_audits").select("id, score, scores, status, created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(60),
    db.from("businesses").select("gsc_email, gsc_site, gsc_sites, gsc_refresh_enc, seo_prefs").eq("id", id).maybeSingle(),
  ]));
  const pickId = searchParams.audit && /^[0-9a-f-]{36}$/i.test(searchParams.audit) ? searchParams.audit : (history ?? []).find((h) => h.status !== "running")?.id ?? history?.[0]?.id;
  const { data: row } = pickId ? await db.from("seo_audits").select("*").eq("id", pickId).eq("business_id", business.id).maybeSingle() : { data: null };
  const a = row as (AuditView & { experts?: ExpertPanel | null }) | null;
  const prefs = (gscRow?.seo_prefs ?? {}) as SeoPrefs;
  const trend = [...(history ?? [])].filter((h) => h.status === "done").reverse();
  const gscConnected = Boolean(gscRow?.gsc_refresh_enc);

  if (!business.website) {
    return (
      <>
        <PageHeader title="SEO & AI search" sub={`Get ${business.name} found on Google, Maps, ChatGPT, Perplexity and Google AI Overviews.`} />
        <div className="card grid gap-5 p-6 sm:p-8">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-lime"><Globe className="h-5 w-5" /></span><div><h2 className="text-[18px] font-semibold tracking-tight">Add your website</h2><p className="text-[14px] text-stone-500">Growvia checks it like Google and AI assistants do, then tells you exactly what to fix.</p></div></div>
          <WebsiteForm />
          <WhatWeCheck />
        </div>
      </>
    );
  }

  const host = business.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = a ? signId(a.id, "seo-report") : "";
  const reportUrl = a ? `${siteOrigin()}/r/seo/${token}` : "";
  const byCat = (c: Category) => (a?.issues ?? []).filter((i) => i.category === c);
  const crit = (a?.issues ?? []).filter((i) => i.severity === "critical").length;
  const qs = (o: Record<string, string>) => `/app/seo?${new URLSearchParams({ ...(a && searchParams.audit ? { audit: a.id } : {}), ...o })}`;

  return (
    <>
      <PageHeader title="SEO & AI search" sub={`${host} · ${a?.finished_at ? `checked ${timeAgo(a.finished_at)}` : a?.status === "running" ? "audit running…" : "not checked yet"}`}>
        {a?.status === "done" && <Link href={`/r/seo/${token}?print=1`} target="_blank" className="btn-ghost h-10 px-4 text-[14px]"><FileText className="h-4 w-4" /> PDF report</Link>}
        <RunAudit label={a ? "Run new audit" : "Run first audit"} />
      </PageHeader>

      {!a ? (
        <div className="card grid gap-5 p-6 sm:p-8">
          <div><h2 className="text-[18px] font-semibold tracking-tight">Ready to check {host}</h2><p className="text-[14px] text-stone-500">Takes about a minute. Change the address: <span className="inline-block align-middle"><WebsiteForm current={business.website} /></span></p></div>
          <WhatWeCheck />
          {!aiReady && <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">Tip: add a free <b>GEMINI_API_KEY</b> in Vercel so Growvia&apos;s AI writes your plan, page titles and content ideas (without it you get a rule-based plan).</p>}
        </div>
      ) : a.status === "failed" ? (
        <div className="card grid gap-3 p-6"><p className="text-[15px] font-medium text-red-700">The last audit couldn&apos;t finish</p><p className="text-[14px] text-stone-600">{a.error}</p><WebsiteForm current={business.website} /></div>
      ) : a.status === "running" ? (
        <div className="card p-6 text-[14px] text-stone-600">An audit is running — this page updates when it finishes.</div>
      ) : (
        <>
          <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="SEO sections">
            {TABS.map(([k, l]) => (
              <Link key={k} href={qs({ tab: k })} aria-current={tab === k ? "page" : undefined} className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14px] ${tab === k ? "border-ink font-medium text-ink" : "border-transparent text-stone-500 hover:text-ink"}`}>
                {l}{k === "issues" && a.issues.length ? <span className="ml-1.5 rounded-full bg-mist px-1.5 py-0.5 text-[11px] tabular-nums">{a.issues.length}</span> : null}
              </Link>
            ))}
          </nav>

          {tab === "overview" && (
            <div className="grid gap-5">
              <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
                <div className="card flex flex-col items-center gap-2 p-6 text-center">
                  <ScoreRing value={a.score} size={150} label="SEO score" />
                  {a.score != null && <p className="text-[15px] font-semibold">{verdict(a.score)}</p>}
                  <p className="text-[13px] text-stone-500">{a.site.crawled} pages checked · {crit} critical issue{crit === 1 ? "" : "s"}</p>
                  {a.scores.speed == null && <div className="mt-2"><StepButton id={a.id} kind="speed" /></div>}
                </div>
                <div className="card grid content-start gap-5 p-6">
                  <CategoryBars scores={a.scores} />
                  {a.ai?.summary ? <p className="rounded-xl bg-paper p-4 text-[14px] leading-relaxed text-stone-700"><Sparkles className="mr-1.5 inline h-4 w-4 text-lime-700" />{a.ai.summary}</p> : <StepButton id={a.id} kind="ai" />}
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="text-[15px] font-semibold">Fix these first</h2><Link href={qs({ tab: "issues" })} className="text-[13px] text-stone-500 hover:text-ink">All issues →</Link></div>
                  <IssueList issues={a.issues} limit={6} showPages={false} />
                </section>
                <section className="card grid content-start gap-4 p-5">
                  <h2 className="text-[15px] font-semibold">At a glance</h2>
                  <ul className="grid gap-2 text-[14px]">
                    {[
                      ["Secure (HTTPS)", a.site.https],
                      ["Sitemap", a.site.sitemap.found, a.site.sitemap.found ? `${a.site.sitemap.urls} URLs` : ""],
                      ["robots.txt", a.site.robots.found],
                      ["llms.txt for AI assistants", a.site.llms.found],
                      ["AI search crawlers allowed", a.site.aiBots.filter((b) => /Search|User|Perplexity/.test(b.name)).every((b) => b.allowed)],
                      ["Business schema", !a.issues.some((i) => i.id === "no-org-schema")],
                      ["Google Search Console", gscConnected && Boolean(gscRow?.gsc_site), a.gsc ? `${a.gsc.totals.clicks} clicks / 28 days` : ""],
                    ].map(([k, v, note]) => (
                      <li key={k as string} className="flex items-center justify-between gap-2"><span className="text-stone-600">{k as string}</span><span className={`text-[13px] font-medium ${v ? "text-lime-700" : "text-red-600"}`}>{v ? `✓ ${note || "Yes"}` : "✗ Missing"}</span></li>
                    ))}
                  </ul>
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    <Share2 className="h-4 w-4 text-stone-500" /><span className="text-[13px] text-stone-600">Share this report with a client:</span>
                    <CopyButton text={reportUrl} label="Copy link" />
                  </div>
                </section>
              </div>
              {trend.length > 1 && (
                <section className="card p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold"><TrendingUp className="h-4 w-4" /> SEO score over time</h2>
                  <LineChart title="SEO score over time" labels={trend.map((h) => h.created_at.slice(0, 10))} min={0} max={100} series={[{ name: "Overall", values: trend.map((h) => h.score) }, { name: "AI search", values: trend.map((h) => h.scores?.ai ?? null) }, { name: "Technical", values: trend.map((h) => h.scores?.technical ?? null) }, { name: "On-page", values: trend.map((h) => h.scores?.onpage ?? null) }]} />
                  <p className="mt-2 text-[12px] text-stone-500">Growvia re-checks automatically ({prefs.audit ?? "weekly"}) — change it in Settings. <Link href={qs({ tab: "reports" })} className="underline">Open reports →</Link></p>
                </section>
              )}
            </div>
          )}

          {tab === "issues" && (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-1.5">
                {(["all", "technical", "onpage", "content", "ai", "social"] as const).map((c) => (
                  <Link key={c} href={qs({ tab: "issues", ...(c === "all" ? {} : { cat: c }) })} className={`rounded-full border px-3 py-1.5 text-[13px] ${(searchParams.cat ?? "all") === c ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>
                    {c === "all" ? `All (${a.issues.length})` : `${CATEGORY_LABEL[c]} (${byCat(c).length})`}
                  </Link>
                ))}
              </div>
              <section className="card overflow-hidden"><IssueList issues={searchParams.cat ? byCat(searchParams.cat as Category) : a.issues} /></section>
            </div>
          )}

          {tab === "pages" && (
            <section className="card overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead className="border-b border-line text-[12px] text-stone-500"><tr>{["Page", "Status", "Title", "Description", "H1", "Words", "Schema", "AI ready", "Load"].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {a.pages.map((p) => (
                    <tr key={p.url} className="align-top">
                      <td className="max-w-[220px] px-3 py-2.5"><a href={p.url} target="_blank" rel="noreferrer" className="block truncate font-mono text-[12px] hover:underline">{p.url.replace(a.site.origin, "") || "/"}</a>{p.noindex && <span className="text-[11px] text-red-600">noindex</span>}</td>
                      <td className={`px-3 py-2.5 tabular-nums ${p.status === 200 ? "text-lime-700" : "text-red-600"}`}>{p.status || "—"}</td>
                      <td className={`max-w-[220px] px-3 py-2.5 ${!p.title || p.title.length > 65 || p.title.length < 25 ? "text-amber-700" : ""}`}><span className="line-clamp-2">{p.title ?? "Missing"}</span><span className="text-[11px] text-stone-400">{p.title?.length ?? 0} chars</span></td>
                      <td className={`max-w-[240px] px-3 py-2.5 ${!p.description ? "text-amber-700" : "text-stone-600"}`}><span className="line-clamp-2">{p.description ?? "Missing"}</span></td>
                      <td className={`max-w-[160px] px-3 py-2.5 ${p.h1.length !== 1 ? "text-amber-700" : ""}`}><span className="line-clamp-2">{p.h1[0] ?? "Missing"}</span></td>
                      <td className={`px-3 py-2.5 tabular-nums ${p.words < 250 ? "text-amber-700" : ""}`}>{p.words}</td>
                      <td className="px-3 py-2.5 text-[12px] text-stone-500">{p.schema.slice(0, 3).join(", ") || "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{p.status === 200 ? pageGeo(p).score : "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums text-stone-500">{(p.ms / 1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "speed" && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] text-stone-600">Google&apos;s own Lighthouse test plus real Chrome-user data. Google ranks on the <b>mobile</b> result.</p>
                <StepButton id={a.id} kind="speed" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2"><SpeedCard s={a.speed?.mobile} label="Mobile" /><SpeedCard s={a.speed?.desktop} label="Desktop" /></div>
              {a.site.heavyImages.length > 0 && <section className="card p-5"><h3 className="mb-2 text-[15px] font-semibold">Heavy images</h3><ul className="grid gap-1 font-mono text-[12px] text-stone-600">{a.site.heavyImages.map((i) => <li key={i.url} className="flex justify-between gap-3"><span className="truncate">{i.url}</span><span className="shrink-0">{i.kb} KB</span></li>)}</ul></section>}
            </div>
          )}

          {tab === "geo" && <GeoTab businessId={business.id} businessName={business.name} audit={a} prefs={prefs} />}
          {tab === "keywords" && <KeywordsTab businessId={business.id} gsc={Boolean(gscRow?.gsc_site && gscConnected)} />}
          {tab === "experts" && <ExpertsTab audit={a} />}
          {tab === "reports" && <ReportsTab businessId={business.id} origin={siteOrigin()} sp={searchParams} />}
          {tab === "settings" && <SettingsTab prefs={prefs} userEmail={user.email} />}

          {tab === "plan" && (
            !a.ai?.plan ? <div className="card grid gap-3 p-6"><p className="text-[14px]">Generate your step-by-step plan, page rewrites, keywords and content ideas.</p><StepButton id={a.id} kind="ai" /></div> : (
              <div className="grid gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] text-stone-500">{a.ai.source === "gemini" ? `Written by Google Gemini (${a.ai.model}) from your audit${a.gsc ? " and Search Console data" : ""}.` : "Built from the audit rules."} {a.ai.error}</p>
                  <StepButton id={a.id} kind="ai" />
                </div>
                {a.ai.summary && <p className="card p-5 text-[15px] leading-relaxed">{a.ai.summary}</p>}
                {!!a.ai.quickWins?.length && <section className="card p-5"><h3 className="mb-2 text-[15px] font-semibold">Quick wins (under an hour each)</h3><ul className="grid list-disc gap-1.5 pl-5 text-[14px] text-stone-700">{a.ai.quickWins.map((q) => <li key={q}>{q}</li>)}</ul></section>}
                <Plan ai={a.ai} />
                {!!a.ai.pageFixes?.length && (
                  <section className="card overflow-hidden">
                    <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">New titles & descriptions — copy into your CMS</h3>
                    <ul className="divide-y divide-line">
                      {a.ai.pageFixes.map((f) => {
                        const cur = a.pages.find((p) => p.url === f.url);
                        return (
                          <li key={f.url} className="grid gap-1.5 p-4 text-[13px]">
                            <span className="font-mono text-[12px] text-stone-500">{f.url.replace(a.site.origin, "") || "/"}</span>
                            <div className="flex items-start justify-between gap-2"><div><span className="text-stone-400">Title: </span><b className="font-medium">{f.title}</b> <span className="text-[11px] text-stone-400">({f.title.length})</span>{cur?.title && <div className="text-[12px] text-stone-400 line-through">{cur.title}</div>}</div><CopyButton text={f.title} /></div>
                            <div className="flex items-start justify-between gap-2"><div><span className="text-stone-400">Description: </span>{f.description} <span className="text-[11px] text-stone-400">({f.description.length})</span></div><CopyButton text={f.description} /></div>
                            {f.h1 && <div><span className="text-stone-400">H1: </span>{f.h1}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                <div className="grid gap-5 lg:grid-cols-2">
                  {!!a.ai.keywords?.length && <section className="card overflow-hidden"><h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Keywords to target</h3><ul className="divide-y divide-line">{a.ai.keywords.map((k) => <li key={k.keyword} className="grid gap-0.5 px-5 py-2.5 text-[13px]"><span><b className="font-medium">{k.keyword}</b> <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-stone-600">{k.intent}</span></span>{(k.note || k.page) && <span className="text-stone-500">{k.note}{k.note && k.page ? " · " : ""}{k.page && <span className="font-mono text-[11px]">{k.page.replace(a.site.origin, "") || "/"}</span>}</span>}</li>)}</ul></section>}
                  {!!a.ai.contentIdeas?.length && <section className="card overflow-hidden"><h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Content to create</h3><ul className="divide-y divide-line">{a.ai.contentIdeas.map((c) => <li key={c.title} className="px-5 py-3 text-[13px]"><p className="font-medium">{c.title} <span className="rounded-full bg-lime/25 px-2 py-0.5 text-[11px] text-lime-800">{c.type}</span></p><p className="text-stone-500">Target: {c.target}</p>{c.outline.length > 0 && <ul className="mt-1 list-disc pl-5 text-stone-600">{c.outline.map((o) => <li key={o}>{o}</li>)}</ul>}</li>)}</ul></section>}
                </div>
                {!!a.ai.faq?.length && <section className="card p-5"><h3 className="mb-3 text-[15px] font-semibold">FAQ to add to your site (AI assistants love these)</h3><dl className="grid gap-3 text-[14px]">{a.ai.faq.map((f) => <div key={f.q}><dt className="font-medium">{f.q}</dt><dd className="text-stone-600">{f.a}</dd></div>)}</dl></section>}
              </div>
            )
          )}

          {tab === "search" && (
            <div className="grid gap-5">
              {searchParams.gsc_error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{searchParams.gsc_error === "setup" ? "Google sign-in isn't set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel (steps below)." : searchParams.gsc_error}</p>}
              {searchParams.gsc === "connected" && <p className="rounded-xl bg-lime/20 px-4 py-3 text-[14px] text-lime-800">Search Console connected. Click “Refresh data” to load your numbers.</p>}
              {!gscConnected ? (
                <section className="card grid gap-3 p-6">
                  <div className="flex items-start gap-3"><Search className="mt-0.5 h-5 w-5 text-lime-700" /><div><h2 className="text-[16px] font-semibold tracking-tight">Connect Google Search Console</h2><p className="text-[14px] text-stone-500">See the real searches people use to find you, your clicks and positions — and Growvia&apos;s AI plans around them (e.g. keywords stuck on page 2).</p></div></div>
                  <div><a href="/api/oauth/google/start" className="btn-primary h-10 px-4 text-[14px]">Sign in with Google</a></div>
                  {!gscReady && <SetupGoogle origin={siteOrigin()} />}
                </section>
              ) : (
                <>
                  <section className="card flex flex-wrap items-center justify-between gap-3 p-5 text-[14px]">
                    <div className="grid gap-1"><span>Connected as <b>{gscRow?.gsc_email ?? "Google account"}</b> <GscDisconnect /></span>{(gscRow?.gsc_sites?.length ?? 0) > 0 && <GscPicker sites={gscRow!.gsc_sites} current={gscRow?.gsc_site ?? null} />}</div>
                    {gscRow?.gsc_site && <StepButton id={a.id} kind="gsc" />}
                  </section>
                  {a.gsc ? <GscView g={a.gsc} origin={a.site.origin} /> : <p className="text-[14px] text-stone-500">{gscRow?.gsc_site ? "No data loaded yet — click Refresh data." : "Pick the Search Console property for this website above."}</p>}
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function GscView({ g, origin }: { g: NonNullable<AuditView["gsc"]>; origin: string }) {
  const striking = g.queries.filter((q) => q.position >= 4 && q.position <= 20 && q.impressions >= 10).sort((x, y) => y.impressions - x.impressions).slice(0, 10);
  const table = (rows: typeof g.queries, key: string, strip = false) => (
    <table className="w-full text-left text-[13px]">
      <thead className="text-[12px] text-stone-500"><tr><th className="px-4 py-2 font-medium">{key}</th><th className="px-2 py-2 text-right font-medium">Clicks</th><th className="px-2 py-2 text-right font-medium">Shown</th><th className="px-2 py-2 text-right font-medium">CTR</th><th className="px-4 py-2 text-right font-medium">Position</th></tr></thead>
      <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.key}><td className="max-w-[280px] truncate px-4 py-2">{strip ? r.key.replace(origin, "") || "/" : r.key}</td><td className="px-2 py-2 text-right tabular-nums">{r.clicks}</td><td className="px-2 py-2 text-right tabular-nums">{r.impressions}</td><td className="px-2 py-2 text-right tabular-nums">{r.ctr}%</td><td className="px-4 py-2 text-right tabular-nums">{r.position}</td></tr>)}</tbody>
    </table>
  );
  return (
    <>
      <p className="text-[13px] text-stone-500">{g.site} · {g.range.start} to {g.range.end}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Clicks", g.totals.clicks], ["Times shown", g.totals.impressions], ["Click rate", `${g.totals.ctr}%`], ["Avg. position", g.totals.position]].map(([k, v]) => <div key={k as string} className="card p-4"><div className="text-[12px] text-stone-500">{k as string}</div><div className="text-[24px] font-semibold tabular-nums tracking-tight">{v as string}</div></div>)}
      </div>
      {striking.length > 0 && <section className="card overflow-hidden"><h3 className="border-b border-line px-4 py-3 text-[15px] font-semibold">Almost on page 1 — biggest opportunities</h3>{table(striking, "Search")}</section>}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card overflow-x-auto"><h3 className="border-b border-line px-4 py-3 text-[15px] font-semibold">Top searches</h3>{table(g.queries.slice(0, 25), "Search")}</section>
        <section className="card overflow-x-auto"><h3 className="border-b border-line px-4 py-3 text-[15px] font-semibold">Top pages</h3>{table(g.pages.slice(0, 25), "Page", true)}</section>
      </div>
    </>
  );
}

function SetupGoogle({ origin }: { origin: string }) {
  return (
    <div className="rounded-xl bg-mist p-4 text-[13px] text-stone-700">
      <p className="mb-1.5 font-medium text-ink">One-time setup (free, ~5 minutes)</p>
      <ol className="grid list-decimal gap-1 pl-5">
        <li>console.cloud.google.com → create a project → <b>APIs & Services → Library</b> → enable <b>Google Search Console API</b>.</li>
        <li><b>OAuth consent screen</b> → External → add your email as a test user.</li>
        <li><b>Credentials → Create credentials → OAuth client ID</b> → Web application → Authorized redirect URI: <code className="rounded bg-white px-1 font-mono">{origin}/api/oauth/google/callback</code></li>
        <li>In Vercel add <code className="font-mono">GOOGLE_CLIENT_ID</code> and <code className="font-mono">GOOGLE_CLIENT_SECRET</code>, then redeploy.</li>
      </ol>
    </div>
  );
}

function WhatWeCheck() {
  const items = [
    ["Technical SEO", "HTTPS, redirects, robots.txt, sitemap, broken links, canonicals, mobile, soft 404s"],
    ["On-page", "Titles, descriptions, headings, image alt text, duplicates, internal links"],
    ["AI search (GEO)", "Whether ChatGPT, Claude, Perplexity & Gemini can crawl you, llms.txt, schema, FAQs"],
    ["Speed", "Google PageSpeed on mobile & desktop, Core Web Vitals from real visitors"],
    ["Content", "Thin pages, FAQs, About/Contact trust signals"],
    ["Your plan", "AI-written weekly plan, new titles, llms.txt, schema, keywords & content ideas"],
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([t, d]) => <li key={t} className="rounded-xl bg-paper p-4"><p className="text-[14px] font-medium">{t}</p><p className="text-[13px] text-stone-500">{d}</p></li>)}
    </ul>
  );
}
