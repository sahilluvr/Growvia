import "server-only";
import { fetchPage } from "@/lib/seo/crawl";
import { lookup } from "@/lib/health/dns";

/*
 * Lead finder (v074): local businesses from Google Maps (Places API, New) + the contact email listed on
 * each business's own website. No paid lead databases, no scraping of social networks, businesses only.
 *
 * Env: GOOGLE_PLACES_API_KEY (Places API (New) enabled), optional LEAD_FINDER_MONTHLY_REQUESTS
 * (default 900 — Google's free allowance for this search type is 1,000 a month, up to 20 businesses each).
 */

const env = (k: string) => (process.env[k] ?? "").trim();
export const PLACES_KEY = env("GOOGLE_PLACES_API_KEY");
const PLACES_BASE = (env("PLACES_BASE") || "https://places.googleapis.com").replace(/\/$/, "");
export const MONTHLY_REQUESTS = Math.max(0, Number(env("LEAD_FINDER_MONTHLY_REQUESTS")) || 900);
export const finderReady = () => Boolean(PLACES_KEY);

/** Businesses each plan can look up per month (each one costs a share of the free Google allowance). */
export const FINDER_ALLOWANCE: Record<string, number> = { free: 20, pro: 200, growth: 600, agency: 2000 };
export const COUNTS = [10, 20, 30, 50] as const;

export type Candidate = {
  id: string; name: string; address: string; phone: string | null; website: string | null; rating: number | null; reviews: number | null;
  email: string | null; status: "pending" | "found" | "no_email" | "no_website";
};

export class FinderError extends Error {}

/** Text Search (New): "<what> in <where>", up to `count` open businesses (20 per page, max 3 pages). */
export async function searchPlaces(what: string, where: string, count: number): Promise<{ places: Candidate[]; requests: number }> {
  if (!PLACES_KEY) throw new FinderError("The lead finder isn't switched on yet.");
  const want = Math.min(60, Math.max(1, count));
  const out: Candidate[] = [];
  const seen = new Set<string>();
  let token: string | undefined, requests = 0;
  do {
    requests++;
    let r: Response;
    try {
      r = await fetch(`${PLACES_BASE}/v1/places:searchText`, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: {
          "Content-Type": "application/json", "X-Goog-Api-Key": PLACES_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,nextPageToken",
        },
        body: JSON.stringify({ textQuery: `${what} in ${where}`, pageSize: 20, ...(token ? { pageToken: token } : {}) }),
      });
    } catch { throw new FinderError("Couldn't reach Google Maps — please try again in a minute."); }
    const d = await r.json().catch(() => ({})) as { places?: Record<string, unknown>[]; nextPageToken?: string; error?: { message?: string; status?: string } };
    if (!r.ok) {
      console.error("[leadfinder] places", r.status, d.error?.status, d.error?.message);
      if (r.status === 429 || d.error?.status === "RESOURCE_EXHAUSTED") throw new FinderError("Google Maps' free search allowance is used up for now — try again later.");
      throw new FinderError("Google Maps search isn't available right now (the API key may need the Places API switched on).");
    }
    for (const p of d.places ?? []) {
      const id = String(p.id ?? "");
      if (!id || seen.has(id) || p.businessStatus === "CLOSED_PERMANENTLY" || p.businessStatus === "CLOSED_TEMPORARILY") continue;
      seen.add(id);
      const website = typeof p.websiteUri === "string" && /^https?:\/\//i.test(p.websiteUri) ? p.websiteUri : null;
      out.push({
        id, name: String((p.displayName as { text?: string } | undefined)?.text ?? "").slice(0, 120) || "Business",
        address: String(p.formattedAddress ?? "").slice(0, 200), phone: (p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null) as string | null,
        website, rating: typeof p.rating === "number" ? p.rating : null, reviews: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
        email: null, status: website ? "pending" : "no_website",
      });
      if (out.length >= want) break;
    }
    token = d.nextPageToken;
  } while (token && out.length < want && requests < 3);
  return { places: out, requests };
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const JUNK = /\.(png|jpe?g|gif|webp|svg|css|js|ico)$|^(no-?reply|donotreply|example|test|user|name|email|your|you)@|@(example|domain|email|sentry|wixpress|sentry-next|yourdomain|mysite|godaddy|squarespace|wordpress|w3)\./i;
const GOOD_PREFIX = /^(info|contact|hello|hi|office|enquir|inquir|sales|admin|booking|team|support|mail|reception)/i;

const regDomain = (host: string) => host.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");

