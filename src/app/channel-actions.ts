"use server";
import { checkLimit } from "@/lib/billing/plan";
import { ensureStandardVideo, needsStandardVideo } from "@/lib/media/standard";
import { pushInApp } from "@/lib/inapp";

import { dbErr, guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { SUPABASE_URL } from "@/lib/config";
import { encrypt } from "@/lib/server/crypto";
import { GraphError, META_APP_ID, META_APP_SECRET, graph, normalizePhone, waCreateTemplate, waNumberOnApi, NOT_ON_API, TEMPLATE_BLOCKED, waDeleteTemplate, waPhoneNumbers, waTemplates, type WaTemplate } from "@/lib/meta/graph";
import { publishPost, runBroadcast, sendOnThread, startWhatsApp, tokenOf, type ChannelAccount } from "@/lib/meta/channels";
import { leadVars, personalize } from "@/lib/email/render";
import type { FormState } from "./actions";
import { AUTO_POST, captionOf } from "@/lib/social/autopost";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return { db: supabaseServer(), user, business, owner: business?.owner_id ?? user.id };
}
const done = () => revalidatePath("/app", "layout");
const errMsg = (e: unknown) => (e instanceof GraphError || e instanceof Error ? e.message : "Something went wrong.");

/* ═════════════ Connections ═════════════ */

export async function connectWhatsAppAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => connectWhatsAppActionImpl(s, f));
}
async function connectWhatsAppActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const phoneId = str(f, "phone_number_id", 40).replace(/\D/g, "");
  const wabaId = str(f, "waba_id", 40).replace(/\D/g, "");
  const token = str(f, "access_token", 1000);
  const appSecret = str(f, "app_secret", 200);
  if (!wabaId) return { error: "Enter the WhatsApp Business Account ID (a number, shown in Meta Business Settings → WhatsApp accounts)." };
  if (token.length < 20) return { error: "Paste the access token (a long string starting with EAA…)." };
  return saveWhatsApp(db, user.id, { wabaId, phoneId, token, appSecret });
}

/** Checks the number with Meta and saves it — shared by the one-click and the manual connect. */
async function saveWhatsApp(db: ReturnType<typeof supabaseServer>, ownerId: string, o: { wabaId: string; phoneId?: string; token: string; appSecret?: string; meta?: Record<string, unknown> }): Promise<FormState> {
  const { wabaId, phoneId, token, appSecret } = o;
  // Look the number up through the Business Account: this checks the token + account and finds the real Phone number ID.
  let numbers: Awaited<ReturnType<typeof waPhoneNumbers>>;
  try {
    numbers = await waPhoneNumbers(wabaId, token);
  } catch (e) {
    const m = errMsg(e);
    return { error: /nonexisting field|does not exist|Unsupported get request/i.test(m)
      ? "That WhatsApp Business Account ID wasn't found for this token. Copy it from Meta Business Settings → WhatsApp accounts (the ID under the account name), and make sure the system user was given this WhatsApp account."
      : e instanceof GraphError ? `Meta rejected this: ${m}` : m };
  }
  if (!numbers.length) return { error: "This WhatsApp Business Account has no phone number yet. Add one in Meta (WhatsApp → API Setup → Add phone number), then try again." };
  const list = numbers.map((n) => `${n.display_phone_number} → ${n.id}`).join(", ");
  const info = phoneId ? numbers.find((n) => n.id === phoneId) : numbers.length === 1 ? numbers[0] : undefined;
  if (!info) return { error: phoneId
    ? `${phoneId} isn't a phone number in this WhatsApp account (it may be an App ID or user ID). Your numbers: ${list}. Paste the Phone number ID, or leave the box empty.`
    : `This account has ${numbers.length} numbers — paste the Phone number ID of the one to connect: ${list}.` };
  let templates: WaTemplate[] = [];
  try { templates = await waTemplates(wabaId, token); } catch (e) { return { error: `Number found, but the WhatsApp Business Account ID or token can't read templates: ${errMsg(e)}` }; }
  const { error } = await db.from("channel_accounts").upsert({
    owner_id: ownerId, provider: "whatsapp", external_id: info.id, waba_id: wabaId, name: info.verified_name || "WhatsApp", phone_display: info.display_phone_number,
    access_token_enc: encrypt(token), app_secret_enc: appSecret ? encrypt(appSecret) : null, status: "connected", last_error: null,
    meta: { ...(o.meta ?? {}), templates, templates_synced_at: new Date().toISOString(), quality: info.quality_rating ?? null },
  }, { onConflict: "provider,external_id" });
  if (error) return { error: error.code === "42501" || /row-level/.test(error.message) ? "This number is already connected to another Growvia account." : dbErr(error) };
  await db.from("activity").insert({ owner_id: ownerId, agent: "Distributor", text: `Connected WhatsApp ${info.display_phone_number} (${info.verified_name}).`, tag: "Channels" });
  done();
  return { ok: true, message: `Connected ${info.verified_name} · ${info.display_phone_number}. ${templates.filter((t) => t.status === "APPROVED").length} approved templates found.` };
}

