import { NextResponse } from "next/server";
import { adminClient } from "@/lib/server/admin";
import { CRON_SECRET, SITE_URL } from "@/lib/config";
import { processDue, syncMailbox } from "@/lib/email/engine";
import { processDueBroadcasts, processDueReminders, processDueSocial, syncPendingTemplates } from "@/lib/meta/channels";
import { runLocalJobs } from "@/lib/local/sync";
import { runHealthJobs } from "@/lib/health/jobs";
import { runSeoJobs } from "@/lib/seo/jobs";
import { setOrigin, sweepJobs } from "@/lib/jobs/queue";
import type { Mailbox } from "@/lib/email/types";
import { runIndexNow } from "@/lib/seo/indexnow";
import { remindPrepaid } from "@/lib/billing/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The scheduler. Supabase pg_cron calls this every 5 minutes (see supabase/cron.sql);
 * Vercel Cron also calls it daily as a backup. Sends due emails and reads new replies.
 */
async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  if (!CRON_SECRET || (auth !== `Bearer ${CRON_SECRET}` && key !== CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  const siteUrl = SITE_URL || new URL(req.url).origin;
  const started = Date.now();
  const deadline = started + 45_000;

  setOrigin(siteUrl);
  const jobs = await sweepJobs(db, started + 30_000).catch(() => ({ restarted: 0, failed: 0 })); // background tasks whose start was missed
  const sending = await processDue(db, { siteUrl, limit: 60, deadline });
  const socialPublished = await processDueSocial(db, deadline);
  const whatsappSent = await processDueBroadcasts(db, deadline);
  // Slow-moving work (SEO, Maps, health, IndexNow, reminders, template status) only every 15 minutes.
  const heavy = await heavyDue(db);
  const templatesSynced = heavy ? await syncPendingTemplates(db).catch(() => 0) : 0;
  const reminders = heavy ? await processDueReminders(db, deadline).catch(() => 0) : 0;
  const prepaidReminders = heavy && Date.now() < deadline ? await remindPrepaid(db).catch(() => 0) : 0;

  // CPU budget (Vercel Hobby = 4h active CPU a month): sending runs every tick; everything else is throttled.
  // Read replies for mailboxes not checked in the last 10 minutes (IMAP + TLS + parsing is the costliest part).
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: boxes } = await db.from("mailboxes").select("*").not("imap_host", "is", null).or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`).order("last_sync_at", { ascending: true, nullsFirst: true }).limit(10);
  const replies = { mailboxes: 0, fetched: 0, replies: 0, bounces: 0, errors: [] as string[] };
  for (const m of (boxes ?? []) as Mailbox[]) {
    if (Date.now() > deadline) break;
    const r = await syncMailbox(db, m);
    replies.mailboxes++;
    replies.fetched += r.fetched;
    replies.replies += r.replies;
    replies.bounces += r.bounces;
    if (r.error) replies.errors.push(`${m.from_email}: ${r.error}`);
  }
  // SEO & AI visibility: scheduled audits, Search Console sync, AI checks, report emails (uses remaining time).
  const seo = heavy ? await runSeoJobs(db, started + 52_000, siteUrl).catch((e) => ({ error: String(e) })) : { skipped: "not due" };
  // Google Business Profile: daily profile/reviews sync + weekly Maps rank check.
  const local = heavy ? await runLocalJobs(db, started + 54_000).catch((e) => ({ error: String(e) })) : { skipped: "not due" };
  // Sending health: mailbox scores, domain DNS/blocklists, Gmail Postmaster, WhatsApp quality (each daily).
  const health = heavy ? await runHealthJobs(db, started + 57_000).catch((e) => ({ error: String(e) })) : { skipped: "not due" };
  // Announce new/changed public pages to Bing & co. (hourly at most; only what changed).
  const indexnow = heavy && Date.now() < started + 58_000 ? await runIndexNow(db).catch((e) => ({ error: String(e).slice(0, 200) })) : { skipped: "no time" };
  return NextResponse.json({ ok: true, ms: Date.now() - started, jobs, sending, socialPublished, whatsappSent, templatesSynced, reminders, prepaidReminders, replies, seo, local, health, indexnow });
}

/** True at most once per 15 minutes (claimed atomically, so overlapping ticks can't both run the heavy jobs). */
async function heavyDue(db: NonNullable<ReturnType<typeof adminClient>>) {
  const key = "tick-heavy";
  const now = Date.now();
  const { data } = await db.from("billing_plans").select("rzp_plan_id").eq("key", key).maybeSingle();
  const last = data?.rzp_plan_id ? Date.parse(data.rzp_plan_id) : 0;
  if (Number.isFinite(last) && now - last < 15 * 60_000) return false;
  const stamp = new Date(now).toISOString();
  if (!data) {
    const { error } = await db.from("billing_plans").insert({ key, rzp_plan_id: stamp });
    return !error;
  }
  const { data: won } = await db.from("billing_plans").update({ rzp_plan_id: stamp }).eq("key", key).eq("rzp_plan_id", data.rzp_plan_id).select("key");
  return Boolean(won?.length);
}

export const GET = handle;
export const POST = handle;
