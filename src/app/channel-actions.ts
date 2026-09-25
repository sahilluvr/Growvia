"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { SUPABASE_URL } from "@/lib/config";
import { encrypt } from "@/lib/server/crypto";
import { GraphError, normalizePhone, waCreateTemplate, waDeleteTemplate, waPhoneNumbers, waTemplates, type WaTemplate } from "@/lib/meta/graph";
import { publishPost, runBroadcast, sendOnThread, startWhatsApp, tokenOf, type ChannelAccount } from "@/lib/meta/channels";
import { leadVars, personalize } from "@/lib/email/render";
import type { FormState } from "./actions";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return { db: supabaseServer(), user, business };
}
const done = () => revalidatePath("/app", "layout");
const errMsg = (e: unknown) => (e instanceof GraphError || e instanceof Error ? e.message : "Something went wrong.");

/* ═════════════ Connections ═════════════ */

export async function connectWhatsAppAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const phoneId = str(f, "phone_number_id", 40).replace(/\D/g, "");
  const wabaId = str(f, "waba_id", 40).replace(/\D/g, "");
  const token = str(f, "access_token", 1000);
  const appSecret = str(f, "app_secret", 200);
  if (!wabaId) return { error: "Enter the WhatsApp Business Account ID (a number, shown in Meta Business Settings → WhatsApp accounts)." };
  if (token.length < 20) return { error: "Paste the access token (a long string starting with EAA…)." };
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
    owner_id: user.id, provider: "whatsapp", external_id: info.id, waba_id: wabaId, name: info.verified_name || "WhatsApp", phone_display: info.display_phone_number,
    access_token_enc: encrypt(token), app_secret_enc: appSecret ? encrypt(appSecret) : null, status: "connected", last_error: null,
    meta: { templates, templates_synced_at: new Date().toISOString(), quality: info.quality_rating ?? null },
  }, { onConflict: "provider,external_id" });
  if (error) return { error: error.code === "42501" || /row-level/.test(error.message) ? "This number is already connected to another Growvia account." : error.message };
  await db.from("activity").insert({ owner_id: user.id, agent: "Distributor", text: `Connected WhatsApp ${info.display_phone_number} (${info.verified_name}).`, tag: "Channels" });
  done();
  return { ok: true, message: `Connected ${info.verified_name} · ${info.display_phone_number}. ${templates.filter((t) => t.status === "APPROVED").length} approved templates found.` };
}

export async function disconnectChannelAction(id: string) {
  const { db } = await me();
  await db.from("channel_accounts").delete().eq("id", id);
  done();
}

