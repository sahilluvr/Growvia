import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../server/crypto";
import { accessFromRefresh } from "../google/gsc";
import { GoogleApiError } from "../google/api";
import { dailyMetrics, getProfile, listReviews, mediaCount, monthlyKeywords, recentPosts, stars, type GbpLocation, type GbpProfile } from "../google/gbp";
import { mapsRank, mapsReady } from "./maps";
import { notify } from "../notify";
import { refreshSnapshots } from "../competitors/core";

type Db = SupabaseClient;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

export type AuditItem = { id: string; label: string; ok: boolean; tip: string; weight: number };
export type LocalProfile = {
  title: string; phone: string | null; website: string | null; category: string | null; extraCategories: number; address: string | null; description: string;
  hours: boolean; specialHours: boolean; rating: number | null; reviews: number | null; photos: number | null; lastPost: string | null; replyRate: number | null; unanswered: number;
  mapsUri: string | null; newReviewUri: string | null; open: string | null;
};
export type LocalState = {
  google?: { refresh_enc: string; email: string | null; at: string };
  locations?: GbpLocation[];
  locations_error?: string;
  location?: GbpLocation;
  synced_at?: string;
  sync_error?: string | null;
  sync_error_kind?: string | null;
  profile?: LocalProfile;
  audit?: { score: number; items: AuditItem[]; at: string };
  rank_at?: string;
  rank_error?: string | null;
  competitors_at?: string;
  public?: { rating: number | null; reviews: number | null; at: string }; // from Google Maps when the API isn't available
};

export type LocalBiz = { id: string; owner_id: string; name: string; city?: string | null; local_state?: LocalState | null };

/** Profile check — what Google rewards in the Maps pack, scored out of 100. */
export function buildAudit(p: LocalProfile): { score: number; items: AuditItem[] } {
  const recentPost = p.lastPost ? Date.now() - new Date(p.lastPost).getTime() < 8 * 86400000 : false;
  const items: AuditItem[] = [
    { id: "category", label: "Primary category set", ok: Boolean(p.category), weight: 12, tip: "Pick the category that matches what people search (e.g. “Italian restaurant”, not just “Restaurant”)." },
    { id: "extra_categories", label: "2+ additional categories", ok: p.extraCategories >= 2, weight: 6, tip: "Add every category that genuinely fits — each one lets you appear for more searches." },
    { id: "description", label: "Description of 250+ characters", ok: p.description.trim().length >= 250, weight: 8, tip: "Describe what you offer, where, and why people choose you (up to 750 characters). Growvia can write it." },
    { id: "phone", label: "Phone number", ok: Boolean(p.phone), weight: 8, tip: "Add a phone number so people can call straight from Maps." },
    { id: "website", label: "Website link", ok: Boolean(p.website), weight: 8, tip: "Link your website (or booking page) — it's one of the main actions people take." },
    { id: "hours", label: "Opening hours", ok: p.hours, weight: 10, tip: "Add your regular hours — profiles without hours rank lower and lose “open now” searches." },
    { id: "address", label: "Address or service area", ok: Boolean(p.address), weight: 6, tip: "Add your address, or the areas you serve if you visit customers." },
    { id: "photos", label: "10+ photos", ok: (p.photos ?? 0) >= 10, weight: 10, tip: "Upload real photos of your place, team and work. Profiles with photos get far more direction requests." },
    { id: "posts", label: "Posted in the last 7 days", ok: recentPost, weight: 8, tip: "Share an update or offer every week — schedule them from Content with “Google Business” posts." },
    { id: "reviews", label: "20+ Google reviews", ok: (p.reviews ?? 0) >= 20, weight: 10, tip: "Ask happy customers for a review — send them your review link by WhatsApp or email." },
    { id: "rating", label: "Rating 4.3★ or higher", ok: (p.rating ?? 0) >= 4.3, weight: 6, tip: "Reply to every unhappy review politely and fix the cause — ratings recover over time." },
    { id: "replies", label: "Replied to 80%+ of reviews", ok: p.reviews === 0 || (p.replyRate ?? 0) >= 80, weight: 8, tip: `${p.unanswered ? `${p.unanswered} review${p.unanswered === 1 ? " is" : "s are"} waiting for a reply. ` : ""}Replying shows Google and customers you care.` },
  ];
  const total = items.reduce((s, i) => s + i.weight, 0);
  return { score: Math.round((items.filter((i) => i.ok).reduce((s, i) => s + i.weight, 0) / total) * 100), items };
}

