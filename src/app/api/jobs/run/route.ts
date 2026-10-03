import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { CRON_SECRET, SITE_URL } from "@/lib/config";
import { runJob } from "@/lib/jobs/run";
import { setOrigin } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Runs one background job in its own invocation. Answers straight away; the work continues after the reply. */
export async function POST(req: Request) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  setOrigin(SITE_URL || new URL(req.url).origin);
  waitUntil(runJob(id).catch(() => {}));
  return NextResponse.json({ ok: true }, { status: 202 });
}