/**
 * One-click WhatsApp (Meta Embedded Signup): the customer logs in with Facebook, picks or creates their business
 * and number, and Meta hands back a short-lived code. We swap it for a token, subscribe Growvia to the account's
 * messages, register the number for the Cloud API, then save it like a manual connect. No IDs or tokens to copy.
 */
export async function connectWhatsAppEmbeddedAction(input: { code: string; wabaId?: string; phoneNumberId?: string; coexist?: boolean }): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, user } = await me();
    if (!META_APP_ID || !META_APP_SECRET) return { error: "One-click WhatsApp isn't switched on yet — use “Connect with IDs instead”, or ask us to turn it on." };
    const code = String(input.code ?? "").trim();
    if (!code) return { error: "Facebook didn't finish the connection. Please try again." };
    let token: string;
    try {
      token = (await graph<{ access_token: string }>("GET", "oauth/access_token", { query: { client_id: META_APP_ID, client_secret: META_APP_SECRET, code } })).access_token;
    } catch (e) { return { error: `Facebook couldn't confirm the connection (${errMsg(e)}). The window is only valid for a few seconds — please click Connect again.` }; }
    // The account ID usually arrives with the popup; if not, read it from what the token was granted.
    let wabaId = String(input.wabaId ?? "").replace(/\D/g, "");
    if (!wabaId) {
      const dbg = await graph<{ data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>("GET", "debug_token", { query: { input_token: token, access_token: `${META_APP_ID}|${META_APP_SECRET}` } }).catch(() => null);
      wabaId = dbg?.data?.granular_scopes?.find((g) => g.scope === "whatsapp_business_management")?.target_ids?.[0] ?? "";
    }
    if (!wabaId) return { error: "We couldn't see which WhatsApp account you picked. Please try again and choose a WhatsApp Business account in the Facebook window." };
    const phoneId = String(input.phoneNumberId ?? "").replace(/\D/g, "");
    // Receive this account's messages and status updates.
    try { await graph("POST", `${wabaId}/subscribed_apps`, { token }); }
    catch (e) { return { error: `Connected, but Meta wouldn't send this account's messages to Growvia: ${errMsg(e)}` }; }
    // A new number must be registered for the Cloud API (the PIN becomes its two-step verification PIN).
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    let registered = false;
    if (input.coexist && phoneId) {
      // Number stays on the WhatsApp Business app too: no registration; ask Meta to sync contacts and recent chats (best effort).
      for (const sync_type of ["smb_app_state_sync", "history"]) await graph("POST", `${phoneId}/smb_app_data`, { token, body: { messaging_product: "whatsapp", sync_type } }).catch(() => null);
      return saveWhatsApp(db, user.id, { wabaId, phoneId, token, meta: { onboarded: "coexistence" } });
    }
    if (phoneId) {
      try { await graph("POST", `${phoneId}/register`, { token, body: { messaging_product: "whatsapp", pin } }); registered = true; }
      catch (e) { if (!/already registered|registered/i.test(errMsg(e))) return { error: `Your number couldn't be activated for messaging: ${errMsg(e)}. If it has two-step verification, turn it off in WhatsApp Manager and try again.` }; }
    }
    return saveWhatsApp(db, user.id, { wabaId, phoneId, token, meta: { onboarded: "embedded", ...(registered ? { pin_enc: encrypt(pin) } : {}) } });
  });
}

