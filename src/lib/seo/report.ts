import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signId } from "../server/crypto";
import { esc, layout, sendSystemEmail } from "../mail/system";
import type { ExpertPanel, Issue, Scores } from "./types";

type Db = SupabaseClient;
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export type Range = { from: string; to: string };
export function presetRange(p: string): Range {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const back = (n: number) => iso(new Date(today.getTime() - n * 86400000));
  if (p === "7d") return { from: back(6), to: iso(today) };
  if (p === "90d") return { from: back(89), to: iso(today) };
  if (p === "month") return { from: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))), to: iso(today) };
  if (p === "lastmonth") { const s = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)); const e = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); return { from: iso(s), to: iso(e) }; }
  return { from: back(29), to: iso(today) };
}
export function cleanRange(from?: string, to?: string, preset = "30d"): Range {
  const ok = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(D(s).getTime()));
  if (ok(from) && ok(to) && from! <= to!) return { from: from!, to: to! };
  return presetRange(preset);
}
export const reportToken = (businessId: string, r: Range) => signId(`${businessId}~${r.from}~${r.to}`, "seo-range");

export type ReportData = {
  range: Range;
  business: { id: string; name: string; website: string | null };
  audits: { id: string; day: string; score: number | null; scores: Scores }[];
  start?: { score: number | null; scores: Scores; issues: Issue[] } | null;
  end?: { score: number | null; scores: Scores; issues: Issue[]; experts: ExpertPanel | null; quickWins: string[] } | null;
  fixed: Issue[]; added: Issue[];
  traffic: { day: string; clicks: number; impressions: number; position: number | null }[];
  totals: { clicks: number; impressions: number; prevClicks: number; prevImpressions: number; position: number | null; prevPosition: number | null };
  keywords: { id: string; keyword: string; start: number | null; end: number | null; best: number | null; clicks: number; impressions: number; series: { day: string; position: number | null }[] }[];
  geo: { runs: { day: string; rate: number; cited: number; checks: number }[]; byEngine: { engine: string; rate: number; checks: number }[]; rate: number | null; prevRate: number | null; checks: number; shareOfVoice: { name: string; count: number; you?: boolean }[]; prompts: { prompt: string; engines: Record<string, boolean> }[] };
};

