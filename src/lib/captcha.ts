import "server-only";

// Cloudflare Turnstile (free, usually invisible). Keys: dash.cloudflare.com → Turnstile → Add site.
export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY?.trim() || "";
const SECRET = process.env.TURNSTILE_SECRET_KEY?.trim() || "";
const VERIFY_URL = process.env.TURNSTILE_VERIFY_URL?.trim() || "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_SCRIPT = process.env.TURNSTILE_SCRIPT_URL?.trim() || "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** "supabase" = Supabase Auth checks the token itself (Auth → Bot and Abuse Protection); otherwise Growvia checks it. */
export const CAPTCHA_MODE = process.env.CAPTCHA_MODE?.trim() === "supabase" ? "supabase" : "growvia";
export const captchaOn = Boolean(TURNSTILE_SITE_KEY && (SECRET || CAPTCHA_MODE === "supabase"));

export async function verifyCaptcha(token: string | null | undefined, ip?: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!captchaOn) return { ok: true };
  if (!token) return { ok: false, error: "Please complete the “I'm human” check." };
  try {
    const body = new URLSearchParams({ secret: SECRET, response: token, ...(ip ? { remoteip: ip } : {}) });
    const r = await fetch(VERIFY_URL, { method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(8000) });
    const d = await r.json().catch(() => ({}));
    return d.success ? { ok: true } : { ok: false, error: "The human check failed or expired — please try again." };
  } catch {
    return { ok: false, error: "Couldn't verify the human check — please try again." };
  }
}
