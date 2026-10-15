// Plans, prices and what each plan includes. Everything about billing reads from here.

export type PlanId = "free" | "pro" | "growth" | "agency";
export type PaidPlan = Exclude<PlanId, "free">;
export type Interval = "month" | "year";
export type Currency = "USD" | "INR";

/** Paid plans, cheapest first. */
export const PAID_PLANS: PaidPlan[] = ["pro", "growth", "agency"];
export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, growth: 2, agency: 3 };
export const isPaidPlan = (p: unknown): p is PaidPlan => p === "pro" || p === "growth" || p === "agency";

/** List prices in US dollars (the only prices shown on the site). Yearly = 10 months (2 months free). */
export const PRICES: Record<PaidPlan, { month: number; year: number }> = {
  pro: { month: 19, year: 190 },
  growth: { month: 45, year: 450 },
  agency: { month: 99, year: 990 },
};
/** Kept for older call sites: the Pro price. */
export const PRICE_USD = PRICES.pro;
export const TRIAL_DAYS = 14;
/** Above the Agency plan's limits we talk (custom pricing). */
export const AGENCY_FROM_USD = PRICES.agency.month;

export const PLAN_INFO: Record<PlanId, { name: string; tagline: string }> = {
  free: { name: "Free", tagline: "For one business trying Growvia" },
  pro: { name: "Pro", tagline: "For a business or freelancer" },
  growth: { name: "Growth", tagline: "For growing businesses and small agencies" },
  agency: { name: "Agency", tagline: "For agencies with many clients" },
};

/** What's metered. Everything not listed here (team, audits, AI, reports, support, leads, inbox) is unlimited on every plan. */
export type LimitKey = "projects" | "mailboxes" | "keywords" | "geoPrompts" | "videos" | "emails" | "forms" | "posts";
/** `competitors` is per project; `branding` (forced form badge) is off on every plan — the badge is the owner's choice. */
export type Limits = { projects: number; mailboxes: number; competitors: number; keywords: number; geoPrompts: number; geoEveryDays: number; videos: number; watermark: boolean; branding: boolean; emails: number; forms: number; posts: number };

const INF = Number.POSITIVE_INFINITY;
export const LIMITS: Record<PlanId, Limits> = {
  free: { projects: 1, mailboxes: 1, competitors: 2, keywords: 10, geoPrompts: 5, geoEveryDays: 30, videos: 1, watermark: true, branding: false, emails: 300, forms: 1, posts: 10 },
  pro: { projects: 10, mailboxes: 5, competitors: 10, keywords: 100, geoPrompts: 30, geoEveryDays: 7, videos: 20, watermark: false, branding: false, emails: 5000, forms: INF, posts: INF },
  growth: { projects: 25, mailboxes: 15, competitors: 15, keywords: 300, geoPrompts: 100, geoEveryDays: 7, videos: 60, watermark: false, branding: false, emails: 15000, forms: INF, posts: INF },
  agency: { projects: 75, mailboxes: 50, competitors: 25, keywords: 1000, geoPrompts: 300, geoEveryDays: 3, videos: 200, watermark: false, branding: false, emails: 50000, forms: INF, posts: INF },
};
/** The most competitors any plan tracks per project. */
export const MAX_COMPETITORS_ANY = LIMITS.agency.competitors;

export const LIMIT_LABEL: Record<LimitKey, { name: string; unit: string; per: "total" | "month" }> = {
  projects: { name: "Projects (businesses)", unit: "projects", per: "total" },
  mailboxes: { name: "Connected mailboxes", unit: "mailboxes", per: "total" },
  keywords: { name: "Tracked keywords", unit: "keywords", per: "total" },
  geoPrompts: { name: "AI-visibility questions", unit: "questions", per: "total" },
  videos: { name: "Video ads", unit: "videos", per: "month" },
  emails: { name: "Emails from your mailbox", unit: "emails", per: "month" },
  forms: { name: "Website forms", unit: "forms", per: "total" },
  posts: { name: "Scheduled social posts", unit: "posts", per: "month" },
};

const n = (x: number) => (Number.isFinite(x) ? x.toLocaleString("en-US") : "Unlimited");
const every = (d: number) => (d >= 28 ? "monthly" : d >= 7 ? "weekly" : d >= 3 ? "twice a week" : "daily");

