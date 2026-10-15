import "server-only";

/** Friendly Google API errors. `kind` lets the UI show the right next step. */
export class GoogleApiError extends Error {
  constructor(message: string, public kind: "auth" | "not_approved" | "quota" | "not_found" | "other" = "other", public status = 0) { super(message); }
}

type Opts = { method?: string; body?: unknown; headers?: Record<string, string>; timeout?: number; what?: string };

/** Calls a Google REST API with a user access token and turns failures into plain-English errors. */
export async function gfetch<T>(access: string, url: string, o: Opts = {}): Promise<T> {
  const res = await fetch(url, {
    method: o.method ?? (o.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${access}`, ...(o.body ? { "Content-Type": "application/json" } : {}), ...(o.headers ?? {}) },
    body: o.body ? JSON.stringify(o.body) : undefined, cache: "no-store", signal: AbortSignal.timeout(o.timeout ?? 20000),
  });
  const text = await res.text();
  let data: { error?: { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } } & Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
  if (res.ok) return data as T;
  throw toGoogleError(res.status, data?.error, o.what ?? "Google");
}

export function toGoogleError(status: number, err: { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } | undefined, what: string) {
  const msg = err?.message ?? "";
  const reasons = [...(err?.errors ?? []), ...(err?.details ?? [])].map((e) => e.reason ?? "").join(" ");
  // The person unticked a permission on Google's consent screen (Google shows one checkbox per permission).
  if (/insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/i.test(`${msg} ${reasons}`))
    return new GoogleApiError(`Google didn't give Growvia permission for ${what}. Click Reconnect and, on Google's screen, tick every box (including "${scopeLabel(what)}") before you click Continue.`, "auth", status);
  if (status === 401) return new GoogleApiError(`Google access for ${what} expired or was removed — connect it again.`, "auth", status);
  if (/SERVICE_DISABLED|has not been used|is disabled|accessNotConfigured/i.test(`${msg} ${reasons} ${err?.status ?? ""}`))
    return new GoogleApiError(`The ${what} API isn't switched on for Growvia's Google Cloud project yet (admin: enable it in APIs & Services → Library).`, "not_approved", status);
  if (status === 429 || /quota|rateLimit|RATE_LIMIT/i.test(`${msg} ${reasons}`)) {
    // Business Profile APIs start with a quota of 0 until Google approves the project, so a quota error there means "not approved yet".
    if (/mybusiness|businessprofile|business profile/i.test(`${msg} ${what}`))
      return new GoogleApiError(`Google hasn't approved ${what} API access for Growvia yet — this is a one-time request by the Growvia admin. Everything else keeps working.`, "not_approved", status);
    return new GoogleApiError(`Google's daily limit for ${what} is used up — Growvia retries automatically tomorrow.`, "quota", status);
  }
  if (status === 403) return new GoogleApiError(msg && msg.length < 200 ? `${what}: ${msg}` : `This Google account doesn't have access to that ${what} — sign in with the account that manages it.`, "auth", status);
  if (status === 404) return new GoogleApiError(`${what} couldn't find that item — it may have been removed. Try reconnecting.`, "not_found", status);
  return new GoogleApiError(msg && msg.length < 200 ? `${what}: ${msg}` : `${what} error ${status} — please try again in a minute.`, "other", status);
}

/** The wording Google shows next to each checkbox, so we can tell people exactly which one to tick. */
function scopeLabel(what: string) {
  if (/business profile/i.test(what)) return "See, edit, create and delete your Google business listings";
  if (/youtube/i.test(what)) return "Manage your YouTube videos";
  if (/search console/i.test(what)) return "View Search Console data for your verified sites";
  if (/postmaster/i.test(what)) return "See email traffic metrics for the domains you have registered in Gmail Postmaster Tools";
  if (/contacts/i.test(what)) return "See and download your contacts";
  return "the Growvia permission";
}