function profileFrom(pr: GbpProfile | null, loc: GbpLocation, extra: { rating: number | null; reviews: number | null; photos: number | null; lastPost: string | null; replyRate: number | null; unanswered: number }): LocalProfile {
  const a = pr?.storefrontAddress;
  return {
    title: pr?.title ?? loc.title, phone: pr?.phoneNumbers?.primaryPhone ?? null, website: pr?.websiteUri ?? null,
    category: pr?.categories?.primaryCategory?.displayName ?? null, extraCategories: pr?.categories?.additionalCategories?.length ?? 0,
    address: a ? [...(a.addressLines ?? []), a.locality].filter(Boolean).join(", ") || null : (pr?.serviceArea?.places?.placeInfos?.length ? "Service area" : loc.address || null),
    description: pr?.profile?.description ?? "", hours: Boolean(pr?.regularHours?.periods?.length), specialHours: Boolean(pr?.specialHours?.specialHourPeriods?.length),
    mapsUri: pr?.metadata?.mapsUri ?? loc.mapsUri, newReviewUri: pr?.metadata?.newReviewUri ?? null, open: pr?.openInfo?.status ?? null, ...extra,
  };
}

/**
 * Pulls the Business Profile into Growvia: profile, daily performance, search terms, reviews, photos and posts.
 * Each part is fetched on its own so one failure (e.g. reviews) doesn't hide the rest.
 */