/** Rows for pricing tables (site + billing page) — built from LIMITS so they can't drift. */
export const COMPARE: { label: string; free: string; pro: string; growth: string; agency: string }[] = [
  { label: "Projects (businesses or client sites)", ...per((l) => n(l.projects)) },
  { label: "Team members, SEO audits, AI experts, reports", ...per(() => "Unlimited") },
  { label: "Leads, inbox, WhatsApp & Instagram replies", ...per(() => "Unlimited") },
  { label: "Competitors tracked (per project)", ...per((l) => n(l.competitors)) },
  { label: "Connected mailboxes", ...per((l) => n(l.mailboxes)) },
  { label: "Tracked keywords", ...per((l) => n(l.keywords)) },
  { label: "AI-visibility questions", ...per((l) => `${n(l.geoPrompts)}, checked ${every(l.geoEveryDays)}`) },
  { label: "Emails from your own mailbox / month", ...per((l) => n(l.emails)) },
  { label: "Video ads / month", ...per((l) => (l.watermark ? `${n(l.videos)}, with “Made with Growvia”` : n(l.videos))) },
  { label: "Website forms", ...per((l) => (l.forms === INF ? "Unlimited, your brand" : `${n(l.forms)}, your brand`)) },
  { label: "Scheduled social posts / month", ...per((l) => n(l.posts)) },
  { label: "Support", free: "Email", pro: "Priority email & chat", growth: "Priority email & chat", agency: "Priority + onboarding call" },
];
function per(f: (l: Limits) => string) { return { free: f(LIMITS.free), pro: f(LIMITS.pro), growth: f(LIMITS.growth), agency: f(LIMITS.agency) }; }

/** Short highlight lines for plan cards. */
export const HIGHLIGHTS: Record<PlanId, string[]> = {
  free: [`${n(LIMITS.free.projects)} project · ${n(LIMITS.free.competitors)} competitors`, `${n(LIMITS.free.keywords)} keywords · ${LIMITS.free.geoPrompts} AI questions (monthly)`, `1 mailbox · ${n(LIMITS.free.emails)} emails a month`, "1 website form, your brand", "Unlimited audits, AI experts, leads & inbox"],
  pro: [`${LIMITS.pro.projects} projects · ${LIMITS.pro.competitors} competitors each`, `${LIMITS.pro.keywords} keywords · ${LIMITS.pro.geoPrompts} AI questions (weekly)`, `${LIMITS.pro.mailboxes} mailboxes · ${n(LIMITS.pro.emails)} emails a month`, `${LIMITS.pro.videos} video ads · unlimited forms & posts`, "No video watermark · priority support"],
  growth: [`${LIMITS.growth.projects} projects · ${LIMITS.growth.competitors} competitors each`, `${LIMITS.growth.keywords} keywords · ${LIMITS.growth.geoPrompts} AI questions (weekly)`, `${LIMITS.growth.mailboxes} mailboxes · ${n(LIMITS.growth.emails)} emails a month`, `${LIMITS.growth.videos} video ads · unlimited forms & posts`, "Everything in Pro"],
  agency: [`${LIMITS.agency.projects} projects · ${LIMITS.agency.competitors} competitors each`, `${n(LIMITS.agency.keywords)} keywords · ${LIMITS.agency.geoPrompts} AI questions (twice a week)`, `${LIMITS.agency.mailboxes} mailboxes · ${n(LIMITS.agency.emails)} emails a month`, `${LIMITS.agency.videos} video ads · unlimited forms & posts`, "Onboarding call · more on request"],
};

export const fmtUSD = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
export const fmtMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

/** Plain-text price lines used across the site, emails and legal pages so they never drift. */
export const PRICE_TEXT = {
  month: `$${PRICE_USD.month}/month`,
  year: `$${PRICE_USD.year}/year`,
  short: `$${PRICE_USD.month}/mo`,
  saving: `2 months free`,
  pro: `Pro is $${PRICES.pro.month}/month, Growth $${PRICES.growth.month}/month and Agency $${PRICES.agency.month}/month — or pay yearly and get 2 months free`,
  all: `Free · Pro $${PRICES.pro.month}/mo · Growth $${PRICES.growth.month}/mo · Agency $${PRICES.agency.month}/mo`,
};
/** The next plan up from this one (null at the top). */
export const nextPlan = (p: PlanId): PaidPlan | null => (p === "free" ? "pro" : p === "pro" ? "growth" : p === "growth" ? "agency" : null);
