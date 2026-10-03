import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSameBusiness, mapsReady, mapsSearch } from "../local/maps";
import type { LocalState } from "../local/sync";

/* Competitors: who you're up against on Google Maps, Google Search, reviews and AI answers — side by side. */

type Db = SupabaseClient;
export type Competitor = { id: string; name: string; website: string | null; place_id: string | null; address: string | null; source: string; created_at: string };
export type Biz = { id: string; owner_id: string; name: string; website: string | null; city: string | null; local_state?: LocalState | null };

import { MAX_COMPETITORS_ANY } from "@/lib/billing/catalog";
/** Hard ceiling per project (the Agency plan's limit); each plan's own limit is in LIMITS. */
export const MAX_COMPETITORS = MAX_COMPETITORS_ANY;
const day = (n = 0) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
export const hostOf = (u?: string | null) => { if (!u) return ""; try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const sameHost = (a: string, b: string) => Boolean(a && b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)));
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
/** Is this name mentioned in a piece of text (an AI answer)? Whole-word match on the normalised name. */
const mentions = (text: string, name: string) => { const n = norm(name); return n.length >= 3 && ` ${norm(text)} `.includes(` ${n} `); };

// Big directories and platforms show up in results but aren't competitors you can beat head-on.
const DIRECTORIES = /(^|\.)(zomato|swiggy|justdial|sulekha|magicpin|practo|yelp|tripadvisor|google|facebook|instagram|youtube|wikipedia|linkedin|quora|reddit|amazon|flipkart|indiamart|tradeindia|yellowpages|urbancompany|housing|99acres|magicbricks|nobroker|makemytrip|booking|agoda|eazydiner|dineout|lybrate|healthgrades|glassdoor|naukri|indeed|x|twitter|pinterest|medium|blogspot|wordpress|shiksha|collegedunia|nearbuy|groupon|mapquest|bing|apple|foursquare)\.[a-z.]+$/;

export type Subject = { id: string; name: string; website: string; placeId: string | null; me: boolean };
export type Row = {
  subject: Subject;
  rating: number | null; reviews: number | null; perMonth: number | null; trackingSince: string | null;
  maps: { keyword: string; position: number | null }[];
  google: { keyword: string; position: number | null }[];
  ai: { prompt: string; mentioned: boolean }[];
  aiRate: number | null;
  series: { day: string; reviews: number | null; rating: number | null }[];
};
export type Insight = { competitor: string; text: string; href: string; cta: string; weight: number };
export type Suggestion = { name: string; website: string | null; placeId: string | null; sources: string[]; score: number; note: string };

type LocalRank = { keyword_id: string; day: string; position: number | null; rating: number | null; reviews: number | null; top: { position: number; title: string; rating: number | null; reviews: number | null; me?: boolean }[] | null };
type SerpRow = { keyword_id: string; day: string; position: number | null; top: { position: number; host: string }[] | null };
type Check = { prompt_id: string; engine: string; mentioned: boolean; competitors: string[] | null; answer: string | null; created_at: string };

const latestBy = <T extends { day: string }>(rows: T[], key: (r: T) => string) => {
  const m = new Map<string, T>();
  for (const r of rows) { const k = key(r); const cur = m.get(k); if (!cur || r.day > cur.day) m.set(k, r); }
  return m;
};