/** Everything a weekly / monthly / custom report needs, for one project and date range. */
export async function buildReport(db: Db, businessId: string, range: Range): Promise<ReportData | null> {
  const { data: b } = await db.from("businesses").select("id, name, website, seo_prefs").eq("id", businessId).maybeSingle();
  if (!b) return null;
  const toEnd = `${range.to}T23:59:59Z`;
  const days = Math.round((D(range.to).getTime() - D(range.from).getTime()) / 86400000) + 1;
  const prevFrom = iso(new Date(D(range.from).getTime() - days * 86400000));
  const [{ data: audits }, { data: before }, { data: daily }, { data: kws }, { data: ranks }, { data: checks }, { data: prompts }] = await Promise.all([
    db.from("seo_audits").select("id, created_at, score, scores").eq("business_id", businessId).eq("status", "done").gte("created_at", `${range.from}T00:00:00Z`).lte("created_at", toEnd).order("created_at").limit(200),
    db.from("seo_audits").select("id, score, scores, issues").eq("business_id", businessId).eq("status", "done").lt("created_at", `${range.from}T00:00:00Z`).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("seo_daily").select("day, clicks, impressions, position").eq("business_id", businessId).gte("day", prevFrom).lte("day", range.to).order("day"),
    db.from("seo_keywords").select("id, keyword").eq("business_id", businessId).order("created_at"),
    db.from("seo_rankings").select("keyword_id, day, position, clicks, impressions, source").eq("business_id", businessId).gte("day", range.from).lte("day", range.to).order("day").limit(20000),
    db.from("geo_checks").select("prompt_id, engine, mentioned, cited, competitors, created_at").eq("business_id", businessId).is("error", null).gte("created_at", `${prevFrom}T00:00:00Z`).lte("created_at", toEnd).order("created_at").limit(5000),
    db.from("geo_prompts").select("id, prompt").eq("business_id", businessId),
  ]);
  const lastId = audits?.at(-1)?.id;
  const [{ data: endRow }, { data: firstRow }] = await Promise.all([
    lastId ? db.from("seo_audits").select("score, scores, issues, experts, ai").eq("id", lastId).maybeSingle() : Promise.resolve({ data: null }),
    !before && audits?.[0] ? db.from("seo_audits").select("score, scores, issues").eq("id", audits[0].id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const start = before ?? firstRow ?? null;
  const end = endRow ? { score: endRow.score, scores: endRow.scores, issues: endRow.issues ?? [], experts: endRow.experts ?? null, quickWins: endRow.ai?.quickWins ?? [] } : null;
  const ids = (l?: Issue[] | null) => new Set((l ?? []).map((i) => i.id));
  const fixed = start && end ? (start.issues as Issue[]).filter((i) => !ids(end.issues).has(i.id)) : [];
  const added = start && end ? (end.issues as Issue[]).filter((i) => !ids(start.issues as Issue[]).has(i.id)) : [];

  const inRange = (daily ?? []).filter((d) => d.day >= range.from);
  const prev = (daily ?? []).filter((d) => d.day < range.from);
  const avgPos = (l: typeof inRange) => { const w = l.reduce((n, d) => n + d.impressions, 0); return w ? Math.round((l.reduce((n, d) => n + Number(d.position ?? 0) * d.impressions, 0) / w) * 10) / 10 : null; };

  const keywords = (kws ?? []).map((k) => {
    const rs = (ranks ?? []).filter((r) => r.keyword_id === k.id);
    const pos = rs.filter((r) => r.position != null);
    // Daily history comes from Search Console; live SERP checks are occasional spot checks, used only when there's no Search Console data.
    const src = rs.some((r) => r.source === "gsc") ? "gsc" : "serp";
    const byDay = new Map<string, number | null>();
    for (const r of rs) if (r.source === src) byDay.set(r.day, r.position == null ? null : Number(r.position));
    const series = [...byDay].sort((a, c) => a[0].localeCompare(c[0])).map(([day, position]) => ({ day, position }));
    const known = series.filter((s) => s.position != null);
    return { id: k.id, keyword: k.keyword, start: known[0]?.position ?? null, end: known.at(-1)?.position ?? null, best: pos.length ? Math.min(...pos.map((p) => Number(p.position))) : null, clicks: rs.reduce((n, r) => n + (r.clicks ?? 0), 0), impressions: rs.reduce((n, r) => n + (r.impressions ?? 0), 0), series };
  });

  const cur = (checks ?? []).filter((c) => c.created_at >= `${range.from}T00:00:00Z`);
  const old = (checks ?? []).filter((c) => c.created_at < `${range.from}T00:00:00Z`);
  const rate = (l: typeof cur) => (l.length ? l.filter((c) => c.mentioned).length / l.length : null);
  const byDay = new Map<string, typeof cur>();
  cur.forEach((c) => { const d = c.created_at.slice(0, 10); byDay.set(d, [...(byDay.get(d) ?? []), c]); });
  const engines = [...new Set(cur.map((c) => c.engine))];
  const sov = new Map<string, number>();
  cur.forEach((c) => (c.competitors ?? []).forEach((n: string) => sov.set(n, (sov.get(n) ?? 0) + 1)));
  const you = cur.filter((c) => c.mentioned).length;
  const latestByPrompt = new Map<string, Record<string, boolean>>();
  cur.forEach((c) => latestByPrompt.set(c.prompt_id, { ...(latestByPrompt.get(c.prompt_id) ?? {}), [c.engine]: c.mentioned }));

  return {
    range,
    business: { id: b.id, name: b.name, website: b.website },
    audits: (audits ?? []).map((a) => ({ id: a.id, day: a.created_at.slice(0, 10), score: a.score, scores: a.scores })),
    start: start ? { score: start.score, scores: start.scores, issues: start.issues ?? [] } : null,
    end, fixed, added,
    traffic: inRange.map((d) => ({ day: d.day, clicks: d.clicks, impressions: d.impressions, position: d.position == null ? null : Number(d.position) })),
    totals: { clicks: inRange.reduce((n, d) => n + d.clicks, 0), impressions: inRange.reduce((n, d) => n + d.impressions, 0), prevClicks: prev.reduce((n, d) => n + d.clicks, 0), prevImpressions: prev.reduce((n, d) => n + d.impressions, 0), position: avgPos(inRange), prevPosition: avgPos(prev) },
    keywords,
    geo: {
      runs: [...byDay].map(([day, l]) => ({ day, rate: Math.round(((rate(l) ?? 0) * 100)), cited: l.filter((c) => c.cited).length, checks: l.length })),
      byEngine: engines.map((e) => { const l = cur.filter((c) => c.engine === e); return { engine: e, rate: Math.round((rate(l) ?? 0) * 100), checks: l.length }; }),
      rate: rate(cur) == null ? null : Math.round(rate(cur)! * 100), prevRate: rate(old) == null ? null : Math.round(rate(old)! * 100), checks: cur.length,
      shareOfVoice: ([{ name: b.name as string, count: you, you: true }] as { name: string; count: number; you?: boolean }[]).concat([...sov].sort((x, y) => y[1] - x[1]).slice(0, 7).map(([name, count]) => ({ name, count }))).filter((x) => x.count > 0 || x.you),
      prompts: (prompts ?? []).map((p) => ({ prompt: p.prompt, engines: latestByPrompt.get(p.id) ?? {} })),
    },
  };
}

const arrow = (d: number, invert = false) => (d === 0 ? "→" : (d > 0) !== invert ? "▲" : "▼");
const color = (d: number, invert = false) => (d === 0 ? "#6E736D" : (d > 0) !== invert ? "#4E7A06" : "#DC2626");

/** Emails a report summary with a link to the full interactive report. */
export async function sendSeoReport(db: Db, b: { id: string; name: string }, range: Range, to: string[], origin: string) {
  const r = await buildReport(db, b.id, range);
  if (!r) return { ok: false as const, error: "Project not found." };
  const url = `${origin}/r/seo-report/${reportToken(b.id, range)}`;
  const kpi = (label: string, value: string, delta?: string, c = "#6E736D") => `<td style="padding:10px;border:1px solid #E4E4DE;border-radius:12px;width:25%"><div style="font-size:12px;color:#6E736D">${label}</div><div style="font-size:22px;font-weight:700">${value}</div>${delta ? `<div style="font-size:12px;color:${c}">${delta}</div>` : ""}</td>`;
  const sd = r.end && r.start ? (r.end.score ?? 0) - (r.start.score ?? 0) : 0;
  const cd = r.totals.clicks - r.totals.prevClicks;
  const gd = r.geo.rate != null && r.geo.prevRate != null ? r.geo.rate - r.geo.prevRate : 0;
  const movers = r.keywords.filter((k) => k.start != null && k.end != null).map((k) => ({ ...k, d: k.start! - k.end! })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 6);
  const body = `<p style="margin:0 0 16px;color:#4F534E;font-size:14px">${esc(r.business.website ?? "")} · ${r.range.from} → ${r.range.to}</p>
<table role="presentation" width="100%" cellspacing="6"><tr>
${kpi("SEO score", `${r.end?.score ?? "—"}`, r.start ? `${arrow(sd)} ${Math.abs(sd)} pts` : undefined, color(sd))}
${kpi("AI visibility", r.geo.rate != null ? `${r.geo.rate}%` : "—", r.geo.prevRate != null ? `${arrow(gd)} ${Math.abs(gd)} pts` : undefined, color(gd))}
${kpi("Google clicks", `${r.totals.clicks}`, r.totals.prevClicks || r.totals.clicks ? `${arrow(cd)} ${Math.abs(cd)}` : undefined, color(cd))}
${kpi("Avg. position", r.totals.position != null ? `${r.totals.position}` : "—")}
</tr></table>
${r.fixed.length ? `<p style="margin:18px 0 6px;font-weight:600">✅ Fixed (${r.fixed.length})</p><ul style="margin:0;padding-left:18px;font-size:14px;color:#4F534E">${r.fixed.slice(0, 6).map((i) => `<li>${esc(i.title)}</li>`).join("")}</ul>` : ""}
${movers.length ? `<p style="margin:18px 0 6px;font-weight:600">Keyword movement</p><table width="100%" style="font-size:14px;border-collapse:collapse">${movers.map((m) => `<tr><td style="padding:4px 0">${esc(m.keyword)}</td><td align="right" style="color:${color(m.d)}">${m.end!.toFixed(1)} ${arrow(m.d)} ${Math.abs(m.d).toFixed(1)}</td></tr>`).join("")}</table>` : ""}
${r.end?.quickWins?.length ? `<p style="margin:18px 0 6px;font-weight:600">Do next</p><ul style="margin:0;padding-left:18px;font-size:14px;color:#4F534E">${r.end.quickWins.slice(0, 4).map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}`;
  return sendSystemEmail({ to, subject: `${r.business.name} — SEO & AI visibility report (${r.range.from} → ${r.range.to})`, html: layout({ title: `${r.business.name}: your SEO report`, preheader: `SEO ${r.end?.score ?? "—"} · AI visibility ${r.geo.rate ?? "—"}% · ${r.totals.clicks} Google clicks`, body, cta: { label: "Open the full report", url } }) });
}