/** Emails on a page (text + mailto + simple obfuscation), best first: same domain as the site, then role addresses. */
export function extractEmails(html: string, siteHost: string): string[] {
  const text = html
    .replace(/&#64;|&commat;|\s*\[at\]\s*|\s*\(at\)\s*/gi, "@")
    .replace(/&#46;|\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".")
    .replace(/%40/g, "@");
  const found = new Set<string>();
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/^\.+|\.+$/g, "");
    if (e.length > 80 || JUNK.test(e)) continue;
    found.add(e);
  }
  const site = regDomain(siteHost);
  const score = (e: string) => (regDomain(e.split("@")[1]) === site ? 0 : 10) + (GOOD_PREFIX.test(e) ? 0 : 1);
  return [...found].sort((a, b) => score(a) - score(b));
}

/** Contact-ish links on a page, same site only. */
export function contactLinks(html: string, base: string): string[] {
  const out: string[] = [];
  const host = new URL(base).hostname.replace(/^www\./, "");
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = m[1];
    if (!/contact|about|impressum|kontakt|reach|get-in-touch/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, "") !== host) continue;
      u.hash = "";
      if (!out.includes(u.toString())) out.push(u.toString());
    } catch { /* bad href */ }
    if (out.length >= 3) break;
  }
  return out;
}

/** The business's contact email from its website: home page, then up to two contact/about pages. */
export async function findEmailOnSite(website: string, budgetMs = 9000): Promise<string | null> {
  const t0 = Date.now();
  let base: URL;
  try { base = new URL(website); } catch { return null; }
  const home = await fetchPage(base.toString(), Math.min(6000, budgetMs));
  if (home.status < 200 || home.status >= 400 || !home.body) return null;
  const host = new URL(home.url).hostname;
  let emails = extractEmails(home.body, host);
  if (emails.length && regDomain(emails[0].split("@")[1]) === regDomain(host)) return emails[0];
  const next = contactLinks(home.body, home.url);
  if (!next.length) for (const p of ["/contact", "/contact-us"]) next.push(new URL(p, home.url).toString());
  for (const url of next.slice(0, 2)) {
    const left = budgetMs - (Date.now() - t0);
    if (left < 1500) break;
    const pg = await fetchPage(url, Math.min(5000, left));
    if (pg.status >= 200 && pg.status < 400 && pg.body) emails = [...new Set([...extractEmails(pg.body, host), ...emails])].sort((a, b) =>
      (regDomain(a.split("@")[1]) === regDomain(host) ? 0 : 1) - (regDomain(b.split("@")[1]) === regDomain(host) ? 0 : 1));
    if (emails.length && regDomain(emails[0].split("@")[1]) === regDomain(host)) break;
  }
  return emails[0] ?? null;
}

/** Can this domain receive email at all (has MX records)? */
export async function hasMx(email: string): Promise<boolean> {
  const dom = email.split("@")[1];
  if (!dom) return false;
  try { return (await lookup(dom, "MX")).length > 0; } catch { return false; }
}

/** Enrich one candidate: find + check its email. Never throws. */
export async function enrich(c: Candidate): Promise<Candidate> {
  if (!c.website) return { ...c, status: "no_website" };
  try {
    const email = await findEmailOnSite(c.website);
    if (email && (await hasMx(email))) return { ...c, email, status: "found" };
  } catch { /* site down or blocked */ }
  return { ...c, email: null, status: "no_email" };
}

/** Rough wait shown before starting: Maps search + ~5 websites checked at a time, a few seconds each. */
export const estimateSeconds = (count: number) => Math.round(5 + Math.ceil(count / 5) * 4);

/** Who to look for, suggested from the user's own kind of business. */
export function suggestions(segment: string | null | undefined): string[] {
  const s = (segment ?? "").toLowerCase();
  const map: Record<string, string[]> = {
    agency: ["Restaurants", "Dental clinics", "Law firms", "Real estate agencies", "Gyms", "Plumbers"],
    saas: ["Software companies", "Accounting firms", "Marketing agencies", "Clinics", "Logistics companies", "Retail stores"],
    realestate: ["Property managers", "Home builders", "Interior designers", "Mortgage brokers", "Moving companies", "Relocation services"],
    restaurant: ["Corporate offices", "Event planners", "Hotels", "Wedding venues", "Coworking spaces", "Schools"],
    dentist: ["Corporate offices", "Schools", "Gyms", "Pharmacies", "Coworking spaces", "Senior living"],
    salon: ["Wedding planners", "Bridal shops", "Photographers", "Hotels", "Gyms", "Spas"],
    gym: ["Corporate offices", "Physiotherapists", "Nutritionists", "Coworking spaces", "Schools", "Apartment complexes"],
    ecommerce: ["Boutiques", "Gift shops", "Concept stores", "Cafés", "Salons", "Hotels"],
    creator: ["Marketing agencies", "Brands", "Event venues", "Cafés", "Gyms", "Boutiques"],
  };
  return map[s] ?? ["Property managers", "Real estate agencies", "Restaurants", "Clinics", "Law firms", "Contractors"];
}
