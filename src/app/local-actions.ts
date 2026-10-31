"use server";
import { guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { decrypt } from "@/lib/server/crypto";
import { accessFromRefresh } from "@/lib/google/gsc";
import { listLocations, replyReview, updateDescription } from "@/lib/google/gbp";
import { checkLocalRanks, syncLocal, type LocalBiz, type LocalState } from "@/lib/local/sync";
import { linkGbpAccount } from "@/lib/local/link";
import { aiReady, geminiJson } from "@/lib/ai/gemini";

type FormState = { ok?: boolean; error?: string; message?: string } | undefined;

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  const db = supabaseServer();
  const { data } = await db.from("businesses").select("id, owner_id, name, city, segment, website, offer, voice, local_state").eq("id", business.id).single();
  const biz = data as LocalBiz & { segment: string; website: string | null; offer: string | null; voice: string | null };
  return { db, user, biz, st: (biz.local_state ?? {}) as LocalState };
}
const done = () => revalidatePath("/app/local");
const errOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
const save = (db: ReturnType<typeof supabaseServer>, id: string, st: LocalState) => db.from("businesses").update({ local_state: st }).eq("id", id);
async function access(st: LocalState) {
  if (!st.google) throw new Error("Connect Google Business Profile first.");
  return accessFromRefresh(decrypt(st.google.refresh_enc));
}

export async function pickLocationAction(name: string): Promise<FormState> {
  return guard(async () => {
    const { db, user, biz, st } = await me();
    const loc = st.locations?.find((l) => l.name === name);
    if (!loc) return { error: "That location isn't in the list any more — reload your locations." };
    const next: LocalState = { ...st, location: loc, synced_at: undefined, profile: undefined, audit: undefined, sync_error: null, sync_error_kind: null };
    await save(db, biz.id, next);
    await linkGbpAccount(db, user.id, biz.id, next);
    const r = await syncLocal(db, { ...biz, local_state: next }, { full: true }).catch((e) => ({ ok: false as const, error: errOf(e) }));
    done();
    return r.ok ? { ok: true, message: `Tracking ${loc.title}. Data loaded.` } : { ok: true, message: `Tracking ${loc.title}. ${r.error}` };
  });
}

export async function reloadLocationsAction(): Promise<FormState> {
  return guard(async () => {
    const { db, user, biz, st } = await me();
    try {
      const locs = await listLocations(await access(st));
      const next: LocalState = { ...st, locations: locs, locations_error: locs.length ? undefined : "This Google account doesn't manage any Business Profiles." };
      if (!next.location && locs.length === 1) next.location = locs[0];
      await save(db, biz.id, next);
      if (next.location) await linkGbpAccount(db, user.id, biz.id, next);
      done();
      return locs.length ? { ok: true, message: `Found ${locs.length} location${locs.length === 1 ? "" : "s"}.` } : { error: next.locations_error };
    } catch (e) {
      await save(db, biz.id, { ...st, locations_error: errOf(e) });
      done();
      return { error: errOf(e) };
    }
  });
}

export async function syncLocalAction(): Promise<FormState> {
  return guard(async () => {
    const { db, biz } = await me();
    const r = await syncLocal(db, biz, { full: true });
    done();
    if (!r.ok) return { error: r.error };
    return { ok: true, message: `Updated — ${r.days} days of stats, ${r.reviews} reviews, ${r.keywords} search terms.${r.partial ? ` (Some parts: ${r.partial})` : ""}` };
  });
}

export async function disconnectLocalAction(): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, biz, st } = await me();
    const { google: _g, locations: _l, location: _loc, locations_error: _e, sync_error: _s, sync_error_kind: _k, ...rest } = st;
    await save(db, biz.id, rest);
    await db.from("channel_accounts").delete().eq("provider", "gbp").contains("meta", { business_id: biz.id });
    done();
    return { ok: true, message: "Disconnected. Your history and Maps rankings are kept." };
  });
}

export async function addLocalKeywordsAction(_: FormState, f: FormData): Promise<FormState> {
  return guard(async () => {
    const { db, user, biz } = await me();
    const words = [...new Set(String(f.get("keywords") ?? "").split(/[\n,]+/).map((k) => k.trim().toLowerCase().replace(/\s+/g, " ")).filter((k) => k.length >= 2 && k.length <= 80))];
    if (!words.length) return { error: "Type a search people use to find you, e.g. “dentist near me”." };
    const { count } = await db.from("local_keywords").select("id", { count: "exact", head: true }).eq("business_id", biz.id);
    const room = 30 - (count ?? 0);
    if (room <= 0) return { error: "You're tracking 30 searches — remove one to add another." };
    const { error } = await db.from("local_keywords").upsert(words.slice(0, room).map((keyword) => ({ business_id: biz.id, owner_id: user.id, keyword })), { onConflict: "business_id,keyword", ignoreDuplicates: true });
    if (error) return { error: "Couldn't save — run the latest schema.sql in Supabase." };
    done();
    return { ok: true, message: `Tracking ${Math.min(words.length, room)} search${words.length === 1 ? "" : "es"}${words.length > room ? ` (limit 30 — ${words.length - room} skipped)` : ""}. Click “Check now” to see today's positions.` };
  });
}

export async function removeLocalKeywordAction(id: string): Promise<FormState> {
  const { db } = await me();
  await db.from("local_keywords").delete().eq("id", id);
  done();
  return { ok: true };
}

