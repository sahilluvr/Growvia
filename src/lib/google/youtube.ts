import "server-only";
import { GoogleApiError, gfetch, toGoogleError } from "./api";

const YT = (process.env.YOUTUBE_BASE?.trim() || "https://www.googleapis.com").replace(/\/$/, "");
const UP = (process.env.YOUTUBE_UPLOAD_BASE?.trim() || process.env.YOUTUBE_BASE?.trim() || "https://www.googleapis.com").replace(/\/$/, "");
const W = "YouTube";
export const YT_MAX_BYTES = 256 * 1024 * 1024;

export async function myChannels(access: string) {
  const r = await gfetch<{ items?: { id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }[] }>(access, `${YT}/youtube/v3/channels?part=snippet&mine=true`, { what: W });
  return (r.items ?? []).map((c) => ({ id: c.id, title: c.snippet?.title ?? "YouTube channel", handle: c.snippet?.customUrl?.replace(/^@/, "") ?? null, picture: c.snippet?.thumbnails?.default?.url ?? null }));
}

const ytError = (status: number, err: { message?: string; errors?: { reason?: string }[] } | undefined) => {
  const reason = (err?.errors ?? []).map((e) => e.reason).join(" ");
  if (/youtubeSignupRequired/.test(reason)) return new GoogleApiError("This Google account doesn't have a YouTube channel yet — create one at youtube.com, then try again.", "auth", status);
  if (/uploadLimitExceeded/.test(reason)) return new GoogleApiError("This channel reached YouTube's upload limit for today — try again tomorrow.", "quota", status);
  if (/quotaExceeded/.test(reason)) return new GoogleApiError("Growvia's daily YouTube upload allowance is used up — the post will retry tomorrow, or upload it in YouTube Studio.", "quota", status);
  return toGoogleError(status, err, W);
};

export type YtOptions = { title?: string; privacy?: "public" | "unlisted" | "private"; tags?: string[] };

/** Uploads a video (from a public URL) to the connected channel with YouTube's resumable upload. */
export async function uploadVideo(access: string, videoUrl: string, description: string, o: YtOptions) {
  const src = await fetch(videoUrl, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!src.ok) throw new GoogleApiError(`Couldn't read the video file (${src.status}) — upload it again.`);
  const bytes = Buffer.from(await src.arrayBuffer());
  if (bytes.length > YT_MAX_BYTES) throw new GoogleApiError("That video is too large to send from Growvia (max 256 MB) — upload it in YouTube Studio instead.");
  const type = src.headers.get("content-type")?.startsWith("video/") ? src.headers.get("content-type")! : "video/mp4";
  const title = (o.title?.trim() || description.split("\n")[0] || "New video").replace(/[<>]/g, "").slice(0, 100);
  const meta = {
    snippet: { title, description: description.replace(/[<>]/g, "").slice(0, 4900), tags: (o.tags ?? []).slice(0, 15), categoryId: "22" },
    status: { privacyStatus: o.privacy ?? "public", selfDeclaredMadeForKids: false },
  };
  const init = await fetch(`${UP}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(bytes.length), "X-Upload-Content-Type": type },
    body: JSON.stringify(meta),
  });
  if (!init.ok) throw ytError(init.status, (await init.json().catch(() => ({})))?.error);
  const loc = init.headers.get("location");
  if (!loc) throw new GoogleApiError("YouTube didn't accept the upload — please try again.");
  const put = await fetch(loc, { method: "PUT", body: bytes, headers: { "Content-Type": type, "Content-Length": String(bytes.length) }, cache: "no-store", signal: AbortSignal.timeout(55000) });
  const data = await put.json().catch(() => ({}));
  if (!put.ok) throw ytError(put.status, data?.error);
  const id = String(data.id ?? "");
  return { id, permalink: `https://youtu.be/${id}`, privacy: data.status?.privacyStatus as string | undefined };
}
