import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../server/crypto";
import { accessFromRefresh, gscQuery } from "../google/gsc";
import { rankAlert } from "./alerts";

type Db = SupabaseClient;
const day = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

export type Biz = { id: string; owner_id: string; website: string | null; city?: string | null; gsc_refresh_enc?: string | null; gsc_site?: string | null; seo_state?: Record<string, unknown> | null; seo_prefs?: Record<string, unknown> | null };

/**
 * Pulls Google Search data into Growvia: daily site totals + daily position for every tracked keyword.
 * First run backfills ~90 days (Search Console keeps 16 months); later runs refresh the last week.
 */
export async function syncSearchConsole(db: Db, b: Biz, { full = false }: { full?: boolean } = {}) {
  if (!b.gsc_refresh_enc || !b.gsc_site) return { ok: false as const, error: "Connect Google Search Console first." };
  const access = await accessFromRefresh(decrypt(b.gsc_refresh_enc));
  const first = !b.seo_state?.gsc_synced_at || full;
  const range = { startDate: day(daysAgo(first ? 92 : 9)), endDate: day(daysAgo(1)) };
  const [daily, kws, pages] = await Promise.all([
    gscQuery(access, b.gsc_site, { ...range, dimensions: ["date"], rowLimit: 500 }),
    db.from("seo_keywords").select("id, keyword, target_url").eq("business_id", b.id).limit(200),
    gscQuery(access, b.gsc_site, { startDate: day(daysAgo(29)), endDate: range.endDate, dimensions: ["query", "page"], rowLimit: 5000 }),
  ]);
  if (daily.length) {
    await db.from("seo_daily").upsert(daily.map((r) => ({ business_id: b.id, owner_id: b.owner_id, day: r.keys![0], clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 1000) / 10, position: Math.round(r.position * 10) / 10 })), { onConflict: "business_id,day" });
  }
  const keywords = kws.data ?? [];
  // Best page per keyword → fill in the target URL when it's empty.
  const bestPage = new Map<string, { page: string; clicks: number; impressions: number }>();
  for (const r of pages) {
    const [q, page] = r.keys ?? [];
    const cur = bestPage.get(q);
    if (!cur || r.clicks > cur.clicks || (r.clicks === cur.clicks && r.impressions > cur.impressions)) bestPage.set(q, { page, clicks: r.clicks, impressions: r.impressions });
  }
  let rows = 0;
  for (let i = 0; i < keywords.length; i += 5) {
    await Promise.all(keywords.slice(i, i + 5).map(async (k) => {
      const series = await gscQuery(access, b.gsc_site!, { ...range, dimensions: ["date"], dimensionFilterGroups: [{ filters: [{ dimension: "query", operator: "equals", expression: k.keyword }] }], rowLimit: 500 });
      const url = bestPage.get(k.keyword)?.page ?? null;
      if (series.length) {
        rows += series.length;
        await db.from("seo_rankings").upsert(series.map((r) => ({ owner_id: b.owner_id, business_id: b.id, keyword_id: k.id, day: r.keys![0], source: "gsc", position: Math.round(r.position * 10) / 10, clicks: r.clicks, impressions: r.impressions, url })), { onConflict: "keyword_id,day,source" });
      }
      if (!k.target_url && url) await db.from("seo_keywords").update({ target_url: url }).eq("id", k.id);
    }));
  }
  await db.from("businesses").update({ seo_state: { ...(b.seo_state ?? {}), gsc_synced_at: new Date().toISOString() } }).eq("id", b.id);
  if (!first) await rankAlert(db, { id: b.id, owner_id: b.owner_id, name: (b as { name?: string }).name ?? "Your project" }).catch(() => null);
  return { ok: true as const, days: daily.length, keywords: keywords.length, rows };
}

/* ───────── Optional exact Google positions (any keyword, incl. ones you don't rank for yet) ───────── */

const SERPAPI_KEY = process.env.SERPAPI_KEY?.trim() || "";
const DFS_LOGIN = process.env.DATAFORSEO_LOGIN?.trim() || "";
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD?.trim() || "";
const SERPAPI_BASE = (process.env.SERPAPI_BASE?.trim() || "https://serpapi.com").replace(/\/$/, "");
const DFS_BASE = (process.env.DATAFORSEO_BASE?.trim() || "https://api.dataforseo.com").replace(/\/$/, "");
export const serpReady = Boolean(SERPAPI_KEY || (DFS_LOGIN && DFS_PASSWORD));
export const serpProvider = SERPAPI_KEY ? "SerpApi" : DFS_LOGIN ? "DataForSEO" : null;

const hostOf = (u: string) => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** Live Google position for a keyword (top 100). null = not in the top 100. */
export async function serpPosition(keyword: string, website: string, location?: string | null): Promise<{ position: number | null; url: string | null; competitors: string[]; top: { position: number; host: string }[] }> {
  const host = hostOf(website);
  let results: { url: string; position: number }[] = [];
  if (SERPAPI_KEY) {
    const q = new URLSearchParams({ engine: "google", q: keyword, num: "100", api_key: SERPAPI_KEY, ...(location ? { location } : {}) });
    const r = await fetch(`${SERPAPI_BASE}/search.json?${q}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error ?? `SerpApi error ${r.status}`);
    results = (d.organic_results ?? []).map((x: { link: string; position: number }) => ({ url: x.link, position: x.position }));
  } else if (DFS_LOGIN) {
    const r = await fetch(`${DFS_BASE}/v3/serp/google/organic/live/regular`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(40000),
      headers: { Authorization: `Basic ${Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword, depth: 100, language_code: "en", ...(location ? { location_name: location } : { location_code: 2356 }) }]),
    });
    const d = await r.json();
    const items = d?.tasks?.[0]?.result?.[0]?.items ?? [];
    if (!r.ok || (d?.tasks?.[0]?.status_code ?? 20000) >= 40000) throw new Error(d?.tasks?.[0]?.status_message ?? `DataForSEO error ${r.status}`);
    results = items.filter((x: { type: string }) => x.type === "organic").map((x: { url: string; rank_absolute: number }) => ({ url: x.url, position: x.rank_absolute }));
  } else throw new Error("No SERP API key configured.");
  const mine = results.find((x) => hostOf(x.url) === host || hostOf(x.url).endsWith(`.${host}`));
  // Top 20 results (by site) are kept so Competitors can compare positions head-to-head.
  const top: { position: number; host: string }[] = [];
  for (const x of results.slice(0, 40)) { const h = hostOf(x.url); if (h && !top.some((t) => t.host === h)) top.push({ position: x.position, host: h }); if (top.length >= 20) break; }
  return { position: mine?.position ?? null, url: mine?.url ?? null, competitors: [...new Set(results.slice(0, 10).map((x) => hostOf(x.url)).filter((h) => h && h !== host))].slice(0, 5), top };
}

/* ───────── Free keyword ideas (Google autocomplete) ───────── */

const SUGGEST_BASE = (process.env.SUGGEST_BASE?.trim() || "https://suggestqueries.google.com").replace(/\/$/, "");
export async function autocomplete(seed: string, hl = "en"): Promise<string[]> {
  try {
    const r = await fetch(`${SUGGEST_BASE}/complete/search?${new URLSearchParams({ client: "firefox", hl, q: seed })}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    return Array.isArray(d?.[1]) ? (d[1] as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
