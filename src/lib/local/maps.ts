import "server-only";

/* Google Maps "local pack" positions via SerpApi (engine=google_maps) or DataForSEO (maps SERP). */
const SERPAPI_KEY = process.env.SERPAPI_KEY?.trim() || "";
const SERPAPI_BASE = (process.env.SERPAPI_BASE?.trim() || "https://serpapi.com").replace(/\/$/, "");
const DFS_LOGIN = process.env.DATAFORSEO_LOGIN?.trim() || "";
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD?.trim() || "";
const DFS_BASE = (process.env.DATAFORSEO_BASE?.trim() || "https://api.dataforseo.com").replace(/\/$/, "");
export const mapsReady = Boolean(SERPAPI_KEY || (DFS_LOGIN && DFS_PASSWORD));
export const mapsProvider = SERPAPI_KEY ? "SerpApi" : DFS_LOGIN ? "DataForSEO" : null;

export type MapsHit = { position: number; title: string; placeId: string | null; rating: number | null; reviews: number | null; address?: string | null };
export type Target = { name: string; city?: string | null; placeId?: string | null; lat?: number | null; lng?: number | null };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\b(the|pvt|ltd|private|limited|llp|inc|co)\b/g, " ").replace(/\s+/g, " ").trim();

/** Is this Maps result the business? Place id when we have it, otherwise a careful name match. */
export function isSameBusiness(hit: Pick<MapsHit, "title" | "placeId">, t: Target) {
  if (t.placeId && hit.placeId) return t.placeId === hit.placeId;
  const a = norm(hit.title), b = norm(t.name);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

const withCity = (kw: string, city?: string | null) => (city && !kw.toLowerCase().includes(city.toLowerCase()) && !/near me/i.test(kw) ? `${kw} ${city}` : kw);

/** Top ~20 Google Maps results for a search, as a customer in that area would see them. */
export async function mapsSearch(keyword: string, t: Target): Promise<MapsHit[]> {
  const geo = t.lat != null && t.lng != null;
  const q = geo ? keyword : withCity(keyword, t.city);
  if (SERPAPI_KEY) {
    const p = new URLSearchParams({ engine: "google_maps", type: "search", q, hl: "en", api_key: SERPAPI_KEY, ...(geo ? { ll: `@${t.lat},${t.lng},14z` } : {}) });
    const r = await fetch(`${SERPAPI_BASE}/search.json?${p}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(/run out|searches left/i.test(d.error ?? "") ? "Your SerpApi searches for this month are used up." : d.error ?? `SerpApi error ${r.status}`);
    const list = (d.local_results ?? (d.place_results ? [d.place_results] : [])) as { position?: number; title: string; place_id?: string; rating?: number; reviews?: number; address?: string }[];
    return list.map((x, i) => ({ position: x.position ?? i + 1, title: x.title, placeId: x.place_id ?? null, rating: x.rating ?? null, reviews: x.reviews ?? null, address: x.address ?? null }));
  }
  if (DFS_LOGIN) {
    const r = await fetch(`${DFS_BASE}/v3/serp/google/maps/live/advanced`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(40000),
      headers: { Authorization: `Basic ${Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword: q, language_code: "en", depth: 20, ...(geo ? { location_coordinate: `${t.lat},${t.lng},14z` } : { location_code: 2356 }) }]),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || (d?.tasks?.[0]?.status_code ?? 20000) >= 40000) throw new Error(d?.tasks?.[0]?.status_message ?? `DataForSEO error ${r.status}`);
    const items = (d?.tasks?.[0]?.result?.[0]?.items ?? []) as { type: string; rank_group?: number; rank_absolute?: number; title: string; place_id?: string; rating?: { value?: number; votes_count?: number }; address?: string }[];
    return items.filter((x) => x.type === "maps_search").map((x, i) => ({ position: x.rank_group ?? x.rank_absolute ?? i + 1, title: x.title, placeId: x.place_id ?? null, rating: x.rating?.value ?? null, reviews: x.rating?.votes_count ?? null, address: x.address ?? null }));
  }
  throw new Error("Map rankings need a SERPAPI_KEY (or DataForSEO login) in Vercel.");
}

export async function mapsRank(keyword: string, t: Target) {
  const hits = await mapsSearch(keyword, t);
  const mine = hits.find((h) => isSameBusiness(h, t)) ?? null;
  return { position: mine?.position ?? null, rating: mine?.rating ?? null, reviews: mine?.reviews ?? null, top: hits.slice(0, 20).map((h) => ({ position: h.position, title: h.title, rating: h.rating, reviews: h.reviews, me: h === mine })) };
}
