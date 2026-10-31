import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DISPOSABLE } from "./health/lists";

/*
 * Extra bot protection for sign-up, on top of Cloudflare Turnstile (and the only protection if Turnstile keys are missing).
 * Email confirmation is off, so these checks are what stop scripted sign-ups:
 *   honeypot field · minimum time on the form · disposable-email block · per-network sign-up limits.
 */

const MORE_DISPOSABLE = ["guerrillamail.net", "guerrillamail.org", "grr.la", "10minutemail.net", "tempmail.net", "tempmailo.com", "temp-mail.io",
  "mailinator.net", "mailcatch.com", "spam4.me", "trashmail.de", "yopmail.net", "yopmail.fr", "dropmail.me", "emailfake.com", "fakemail.net",
  "mail.tm", "mailpoof.com", "tmpmail.org", "tmpmail.net", "1secmail.com", "1secmail.org", "1secmail.net", "linshiyouxiang.net", "byom.de",
  "mytemp.email", "tempail.com", "luxusmail.org", "minuteinbox.com", "discard.email", "33mail.com", "mvrht.net", "nada.email"];
const BLOCKED = new Set([...DISPOSABLE, ...MORE_DISPOSABLE]);

/** Throwaway inbox (including subdomains of known throwaway services)? */
export function disposableEmail(email: string): boolean {
  const dom = email.split("@")[1]?.toLowerCase() ?? "";
  if (!dom) return false;
  const parts = dom.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (BLOCKED.has(parts.slice(i).join("."))) return true;
  return false;
}

/** Humans take a few seconds to fill in name, email and password; scripts submit instantly. `t` is when the form appeared. */
export function submittedTooFast(t: string, now = Date.now(), minMs = 2500): boolean {
  const at = Number(t);
  if (!Number.isFinite(at) || at <= 0) return true;          // field missing → not our form
  if (at > now + 60_000) return true;                        // from the future → forged
  return now - at < minMs;
}

export const SIGNUP_LIMITS = { hour: 3, day: 8 };

/** Too many accounts from this network recently? Fails open if the log table isn't there yet. */
export async function signupRateLimited(db: SupabaseClient | null, ipHash: string | null, now = Date.now()): Promise<boolean> {
  if (!db || !ipHash) return false;
  const since = (ms: number) => new Date(now - ms).toISOString();
  const count = async (ms: number) => {
    const { count, error } = await db.from("signup_log").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(ms));
    if (error) return 0;
    return count ?? 0;
  };
  const [h, d] = await Promise.all([count(3_600_000), count(86_400_000)]);
  return h >= SIGNUP_LIMITS.hour || d >= SIGNUP_LIMITS.day;
}

export async function logSignup(db: SupabaseClient | null, ipHash: string | null, email: string) {
  if (!db) return;
  await db.from("signup_log").insert({ ip_hash: ipHash, email_domain: email.split("@")[1]?.toLowerCase() ?? null });
}
