import "server-only";
import { gfetch } from "./api";

/* Google Business Profile APIs (Account Management, Business Information, Performance, and v4 reviews/posts/media). */
const base = (real: string) => (process.env.GBP_BASE?.trim() || real).replace(/\/$/, "");
const ACCT = base("https://mybusinessaccountmanagement.googleapis.com");
const INFO = base("https://mybusinessbusinessinformation.googleapis.com");
const PERF = base("https://businessprofileperformance.googleapis.com");
const V4 = base("https://mybusiness.googleapis.com");
const W = "Google Business Profile";

export type GbpLocation = { account: string; name: string; title: string; address: string; placeId: string | null; mapsUri: string | null; lat: number | null; lng: number | null };

type Addr = { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string };
const fmtAddr = (a?: Addr) => (a ? [...(a.addressLines ?? []), a.locality, a.administrativeArea, a.postalCode].filter(Boolean).join(", ") : "");

/** Every location this Google account manages (first 5 accounts, 100 locations each). */
export async function listLocations(access: string): Promise<GbpLocation[]> {
  const acc = await gfetch<{ accounts?: { name: string; accountName?: string; type?: string }[] }>(access, `${ACCT}/v1/accounts?pageSize=20`, { what: W });
  const out: GbpLocation[] = [];
  for (const a of (acc.accounts ?? []).slice(0, 5)) {
    const r = await gfetch<{ locations?: { name: string; title?: string; storefrontAddress?: Addr; metadata?: { placeId?: string; mapsUri?: string }; latlng?: { latitude?: number; longitude?: number } }[] }>(
      access, `${INFO}/v1/${a.name}/locations?${new URLSearchParams({ readMask: "name,title,storefrontAddress,metadata,latlng", pageSize: "100" })}`, { what: W });
    for (const l of r.locations ?? []) out.push({ account: a.name, name: l.name, title: l.title ?? "Unnamed location", address: fmtAddr(l.storefrontAddress), placeId: l.metadata?.placeId ?? null, mapsUri: l.metadata?.mapsUri ?? null, lat: l.latlng?.latitude ?? null, lng: l.latlng?.longitude ?? null });
  }
  return out;
}

export type GbpProfile = {
  title?: string; phoneNumbers?: { primaryPhone?: string }; categories?: { primaryCategory?: { displayName?: string }; additionalCategories?: { displayName?: string }[] };
  storefrontAddress?: Addr; websiteUri?: string; regularHours?: { periods?: unknown[] }; specialHours?: { specialHourPeriods?: unknown[] };
  serviceArea?: { places?: { placeInfos?: unknown[] } }; profile?: { description?: string }; openInfo?: { status?: string }; metadata?: { placeId?: string; mapsUri?: string; newReviewUri?: string; hasPendingEdits?: boolean };
};

export const getProfile = (access: string, loc: string) =>
  gfetch<GbpProfile>(access, `${INFO}/v1/${loc}?readMask=${encodeURIComponent("name,title,phoneNumbers,categories,storefrontAddress,websiteUri,regularHours,specialHours,serviceArea,profile,openInfo,metadata")}`, { what: W });

const METRICS = {
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "search_views", BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "search_views",
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "maps_views", BUSINESS_IMPRESSIONS_MOBILE_MAPS: "maps_views",
  CALL_CLICKS: "calls", WEBSITE_CLICKS: "website", BUSINESS_DIRECTION_REQUESTS: "directions", BUSINESS_CONVERSATIONS: "messages", BUSINESS_BOOKINGS: "bookings",
} as const;
export type DailyRow = { day: string; search_views: number; maps_views: number; calls: number; website: number; directions: number; messages: number; bookings: number };
type GDate = { year: number; month: number; day: number };
const gd = (d: Date): GDate => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });

