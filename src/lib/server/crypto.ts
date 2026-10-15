import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "../config";

/*
 * Key for encrypting saved passwords/tokens and signing links. Set ENCRYPTION_KEY in production.
 * The first available secret encrypts; ALL of them can still decrypt/verify, so adding
 * ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY later never breaks connections saved earlier.
 */
const RAWS = [process.env.ENCRYPTION_KEY?.trim(), SUPABASE_SERVICE_KEY, SUPABASE_KEY, "growvia-dev-key"].filter((x, i, a): x is string => Boolean(x) && a.indexOf(x) === i);
const KEYS = RAWS.map((r) => createHash("sha256").update(`growvia:${r}`).digest());
const KEY = KEYS[0];
export const hasDedicatedKey = Boolean(process.env.ENCRYPTION_KEY?.trim());

export class SecretError extends Error {}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decrypt(token: string): string {
  const [v, iv, tag, data] = (token || "").split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new SecretError("Saved credentials are missing or damaged — please reconnect.");
  for (const k of KEYS) {
    try {
      const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
      d.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
    } catch { /* try the next key */ }
  }
  throw new SecretError("Growvia can't read the saved credentials because the server's secret key changed. Please reconnect this account.");
}

const macWith = (k: Buffer, v: string) => createHmac("sha256", k).update(v).digest("base64url").slice(0, 22);

/** Tamper-proof token for public links (unsubscribe, tracking, OAuth state). */
export function signId(id: string, purpose: string) {
  return `${id}.${macWith(KEY, `${purpose}:${id}`)}`;
}
export function verifyId(token: string, purpose: string): string | null {
  const [id, sig] = (token || "").split(".");
  if (!id || !sig) return null;
  for (const k of KEYS) {
    const good = macWith(k, `${purpose}:${id}`);
    if (good.length === sig.length && timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return id;
  }
  return null;
}

const derivedWith = (k: Buffer, purpose: string) => `gv_${createHmac("sha256", k).update(`derived:${purpose}`).digest("base64url").slice(0, 28)}`;
/** A stable secret derived from the app key (used as the default Meta webhook verify token). */
export function derivedToken(purpose: string) {
  return derivedWith(KEY, purpose);
}
/** Every token this server would ever have shown — so an earlier-copied verify token keeps working. */
export function derivedTokens(purpose: string) {
  return KEYS.map((k) => derivedWith(k, purpose));
}
