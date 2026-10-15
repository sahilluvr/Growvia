import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteOrigin } from "./data";
import type { FormSettings, LeadFormRow } from "./forms-model";

/* Security for the public form endpoint: who may post (origin / server key), CORS, and spam limits. */

export const hashIp = (ip: string | null | undefined) => (ip ? createHash("sha256").update(`gv:${ip}`).digest("hex").slice(0, 16) : null);
export const hashKey = (k: string) => createHash("sha256").update(`gvkey:${k}`).digest("hex");
export const newServerKey = () => `gvf_${randomBytes(24).toString("base64url")}`;

/** Valid "Authorization: Bearer <server key>" for this form? */
export function serverKeyOk(req: Request, form: Pick<LeadFormRow, "server_key_hash">): boolean {
  const h = form.server_key_hash;
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!h || !m) return false;
  const a = Buffer.from(hashKey(m[1])), b = Buffer.from(h);
  return a.length === b.length && timingSafeEqual(a, b);
}

const hostOf = (u: string | null | undefined) => { try { return u ? new URL(u).hostname.toLowerCase().replace(/^www\./, "") : null; } catch { return null; } };
const growviaHost = () => hostOf(siteOrigin());

/** The page that sent the post: Origin header, else Referer. */
export function requestHost(req: Request): string | null {
  return hostOf(req.headers.get("origin")) ?? hostOf(req.headers.get("referer"));
}
export const fromGrowvia = (req: Request) => { const h = requestHost(req); return Boolean(h && h === growviaHost()); };

/** Allowed websites: empty list = any site. Growvia's own hosted page and iframe are always allowed. */
export function originAllowed(req: Request, s: Pick<FormSettings, "allowed_origins">): boolean {
  if (!s.allowed_origins.length) return true;
  const h = requestHost(req);
  if (!h) return false; // browsers always send Origin on cross-site POSTs; no header = not a browser on an allowed site
  if (h === growviaHost()) return true;
  return s.allowed_origins.some((a) => h === a || h.endsWith(`.${a}`));
}

/** CORS headers: echo an allowed origin, or * when the form allows any site. */
export function corsHeaders(req: Request, s?: Pick<FormSettings, "allowed_origins"> | null): Record<string, string> {
  const origin = req.headers.get("origin");
  const base = { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400", Vary: "Origin" };
  if (!s || !s.allowed_origins.length) return { ...base, "Access-Control-Allow-Origin": "*" };
  return origin && originAllowed(req, s) ? { ...base, "Access-Control-Allow-Origin": origin } : base;
}

/** frame-ancestors for the iframe embed when the form is locked to certain sites. */
export function frameAncestors(s: Pick<FormSettings, "allowed_origins">): string | null {
  if (!s.allowed_origins.length) return null;
  const self = siteOrigin();
  return ["'self'", self, ...s.allowed_origins.flatMap((h) => [`https://${h}`, `https://*.${h}`, `http://${h}`])].join(" ");
}

export type BlockReason = "honeypot" | "too_fast" | "rate_ip" | "rate_email" | "origin" | "captcha" | "invalid";

/** Records a blocked attempt (shown as a count on the form). Never throws. */
export async function logBlock(db: SupabaseClient, form: Pick<LeadFormRow, "id" | "owner_id" | "business_id">, reason: BlockReason, ipHash: string | null, detail?: string) {
  await db.from("form_blocks").insert({ form_id: form.id, owner_id: form.owner_id, business_id: form.business_id, reason, ip_hash: ipHash, detail: detail?.slice(0, 200) ?? null }).then(() => null, () => null);
}

/** Rate limits per device (IP) and per email within the window. */
export async function rateLimited(db: SupabaseClient, formId: string, s: Pick<FormSettings, "spam">, ipHash: string | null, email: string | null): Promise<"rate_ip" | "rate_email" | null> {
  const since = new Date(Date.now() - s.spam.window_min * 60_000).toISOString();
  const [ip, em] = await Promise.all([
    ipHash ? db.from("lead_submissions").select("id", { count: "exact", head: true }).eq("form_id", formId).eq("ip_hash", ipHash).gt("created_at", since) : Promise.resolve({ count: 0 }),
    email ? db.from("lead_submissions").select("id", { count: "exact", head: true }).eq("form_id", formId).eq("email", email).gt("created_at", since) : Promise.resolve({ count: 0 }),
  ]);
  if ((ip.count ?? 0) >= s.spam.ip_limit) return "rate_ip";
  if ((em.count ?? 0) >= s.spam.email_limit) return "rate_email";
  return null;
}

/** Minimum time between the form loading and the submit (bots post instantly). Old snippets without a timestamp pass. */
export function tooFast(loadedAt: unknown, s: Pick<FormSettings, "spam">): boolean {
  const t = Number(loadedAt);
  if (!s.spam.min_seconds || !Number.isFinite(t) || t <= 0) return false;
  const age = Date.now() - t;
  return age >= 0 && age < s.spam.min_seconds * 1000;
}
