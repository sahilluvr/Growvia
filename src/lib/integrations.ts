import "server-only";
import { CRON_SECRET, SUPABASE_SERVICE_KEY } from "./config";

const set = (...k: string[]) => k.every((x) => Boolean(process.env[x]?.trim()));
const any = (...k: string[]) => k.some((x) => Boolean(process.env[x]?.trim()));

/** What each Vercel setting switches on — shown in Settings → Integrations (never shows the values). */
export function integrations() {
  return [
    { group: "Core", name: "Scheduler & automation", ok: Boolean(SUPABASE_SERVICE_KEY && CRON_SECRET), keys: "SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET", what: "Scheduled emails, replies sync, auto SEO checks, webhooks, public forms" },
    { group: "Core", name: "Encryption key", ok: set("ENCRYPTION_KEY"), keys: "ENCRYPTION_KEY", what: "Encrypts saved passwords and tokens (recommended)" },
    { group: "Core", name: "Growvia emails (Resend)", ok: set("RESEND_API_KEY"), keys: "RESEND_API_KEY, EMAIL_FROM", what: "Welcome, alerts, reports, team invites, form auto-replies" },
    { group: "Core", name: "Bot protection (Turnstile)", ok: set("TURNSTILE_SITE_KEY") && (set("TURNSTILE_SECRET_KEY") || process.env.CAPTCHA_MODE === "supabase"), keys: "TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY", what: "Human check on login, signup, password reset and website forms" },
    { group: "AI", name: "Google Gemini", ok: any("GEMINI_API_KEY", "GOOGLE_AI_API_KEY"), keys: "GEMINI_API_KEY", what: "AI writing (emails, posts), SEO plans, experts, AI visibility" },
    { group: "AI", name: "Perplexity", ok: set("PERPLEXITY_API_KEY"), keys: "PERPLEXITY_API_KEY", what: "Also check Perplexity answers (optional)" },
    { group: "AI", name: "OpenAI / ChatGPT", ok: set("OPENAI_API_KEY"), keys: "OPENAI_API_KEY", what: "Also check ChatGPT answers (optional)" },
    { group: "Google", name: "Search Console sign-in", ok: set("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), keys: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET", what: "Real searches, clicks, keyword positions" },
    { group: "Google", name: "PageSpeed key", ok: any("PAGESPEED_API_KEY", "GOOGLE_API_KEY"), keys: "PAGESPEED_API_KEY", what: "Higher limit for speed tests (optional)" },
    { group: "Google", name: "Live rankings (SERP API)", ok: any("SERPAPI_KEY", "DATAFORSEO_LOGIN"), keys: "SERPAPI_KEY or DATAFORSEO_LOGIN/PASSWORD", what: "Exact Google position for any keyword (optional, paid)" },
    { group: "Meta", name: "Facebook & Instagram login", ok: set("META_APP_ID", "META_APP_SECRET"), keys: "META_APP_ID, META_APP_SECRET", what: "Connect Pages/Instagram, publish, DMs, WhatsApp webhooks" },
  ];
}
