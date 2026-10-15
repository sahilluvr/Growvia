import "server-only";
import type { GscData } from "../seo/types";

// Google OAuth app (console.cloud.google.com → APIs & Services → Credentials → OAuth client, type "Web application").
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
const AUTH_BASE = (process.env.GOOGLE_AUTH_BASE?.trim() || "https://accounts.google.com").replace(/\/$/, "");
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL?.trim() || "https://oauth2.googleapis.com/token";
const API = (process.env.GSC_API_BASE?.trim() || "https://www.googleapis.com").replace(/\/$/, "");
export const gscReady = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const SCOPES = "openid email https://www.googleapis.com/auth/webmasters.readonly";

/** What a Google sign-in is for. Every purpose shares one redirect URI (/api/oauth/google/callback). */
export const GOOGLE_PURPOSES = {
  gsc: { scopes: SCOPES, back: "/app/seo?tab=search", label: "Search Console" },
  gbp: { scopes: "openid email https://www.googleapis.com/auth/business.manage", back: "/app/local", label: "Google Business Profile" },
  youtube: { scopes: "openid email https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly", back: "/app/channels", label: "YouTube" },
  contacts: { scopes: "openid email https://www.googleapis.com/auth/contacts.readonly", back: "/app/leads", label: "Google Contacts" },
  postmaster: { scopes: "openid email https://www.googleapis.com/auth/postmaster.readonly", back: "/app/health?tab=email", label: "Gmail Postmaster Tools" },
} as const;
export type GooglePurpose = keyof typeof GOOGLE_PURPOSES;
export const isPurpose = (p: string | null | undefined): p is GooglePurpose => Boolean(p && p in GOOGLE_PURPOSES);

export class GscError extends Error {}

export function googleAuthUrl(redirectUri: string, state: string, purpose: GooglePurpose = "gsc") {
  // Contacts is a one-time read, so it doesn't need lasting (offline) access.
  const q = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: GOOGLE_PURPOSES[purpose].scopes, access_type: purpose === "contacts" ? "online" : "offline", prompt: purpose === "contacts" ? "select_account" : "consent", include_granted_scopes: "false", state });
  return `${AUTH_BASE}/o/oauth2/v2/auth?${q}`;
}

export async function token(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, ...body }), cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GscError(data.error === "invalid_grant" ? "Google access expired or was removed — connect the Google account again." : data.error_description || data.error || `Google error ${res.status}`);
  return data as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const t = await token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  let email: string | null = null;
  try { email = JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString()).email ?? null; } catch { /* no id token */ }
  // `scope` = the permissions this exact token has (more reliable than the redirect URL).
  return { accessToken: t.access_token, refreshToken: t.refresh_token ?? null, email, idToken: t.id_token ?? null, scopes: (t.scope ?? "").split(" ").filter(Boolean) };
}

export const accessFromRefresh = async (refresh: string) => (await token({ refresh_token: refresh, grant_type: "refresh_token" })).access_token;

async function api<T>(access: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${access}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GscError(res.status === 403 ? "This Google account can't see that Search Console property — add it as a user in Search Console, or connect the right account." : data?.error?.message || `Search Console error ${res.status}`);
  return data as T;
}

export async function listSites(access: string) {
  const r = await api<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(access, "/webmasters/v3/sites");
  return (r.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
}

/** Picks the Search Console property that covers this website (domain property preferred). */
export function matchSite(sites: string[], website: string | null) {
  if (!website) return sites.length === 1 ? sites[0] : null;
  let host = "";
  try { host = new URL(/^https?:/.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, ""); } catch { return null; }
  return sites.find((s) => s === `sc-domain:${host}`) ?? sites.find((s) => { try { return new URL(s).hostname.replace(/^www\./, "") === host; } catch { return false; } }) ?? null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Last 28 days of Google Search data (Search Console lags ~2-3 days). */
export async function searchData(access: string, site: string): Promise<GscData> {
  const end = new Date(Date.now() - 2 * 86400000);
  const start = new Date(end.getTime() - 27 * 86400000);
  const path = `/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const range = { startDate: day(start), endDate: day(end) };
  type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
  const [tot, q, p] = await Promise.all([
    api<{ rows?: Row[] }>(access, path, { ...range }),
    api<{ rows?: Row[] }>(access, path, { ...range, dimensions: ["query"], rowLimit: 250 }),
    api<{ rows?: Row[] }>(access, path, { ...range, dimensions: ["page"], rowLimit: 100 }),
  ]);
  const map = (r: Row) => ({ key: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 1000) / 10, position: Math.round(r.position * 10) / 10 });
  const t = tot.rows?.[0];
  return {
    site,
    range: { start: range.startDate, end: range.endDate },
    totals: { clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t ? Math.round(t.ctr * 1000) / 10 : 0, position: t ? Math.round(t.position * 10) / 10 : 0 },
    queries: (q.rows ?? []).map(map),
    pages: (p.rows ?? []).map(map),
    at: new Date().toISOString(),
  };
}

export type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

/** Raw Search Analytics query (dates are YYYY-MM-DD). */
export async function gscQuery(access: string, site: string, body: Record<string, unknown>) {
  const r = await api<{ rows?: GscRow[] }>(access, `/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, body);
  return r.rows ?? [];
}