export async function disconnectChannelAction(id: string) {
  const { db } = await me();
  const { data: acc } = await db.from("channel_accounts").select("provider, meta").eq("id", id).maybeSingle();
  await db.from("channel_accounts").delete().eq("id", id);
  if (acc?.provider === "gbp" && acc.meta?.business_id) {
    // Disconnecting the Business Profile channel also stops Google Business tracking for that project (history is kept).
    const { data: b } = await db.from("businesses").select("local_state").eq("id", acc.meta.business_id).maybeSingle();
    if (b?.local_state) { const { google: _g, location: _l, locations: _ls, ...rest } = b.local_state as Record<string, unknown>; await db.from("businesses").update({ local_state: rest }).eq("id", acc.meta.business_id); }
  }
  done();
}

export async function syncTemplatesAction(accountId: string): Promise<FormState> {
  const { db } = await me();
  const { data: acc } = await db.from("channel_accounts").select("*").eq("id", accountId).maybeSingle<ChannelAccount>();
  if (!acc?.waba_id) return { error: "WhatsApp account not found." };
  if (acc.external_id && (await waNumberOnApi(acc.external_id, tokenOf(acc))) === false) {
    await db.from("channel_accounts").update({ status: "error", last_error: NOT_ON_API }).eq("id", accountId);
    done();
    return { error: NOT_ON_API };
  }
  try {
    const templates = await waTemplates(acc.waba_id, tokenOf(acc));
    await db.from("channel_accounts").update({ meta: { ...acc.meta, templates, templates_synced_at: new Date().toISOString() }, status: "connected", last_error: null }).eq("id", accountId);
    done();
    return { ok: true, message: `${templates.filter((t) => t.status === "APPROVED").length} approved templates.` };
  } catch (e) {
    await db.from("channel_accounts").update({ status: "error", last_error: errMsg(e) }).eq("id", accountId);
    return { error: errMsg(e) };
  }
}

/* ═════════════ WhatsApp message templates ═════════════ */

const TEMPLATE_LANGS = ["en", "en_US", "en_GB", "hi", "pa", "ur", "gu", "mr", "ta", "te", "bn", "kn", "ml", "ar", "es", "fr", "de"];

