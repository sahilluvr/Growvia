import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "crypto";
import { signId, verifyId } from "@/lib/server/crypto";

/*
 * One fixed admin login for the owner's dashboard (/admin).
 * Credentials live in Vercel env vars — never in the code or the repo:
 *   ADMIN_EMAIL     (defaults to sahilaggarwal43@gmail.com)
 *   ADMIN_PASSWORD  (required — the dashboard stays locked until it's set)
 */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "sahilaggarwal43@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();
export const adminConfigured = ADMIN_PASSWORD.length >= 8;
export const ADMIN_COOKIE = "gv_admin";
const HOURS = 12;

const fp = () => createHash("sha256").update(`gv-admin:${ADMIN_EMAIL}:${ADMIN_PASSWORD}`).digest("hex").slice(0, 16);
const eq = (a: string, b: string) => { const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest(); return timingSafeEqual(x, y); };

export function checkCredentials(email: string, password: string) {
  if (!adminConfigured) return false;
  return eq(email.trim().toLowerCase(), ADMIN_EMAIL) && eq(password, ADMIN_PASSWORD);
}

/** Session token = expiry + password fingerprint, signed. Changing the password logs every session out. */
export function newSessionToken() {
  return signId(`${Date.now() + HOURS * 3600_000}:${fp()}`, "admin-session");
}
export function sessionValid(token: string | undefined) {
  if (!token || !adminConfigured) return false;
  const id = verifyId(token, "admin-session");
  if (!id) return false;
  const [exp, f] = id.split(":");
  return Number(exp) > Date.now() && f === fp();
}
export const sessionMaxAge = HOURS * 3600;

export function isAdmin() {
  return sessionValid(cookies().get(ADMIN_COOKIE)?.value);
}
export function requireAdmin() {
  if (!isAdmin()) redirect("/admin/login");
}
