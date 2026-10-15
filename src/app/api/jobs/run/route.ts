import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { CRON_SECRET, SITE_URL } from "@/lib/config";
import { runJob } from "@/lib/jobs/run";
import { setOrigin } from "@/lib/jobs/queue";
import { onVercel } from "@/lib/server/host";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Runs one background job in its own invocation. Answers straight away; the work continues after the reply. */
export async function POST(req: Request) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  setOrigin(SITE_URL || new URL(req.url).origin);
  if (onVercel) {
    waitUntil(runJob(id).catch(() => {}));
    return NextResponse.json({ ok: true }, { status: 202 });
  }
  // Cloud Run: answer "accepted" at once but keep this request open until the job is done — CPU stays on.
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(c) {
      c.enqueue(enc.encode('{"ok":true,"accepted":true'));
      await runJob(id).catch(() => {});
      c.enqueue(enc.encode(',"done":true}'));
      c.close();
    },
  });
  return new Response(body, { status: 202, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