export async function createWaTemplateAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => createWaTemplateActionImpl(s, f));
}
async function createWaTemplateActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db } = await me();
  const { data: acc } = await db.from("channel_accounts").select("*").eq("id", str(f, "account_id", 64)).maybeSingle<ChannelAccount>();
  if (!acc?.waba_id) return { error: "Pick a connected WhatsApp number." };
  const name = str(f, "name", 512).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!name) return { error: "Give the template a name, e.g. weekend_offer." };
  const language = str(f, "language", 10);
  if (!TEMPLATE_LANGS.includes(language)) return { error: "Pick a language." };
  const category = str(f, "category", 20) === "UTILITY" ? "UTILITY" : "MARKETING";
  const header = str(f, "header", 60);
  const footer = str(f, "footer", 60);
  const body = String(f.get("body") ?? "").trim().slice(0, 1024);
  if (!body) return { error: "Write the message." };
  if (/\{\{\s*\D/.test(body)) return { error: "Use numbered variables like {{1}}, {{2}} in the message — you choose what fills them (e.g. the customer's first name) when you send." };
  const nums = Array.from(new Set((body.match(/\{\{(\d+)\}\}/g) ?? []).map((m) => Number(m.replace(/\D/g, ""))))).sort((a, b) => a - b);
  if (nums.some((n, i) => n !== i + 1)) return { error: "Variables must be numbered in order: {{1}}, then {{2}}, and so on." };
  if (/^\s*\{\{\d+\}\}/.test(body) || /\{\{\d+\}\}[\s.!?]*$/.test(body)) return { error: "WhatsApp doesn't allow a variable at the very start or end of the message — add a word before/after it (e.g. “Hi {{1}},” … “Thanks!”)." };
  const examples = f.getAll("example").map((x) => String(x).trim().slice(0, 200)).slice(0, nums.length);
  if (examples.length < nums.length || examples.some((x) => !x)) return { error: "Add an example for every variable — Meta uses these to review the template." };
  const quickReplies = str(f, "quick_replies", 200).split(",").map((x) => x.trim().slice(0, 25)).filter(Boolean).slice(0, 3);
  const btnText = str(f, "url_text", 25);
  const btnUrl = str(f, "url", 2000);
  if (btnUrl && !/^https:\/\//.test(btnUrl)) return { error: "The button link must start with https://" };
  try {
    await waCreateTemplate(acc.waba_id, tokenOf(acc), { name, language, category, header: header || undefined, body, footer: footer || undefined, examples, quickReplies, urlButton: btnUrl ? { text: btnText || "Visit website", url: btnUrl } : undefined });
  } catch (e) {
    const m = errMsg(e);
    // Template creation refused for the whole account: check whether the number is even on the API.
    if (m === TEMPLATE_BLOCKED && acc.external_id && (await waNumberOnApi(acc.external_id, tokenOf(acc))) === false) return { error: NOT_ON_API };
    return { error: /already exists|2388024|name.*language/i.test(m) ? `A template called “${name}” in this language already exists — pick another name.` : e instanceof GraphError ? (/^Meta /.test(m) ? m : `Meta didn't accept it: ${m}`) : m };
  }
  try {
    const templates = await waTemplates(acc.waba_id, tokenOf(acc));
    await db.from("channel_accounts").update({ meta: { ...acc.meta, templates, templates_synced_at: new Date().toISOString() } }).eq("id", acc.id);
  } catch { /* status will sync on the next tick */ }
  done();
  return { ok: true, message: `“${name}” sent to Meta for review. Most are approved within minutes (sometimes up to 24 hours) — the status updates here automatically.` };
}

export async function deleteWaTemplateAction(accountId: string, name: string): Promise<FormState> {
  const { db } = await me();
  const { data: acc } = await db.from("channel_accounts").select("*").eq("id", accountId).maybeSingle<ChannelAccount>();
  if (!acc?.waba_id) return { error: "WhatsApp account not found." };
  try {
    await waDeleteTemplate(acc.waba_id, tokenOf(acc), name);
    const templates = ((acc.meta?.templates ?? []) as WaTemplate[]).filter((t) => t.name !== name);
    await db.from("channel_accounts").update({ meta: { ...acc.meta, templates } }).eq("id", acc.id);
    done();
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/* ═════════════ Chat ═════════════ */

export async function channelReplyAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => channelReplyActionImpl(s, f));
}
async function channelReplyActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, owner } = await me();
  const threadId = str(f, "thread_id", 64);
  const template = str(f, "template", 200);
  if (template) {
    const [name, language] = template.split("|");
    const params = f.getAll("param").map((p) => String(p).slice(0, 500));
    const r = await sendOnThread(db, { ownerId: owner, threadId, template: { name, language, params } });
    if (!r.ok) return { error: r.error };
  } else {
    const text = String(f.get("body") ?? "").trim().slice(0, 4000);
    if (!text) return { error: "Write a message." };
    const r = await sendOnThread(db, { ownerId: owner, threadId, text });
    if (!r.ok) return { error: r.error };
  }
  done();
  return { ok: true, message: "Sent" };
}

export async function startWhatsAppAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => startWhatsAppActionImpl(s, f));
}
async function startWhatsAppActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, owner, business } = await me();
  const leadId = str(f, "lead_id", 64);
  const accountId = str(f, "account_id", 64);
  const [name, language] = str(f, "template", 200).split("|");
  if (!name) return { error: "Pick an approved template." };
  const [{ data: lead }, { data: acc }] = await Promise.all([
    db.from("leads").select("id, name, phone, wa_id, company").eq("id", leadId).maybeSingle(),
    db.from("channel_accounts").select("*").eq("id", accountId).maybeSingle<ChannelAccount>(),
  ]);
  if (!lead || !acc) return { error: "Lead or WhatsApp number not found." };
  const vars = leadVars(lead, { business_name: business?.name ?? "", city: business?.city ?? "", sender_name: acc.name });
  const params = f.getAll("param").map((p) => personalize(String(p), vars).slice(0, 500) || "-");
  try {
    const r = await startWhatsApp(db, owner, acc, lead, { name, language, params });
    if (!r.ok) return { error: r.error };
    if (f.get("opt_in") === "on") await db.from("leads").update({ wa_opt_in: true }).eq("id", lead.id);
    done();
    return { ok: true, message: `WhatsApp sent to ${lead.name}. Their reply will appear in your Inbox.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/* ═════════════ Media + publishing ═════════════ */

export async function createUploadUrlAction(filename: string, type: string): Promise<{ uploadUrl?: string; publicUrl?: string; error?: string }> {
  const { db, user } = await me();
  if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime))$/.test(type)) return { error: "Use JPG, PNG, WebP or GIF images, or MP4/MOV videos." };
  const safe = filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  const path = `${user.id}/${Date.now()}-${safe}`;
  const { data, error } = await db.storage.from("media").createSignedUploadUrl(path);
  if (error || !data) return { error: dbErr(error, "Storage isn't set up — run the latest schema.sql in Supabase.") };
  return { uploadUrl: data.signedUrl, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` };
}