export async function syncTemplatesAction(accountId: string): Promise<FormState> {
  const { db } = await me();
  const { data: acc } = await db.from("channel_accounts").select("*").eq("id", accountId).maybeSingle<ChannelAccount>();
  if (!acc?.waba_id) return { error: "WhatsApp account not found." };
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

export async function createWaTemplateAction(_: FormState, f: FormData): Promise<FormState> {
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
    return { error: /already exists|2388024|name.*language/i.test(m) ? `A template called “${name}” in this language already exists — pick another name.` : e instanceof GraphError ? `Meta didn't accept it: ${m}` : m };
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

export async function channelReplyAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const threadId = str(f, "thread_id", 64);
  const template = str(f, "template", 200);
  if (template) {
    const [name, language] = template.split("|");
    const params = f.getAll("param").map((p) => String(p).slice(0, 500));
    const r = await sendOnThread(db, { ownerId: user.id, threadId, template: { name, language, params } });
    if (!r.ok) return { error: r.error };
  } else {
    const text = String(f.get("body") ?? "").trim().slice(0, 4000);
    if (!text) return { error: "Write a message." };
    const r = await sendOnThread(db, { ownerId: user.id, threadId, text });
    if (!r.ok) return { error: r.error };
  }
  done();
  return { ok: true, message: "Sent" };
}

export async function startWhatsAppAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user, business } = await me();
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
    const r = await startWhatsApp(db, user.id, acc, lead, { name, language, params });
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
  if (error || !data) return { error: error?.message ?? "Storage isn't set up — run the latest schema.sql in Supabase." };
  return { uploadUrl: data.signedUrl, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` };
}

export async function savePostAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
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
  const { data: accs } = await db.from("channel_accounts").select("id, provider, name").in("id", targets.length ? targets : ["00000000-0000-0000-0000-000000000000"]);
  if ((accs ?? []).some((a) => a.provider === "instagram") && !media.length) return { error: "Instagram needs at least one photo or video. Add media or untick Instagram." };
  if (media.some((m) => m.type === "video") && media.length > 1 && (accs ?? []).some((a) => a.provider === "facebook")) return { error: "For Facebook, post a video on its own (or use photos for a multi-image post)." };
  const scheduledAt = intent === "schedule" ? (when ? new Date(when) : null) : null;
  if (intent === "schedule" && (!scheduledAt || isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000)) return { error: "Pick a time at least a minute from now." };
  const id = str(f, "id", 64);
  const row = {
    owner_id: user.id, caption, link, media, targets, content_item_id: str(f, "content_item_id", 64) || null,
    status: intent === "draft" ? "draft" : intent === "schedule" ? "scheduled" : "draft", scheduled_at: scheduledAt?.toISOString() ?? null, results: [],
  };
  const q = id ? db.from("social_posts").update(row).eq("id", id).select("id").single() : db.from("social_posts").insert(row).select("id").single();
  const { data: post, error } = await q;
  if (error || !post) return { error: error?.message ?? "Couldn't save the post." };
  if (row.content_item_id) await db.from("content_items").update({ status: intent === "now" ? "published" : "scheduled", scheduled_at: scheduledAt?.toISOString() ?? new Date().toISOString() }).eq("id", row.content_item_id);
  if (intent === "now") {
    const r = await publishPost(db, post.id);
    done();
    const ok = r.results.filter((x) => x.ok);
    const bad = r.results.filter((x) => !x.ok);
    if (!ok.length) return { error: `Not published: ${bad.map((b) => `${b.name}: ${b.error}`).join(" · ")}` };
    return { ok: true, message: `Published to ${ok.map((o) => o.name).join(", ")}.${bad.length ? ` Failed on ${bad.map((b) => `${b.name} (${b.error})`).join(", ")}.` : ""}` };
  }
  done();
  return { ok: true, message: intent === "schedule" ? `Scheduled for ${scheduledAt!.toLocaleString()}.` : "Draft saved." };
}

export async function retryPostAction(id: string) {
  const { db } = await me();
  await publishPost(db, id);
  done();
}

export async function deletePostAction(id: string) {
  const { db } = await me();
  await db.from("social_posts").delete().eq("id", id).neq("status", "publishing");
  done();
}

/* ═════════════ WhatsApp broadcasts ═════════════ */

export async function createBroadcastAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const accountId = str(f, "account_id", 64);
  const [template, language] = str(f, "template", 200).split("|");
  const name = str(f, "name", 100) || template;
  const params = f.getAll("param").map((p) => String(p).slice(0, 500));
  const mode = str(f, "mode", 20);
  const intent = str(f, "intent", 20);
  if (!template) return { error: "Pick an approved template." };
  let q = db.from("leads").select("id, phone, wa_id");
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
  if (error || !bc) return { error: error?.message ?? "Couldn't create the broadcast." };
  if (!scheduled) {
    const r = await runBroadcast(db, bc.id, Date.now() + 40_000);
    done();
    return { ok: true, message: `Sent to ${r.sent} contact${r.sent === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} failed` : ""}${reachable.length > r.sent + r.failed ? ` · ${reachable.length - r.sent - r.failed} more going out in the next minute` : ""}.` };
  }
  done();
  return { ok: true, message: `Scheduled for ${scheduled.toLocaleString()} to ${reachable.length} contacts.` };
}
