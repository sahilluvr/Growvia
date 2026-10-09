"use server";
import { checkLimit, recordUsage } from "@/lib/billing/plan";
import { ensureStandardVideo } from "@/lib/media/standard";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { SUPABASE_URL } from "@/lib/config";
import { dbErr, guard } from "@/lib/errors";
import { AiError } from "@/lib/ai/gemini";
import { CrawlError, fetchBinary } from "@/lib/seo/crawl";
import { readSite, importImages, type SiteRead } from "@/lib/ads/analyze";
import { writeBrief, writeTextAds, writeVideoScript, DEFAULT_SETTINGS, PLATFORMS, type Brief, type PlatformId, type TextAds, type VideoData, type VideoSettings, type Scene } from "@/lib/ai/ads";
import { speak, VOICES } from "@/lib/ai/tts";
import { store, load, cleanSettings, extOf, textAdsOp, scriptOp, voiceOp } from "@/lib/ads/ops";
import { enqueue } from "@/lib/jobs/queue";
import { aiPhoto } from "@/lib/social/image";
import type { FormState } from "./actions";

type Db = ReturnType<typeof supabaseServer>;
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return { db: supabaseServer(), user, business };
}
const aiErr = (e: unknown) => (e instanceof AiError || e instanceof CrawlError ? e.message : "Something went wrong — please try again.");
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const done = (id?: string) => { revalidatePath("/app/ads"); if (id) revalidatePath(`/app/ads/${id}`); };


/** New ad project: read the website, copy its photos, write the creative brief. */
export async function createAdAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => createAdActionImpl(s, f));
}
async function createAdActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, user, business } = await me();
  if (!business) return { error: "Set up your project first." };
  const url = str(f, "url", 500) || business.website || "";
  const goal = str(f, "goal", 300);
  let site: SiteRead | null = null;
  let warning = "";
  if (url) {
    try { site = await readSite(url); } catch (e) { if (e instanceof CrawlError) warning = e.message; else warning = "Couldn't read the website, so the brief uses your project details."; }
  }
  let brief: Brief;
  try {
    const b = await writeBrief(business, site, { goal, offer: str(f, "offer", 300), audience: str(f, "audience", 300) });
    const images = site ? await importImages(site.images, (d, t) => store(db, user.id, d, t, extOf(t))) : [];
    // Copy the logo too, so the video's end card can show it (images must be on our storage to be drawn).
    const lg = site?.logo ? await fetchBinary(site.logo, { maxBytes: 1_500_000 }).catch(() => null) : null;
    const logo = lg && /^image\/(png|jpeg|webp|svg\+xml)$/.test(lg.type) ? await store(db, user.id, lg.data, lg.type, lg.type === "image/svg+xml" ? "svg" : extOf(lg.type)).catch(() => null) : null;
    brief = { ...b, images, logo, color: site?.color ?? null };
  } catch (e) {
    return { error: aiErr(e) };
  }
  const { data, error } = await db.from("ad_projects").insert({ business_id: business.id, name: str(f, "name", 80) || brief.offer.slice(0, 60) || "New ad", url: site?.url ?? (url || null), brief, video: { scenes: [], settings: DEFAULT_SETTINGS } }).select("id").single();
  if (error || !data) return { error: dbErr(error, "Couldn't save the ad.") };
  await db.from("activity").insert({ business_id: business.id, agent: "Creator", text: `Started an ad: ${brief.offer.slice(0, 80) || brief.business}.`, tag: "Ads" });
  done();
  redirect(`/app/ads/${data.id}${warning ? `?warn=${encodeURIComponent(warning)}` : ""}`);
}