export async function savePostAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => savePostActionImpl(s, f));
}
async function savePostActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, user, owner } = await me();
  const caption = String(f.get("caption") ?? "").slice(0, 2200);
  const link = str(f, "link", 500) || null;
  const targets = f.getAll("targets").map(String).filter(Boolean);
  let media: { url: string; type: "image" | "video" }[] = [];
  try { media = JSON.parse(String(f.get("media") ?? "[]")); } catch {}
  media = media.filter((m) => /^https?:\/\//.test(m.url) && (m.type === "image" || m.type === "video")).slice(0, 10);
  const when = str(f, "schedule_at", 40);
  const intent = str(f, "intent", 20); // now | schedule | draft
  if (!targets.length && intent !== "draft") return { error: "Choose at least one account to post to." };
  if (!caption.trim() && !media.length) return { error: "Write a caption or add a photo/video." };
  const { data: accs } = await db.from("channel_accounts").select("id, provider, name, status, meta").in("id", targets.length ? targets : ["00000000-0000-0000-0000-000000000000"]);
  if ((accs ?? []).length < targets.length) return { error: "One of the chosen accounts was disconnected. Refresh the page and pick again." };
  const broken = (accs ?? []).find((a) => a.status !== "connected");
  if (broken && intent !== "draft") return { error: `${broken.name} needs reconnecting in Channels before Growvia can post to it.` };
  if ((accs ?? []).some((a) => a.provider === "instagram") && !media.length) return { error: "Instagram needs at least one photo or video. Add media or untick Instagram." };
  if ((accs ?? []).some((a) => a.provider === "youtube") && !media.some((m) => m.type === "video")) return { error: "YouTube needs a video. Upload an MP4 or untick YouTube." };
  if ((accs ?? []).some((a) => a.provider === "gbp")) {
    if (media.some((m) => m.type === "video")) return { error: "Google Business posts take a photo, not a video. Remove the video or untick Google Business." };
    if (caption.length > 1500) return { error: "Google Business posts can be up to 1,500 characters — shorten the caption or untick Google Business." };
  }
  if (media.some((m) => m.type === "video") && media.length > 1 && (accs ?? []).some((a) => a.provider === "facebook")) return { error: "For Facebook, post a video on its own (or use photos for a multi-image post)." };
  // Videos recorded in the browser are converted once to a standard MP4 (full length on Facebook, accepted by Instagram).
  if (intent !== "draft" && media.some((m) => m.type === "video" && needsStandardVideo(m.url))) {
    media = await Promise.all(media.map(async (m) => (m.type === "video" ? { ...m, url: (await ensureStandardVideo(m.url, user.id)).url } : m)));
  }
  const scheduledAt = intent === "schedule" ? (when ? new Date(when) : null) : null;
  if (intent === "schedule" && (!scheduledAt || isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000)) return { error: "Pick a time at least a minute from now." };
  const id = str(f, "id", 64);
  if (intent === "schedule") {
    const { data: prev } = id ? await db.from("social_posts").select("status").eq("id", id).maybeSingle() : { data: null };
    if (prev?.status !== "scheduled") {
      const gate = await checkLimit(owner, "posts", 1, db);
      if (!gate.ok) return { error: gate.error };
    }
  }
  const ytPrivacy = str(f, "yt_privacy", 10);
  const options = (accs ?? []).some((a) => a.provider === "youtube") ? { youtube: { title: str(f, "yt_title", 100) || undefined, privacy: (["public", "unlisted", "private"].includes(ytPrivacy) ? ytPrivacy : "public") as "public" | "unlisted" | "private" } } : {};
  const row = {
    caption, link, media, targets, options, content_item_id: str(f, "content_item_id", 64) || null,
    status: intent === "draft" ? "draft" : intent === "schedule" ? "scheduled" : "draft", scheduled_at: scheduledAt?.toISOString() ?? null, results: [],
  };
  const q = id ? db.from("social_posts").update(row).eq("id", id).select("id").single() : db.from("social_posts").insert({ ...row, owner_id: user.id }).select("id").single();
  const { data: post, error } = await q;
  if (error || !post) return { error: dbErr(error, "Couldn't save the post.") };
  // "now" updates the content card from the real result (publishPost); a schedule marks it scheduled; a draft leaves it alone.
  if (row.content_item_id && intent === "schedule") await db.from("content_items").update({ status: "scheduled", scheduled_at: scheduledAt!.toISOString(), reminded_at: null }).eq("id", row.content_item_id);
  if (intent === "now") {
    const r = await publishPost(db, post.id, { by: "user" });
    done();
    const ok = r.results.filter((x) => x.ok);
    const bad = r.results.filter((x) => !x.ok);
    if (!ok.length) return { error: `Not published: ${bad.map((b) => `${b.name}: ${b.error}`).join(" · ")}` };
    return {
      ok: true, message: `Published to ${ok.map((o) => o.name).join(", ")}.${bad.length ? ` Failed on ${bad.map((b) => `${b.name} (${b.error})`).join(", ")}.` : ""}`,
      data: { kind: "published", postId: post.id, live: ok.map((o) => ({ name: o.name, provider: o.provider, permalink: o.permalink ?? null })), failed: bad.map((b) => ({ name: b.name, provider: b.provider, error: b.error ?? "" })), milestone: r.milestone ?? null, count: r.count ?? 0, video: media.some((m) => m.type === "video") },
    };
  }
  done();
  if (intent === "schedule") {
    const names = (accs ?? []).map((a) => ({ name: a.name, provider: a.provider }));
    const { count } = await db.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled");
    await pushInApp(db, owner, { kind: "post_scheduled", title: `Scheduled for ${names.map((n) => n.name).join(", ")}`, body: `“${caption.slice(0, 120) || "Your post"}” goes out automatically — we'll let you know when it's live.`, url: "/app/publish", provider: names[0]?.provider ?? null });
    return { ok: true, message: "Scheduled.", data: { kind: "scheduled", postId: post.id, at: scheduledAt!.toISOString(), targets: names, firstSchedule: (count ?? 0) <= 1 } };
  }
  return { ok: true, message: "Draft saved.", data: { kind: "draft", postId: post.id } };
}