/** Everything the Competitors pages show, computed from data Growvia already collects. */
export async function competitorData(db: Db, b: Biz) {
  const st = (b.local_state ?? {}) as LocalState;
  const [{ data: comps }, { data: snaps }, { data: lkw }, { data: lranks }, { data: skw }, { data: serp }, { data: prompts }, { data: checks }, { data: myReviews }] = await Promise.all([
    db.from("competitors").select("id, name, website, place_id, address, source, created_at").eq("business_id", b.id).order("created_at"),
    db.from("competitor_snapshots").select("subject, day, rating, reviews").eq("business_id", b.id).gte("day", day(365)).order("day"),
    db.from("local_keywords").select("id, keyword").eq("business_id", b.id).order("created_at"),
    db.from("local_ranks").select("keyword_id, day, position, rating, reviews, top").eq("business_id", b.id).gte("day", day(60)),
    db.from("seo_keywords").select("id, keyword").eq("business_id", b.id).order("created_at").limit(100),
    db.from("seo_rankings").select("keyword_id, day, position, top").eq("business_id", b.id).eq("source", "serp").gte("day", day(60)),
    db.from("geo_prompts").select("id, prompt").eq("business_id", b.id),
    db.from("geo_checks").select("prompt_id, engine, mentioned, competitors, answer, created_at").eq("business_id", b.id).is("error", null).gte("created_at", `${day(35)}T00:00:00Z`).order("created_at", { ascending: false }).limit(1000),
    db.from("gbp_reviews").select("created_at").eq("business_id", b.id).gte("created_at", `${day(90)}T00:00:00Z`),
  ]);
  const list = (comps ?? []) as Competitor[];
  const localLatest = latestBy((lranks ?? []) as LocalRank[], (r) => r.keyword_id);
  const serpLatest = latestBy((serp ?? []) as SerpRow[], (r) => r.keyword_id);
  // Latest answer per question and assistant.
  const seen = new Set<string>();
  const latestChecks = ((checks ?? []) as Check[]).filter((c) => { const k = `${c.prompt_id}:${c.engine}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const promptText = new Map((prompts ?? []).map((p) => [p.id as string, p.prompt as string]));

  const me: Subject = { id: "me", name: st.location?.title ?? st.profile?.title ?? b.name, website: hostOf(b.website), placeId: st.location?.placeId ?? null, me: true };
  const subjects: Subject[] = [me, ...list.map((c) => ({ id: c.id, name: c.name, website: hostOf(c.website), placeId: c.place_id, me: false }))];

  const rows: Row[] = subjects.map((s) => {
    const maps = (lkw ?? []).map((k) => {
      const r = localLatest.get(k.id);
      if (!r) return { keyword: k.keyword, position: null, checked: false };
      if (s.me) return { keyword: k.keyword, position: r.position, checked: true };
      const hit = (r.top ?? []).find((t) => !t.me && isSameBusiness({ title: t.title, placeId: null }, { name: s.name, placeId: null }));
      return { keyword: k.keyword, position: hit?.position ?? null, checked: true };
    }).filter((x) => x.checked).map(({ keyword, position }) => ({ keyword, position }));
    const google = (skw ?? []).map((k) => {
      const r = serpLatest.get(k.id);
      if (!r) return null;
      if (s.me) return { keyword: k.keyword, position: r.position };
      if (!s.website || !r.top) return null;
      return { keyword: k.keyword, position: r.top.find((t) => sameHost(t.host, s.website))?.position ?? null };
    }).filter(Boolean) as { keyword: string; position: number | null }[];
    const byPrompt = new Map<string, boolean>();
    for (const c of latestChecks) {
      const hit = s.me ? c.mentioned : (c.competitors ?? []).some((n) => isSameBusiness({ title: n, placeId: null }, { name: s.name, placeId: null })) || mentions(c.answer ?? "", s.name);
      byPrompt.set(c.prompt_id, (byPrompt.get(c.prompt_id) ?? false) || hit);
    }
    const ai = [...byPrompt].map(([id, mentioned]) => ({ prompt: promptText.get(id) ?? "(deleted question)", mentioned }));
    const aiChecks = latestChecks.length;
    const aiHits = latestChecks.filter((c) => (s.me ? c.mentioned : (c.competitors ?? []).some((n) => isSameBusiness({ title: n, placeId: null }, { name: s.name, placeId: null })) || mentions(c.answer ?? "", s.name))).length;

    const series = (snaps ?? []).filter((x) => x.subject === s.id).map((x) => ({ day: x.day as string, reviews: x.reviews as number | null, rating: x.rating == null ? null : Number(x.rating) }));
    // Fallbacks for today's numbers: Business Profile (you), or what Google Maps showed in your tracked searches.
    let rating = series.at(-1)?.rating ?? null, reviews = series.at(-1)?.reviews ?? null;
    if (s.me && st.profile?.reviews != null) { rating = st.profile.rating ?? rating; reviews = st.profile.reviews; }
    if (rating == null || reviews == null) {
      for (const r of localLatest.values()) {
        const t = s.me ? (r.position != null ? { rating: r.rating, reviews: r.reviews } : null) : (r.top ?? []).find((x) => !x.me && isSameBusiness({ title: x.title, placeId: null }, { name: s.name, placeId: null }));
        if (t?.reviews != null && (reviews == null || t.reviews > reviews)) { reviews = t.reviews; rating = t.rating ?? rating; }
      }
    }
    // Reviews per month: exact for you when the Business Profile is connected; otherwise from weekly snapshots (needs 2+ weeks).
    let perMonth: number | null = null;
    const withCount = series.filter((x) => x.reviews != null);
    const first = withCount[0], last = withCount.at(-1);
    if (s.me && st.google && (myReviews ?? []).length) perMonth = Math.round(((myReviews ?? []).length / 3) * 10) / 10;
    else if (first && last && first !== last) {
      const days = (new Date(last.day).getTime() - new Date(first.day).getTime()) / 86400000;
      if (days >= 13) perMonth = Math.max(0, Math.round((((last.reviews! - first.reviews!) / days) * 30) * 10) / 10);
    }
    return { subject: s, rating, reviews, perMonth, trackingSince: first?.day ?? null, maps, google, ai, aiRate: aiChecks ? Math.round((aiHits / aiChecks) * 100) : null, series };
  });

  const mine = rows[0];
  const insights: Insight[] = [];
  for (const r of rows.slice(1)) {
    const n = r.subject.name;
    if (r.reviews != null && mine.reviews != null && r.reviews > Math.max(mine.reviews * 1.3, mine.reviews + 10))
      insights.push({ competitor: n, weight: 9, text: `${n} has ${r.reviews.toLocaleString("en-IN")} Google reviews to your ${mine.reviews.toLocaleString("en-IN")}. Review count is one of the biggest Google Maps ranking signals — ask every happy customer.`, href: "/app/local?tab=reviews", cta: "Get your review link" });
    if (r.perMonth != null && (mine.perMonth ?? 0) < r.perMonth * 0.7)
      insights.push({ competitor: n, weight: 8, text: `${n} is getting about ${r.perMonth} new reviews a month${mine.perMonth != null ? ` vs your ${mine.perMonth}` : ""}. At this pace the gap keeps growing.`, href: "/app/local?tab=reviews", cta: "Ask for reviews" });
    if (r.rating != null && mine.rating != null && r.rating - mine.rating >= 0.2)
      insights.push({ competitor: n, weight: 6, text: `${n} is rated ${r.rating}★ vs your ${mine.rating}★. Reply to every unhappy review and fix what people complain about — ratings recover over time.`, href: "/app/local?tab=reviews", cta: "Reply to reviews" });
    const mapsLost = r.maps.filter((m) => m.position != null && (mine.maps.find((x) => x.keyword === m.keyword)?.position ?? 99) > m.position);
    if (mapsLost.length) {
      const m = mapsLost[0], my = mine.maps.find((x) => x.keyword === m.keyword)?.position;
      insights.push({ competitor: n, weight: 7 + Math.min(3, mapsLost.length), text: `${n} beats you on Google Maps for ${mapsLost.length === 1 ? `“${m.keyword}”` : `${mapsLost.length} searches, like “${m.keyword}”`} (#${m.position} vs ${my ? `your #${my}` : "you not in the top 20"}).`, href: "/app/local?tab=profile", cta: "Strengthen your profile" });
    }
    const googleLost = r.google.filter((g) => g.position != null && g.position <= 10 && (mine.google.find((x) => x.keyword === g.keyword)?.position ?? 101) > g.position);
    if (googleLost.length) {
      const g = googleLost[0], my = mine.google.find((x) => x.keyword === g.keyword)?.position;
      insights.push({ competitor: n, weight: 6 + Math.min(3, googleLost.length), text: `${n} ranks #${g.position} on Google for “${g.keyword}”${my ? ` — you're #${my}` : " — you're not in the top 100"}${googleLost.length > 1 ? `, and beats you on ${googleLost.length - 1} more keyword${googleLost.length > 2 ? "s" : ""}` : ""}.`, href: "/app/seo?tab=keywords", cta: "Improve that page" });
    }
    const aiLost = r.ai.filter((a) => a.mentioned && !mine.ai.find((x) => x.prompt === a.prompt)?.mentioned);
    if (aiLost.length) insights.push({ competitor: n, weight: 7 + Math.min(3, aiLost.length), text: `AI assistants recommend ${n} but not you for ${aiLost.length === 1 ? `“${aiLost[0].prompt}”` : `${aiLost.length} questions, like “${aiLost[0].prompt}”`}.`, href: "/app/seo?tab=geo", cta: "Fix AI visibility" });
  }
  insights.sort((x, y) => y.weight - x.weight);

  // Suggestions: businesses that keep showing up next to you, in Maps, Google and AI answers.
  const added = (name: string, host?: string | null) => list.some((c) => isSameBusiness({ title: c.name, placeId: null }, { name, placeId: null }) || (host && sameHost(hostOf(c.website), host)));
  const sug = new Map<string, Suggestion>();
  const add = (key: string, s: Omit<Suggestion, "score" | "sources"> & { source: string }) => {
    const cur = sug.get(key) ?? { name: s.name, website: s.website, placeId: s.placeId, sources: [], score: 0, note: s.note };
    cur.score++; if (!cur.sources.includes(s.source)) cur.sources.push(s.source);
    if (!cur.website && s.website) cur.website = s.website;
    sug.set(key, cur);
  };
  for (const r of localLatest.values()) for (const t of (r.top ?? []).slice(0, 10)) {
    if (t.me || isSameBusiness({ title: t.title, placeId: null }, { name: me.name, placeId: null }) || added(t.title)) continue;
    add(`n:${norm(t.title)}`, { name: t.title, website: null, placeId: null, source: "Google Maps", note: t.rating ? `${t.rating}★ · ${t.reviews ?? 0} reviews` : "" });
  }
  for (const r of serpLatest.values()) for (const t of (r.top ?? []).slice(0, 10)) {
    if (DIRECTORIES.test(t.host) || sameHost(t.host, me.website) || added(t.host, t.host)) continue;
    // Same business seen by name on Maps and by website on Google (pizzapalace.in ↔ "Pizza Palace") → one suggestion.
    const byName = [...sug.entries()].find(([k, v]) => k.startsWith("n:") && !v.website && norm(v.name).replace(/ /g, "").length >= 5 && t.host.replace(/[^a-z0-9]/g, "").includes(norm(v.name).replace(/ /g, "")));
    if (byName) { add(byName[0], { name: byName[1].name, website: t.host, placeId: null, source: "Google", note: "" }); continue; }
    add(`h:${t.host}`, { name: t.host, website: t.host, placeId: null, source: "Google", note: "" });
  }
  for (const c of latestChecks) for (const n of c.competitors ?? []) {
    if (added(n) || isSameBusiness({ title: n, placeId: null }, { name: me.name, placeId: null })) continue;
    add(`n:${norm(n)}`, { name: n, website: null, placeId: null, source: "AI answers", note: "" });
  }
  const suggestions = [...sug.values()].sort((a, b2) => b2.sources.length - a.sources.length || b2.score - a.score).slice(0, 8);

  return { competitors: list, rows, insights, suggestions, has: { maps: (lkw ?? []).length > 0, google: (skw ?? []).length > 0 && (serp ?? []).length > 0, ai: latestChecks.length > 0 } };
}

/** Weekly: today's public Google rating and review count for you and every competitor (one Maps search each). */
export async function refreshSnapshots(db: Db, b: Biz, deadline = Date.now() + 40_000) {
  if (!mapsReady) return { ok: false as const, error: "Rating & review tracking needs a SERPAPI_KEY (or DataForSEO login) in Vercel." };
  const st = (b.local_state ?? {}) as LocalState;
  const { data: comps } = await db.from("competitors").select("id, name, website, place_id, address").eq("business_id", b.id).limit(MAX_COMPETITORS);
  const today = day();
  let done = 0, found = 0, lastError: string | null = null;
  const put = (subject: string, rating: number | null, reviews: number | null) =>
    db.from("competitor_snapshots").upsert({ business_id: b.id, owner_id: b.owner_id, subject, day: today, rating, reviews }, { onConflict: "business_id,subject,day" });
  // You: the Business Profile numbers are exact, so no search is needed when it's connected.
  if (st.profile?.reviews != null) { await put("me", st.profile.rating ?? null, st.profile.reviews); found++; }
  const targets = [...(st.profile?.reviews != null ? [] : [{ id: "me", name: st.location?.title ?? b.name, place_id: st.location?.placeId ?? null, address: null as string | null }]), ...((comps ?? []) as { id: string; name: string; place_id: string | null; address: string | null }[])];
  for (const t of targets) {
    if (Date.now() > deadline) break;
    try {
      const hits = await mapsSearch(t.name, { name: t.name, city: b.city, placeId: t.place_id });
      const hit = hits.find((h) => isSameBusiness(h, { name: t.name, placeId: t.place_id })) ?? (hits.length === 1 ? hits[0] : null);
      done++;
      if (!hit) continue;
      found++;
      await put(t.id, hit.rating, hit.reviews);
      if (t.id !== "me" && (!t.place_id || !t.address)) await db.from("competitors").update({ place_id: t.place_id ?? hit.placeId, address: t.address ?? hit.address ?? null }).eq("id", t.id);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Google Maps search failed";
      if (/used up|api key|invalid/i.test(lastError)) break;
    }
  }
  await db.from("businesses").update({ local_state: { ...st, competitors_at: new Date().toISOString() } }).eq("id", b.id);
  if (!done && lastError) return { ok: false as const, error: lastError };
  return { ok: true as const, checked: done, found };
}

/** Keeps the AI share-of-voice list (SEO settings) in step with the Competitors page. */
export async function syncSeoPrefs(db: Db, businessId: string) {
  const [{ data: comps }, { data: biz }] = await Promise.all([
    db.from("competitors").select("name, website").eq("business_id", businessId).order("created_at").limit(MAX_COMPETITORS),
    db.from("businesses").select("seo_prefs").eq("id", businessId).maybeSingle(),
  ]);
  const prefs = (biz?.seo_prefs ?? {}) as Record<string, unknown>;
  await db.from("businesses").update({ seo_prefs: { ...prefs, competitors: (comps ?? []).map((c) => ({ name: c.name, ...(c.website ? { domain: c.website } : {}) })) } }).eq("id", businessId);
}
