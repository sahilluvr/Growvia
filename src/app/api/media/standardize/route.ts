import { NextResponse } from "next/server";
import { CRON_SECRET, SUPABASE_URL } from "@/lib/config";
import { adminClient } from "@/lib/server/admin";
import { transcodeToStandardMp4 } from "@/lib/media/transcode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Internal: converts a stored video into a standard MP4 (see lib/media/transcode.ts) and stores it next to the
 * original as "…-std.mp4". Called server-to-server with the CRON_SECRET, never from the browser.
 */
export async function POST(req: Request) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  const { url, owner } = (await req.json().catch(() => ({}))) as { url?: string; owner?: string };
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/media/`;
  if (!url || !owner || !/^[0-9a-f-]{36}$/i.test(owner) || !url.startsWith(prefix)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const path = decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  if (!path.startsWith(`${owner}/`)) return NextResponse.json({ error: "not your file" }, { status: 403 });
  const outPath = path.replace(/\.[a-z0-9]+$/i, "") + "-std.mp4";

  // Converted before? Reuse it.
  const dir = outPath.split("/").slice(0, -1).join("/"), name = outPath.split("/").pop()!;
  const { data: existing } = await db.storage.from("media").list(dir, { search: name, limit: 1 });
  if (existing?.some((f) => f.name === name)) return NextResponse.json({ url: `${prefix}${outPath}`, reused: true });

  const src = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!src?.ok) return NextResponse.json({ error: "Couldn't download the video." }, { status: 502 });
  const buf = Buffer.from(await src.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "The video is over 200 MB." }, { status: 413 });
  try {
    const t = Date.now();
    const r = await transcodeToStandardMp4(buf, { maxSeconds: 15 * 60, timeoutMs: 270_000 });
    const { error } = await db.storage.from("media").upload(outPath, r.data, { contentType: "video/mp4", upsert: true, cacheControl: "31536000" });
    if (error) return NextResponse.json({ error: `Couldn't save the converted video: ${error.message}` }, { status: 500 });
    return NextResponse.json({ url: `${prefix}${outPath}`, seconds: r.seconds, width: r.width, height: r.height, ms: Date.now() - t });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Conversion failed." }, { status: 500 });
  }
}