/**
 * Schedules a content card. If Growvia can post to that channel and an account is connected, it creates a real
 * scheduled post. Otherwise it's saved as "planned" and Growvia emails a reminder at that time — it never pretends.
 */
export async function scheduleContentAction(id: string, when: string, opts: { remind?: boolean } = {}): Promise<FormState & { mode?: "auto" | "planned"; publishUrl?: string }> {
  return guard(async () => {
    const { db, user, owner, business } = await me();
    const at = new Date(when);
    if (isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) return { error: "Pick a time at least a minute from now." };
    if (at.getTime() > Date.now() + 180 * 86400000) return { error: "Pick a time within the next 6 months." };
    const { data: item } = await db.from("content_items").select("id, channel, title, body, status").eq("id", id).maybeSingle();
    if (!item) return { error: "This content was deleted — refresh the page." };
    const rule = AUTO_POST[item.channel];
    let accs: { id: string; name: string; username: string | null; status: string }[] = [];
    if (rule) {
      let q = db.from("channel_accounts").select("id, name, username, status, meta").eq("provider", rule.provider);
      if (rule.provider === "gbp" && business) q = q.contains("meta", { business_id: business.id });
      accs = (await q).data ?? [];
    }
    const live = accs.filter((a) => a.status === "connected");
    // Clear any earlier auto-post for this card so it can't go out twice.
    await db.from("social_posts").delete().eq("content_item_id", id).in("status", ["scheduled", "draft"]);
    if (rule && live.length && !opts.remind) {
      if (rule.needs) return { error: rule.needs === "video" ? "YouTube needs a video — add it on the Publish page and schedule it there." : "Instagram needs a photo or video — add one on the Publish page and schedule it there.", publishUrl: `/app/publish?content=${id}` };
      const gate = await checkLimit(owner, "posts", 1, db);
      if (!gate.ok) return { error: gate.error };
      const { error } = await db.from("social_posts").insert({ owner_id: user.id, content_item_id: id, caption: captionOf(item.body).slice(0, rule.provider === "gbp" ? 1500 : 2200), media: [], targets: live.map((a) => a.id), status: "scheduled", scheduled_at: at.toISOString(), results: [] });
      if (error) return { error: dbErr(error, "Couldn't schedule the post.") };
      await db.from("content_items").update({ status: "scheduled", scheduled_at: at.toISOString(), reminded_at: null }).eq("id", id);
      const names = live.map((a) => (a.username ? `@${a.username}` : a.name)).join(", ");
      await db.from("activity").insert({ owner_id: user.id, agent: "Distributor", text: `Scheduled “${item.title}” to post on ${names}.`, tag: "scheduled" });
      done();
      return { ok: true, mode: "auto", message: `Scheduled — Growvia will post it to ${names} automatically.` };
    }
    await db.from("content_items").update({ status: "approved", scheduled_at: at.toISOString(), reminded_at: null }).eq("id", id);
    await db.from("activity").insert({ owner_id: user.id, agent: "Distributor", text: `Planned “${item.title}” for ${item.channel} (reminder only).`, tag: "planned" });
    done();
    const why = !rule ? `Growvia can't post to ${item.channel} for you` : accs.length ? `${accs[0].name} needs reconnecting` : `${item.channel} isn't connected`;
    return { ok: true, mode: "planned", message: `Planned. ${why}, so nothing will be posted automatically — we'll email you a reminder at that time.` };
  });
}

