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
export async function GET() {
  const out: Record<string, unknown> = {
    mode: isSupabase ? "supabase" : "not-configured",
    supabaseUrl: SUPABASE_URL ? new URL(SUPABASE_URL).host : null,
    supabaseKeySet: Boolean(SUPABASE_KEY),
    serviceKeySet: Boolean(SUPABASE_SERVICE_KEY), // needed for scheduling, booking page, tracking
    cronSecretSet: Boolean(CRON_SECRET),
    encryptionKeySet: Boolean(process.env.ENCRYPTION_KEY?.trim()), // optional; recommended
    metaAppSet: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET), // Facebook/Instagram login
    siteUrl: SITE_URL || null,
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
  const checks: Record<string, Check> = {};
  try {
    const a = await check("/auth/v1/settings");
    let autoconfirm: boolean | undefined;
    try { autoconfirm = JSON.parse(a.body).mailer_autoconfirm; } catch {}
    checks.auth = { ok: a.status === 200, detail: a.status === 200 ? (autoconfirm ? "Email confirmation OFF (instant signup)" : "Email confirmation ON (users must click the email link)") : `HTTP ${a.status} — check the anon key` };
  } catch (e) {
    checks.auth = { ok: false, detail: `Cannot reach Supabase: ${(e as Error).message}` };
  }
  for (const t of ["businesses", "campaigns", "content_items", "leads", "activity", "mailboxes", "threads", "channel_accounts", "social_posts", "wa_broadcasts"]) {
    try {
      const r = await check(`/rest/v1/${t}?select=id&limit=1`);
      // Anonymous visitors are intentionally denied (42501): that proves the table exists and is locked down.
      const exists = r.status === 200 || r.body.includes("42501");
      checks[`table:${t}`] = { ok: exists, detail: exists ? "ok (locked to signed-in owners)" : `HTTP ${r.status} ${r.body.includes("PGRST205") || r.body.includes("does not exist") ? "— table missing: run supabase/schema.sql" : r.body.slice(0, 200)}` };
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
  out.checks = checks;
  out.ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(out);
}
