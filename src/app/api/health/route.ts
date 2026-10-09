import { geminiStatus } from "@/lib/ai/gemini";
import { supabaseRegion, authKeyMode, vercelRegionName } from "@/lib/server/region";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, CRON_SECRET, SITE_URL, isSupabase, setupMissing } from "@/lib/config";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

async function check(path: string, init?: RequestInit): Promise<{ status: number; body: string }> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  return { status: res.status, body: await res.text() };
}

/** Safe diagnostics — never returns keys. Open /api/health on the live site to confirm setup. */
// PayPal readiness: creates one $1 USD Razorpay order (never charged; unpaid orders simply expire). Cached 10 min.
let ppCache: { at: number; check: Check } | null = null;
async function paypalCheck(rid: string, rsec: string): Promise<Check> {
  if (ppCache && Date.now() - ppCache.at < 600_000) return ppCache.check;
  let check: Check;
  try {
    const r = await fetch(`${(process.env.RAZORPAY_API_BASE || "https://api.razorpay.com").replace(/\/$/, "")}/v1/orders`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Basic ${Buffer.from(`${rid}:${rsec}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 100, currency: "USD", receipt: `health-${Date.now()}`, notes: { app: "growvia", purpose: "paypal-health-check" } }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; error?: { description?: string; code?: string } };
    check = r.ok
      ? { ok: true, detail: `ok — Razorpay accepts US-dollar orders (${j.id}), so PayPal can show at checkout. If a payment still fails, test with a PayPal account registered OUTSIDE India.` }
      : { ok: false, detail: `Razorpay refused a US-dollar order: "${j.error?.description ?? `HTTP ${r.status}`}"${j.error?.code ? ` (${j.error.code})` : ""}. PayPal needs USD orders — send this exact message to Razorpay Support (ticket #21214420) and ask them to allow USD orders for PayPal.` };
  } catch (e) {
    check = { ok: false, detail: `Couldn't reach Razorpay: ${(e as Error).message}` };
  }
  ppCache = { at: Date.now(), check };
  return check;
}

export async function GET(req: Request) {
  const wantPaypal = new URL(req.url).searchParams.get("paypal") === "1";
  const out: Record<string, unknown> = {
    mode: isSupabase ? "supabase" : "not-configured",
    supabaseUrl: SUPABASE_URL ? new URL(SUPABASE_URL).host : null,
    supabaseKeySet: Boolean(SUPABASE_KEY),
    serviceKeySet: Boolean(SUPABASE_SERVICE_KEY), // needed for scheduling, booking page, tracking
    cronSecretSet: Boolean(CRON_SECRET),
    encryptionKeySet: Boolean(process.env.ENCRYPTION_KEY?.trim()), // optional; recommended
    geminiSet: Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim()), // AI SEO plan
    googleLoginSet: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()), // Search Console
    resendSet: Boolean(process.env.RESEND_API_KEY?.trim()), // report & alert emails
    perplexitySet: Boolean(process.env.PERPLEXITY_API_KEY?.trim()), // optional AI-visibility engine
    openaiSet: Boolean(process.env.OPENAI_API_KEY?.trim()), // optional AI-visibility engine
    serpApiSet: Boolean(process.env.SERPAPI_KEY?.trim() || process.env.DATAFORSEO_LOGIN?.trim()), // optional live rankings
    pagespeedKeySet: Boolean(process.env.PAGESPEED_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()), // optional
    metaAppSet: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET), // Facebook/Instagram login
    siteUrl: SITE_URL || null,
    // Go-live checks (v021)
    razorpaySet: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
    razorpayMode: process.env.RAZORPAY_KEY_ID?.trim().startsWith("rzp_live_") ? "live" : process.env.RAZORPAY_KEY_ID?.trim() ? "test" : null,
    razorpayWebhookSecretSet: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
    turnstileSet: Boolean(process.env.TURNSTILE_SITE_KEY?.trim() && process.env.TURNSTILE_SECRET_KEY?.trim()),
    emailFrom: process.env.EMAIL_FROM?.trim() || "Growvia <onboarding@resend.dev> (default — only delivers to your own Resend address)",
    contactEmail: process.env.CONTACT_EMAIL?.trim() || "team.usegrowvia@gmail.com (default)",
    warnings: [
      ...(!SITE_URL ? ["SITE_URL is not set — email links and OAuth use the request address. Set it to https://usegrowvia.com."] : []),
      ...(SITE_URL && !/^https:\/\//.test(SITE_URL) && !/localhost|127\./.test(SITE_URL) ? ["SITE_URL should start with https://"] : []),
      ...(SITE_URL.includes("vercel.app") ? ["SITE_URL still points at vercel.app — change it to https://usegrowvia.com and redeploy."] : []),
      ...(!process.env.EMAIL_FROM?.trim() || /resend\.dev/.test(process.env.EMAIL_FROM ?? "") ? ["EMAIL_FROM uses Resend's test sender — verify usegrowvia.com in Resend and set EMAIL_FROM=Growvia <hello@usegrowvia.com>."] : []),
      ...(process.env.RAZORPAY_KEY_ID?.trim().startsWith("rzp_test_") ? ["Razorpay is in TEST mode — switch to live keys when you're ready to take real payments."] : []),
      ...(process.env.RAZORPAY_KEY_ID?.trim() && !process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ? ["RAZORPAY_WEBHOOK_SECRET missing — renewals and cancellations won't sync."] : []),
      ...(!SUPABASE_SERVICE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY missing — billing, scheduler, booking and tracking need it."] : []),
    ],
  };
  if (!isSupabase) {
    out.ok = !setupMissing;
    out.fix = "Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables, then Redeploy.";
    return NextResponse.json(out);
  }
  // Server location vs database: both should be in the same region for fast pages.
  out.serverRegion = process.env.VERCEL_REGION || "local";
  try {
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      await check("/auth/v1/health");
      times.push(Date.now() - t);
    }
    out.dbLatencyMs = Math.min(...times);
    out.dbLatencyVerdict = (out.dbLatencyMs as number) < 40 ? "fast (same region)" : "slow — Vercel functions and Supabase are in different regions";
  } catch {}
  // Which region is the database in, and does the login check need a network call on every page?
  const [db, keys] = await Promise.all([supabaseRegion(SUPABASE_URL ?? "").catch(() => null), authKeyMode(SUPABASE_URL ?? "", SUPABASE_KEY ?? "")]);
  out.databaseRegion = db ? `${db.city} (${db.aws})` : "unknown";
  out.authKeys = keys;
  const here = String(out.serverRegion);
  if (db?.vercel && here !== "local" && db.vercel !== here) {
    out.speedFix = `Your database is in ${db.city} but the app runs in ${vercelRegionName(here)}. Every dashboard page talks to the database several times, so each page waits ~${out.dbLatencyMs ?? "100+"} ms × several. Fix (2 minutes): in vercel.json set "regions": ["${db.vercel}"], push, and redeploy — pages get several times faster.`;
  } else if ((out.dbLatencyMs as number) >= 40) {
    out.speedFix = "Every page waits for the database several times, so this delay is multiplied. Supabase → Settings → General shows your project's region; set vercel.json \"regions\" to the matching Vercel region (Mumbai → bom1, Singapore → sin1, N. Virginia → iad1, Frankfurt → fra1, London → lhr1, Tokyo → hnd1, Sydney → syd1) and redeploy.";
  }
  if (keys === "legacy-secret") out.speedFix2 = "Supabase is still using the legacy JWT secret, so every page has to ask Supabase Auth to check the login (one extra round trip). Supabase → Project Settings → JWT Keys → “Migrate JWT secret” → then “Rotate keys” to switch to signing keys. Growvia then checks logins instantly, with no extra request (no code change needed).";
  const checks: Record<string, Check> = {};
  try {
    const a = await check("/auth/v1/settings");
    let autoconfirm: boolean | undefined;
    try { autoconfirm = JSON.parse(a.body).mailer_autoconfirm; } catch {}
    checks.auth = { ok: a.status === 200, detail: a.status === 200 ? (autoconfirm || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY ? "Instant signup (no email confirmation needed)" : "Email confirmation ON (users must click the email link) — add SUPABASE_SERVICE_ROLE_KEY for instant signup") : `HTTP ${a.status} — check the anon key` };
  } catch (e) {
    checks.auth = { ok: false, detail: `Cannot reach Supabase: ${(e as Error).message}` };
  }
  for (const t of ["businesses", "campaigns", "content_items", "leads", "activity", "mailboxes", "threads", "channel_accounts", "social_posts", "wa_broadcasts", "workspaces", "seo_audits", "seo_keywords", "seo_rankings", "seo_daily", "geo_prompts", "geo_checks", "team_members", "lead_forms", "ad_projects", "jobs", "subscriptions", "payments", "usage_events", "ai_cache"]) {
    try {
      const r = await check(`/rest/v1/${t}?select=owner_id&limit=1`); // every table has owner_id (seo_daily has no id)
      // Anonymous visitors are intentionally denied (42501): that proves the table exists and is locked down.
      const exists = r.status === 200 || r.body.includes("42501") || r.status === 401 || r.status === 403;
      checks[`table:${t}`] = { ok: exists, detail: exists ? "ok (locked to signed-in owners)" : `HTTP ${r.status} ${r.body.includes("PGRST205") || r.body.includes("42P01") ? "— table missing: run supabase/schema.sql" : r.body.slice(0, 200)}` };
    } catch (e) {
      checks[`table:${t}`] = { ok: false, detail: (e as Error).message };
    }
  }
  try {
    const r = await check("/rest/v1/rpc/public_business", { method: "POST", body: JSON.stringify({ bid: "00000000-0000-0000-0000-000000000000" }) });
    checks["function:public_business"] = { ok: r.status === 200, detail: r.status === 200 ? "ok" : `HTTP ${r.status} — run supabase/schema.sql` };
  } catch (e) {
    checks["function:public_business"] = { ok: false, detail: (e as Error).message };
  }
  // Razorpay: prove the keys work (read-only call, nothing is created or charged).
  const rid = process.env.RAZORPAY_KEY_ID?.trim(), rsec = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (rid && rsec) {
    try {
      const r = await fetch(`${(process.env.RAZORPAY_API_BASE || "https://api.razorpay.com").replace(/\/$/, "")}/v1/plans?count=1`, { headers: { Authorization: `Basic ${Buffer.from(`${rid}:${rsec}`).toString("base64")}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
      const hint = r.status === 401
        ? `Razorpay rejected the keys. Check: (1) RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET come from the SAME key pair and the same mode (${rid.startsWith("rzp_live_") ? "live" : "test"} — the Key ID starts with ${rid.slice(0, 9)}); (2) no spaces, quotes or line breaks; (3) you didn't regenerate the key after copying; (4) the secret is the API Key Secret, not the webhook secret; (5) you redeployed after saving.`
        : r.status === 400 || r.status === 403 ? "Keys accepted, but Subscriptions may not be enabled for this Razorpay account yet (Dashboard → Subscriptions)." : `HTTP ${r.status}`;
      checks["razorpay:keys"] = { ok: r.ok, detail: r.ok ? `ok (${rid.startsWith("rzp_live_") ? "live" : "test"} keys accepted)` : hint };
    } catch (e) {
      checks["razorpay:keys"] = { ok: false, detail: `Couldn't reach Razorpay: ${(e as Error).message}` };
    }
    out.paypalPrepaid = /^(1|on|true|yes)$/i.test(process.env.PAYPAL_PREPAID?.trim() ?? "");
    if (wantPaypal) checks["razorpay:paypal"] = await paypalCheck(rid, rsec);
    out.razorpayKeyIdPrefix = rid.slice(0, 9); // rzp_live_ / rzp_test_ — never the full key
    out.razorpayKeyLooksValid = /^rzp_(live|test)_[A-Za-z0-9]{10,}$/.test(rid) && rsec.length >= 16 && !/\s/.test(rsec);
  }
  out.checks = checks;
  out.ok = Object.values(checks).every((c) => c.ok);
  out.gemini = geminiStatus(); // which AI model is answering, and any that are resting after hitting their free limit
  return NextResponse.json(out);
}