export async function syncLocal(db: Db, b: LocalBiz, { full = false }: { full?: boolean } = {}) {
  const st = (b.local_state ?? {}) as LocalState;
  if (!st.google) return { ok: false as const, error: "Connect Google Business Profile first." };
  if (!st.location) return { ok: false as const, error: "Pick which Business Profile location to track." };
  const loc = st.location;
  let access: string;
  try { access = await accessFromRefresh(decrypt(st.google.refresh_enc)); } catch (e) {
    const error = "Google access for Business Profile expired or was removed — connect it again.";
    await db.from("businesses").update({ local_state: { ...st, sync_error: error, sync_error_kind: "auth" } }).eq("id", b.id);
    return { ok: false as const, error: e instanceof Error && !/expired|removed/.test(e.message) ? e.message : error };
  }
  const errors: GoogleApiError[] = [];
  const attempt = async <T,>(f: () => Promise<T>): Promise<T | null> => { try { return await f(); } catch (e) { errors.push(e instanceof GoogleApiError ? e : new GoogleApiError(e instanceof Error ? e.message : "Google error")); return null; } };
  const first = !st.synced_at || full;
  const now = new Date();
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));

  const [profile, daily, kwNow, kwPrev, rv, photos, posts] = await Promise.all([
    attempt(() => getProfile(access, loc.name)),
    attempt(() => dailyMetrics(access, loc.name, daysAgo(first ? 120 : 14), daysAgo(1))),
    attempt(() => monthlyKeywords(access, loc.name, lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1)),
    first ? attempt(() => monthlyKeywords(access, loc.name, prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1)) : Promise.resolve(null),
    attempt(() => listReviews(access, loc.account, loc.name, first ? 300 : 100)),
    attempt(() => mediaCount(access, loc.account, loc.name)),
    attempt(() => recentPosts(access, loc.account, loc.name)),
  ]);

  if (daily?.length) await db.from("gbp_daily").upsert(daily.map((d) => ({ ...d, business_id: b.id, owner_id: b.owner_id })), { onConflict: "business_id,day" });
  for (const [rows, m] of [[kwNow, lastMonth], [kwPrev, prevMonth]] as const) {
    if (rows?.length) await db.from("gbp_keywords").upsert(rows.slice(0, 200).map((k) => ({ ...k, month: m.toISOString().slice(0, 10), business_id: b.id, owner_id: b.owner_id })), { onConflict: "business_id,month,keyword" });
  }
  let newReviews: { reviewer: string; rating: number; comment: string }[] = [];
  if (rv) {
    const rows = rv.reviews.map((r) => ({
      id: r.name, business_id: b.id, owner_id: b.owner_id, reviewer: r.reviewer?.isAnonymous ? "A Google user" : r.reviewer?.displayName ?? "A Google user", photo: r.reviewer?.profilePhotoUrl ?? null,
      rating: stars(r.starRating), comment: r.comment ?? "", reply: r.reviewReply?.comment ?? null, replied_at: r.reviewReply?.updateTime ?? null, created_at: r.createTime, updated_at: r.updateTime ?? r.createTime,
    }));
    if (!first && st.synced_at) newReviews = rows.filter((r) => r.created_at > st.synced_at!).map((r) => ({ reviewer: r.reviewer, rating: r.rating, comment: r.comment }));
    for (let i = 0; i < rows.length; i += 200) await db.from("gbp_reviews").upsert(rows.slice(i, i + 200), { onConflict: "id" });
  }
  const recent = (rv?.reviews ?? []).filter((r) => Date.now() - new Date(r.createTime).getTime() < 365 * 86400000);
  const replied = recent.filter((r) => r.reviewReply?.comment).length;
  const prof = profileFrom(profile, loc, {
    rating: rv ? Math.round((rv.average || 0) * 10) / 10 : st.profile?.rating ?? null, reviews: rv ? rv.total || rv.reviews.length : st.profile?.reviews ?? null,
    photos: photos ?? st.profile?.photos ?? null, lastPost: posts ? posts.map((p) => p.createTime).sort().pop() ?? null : st.profile?.lastPost ?? null,
    replyRate: recent.length ? Math.round((replied / recent.length) * 100) : rv ? 100 : st.profile?.replyRate ?? null, unanswered: recent.length - replied,
  });
  const everything = errors.length >= 7 - (first ? 0 : 1);
  const main = errors.find((e) => e.kind === "not_approved") ?? errors.find((e) => e.kind === "auth") ?? errors[0];
  const next: LocalState = {
    ...st,
    profile: everything ? st.profile : prof,
    audit: everything || !profile ? st.audit : { ...buildAudit(prof), at: new Date().toISOString() },
    synced_at: everything ? st.synced_at : new Date().toISOString(),
    sync_error: main ? main.message : null, sync_error_kind: main ? main.kind : null,
  };
  await db.from("businesses").update({ local_state: next }).eq("id", b.id);
  for (const r of newReviews.slice(0, 5)) {
    await notify({
      ownerId: b.owner_id, businessId: b.id, type: "review", subject: `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} New Google review from ${r.reviewer}`,
      title: `New ${r.rating}-star review for ${b.name}`, body: r.comment ? `“${r.comment.slice(0, 400)}”` : "No comment, just a rating.",
      cta: { label: r.rating <= 3 ? "Reply now" : "Say thanks", url: "/app/local?tab=reviews" }, dedupe: `${b.id}:${r.reviewer}:${r.comment.slice(0, 40)}`,
    }).catch(() => null);
  }
  if (everything) return { ok: false as const, error: main?.message ?? "Couldn't reach Google Business Profile." };
  return { ok: true as const, days: daily?.length ?? 0, reviews: rv?.reviews.length ?? 0, keywords: kwNow?.length ?? 0, partial: errors.length ? main!.message : null };
}