export async function saveBriefAction(id: string, brief: Partial<Brief>): Promise<Res> {
  const { db } = await me();
  const cur = await load(db, id);
  if (!cur) return { ok: false, error: "Ad not found." };
  const next = { ...cur.brief, ...brief, usps: (brief.usps ?? cur.brief.usps).map((x) => String(x).slice(0, 120)).filter(Boolean).slice(0, 8) };
  const { error } = await db.from("ad_projects").update({ brief: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: dbErr(error) };
  done(id);
  return { ok: true };
}

export async function writeTextAdsAction(id: string, platforms: string[], tone?: string): Promise<Res<{ jobId: string }>> {
  return startAdJob(id, "ad_text", { adId: id, platforms: platforms.filter((p) => p in PLATFORMS), tone: tone ?? "" }, "Ad copy");
}

/** Slow AI steps run in the background so the screen never freezes; the page listens for the result. */
async function startAdJob(id: string, kind: "ad_text" | "ad_script" | "ad_voice", params: Record<string, unknown>, title: string): Promise<Res<{ jobId: string }>> {
  const { db, user } = await me();
  const cur = await load(db, id);
  if (!cur) return { ok: false, error: "Ad not found." };
  const { data: biz } = await db.from("businesses").select("owner_id").eq("id", cur.business_id).maybeSingle();
  const r = await enqueue({ ownerId: biz?.owner_id ?? user.id, businessId: cur.business_id, userId: user.id, kind, params, title: `${title}: ${cur.name}`.slice(0, 120), link: `/app/ads/${id}${kind === "ad_text" ? "" : "?tab=video"}` });
  return r.id ? { ok: true, jobId: r.id } : { ok: false, error: r.error ?? "Couldn't start that." };
}

export async function saveTextAdsAction(id: string, ads: TextAds): Promise<Res> {
  const { db } = await me();
  const { error } = await db.from("ad_projects").update({ text_ads: ads, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: dbErr(error) };
  done(id);
  return { ok: true };
}

/** Writes the story (scenes). Keeps settings; clears the old voice-over. */
export async function writeScriptAction(id: string, settings: Partial<VideoSettings>, direction?: string): Promise<Res<{ jobId: string }>> {
  return startAdJob(id, "ad_script", { adId: id, settings: cleanSettings(settings), direction: (direction ?? "").slice(0, 400) }, "Video story");
}

export async function saveVideoAction(id: string, video: { scenes: Scene[]; settings: Partial<VideoSettings> }): Promise<Res<{ voiceCleared: boolean }>> {
  const { db } = await me();
  const cur = await load(db, id);
  if (!cur) return { ok: false, error: "Ad not found." };
  const scenes = (video.scenes ?? []).slice(0, 10).map((s, i) => ({ id: String(s.id || `s${i}`).slice(0, 20), kind: s.kind, voice: String(s.voice ?? "").slice(0, 400), text: String(s.text ?? "").slice(0, 60), image: typeof s.image === "number" ? s.image : null }));
  const settings = cleanSettings(video.settings ?? {});
  const said = (x: { voice: string }[]) => x.map((s) => s.voice.trim()).join("|");
  const voiceCleared = Boolean(cur.audio_url) && (said(scenes) !== said(cur.video.scenes ?? []) || settings.voice !== cur.video.settings?.voice);
  const next: VideoData = { ...cur.video, scenes, settings, ...(voiceCleared ? { timing: undefined, audioSeconds: undefined } : {}) };
  const { error } = await db.from("ad_projects").update({ video: next, ...(voiceCleared ? { audio_url: null } : {}), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: dbErr(error) };
  done(id);
  return { ok: true, voiceCleared };
}

/** Records the AI voice-over for the whole script in one go, then times each scene by its share of the words. */
export async function voiceoverAction(id: string): Promise<Res<{ jobId: string }>> {
  const { db } = await me();
  const cur = await load(db, id);
  if (!cur?.video?.scenes?.length) return { ok: false, error: "Write the story first." };
  return startAdJob(id, "ad_voice", { adId: id }, "Voice-over");
}

export async function voiceSampleAction(voice: string): Promise<Res<{ url: string }>> {
  try {
    const { db, user } = await me();
    const v = VOICES.some((x) => x.id === voice) ? voice : "Kore";
    const path = `${user.id}/voice-samples/${v}.wav`;
    const url = `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
    const head = await fetch(url, { method: "HEAD", cache: "no-store" }).catch(() => null);
    if (head?.ok) return { ok: true, url }; // already made once — no AI call needed
    const { wav } = await speak("Hi! This is how your ad will sound. Short, clear, and made for your business.", v);
    const { data: signed } = await db.storage.from("media").createSignedUploadUrl(path);
    if (signed) await db.storage.from("media").uploadToSignedUrl(path, signed.token, wav, { contentType: "audio/wav" });
    return { ok: true, url: signed ? url : await store(db, user.id, wav, "audio/wav", "wav") };
  } catch (e) {
    return { ok: false, error: aiErr(e) };
  }
}

/** Adds an AI-generated photo to the ad's image library (optional; needs an image-capable Gemini key). */
export async function adPhotoAction(id: string, prompt: string): Promise<Res<{ images: string[] }>> {
  const { db, user } = await me();
  const cur = await load(db, id);
  if (!cur) return { ok: false, error: "Ad not found." };
  const size = cur.video?.settings?.format === "9:16" ? "story" : cur.video?.settings?.format === "16:9" ? "landscape" : "square";
  const r = await aiPhoto(prompt || cur.brief.summary, size);
  if (!r.url) return { ok: false, error: r.error ?? "Couldn't create the photo." };
  const m = r.url.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return { ok: false, error: "Couldn't read the photo." };
  const url = await store(db, user.id, Buffer.from(m[2], "base64"), m[1], extOf(m[1]) === "bin" ? "png" : extOf(m[1]));
  const images = [...(cur.brief.images ?? []), url].slice(-20);
  await db.from("ad_projects").update({ brief: { ...cur.brief, images } }).eq("id", id);
  done(id);
  return { ok: true, images };
}

/** Browser uploads its own photo for the ad: we hand out a signed upload URL. */
export async function adUploadUrlAction(filename: string, type: string): Promise<Res<{ uploadUrl: string; publicUrl: string }>> {
  const { db, user } = await me();
  const video = /^video\/(webm|mp4)$/.test(type);
  if (!/^image\/(jpeg|png|webp)$/.test(type) && !video) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  const ext = video ? (type.includes("mp4") ? "mp4" : "webm") : extOf(type);
  const path = `${user.id}/ads/${Date.now()}-${filename.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(-40)}.${ext}`;
  const { data, error } = await db.storage.from("media").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Storage isn't set up — run the latest schema.sql in Supabase." };
  return { ok: true, uploadUrl: data.signedUrl, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` };
}

export async function addAdImageAction(id: string, url: string): Promise<Res<{ images: string[] }>> {
  const { db } = await me();
  const cur = await load(db, id);
  if (!cur || !url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/media/`)) return { ok: false, error: "Couldn't add that image." };
  const images = [...(cur.brief.images ?? []), url].slice(-20);
  await db.from("ad_projects").update({ brief: { ...cur.brief, images } }).eq("id", id);
  done(id);
  return { ok: true, images };
}

/** Called after the browser has rendered and uploaded the video file. */
/** Checks the monthly video allowance before recording (Free: 1/month with a watermark; Pro: 20/month). */
export async function startExportAction(id: string): Promise<Res<{ watermark: boolean }>> {
  const { db, user, business } = await me();
  const owner = business?.owner_id ?? user.id;
  const { data: ad } = await db.from("ad_projects").select("id").eq("id", id).maybeSingle();
  if (!ad) return { ok: false, error: "This ad was deleted." };
  const gate = await checkLimit(owner, "videos", 1, db);
  if (!gate.ok) return { ok: false, error: gate.error };
  return { ok: true, watermark: gate.plan.limits.watermark };
}

export async function saveRenderAction(id: string, url: string): Promise<Res<{ url: string; seconds: number | null; converted: boolean }>> {
  const { db, user, business } = await me();
  if (!url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/media/`)) return { ok: false, error: "Upload failed." };
  // Browser recordings have broken headers (Facebook kept only the first seconds) — convert to a standard MP4 now,
  // so posting later is instant and the full video goes out everywhere.
  const std = await ensureStandardVideo(url, user.id);
  const { error } = await db.from("ad_projects").update({ video_url: std.url, status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: dbErr(error) };
  await recordUsage(business?.owner_id ?? user.id, "video", id, db).catch(() => {});
  done(id);
  return { ok: true, url: std.url, seconds: std.seconds ?? null, converted: std.converted };
}

/** Turns the finished video (plus a caption) into a Publish draft. */
export async function postAdAction(id: string, caption: string): Promise<Res<{ postId: string }>> {
  const { db, user } = await me();
  const cur = await load(db, id);
  if (!cur?.video_url) return { ok: false, error: "Export the video first." };
  const std = await ensureStandardVideo(cur.video_url, user.id);
  if (std.converted) await db.from("ad_projects").update({ video_url: std.url }).eq("id", id);
  const { data, error } = await db.from("social_posts").insert({ owner_id: user.id, caption: caption.slice(0, 2200), media: [{ url: std.url, type: "video" }], targets: [], status: "draft", results: [], ai: { ad: id } }).select("id").single();
  if (error || !data) return { ok: false, error: dbErr(error, "Couldn't create the post.") };
  revalidatePath("/app/publish");
  return { ok: true, postId: data.id };
}

export async function deleteAdAction(id: string) {
  const { db } = await me();
  await db.from("ad_projects").delete().eq("id", id);
  done();
  redirect("/app/ads");
}