export async function retryPostAction(id: string) {
  const { db } = await me();
  const r = await publishPost(db, id, { by: "user" });
  done();
  const ok = r.results.filter((x) => x.ok), bad = r.results.filter((x) => !x.ok);
  return { status: r.status, live: ok.map((o) => ({ name: o.name, provider: o.provider, permalink: o.permalink ?? null })), failed: bad.map((b) => ({ name: b.name, provider: b.provider, error: b.error ?? "" })), milestone: r.milestone ?? null, count: r.count ?? 0 };
}

export async function deletePostAction(id: string) {
  const { db } = await me();
  await db.from("social_posts").delete().eq("id", id).neq("status", "publishing");
  done();
}

/* ═════════════ WhatsApp broadcasts ═════════════ */

export async function createBroadcastAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => createBroadcastActionImpl(s, f));
}
async function createBroadcastActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, user, business } = await me();
  const accountId = str(f, "account_id", 64);
  const [template, language] = str(f, "template", 200).split("|");
  const name = str(f, "name", 100) || template;
  const params = f.getAll("param").map((p) => String(p).slice(0, 500));
  const mode = str(f, "mode", 20);
  const intent = str(f, "intent", 20);
  if (!template) return { error: "Pick an approved template." };
  const { data: num } = await db.from("channel_accounts").select("meta").eq("id", accountId).maybeSingle();
  if (num?.meta?.health?.paused) return { error: "Broadcasts from this number are paused because Meta rates its quality LOW. Replying to chats still works — see Sending health → WhatsApp for what to do." };
  let q = db.from("leads").select("id, phone, wa_id");
  if (business) q = q.eq("business_id", business.id); // audiences come from the current project
  if (mode === "tag") q = q.contains("tags", [str(f, "tag", 60)]);
  if (mode === "stage") q = q.in("stage", f.getAll("stages").map(String));
  if (f.get("opted_in_only") === "on") q = q.eq("wa_opt_in", true);
  const { data: leads } = await q;
  const reachable = (leads ?? []).filter((l) => l.wa_id || (l.phone && normalizePhone(l.phone)));
  if (!reachable.length) return { error: "No matching leads have a phone number." };
  const when = str(f, "schedule_at", 40);
  const scheduled = intent === "schedule" && when ? new Date(when) : null;
  if (intent === "schedule" && (!scheduled || scheduled.getTime() < Date.now() + 60_000)) return { error: "Pick a time at least a minute from now." };
  const { data: bc, error } = await db.from("wa_broadcasts").insert({
    owner_id: user.id, account_id: accountId, name, template_name: template, language: language || "en_US", params, lead_ids: reachable.map((l) => l.id),
    status: "scheduled", scheduled_at: (scheduled ?? new Date()).toISOString(),
  }).select("id").single();
  if (error || !bc) return { error: dbErr(error, "Couldn't create the broadcast.") };
  if (!scheduled) {
    const r = await runBroadcast(db, bc.id, Date.now() + 40_000);
    done();
    return { ok: true, message: `Sent to ${r.sent} contact${r.sent === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} failed` : ""}${reachable.length > r.sent + r.failed ? ` · ${reachable.length - r.sent - r.failed} more going out in the next minute` : ""}.` };
  }
  done();
  return { ok: true, message: `Scheduled for ${scheduled.toLocaleString()} to ${reachable.length} contacts.` };
}
