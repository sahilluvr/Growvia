import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, SecretError } from "../server/crypto";
import { accessFromRefresh, GscError, searchData } from "../google/gsc";
import { crawlSite, CrawlError } from "./crawl";
import { buildIssues, scoreAudit } from "./audit";
import { pageSpeed } from "./psi";
import { generateSeoAi } from "./ai";
import { expertPanel, type GeoSummary } from "./experts";
import { auditAlert } from "./alerts";
import type { GscData, Issue, PageResult, SiteInfo, SpeedResult } from "./types";

/* Shared by the buttons in the app (user session) and the scheduler (service role). */

type Db = SupabaseClient;
export type SeoBiz = {
  id: string; owner_id: string; name: string; website: string | null; segment: string; city: string | null; goal: string | null; audience: string | null; offer: string | null; voice: string | null;
  gsc_refresh_enc?: string | null; gsc_site?: string | null; seo_state?: Record<string, unknown> | null; seo_prefs?: Record<string, unknown> | null;
};
export const BIZ_COLS = "id, owner_id, name, website, segment, city, goal, audience, offer, voice, gsc_refresh_enc, gsc_site, seo_state, seo_prefs";

export async function gscSnapshot(b: Pick<SeoBiz, "gsc_refresh_enc" | "gsc_site">): Promise<{ data: GscData | null; error?: string }> {
  if (!b.gsc_refresh_enc || !b.gsc_site) return { data: null };
  try {
    return { data: await searchData(await accessFromRefresh(decrypt(b.gsc_refresh_enc)), b.gsc_site) };
  } catch (e) {
    return { data: null, error: e instanceof GscError || e instanceof SecretError ? e.message : "Couldn't load Search Console data." };
  }
}

/** Crawl + checks + Search Console snapshot. Returns the new audit id. */
export async function performAudit(db: Db, b: SeoBiz, { trigger = "manual", budgetMs = 40000 }: { trigger?: string; budgetMs?: number } = {}): Promise<{ ok: boolean; id?: string; error?: string; score?: number }> {
  if (!b.website) return { ok: false, error: "Add your website address first." };
  const { data: row, error } = await db.from("seo_audits").insert({ owner_id: b.owner_id, business_id: b.id, url: b.website, status: "running", trigger }).select("id").single();
  if (error || !row) return { ok: false, error: error?.message ?? "Couldn't start the audit." };
  try {
    const [{ site, pages }, gsc] = await Promise.all([crawlSite(b.website, { maxPages: 25, budgetMs }), gscSnapshot(b)]);
    const issues = buildIssues(site, pages);
    const scores = scoreAudit(issues);
    await db.from("seo_audits").update({ status: "done", url: site.finalUrl, site, pages, issues, scores, score: scores.overall, gsc: gsc.data, error: gsc.error ?? null, finished_at: new Date().toISOString() }).eq("id", row.id);
    await db.from("activity").insert({ owner_id: b.owner_id, business_id: b.id, agent: "SEO Analyst", text: `${trigger === "schedule" ? "Weekly check of" : "Audited"} ${new URL(site.finalUrl).host}: score ${scores.overall}/100, ${issues.filter((i) => i.severity === "critical").length} critical issues.`, tag: "SEO" });
    await db.from("businesses").update({ seo_state: { ...(b.seo_state ?? {}), audit_at: new Date().toISOString() } }).eq("id", b.id);
    await auditAlert(db, b, row.id, trigger).catch(() => null);
    return { ok: true, id: row.id, score: scores.overall };
  } catch (e) {
    const msg = e instanceof CrawlError ? e.message : "The audit failed unexpectedly — try again.";
    await db.from("seo_audits").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, id: row.id, error: msg };
  }
}

type AuditRow = { id: string; business_id: string; url: string; site: SiteInfo; pages: PageResult[]; issues: Issue[]; scores: Record<string, number>; speed: { mobile?: SpeedResult; desktop?: SpeedResult }; gsc: GscData | null };
const loadAudit = async (db: Db, id: string) => (await db.from("seo_audits").select("id, business_id, url, site, pages, issues, scores, speed, gsc").eq("id", id).maybeSingle()).data as AuditRow | null;

export async function performSpeed(db: Db, auditId: string) {
  const a = await loadAudit(db, auditId);
  if (!a) return { ok: false, error: "Audit not found." };
  const url = a.site?.finalUrl ?? a.url;
  const [mobile, desktop] = await Promise.all([pageSpeed(url, "mobile"), pageSpeed(url, "desktop")]);
  const speed = { mobile, desktop };
  const scores = scoreAudit(a.issues ?? [], speed);
  await db.from("seo_audits").update({ speed, scores, score: scores.overall }).eq("id", auditId);
  return mobile.ok || desktop.ok ? { ok: true } : { ok: false, error: mobile.error ?? desktop.error };
}

export async function performAi(db: Db, b: SeoBiz, auditId: string) {
  const a = await loadAudit(db, auditId);
  if (!a?.site) return { ok: false, error: "Run the audit first." };
  const ai = await generateSeoAi(b, a.site, a.pages ?? [], a.issues ?? [], a.speed ?? {}, a.gsc);
  await db.from("seo_audits").update({ ai }).eq("id", auditId);
  return { ok: true, message: ai.error && ai.source === "rules" ? ai.error : undefined };
}

export async function geoSummary(db: Db, businessId: string, sinceDays = 35): Promise<GeoSummary> {
  const { data } = await db.from("geo_checks").select("mentioned, cited, competitors, prompt_id").eq("business_id", businessId).is("error", null).gt("created_at", new Date(Date.now() - sinceDays * 86400000).toISOString()).limit(2000);
  if (!data?.length) return null;
  const counts = new Map<string, number>();
  data.forEach((c) => (c.competitors ?? []).forEach((n: string) => counts.set(n, (counts.get(n) ?? 0) + 1)));
  return {
    prompts: new Set(data.map((d) => d.prompt_id)).size, checks: data.length,
    mentionRate: data.filter((d) => d.mentioned).length / data.length, citedRate: data.filter((d) => d.cited).length / data.length,
    topCompetitors: [...counts].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
  };
}

/** Latest known position per tracked keyword. */
export async function keywordPositions(db: Db, businessId: string) {
  const [{ data: kws }, { data: ranks }] = await Promise.all([
    db.from("seo_keywords").select("id, keyword").eq("business_id", businessId),
    db.from("seo_rankings").select("keyword_id, day, position").eq("business_id", businessId).gt("day", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)).order("day", { ascending: false }).limit(3000),
  ]);
  return (kws ?? []).map((k) => ({ keyword: k.keyword, position: (ranks ?? []).find((r) => r.keyword_id === k.id)?.position ?? null }));
}

export async function performExperts(db: Db, b: SeoBiz, auditId: string) {
  const a = await loadAudit(db, auditId);
  if (!a?.site) return { ok: false, error: "Run the audit first." };
  const [geo, kws] = await Promise.all([geoSummary(db, b.id), keywordPositions(db, b.id)]);
  const panel = await expertPanel(b, a.site, a.pages ?? [], a.issues ?? [], a.scores ?? {}, a.speed ?? {}, a.gsc, geo, kws);
  await db.from("seo_audits").update({ experts: panel }).eq("id", auditId);
  return { ok: true, message: panel.error };
}
