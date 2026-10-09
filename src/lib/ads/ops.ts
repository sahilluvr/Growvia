import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../config";
import { writeTextAds, writeVideoScript, DEFAULT_SETTINGS, PLATFORMS, type Brief, type PlatformId, type TextAds, type VideoData, type VideoSettings } from "../ai/ads";
import { speak, VOICES } from "../ai/tts";

/* The slow ad-studio steps, shared by the in-page actions and the background job runner. */
type Db = SupabaseClient;

/** Uploads bytes to the media bucket through a signed URL (same rules as browser uploads). */
export async function store(db: Db, userId: string, data: Buffer, type: string, ext: string) {
  const path = `${userId}/ads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data: signed, error: e1 } = await db.storage.from("media").createSignedUploadUrl(path);
  if (!signed) throw new Error(e1?.message ?? "no upload url");
  const { error } = await db.storage.from("media").uploadToSignedUrl(path, signed.token, data, { contentType: type });
  if (error) throw new Error(error.message);
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}
export const extOf = (type: string) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[type] ?? "bin";

export async function load(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("ad_projects").select("*").eq("id", id).maybeSingle();
  return data as { id: string; business_id: string; name: string; url: string | null; brief: Brief; text_ads: TextAds; video: VideoData; audio_url: string | null; video_url: string | null } | null;
}

export const cleanSettings = (s: Partial<VideoSettings>): VideoSettings => ({
  format: (["9:16", "1:1", "16:9"] as const).includes(s.format as never) ? s.format! : DEFAULT_SETTINGS.format,
  length: ([15, 30, 45, 60] as const).includes(Number(s.length) as never) ? (Number(s.length) as VideoSettings["length"]) : DEFAULT_SETTINGS.length,
  style: String(s.style ?? DEFAULT_SETTINGS.style).slice(0, 40),
  voice: VOICES.some((v) => v.id === s.voice) ? s.voice! : DEFAULT_SETTINGS.voice,
  avatar: s.avatar === "custom" && !String(s.avatarUrl ?? "").startsWith(`${SUPABASE_URL}/storage/v1/object/public/media/`) ? DEFAULT_SETTINGS.avatar : String(s.avatar ?? DEFAULT_SETTINGS.avatar).slice(0, 20),
  // Your own photo as the presenter — only images from Growvia's own storage.
  ...(typeof s.avatarUrl === "string" && s.avatarUrl.startsWith(`${SUPABASE_URL}/storage/v1/object/public/media/`) ? { avatarUrl: s.avatarUrl.slice(0, 500) } : {}),
  avatarPos: (["corner", "presenter", "none"] as const).includes(s.avatarPos as never) ? s.avatarPos! : DEFAULT_SETTINGS.avatarPos,
  music: (["upbeat", "calm", "corporate", "none"] as const).includes(s.music as never) ? s.music! : DEFAULT_SETTINGS.music,
  palette: String(s.palette ?? DEFAULT_SETTINGS.palette).slice(0, 20),
  captions: s.captions !== false,
});

export async function textAdsOp(db: Db, id: string, platforms: string[], tone?: string) {
  const cur = await load(db, id);
  if (!cur) throw new Error("Ad not found.");
  const ps = platforms.filter((p): p is PlatformId => p in PLATFORMS);
  const ads = await writeTextAds(cur.brief, ps, tone);
  const merged: TextAds = { ...cur.text_ads, ...ads };
  await db.from("ad_projects").update({ text_ads: merged, updated_at: new Date().toISOString() }).eq("id", id);
  return { ads: merged };
}

export async function scriptOp(db: Db, id: string, settings: Partial<VideoSettings>, direction?: string) {
  const cur = await load(db, id);
  if (!cur) throw new Error("Ad not found.");
  const s = cleanSettings(settings);
  const script = await writeVideoScript(cur.brief, s, direction);
  const video: VideoData = { title: script.title, scenes: script.scenes, settings: s, at: new Date().toISOString() };
  await db.from("ad_projects").update({ video, audio_url: null, updated_at: new Date().toISOString() }).eq("id", id);
  return { video };
}

export async function voiceOp(db: Db, id: string, userId: string) {
  const cur = await load(db, id);
  if (!cur?.video?.scenes?.length) throw new Error("Write the story first.");
  const scenes = cur.video.scenes;
  const text = scenes.map((s) => s.voice.trim()).filter(Boolean).map((v) => (/[.!?]$/.test(v) ? v : `${v}.`)).join(" ");
  const { wav, seconds } = await speak(text, cur.video.settings?.voice, `${cur.brief.tone || "warm, confident"} advertising voice-over`);
  const words = scenes.map((s) => Math.max(1, s.voice.split(/\s+/).filter(Boolean).length));
  const total = words.reduce((a, b) => a + b, 0);
  const timing = words.map((w) => Math.max(1.6, (w / total) * seconds));
  const audioUrl = await store(db, userId, wav, "audio/wav", "wav");
  const video = { ...cur.video, timing, audioSeconds: seconds };
  await db.from("ad_projects").update({ audio_url: audioUrl, video, updated_at: new Date().toISOString() }).eq("id", id);
  return { audioUrl, timing, seconds };
}
void DEFAULT_SETTINGS; void VOICES;