export async function checkLocalRanksAction(): Promise<FormState> {
  return guard(async () => {
    const { db, biz } = await me();
    const r = await checkLocalRanks(db, biz);
    done();
    if (!r.ok) return { error: r.error };
    return { ok: true, message: `Checked ${r.checked} search${r.checked === 1 ? "" : "es"} — you're in the Maps results for ${r.found}.${r.remaining ? ` ${r.remaining} more will be checked automatically.` : ""}` };
  });
}

const templateReply = (name: string, rating: number, biz: string) => {
  const first = name.split(" ")[0] || "there";
  if (rating >= 4) return `Thank you so much, ${first}! We're really glad you had a great experience at ${biz}. See you again soon!`;
  if (rating === 3) return `Thanks for the honest feedback, ${first}. We'd love to know what would have made it a 5-star visit — please message us so we can make it right next time.`;
  return `Hi ${first}, we're sorry your experience didn't meet expectations. This isn't the standard we aim for at ${biz}. Please contact us directly so we can understand what happened and put it right.`;
};

export async function suggestReplyAction(reviewId: string): Promise<{ reply?: string; error?: string }> {
  const { db, biz } = await me();
  const { data: r } = await db.from("gbp_reviews").select("reviewer, rating, comment").eq("id", reviewId).eq("business_id", biz.id).maybeSingle();
  if (!r) return { error: "Review not found — refresh the page." };
  if (!aiReady) return { reply: templateReply(r.reviewer, r.rating, biz.name) };
  try {
    const { data } = await geminiJson<{ reply?: string }>(`You reply to Google reviews on behalf of the local business "${biz.name}"${biz.city ? ` in ${biz.city}` : ""} (${biz.segment}). Voice: ${biz.voice || "warm, professional"}.
Write ONE reply to this ${r.rating}-star review from ${r.reviewer}: """${(r.comment || "(no text, rating only)").slice(0, 1500)}"""
Rules: 2–4 sentences, under 600 characters, use their first name, mention a specific detail from the review when there is one, never argue or reveal private details, for 1–3 stars apologise and invite them to contact the business directly. No hashtags, no emojis.
Return JSON: {"reply": "..."}`, { lite: true, temperature: 0.6, maxTokens: 600 });
    return { reply: (data.reply ?? "").trim().slice(0, 4000) || templateReply(r.reviewer, r.rating, biz.name) };
  } catch {
    return { reply: templateReply(r.reviewer, r.rating, biz.name) };
  }
}

export async function replyReviewAction(reviewId: string, text: string): Promise<FormState> {
  return guard(async () => {
    const { db, biz, st } = await me();
    const reply = text.trim();
    if (reply.length < 2) return { error: "Write a reply first." };
    if (reply.length > 4000) return { error: "Keep replies under 4,000 characters." };
    const { data: r } = await db.from("gbp_reviews").select("id").eq("id", reviewId).eq("business_id", biz.id).maybeSingle();
    if (!r) return { error: "Review not found — refresh the page." };
    try {
      const out = await replyReview(await access(st), reviewId, reply);
      await db.from("gbp_reviews").update({ reply: out.comment ?? reply, replied_at: out.updateTime ?? new Date().toISOString() }).eq("id", reviewId);
    } catch (e) {
      return { error: errOf(e) };
    }
    done();
    return { ok: true, message: "Reply posted on Google." };
  });
}

export async function writeDescriptionAction(): Promise<{ text?: string; error?: string }> {
  const { biz, st } = await me();
  const cat = st.profile?.category ?? biz.segment;
  const fallback = `${biz.name} is a ${cat.toLowerCase()}${biz.city ? ` in ${biz.city}` : ""}. ${biz.offer ? `${biz.offer}. ` : ""}We're known for friendly service and quality you can count on. Visit us, call, or message us to book — we'd love to help.`;
  if (!aiReady) return { text: fallback.slice(0, 750) };
  try {
    const { data } = await geminiJson<{ description?: string }>(`Write a Google Business Profile description for "${biz.name}", a ${cat}${biz.city ? ` in ${biz.city}` : ""}. ${biz.offer ? `What they offer: ${biz.offer}.` : ""} ${biz.website ? `Website: ${biz.website}.` : ""}
Rules (Google's guidelines): 600–750 characters, plain text, first sentence says what the business is and where, then services and what makes it different, end with a simple invitation. No URLs, phone numbers, prices, ALL CAPS, emojis or promotional claims like "best in town".
Return JSON: {"description": "..."}`, { lite: true, temperature: 0.5, maxTokens: 800 });
    return { text: (data.description ?? "").trim().slice(0, 750) || fallback.slice(0, 750) };
  } catch {
    return { text: fallback.slice(0, 750) };
  }
}

export async function applyDescriptionAction(text: string): Promise<FormState> {
  return guard(async () => {
    const { db, biz, st } = await me();
    const d = text.trim();
    if (d.length < 50) return { error: "Write at least 50 characters." };
    if (!st.location) return { error: "Connect your Business Profile first." };
    try {
      await updateDescription(await access(st), st.location.name, d);
    } catch (e) {
      return { error: errOf(e) };
    }
    if (st.profile) await save(db, biz.id, { ...st, profile: { ...st.profile, description: d } });
    done();
    return { ok: true, message: "Description sent to Google. Edits can take a few minutes (sometimes a day) to appear while Google reviews them." };
  });
}
