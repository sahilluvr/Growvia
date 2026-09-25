import { NextResponse } from "next/server";
import { adminClient } from "@/lib/server/admin";
import { CRON_SECRET, SITE_URL } from "@/lib/config";
import { processDue, syncMailbox } from "@/lib/email/engine";
import { processDueBroadcasts, processDueSocial, syncPendingTemplates } from "@/lib/meta/channels";
import type { Mailbox } from "@/lib/email/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The scheduler. Supabase pg_cron calls this every minute (see supabase/cron.sql);
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

  const sending = await processDue(db, { siteUrl, limit: 60, deadline });
  const socialPublished = await processDueSocial(db, deadline);
  const whatsappSent = await processDueBroadcasts(db, deadline);
  const templatesSynced = await syncPendingTemplates(db).catch(() => 0);

  // Read replies for mailboxes not checked in the last 2 minutes.
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
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
  return NextResponse.json({ ok: true, ms: Date.now() - started, sending, socialPublished, whatsappSent, templatesSynced, replies });
}

export const GET = handle;
export const POST = handle;