/** Checks every tracked local keyword on Google Maps and stores today's position (+ public rating/review count). */
export async function checkLocalRanks(db: Db, b: LocalBiz, deadline = Date.now() + 40_000) {
  if (!mapsReady) return { ok: false as const, error: "Map rankings need a SERPAPI_KEY (or DataForSEO login) in Vercel." };
  const st = (b.local_state ?? {}) as LocalState;
  const { data: kws } = await db.from("local_keywords").select("id, keyword").eq("business_id", b.id).order("created_at").limit(30);
  if (!kws?.length) return { ok: false as const, error: "Add a few searches to track first, like “dentist near me”." };
  const target = { name: st.location?.title ?? st.profile?.title ?? b.name, city: b.city, placeId: st.location?.placeId ?? null, lat: st.location?.lat ?? null, lng: st.location?.lng ?? null };
  const day = new Date().toISOString().slice(0, 10);
  let checked = 0, found = 0, lastError: string | null = null;
  let pub: LocalState["public"] | undefined;
  for (const k of kws) {
    if (Date.now() > deadline) break;
    try {
      const r = await mapsRank(k.keyword, target);
      await db.from("local_ranks").upsert({ keyword_id: k.id, business_id: b.id, owner_id: b.owner_id, day, position: r.position, rating: r.rating, reviews: r.reviews, top: r.top }, { onConflict: "keyword_id,day" });
      checked++;
      if (r.position != null) { found++; if (r.rating != null) pub = { rating: r.rating, reviews: r.reviews, at: new Date().toISOString() }; }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Maps search failed";
      if (/used up|api key|invalid/i.test(lastError)) break;
    }
  }
  await db.from("businesses").update({ local_state: { ...st, rank_at: new Date().toISOString(), rank_error: checked ? null : lastError, ...(pub ? { public: pub } : {}) } }).eq("id", b.id);
  if (!checked) return { ok: false as const, error: lastError ?? "Couldn't check Google Maps." };
  return { ok: true as const, checked, found, remaining: kws.length - checked };
}

/** Background: daily profile sync + weekly Maps rank check for every project that uses them. */
export async function runLocalJobs(db: Db, deadline: number) {
  const out = { synced: 0, ranked: 0 };
  const { data } = await db.from("businesses").select("id, owner_id, name, city, local_state").not("local_state->google", "is", null).limit(200);
  const { data: tracked } = await db.from("local_keywords").select("business_id").limit(5000);
  const { data: rivals } = await db.from("competitors").select("business_id").limit(5000);
  const withCompetitors = new Set((rivals ?? []).map((t) => t.business_id));
  const withKeywords = new Set((tracked ?? []).map((t) => t.business_id));
  const ids = new Set((data ?? []).map((b) => b.id));
  const extra = [...new Set([...withKeywords, ...withCompetitors])].filter((id) => !ids.has(id));
  const more = extra.length ? (await db.from("businesses").select("id, owner_id, name, city, local_state").in("id", extra.slice(0, 200))).data ?? [] : [];
  for (const b of [...(data ?? []), ...more] as LocalBiz[]) {
    if (Date.now() > deadline) break;
    const st = (b.local_state ?? {}) as LocalState;
    const age = (s?: string) => (s ? Date.now() - new Date(s).getTime() : Infinity);
    if (st.google && st.location && age(st.synced_at) > 20 * 3600_000 && st.sync_error_kind !== "auth") {
      const r = await syncLocal(db, b).catch(() => null);
      if (r?.ok) out.synced++;
      b.local_state = ((await db.from("businesses").select("local_state").eq("id", b.id).maybeSingle()).data?.local_state ?? st) as LocalState;
    }
    if (mapsReady && withKeywords.has(b.id) && age((b.local_state as LocalState)?.rank_at) > 6.5 * 86400_000) {
      const r = await checkLocalRanks(db, b, Math.min(deadline, Date.now() + 25_000)).catch(() => null);
      if (r?.ok) out.ranked++;
      b.local_state = ((await db.from("businesses").select("local_state").eq("id", b.id).maybeSingle()).data?.local_state ?? b.local_state) as LocalState;
    }
    // Competitors: weekly rating & review count (for review-speed comparisons).
    if (mapsReady && withCompetitors.has(b.id) && age((b.local_state as LocalState)?.competitors_at) > 6.5 * 86400_000 && Date.now() < deadline) {
      await refreshSnapshots(db, { ...b, city: b.city ?? null, website: null }, Math.min(deadline, Date.now() + 20_000)).catch(() => null);
    }
  }
  return out;
}
