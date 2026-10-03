"use server";

import { guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { SUPABASE_URL } from "@/lib/config";
import { AiError } from "@/lib/ai/gemini";
import { planSocialWeek, writeSocial, type SocialIdea } from "@/lib/ai/write";
import { aiPhoto, renderDesign, LAYOUTS, PALETTES, SIZES, type Layout, type Palette, type Size } from "@/lib/social/image";
import type { FormState } from "./actions";

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return { db: supabaseServer(), user, business };
}
const aiErr = (e: unknown) => (e instanceof AiError ? e.message : "The AI couldn't do that right now — try again in a moment.");
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

type Db = ReturnType<typeof supabaseServer>;
async function store(db: Db, userId: string, png: Buffer): Promise<string> {
  const path = `${userId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  // Signed upload = the same path the browser uses, so it follows the same storage rules.
  const { data: signed, error: e1 } = await db.storage.from("media").createSignedUploadUrl(path);
  const { error } = signed ? await db.storage.from("media").uploadToSignedUrl(path, signed.token, png, { contentType: "image/png" }) : { error: e1 ?? new Error("no upload url") };
  if (error) throw new Error(/bucket/i.test(error.message) ? "Image storage isn't set up — run the latest schema.sql in Supabase." : "Couldn't save the image — try again.");
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

/** Caption ideas for the Publish composer. Never throws. */
export async function aiSocialAction(i: { brief: string; tone?: string; channels?: string[] }): Promise<{ ok: true; options: SocialIdea[] } | { ok: false; error: string }> {
  try {
    const { business } = await me();
    if (!business) return { ok: false, error: "Set up your project first so the AI knows your business." };
    return { ok: true, ...(await writeSocial(business, i)) };
  } catch (e) {
    return { ok: false, error: aiErr(e) };
  }
}

export type ImageInput = { headline: string; sub?: string; cta?: string; palette?: string; layout?: string; size?: string; photoPrompt?: string; usePhoto?: boolean };
const pick = <T extends string>(v: string | undefined, all: readonly T[], d: T): T => (all as readonly string[]).includes(v ?? "") ? (v as T) : d;

async function makeImage(db: Db, userId: string, brand: string, i: ImageInput) {
  const size = pick<Size>(i.size, Object.keys(SIZES) as Size[], "square");
  let photo: string | null = null;
  let warning: string | undefined;
  if (i.usePhoto && i.photoPrompt?.trim()) {
    const r = await aiPhoto(i.photoPrompt, size);
    photo = r.url ?? null;
    warning = r.error;
  }
  const png = await renderDesign({
    headline: i.headline, sub: i.sub, cta: i.cta, brand, photo, size,
    palette: pick<Palette>(i.palette, Object.keys(PALETTES) as Palette[], "ink"),
    layout: pick<Layout>(i.layout, LAYOUTS, photo ? "photo" : "bold"),
  });
  return { url: await store(db, userId, png), warning };
}

/** Designs a branded image (optionally on an AI photo) and saves it to your media library. */
export async function aiImageAction(i: ImageInput): Promise<{ ok: true; url: string; warning?: string } | { ok: false; error: string }> {
  try {
    const { db, user, business } = await me();
    if (!String(i.headline ?? "").trim()) return { ok: false, error: "Add a headline for the image." };
    const r = await makeImage(db, user.id, business?.name ?? "", i);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.length < 160 ? e.message : "Couldn't create the image — try again." };
  }
}

/** Local wall-clock time in a time zone → UTC instant. */
function zoned(dayOffset: number, hhmm: string, tz: string) {
  const now = new Date();
  let zone = tz;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { zone = "UTC"; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + dayOffset, hh, mm);
  const off = (t: number) => {
    const q = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    return Date.UTC(Number(q.year), Number(q.month) - 1, Number(q.day), Number(q.hour), Number(q.minute)) - t;
  };
  return new Date(guess - off(guess - off(guess)));
}

/** “Plan my week”: writes N posts with images and saves them as drafts or scheduled posts. */
export async function planWeekAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => planWeekActionImpl(s, f));
}
async function planWeekActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, user, business } = await me();
  if (!business) return { error: "Set up your project first." };
  const targets = f.getAll("targets").map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  let schedule = f.get("schedule") === "on";
  const withPhotos = f.get("photos") === "on";
  const palette = str(f, "palette", 20) || "ink";
  const tz = str(f, "tz", 60) || "Asia/Kolkata";
  const { data: picked } = targets.length ? await db.from("channel_accounts").select("id, provider").in("id", targets) : { data: [] as { id: string; provider: string }[] };
  const accs = (picked ?? []).filter((a) => a.provider !== "youtube"); // image posts can't go to YouTube
  targets.splice(0, targets.length, ...accs.map((a) => a.id));
  schedule = schedule && targets.length > 0;
  let posts;
  try {
    posts = await planSocialWeek(business, { focus: str(f, "focus", 600), posts: Number(f.get("posts")) || 5, tone: str(f, "tone", 40), channels: [...new Set((accs ?? []).map((a) => a.provider))] });
  } catch (e) {
    return { error: aiErr(e) };
  }
  const images = await Promise.all(posts.map((p, i) => makeImage(db, user.id, business.name, { headline: p.image.headline || p.theme, sub: p.image.sub, palette, layout: withPhotos ? "photo" : LAYOUTS[i % 2 === 0 ? 0 : 2], usePhoto: withPhotos, photoPrompt: p.image.prompt }).catch(() => null)));
  const rows = posts.map((p, i) => {
    let at = zoned(p.day, p.time, tz);
    if (at.getTime() < Date.now() + 10 * 60_000) at = new Date(Date.now() + (i + 1) * 3600_000);
    const caption = [p.caption, p.hashtags.join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);
    return {
      owner_id: user.id, caption, media: images[i] ? [{ url: images[i]!.url, type: "image" }] : [], targets,
      status: schedule ? "scheduled" : "draft", scheduled_at: at.toISOString(), results: [], ai: { theme: p.theme, image: p.image },
    };
  });
  const { error } = await db.from("social_posts").insert(rows);
  if (error) return { error: "Couldn't save the planned posts — try again." };
  await db.from("activity").insert({ owner_id: user.id, business_id: business.id, agent: "Content Creator", text: `Planned ${rows.length} social posts for the week${schedule ? " and scheduled them" : " as drafts"}.`, tag: "Social" });
  revalidatePath("/app", "layout");
  const warn = images.find((x) => x?.warning)?.warning;
  const failedImg = images.filter((x) => !x).length;
  return { ok: true, message: `${rows.length} posts ${schedule ? "scheduled" : "saved as drafts"} with images.${failedImg ? ` ${failedImg} image${failedImg === 1 ? "" : "s"} couldn't be made — add your own.` : ""}${warn ? ` ${warn}` : ""}` };
}
