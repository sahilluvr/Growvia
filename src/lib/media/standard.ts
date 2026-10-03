import "server-only";
import { headers } from "next/headers";
import { CRON_SECRET, SITE_URL, SUPABASE_URL } from "../config";

const PUBLIC = () => `${SUPABASE_URL}/storage/v1/object/public/media/`;

/** Already converted by Growvia (ends in -std.mp4). */
export const isStandardVideo = (url: string) => /-std\.mp4(\?|$)/i.test(url);

/**
 * Videos Growvia should convert before posting: anything recorded in Ad studio (browser recordings have broken
 * headers) and any WebM. Phone/camera MP4s and MOVs are already fine and can be large, so they go as they are.
 */
export function needsStandardVideo(url: string) {
  if (!url || isStandardVideo(url) || !SUPABASE_URL || !url.startsWith(PUBLIC())) return false;
  return /\/ads\//.test(url) || /\.webm(\?|$)/i.test(url);
}

function origin() {
  if (SITE_URL) return SITE_URL;
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) return `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  } catch { /* not in a request */ }
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
}

/**
 * Returns a version of the video every network accepts (converting it once, in its own function with ffmpeg).
 * Never throws: if conversion isn't possible the original URL comes back with the reason.
 */
export async function ensureStandardVideo(url: string, ownerId: string, timeoutMs = 280_000): Promise<{ url: string; seconds?: number | null; converted: boolean; error?: string }> {
  if (!needsStandardVideo(url)) return { url, converted: false };
  const base = origin();
  if (!base || !CRON_SECRET) return { url, converted: false, error: "Video conversion needs SITE_URL and CRON_SECRET." };
  try {
    const r = await fetch(`${base}/api/media/standardize`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
      body: JSON.stringify({ url, owner: ownerId }), cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    });
    const j = (await r.json().catch(() => ({}))) as { url?: string; seconds?: number | null; error?: string };
    if (!r.ok || !j.url) return { url, converted: false, error: j.error || `Conversion failed (${r.status}).` };
    return { url: j.url, seconds: j.seconds ?? null, converted: true };
  } catch (e) {
    return { url, converted: false, error: e instanceof Error && e.name === "TimeoutError" ? "Converting the video took too long." : "Couldn't reach the video converter." };
  }
}