/** Daily views, calls, website clicks, directions… for a date range (Google keeps ~18 months, lags 2–3 days). */
export async function dailyMetrics(access: string, loc: string, start: Date, end: Date): Promise<DailyRow[]> {
  const q = new URLSearchParams();
  for (const m of Object.keys(METRICS)) q.append("dailyMetrics", m);
  const s = gd(start), e = gd(end);
  q.set("dailyRange.startDate.year", String(s.year)); q.set("dailyRange.startDate.month", String(s.month)); q.set("dailyRange.startDate.day", String(s.day));
  q.set("dailyRange.endDate.year", String(e.year)); q.set("dailyRange.endDate.month", String(e.month)); q.set("dailyRange.endDate.day", String(e.day));
  type TS = { dailyMetric: keyof typeof METRICS; timeSeries?: { datedValues?: { date: GDate; value?: string }[] } };
  const r = await gfetch<{ multiDailyMetricTimeSeries?: { dailyMetricTimeSeries?: TS[] }[] }>(access, `${PERF}/v1/${loc}:fetchMultiDailyMetricsTimeSeries?${q}`, { what: W });
  const days = new Map<string, DailyRow>();
  for (const group of r.multiDailyMetricTimeSeries ?? []) for (const ts of group.dailyMetricTimeSeries ?? []) {
    const col = METRICS[ts.dailyMetric];
    if (!col) continue;
    for (const v of ts.timeSeries?.datedValues ?? []) {
      const day = `${v.date.year}-${String(v.date.month).padStart(2, "0")}-${String(v.date.day).padStart(2, "0")}`;
      const row = days.get(day) ?? { day, search_views: 0, maps_views: 0, calls: 0, website: 0, directions: 0, messages: 0, bookings: 0 };
      row[col] += Number(v.value ?? 0) || 0;
      days.set(day, row);
    }
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** What people searched on Google/Maps before seeing the profile, for one calendar month. */
export async function monthlyKeywords(access: string, loc: string, year: number, month: number) {
  const q = new URLSearchParams({ "monthlyRange.startMonth.year": String(year), "monthlyRange.startMonth.month": String(month), "monthlyRange.endMonth.year": String(year), "monthlyRange.endMonth.month": String(month), pageSize: "100" });
  const r = await gfetch<{ searchKeywordsCounts?: { searchKeyword: string; insightsValue?: { value?: string; threshold?: string } }[] }>(access, `${PERF}/v1/${loc}/searchkeywords/impressions/monthly?${q}`, { what: W });
  return (r.searchKeywordsCounts ?? []).map((k) => ({ keyword: k.searchKeyword, impressions: Number(k.insightsValue?.value ?? k.insightsValue?.threshold ?? 0) || 0, below: !k.insightsValue?.value }));
}

export type GReview = { name: string; reviewId: string; reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean }; starRating?: string; comment?: string; createTime: string; updateTime?: string; reviewReply?: { comment: string; updateTime?: string } };
const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const stars = (s?: string) => STARS[s ?? ""] ?? 0;

export async function listReviews(access: string, account: string, loc: string, max = 200) {
  const out: GReview[] = [];
  let token = "", average = 0, total = 0;
  do {
    const q = new URLSearchParams({ pageSize: "50", orderBy: "updateTime desc", ...(token ? { pageToken: token } : {}) });
    const r = await gfetch<{ reviews?: GReview[]; averageRating?: number; totalReviewCount?: number; nextPageToken?: string }>(access, `${V4}/v4/${account}/${loc}/reviews?${q}`, { what: W });
    out.push(...(r.reviews ?? []));
    average = r.averageRating ?? average; total = r.totalReviewCount ?? total;
    token = r.nextPageToken ?? "";
  } while (token && out.length < max);
  return { reviews: out, average, total };
}

export const replyReview = (access: string, reviewName: string, comment: string) =>
  gfetch<{ comment: string; updateTime: string }>(access, `${V4}/v4/${reviewName}/reply`, { method: "PUT", body: { comment }, what: W });

export async function mediaCount(access: string, account: string, loc: string) {
  const r = await gfetch<{ totalMediaItemCount?: number; mediaItems?: unknown[] }>(access, `${V4}/v4/${account}/${loc}/media?pageSize=100`, { what: W });
  return r.totalMediaItemCount ?? r.mediaItems?.length ?? 0;
}

export async function recentPosts(access: string, account: string, loc: string) {
  const r = await gfetch<{ localPosts?: { createTime: string; summary?: string; state?: string }[] }>(access, `${V4}/v4/${account}/${loc}/localPosts?pageSize=10`, { what: W });
  return r.localPosts ?? [];
}

/** Publishes a "What's new" update on the Business Profile (optionally with a photo and a Learn more button). */
export async function createLocalPost(access: string, account: string, loc: string, p: { summary: string; photo?: string | null; url?: string | null }) {
  const body = {
    languageCode: "en", topicType: "STANDARD", summary: p.summary.slice(0, 1500),
    ...(p.url ? { callToAction: { actionType: "LEARN_MORE", url: p.url } } : {}),
    ...(p.photo ? { media: [{ mediaFormat: "PHOTO", sourceUrl: p.photo }] } : {}),
  };
  return gfetch<{ name: string; searchUrl?: string }>(access, `${V4}/v4/${account}/${loc}/localPosts`, { body, what: W });
}

/** Updates the profile description (what shows under "About" on Google). */
export const updateDescription = (access: string, loc: string, description: string) =>
  gfetch<{ profile?: { description?: string } }>(access, `${INFO}/v1/${loc}?updateMask=profile.description`, { method: "PATCH", body: { profile: { description: description.slice(0, 750) } }, what: W });
