import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../server/crypto";
import { notifyNewLead, notifyReply } from "../notify";
import { leadVars, personalize } from "../email/render";
import { accessFromRefresh } from "../google/gsc";
import { uploadVideo, type YtOptions } from "../google/youtube";
import { createLocalPost } from "../google/gbp";
import { notify } from "../notify";
import { ensureStandardVideo, needsStandardVideo } from "../media/standard";
import { postMilestone, pushInApp } from "../inapp";
import {
  GraphError, normalizePhone, profileName, publishToInstagram, publishToPage, sendDirect, waMarkRead, waSendTemplate, waSendText, waTemplates, type Media, type WaTemplate,
} from "./graph";

type Db = SupabaseClient;
export type Provider = "whatsapp" | "facebook" | "instagram";
export type SocialProvider = Provider | "youtube" | "gbp";
export type Channel = "email" | "whatsapp" | "messenger" | "instagram";

export type ChannelAccount = {
  id: string; owner_id: string; provider: SocialProvider; external_id: string; name: string; username: string | null; picture: string | null;
  phone_display: string | null; waba_id: string | null; page_id: string | null; access_token_enc: string; app_secret_enc: string | null;
  status: string; last_error: string | null; meta: Record<string, unknown>; created_at: string;
};

export const tokenOf = (a: ChannelAccount) => decrypt(a.access_token_enc);
export const channelOf = (p: Provider): Channel => (p === "facebook" ? "messenger" : p);
const DAY = 86_400_000;
const nowIso = () => new Date().toISOString();

async function activity(db: Db, owner: string, agent: string, text: string, tag: string) {
  await db.from("activity").insert({ owner_id: owner, agent, text, tag });
}

/* ───────── Contacts & threads ───────── */

type LeadRow = { id: string; name: string; phone: string | null; wa_id: string | null; company: string | null; stage: string };

async function contactFor(db: Db, acc: ChannelAccount, key: string, name: string | null): Promise<LeadRow | null> {
  const owner = acc.owner_id;
  const col = acc.provider === "whatsapp" ? "wa_id" : acc.provider === "facebook" ? "fb_psid" : "ig_id";
  const { data: hit } = await db.from("leads").select("id, name, phone, wa_id, company, stage").eq("owner_id", owner).eq(col, key).limit(1).maybeSingle();
  if (hit) return hit;
  if (acc.provider === "whatsapp") {
    // Match an existing lead by phone number (any format) before creating a new one.
    const { data: withPhone } = await db.from("leads").select("id, name, phone, wa_id, company, stage").eq("owner_id", owner).not("phone", "is", null);
    const match = (withPhone ?? []).find((l) => l.phone && normalizePhone(l.phone) === key);
    if (match) {
      await db.from("leads").update({ wa_id: key, wa_opt_in: true }).eq("id", match.id);
      return { ...match, wa_id: key };
    }
  }
  const { data: biz } = await db.from("businesses").select("id").eq("owner_id", owner).order("created_at").limit(1).maybeSingle();
  if (!biz) return null;
  const label = name || (acc.provider === "whatsapp" ? `+${key}` : acc.provider === "instagram" ? "Instagram user" : "Facebook user");
  const { data: created } = await db.from("leads").insert({
    owner_id: owner, business_id: biz.id, name: label, phone: acc.provider === "whatsapp" ? `+${key}` : null,
    source: acc.provider === "whatsapp" ? "WhatsApp" : acc.provider === "instagram" ? "Instagram" : "Messenger", stage: "new",
    [col]: key, ...(acc.provider === "whatsapp" ? { wa_opt_in: true } : {}),
  }).select("id, name, phone, wa_id, company, stage").single();
  if (created) {
    const src = acc.provider === "whatsapp" ? "WhatsApp" : acc.provider === "instagram" ? "Instagram" : "Messenger";
    await activity(db, owner, "Lead Finder", `New ${src} contact: ${label}`, "+1 lead");
    await notifyNewLead(db, owner, biz.id, created.id, label, src, created.phone ? [["Phone", created.phone]] : []);
  }
  return created ?? null;
}

async function threadFor(db: Db, acc: ChannelAccount, leadId: string, key: string) {
  const { data: t } = await db.from("threads").select("id").eq("channel_account_id", acc.id).eq("external_key", key).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (t) return t.id as string;
  const subject = acc.provider === "whatsapp" ? "WhatsApp chat" : acc.provider === "instagram" ? "Instagram messages" : "Messenger chat";
  const { data: n } = await db.from("threads").insert({ owner_id: acc.owner_id, lead_id: leadId, subject, channel: channelOf(acc.provider as Provider), channel_account_id: acc.id, external_key: key }).select("id").single();
  return n!.id as string;
}

/* ───────── Webhook ingestion ───────── */

type WaValue = {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: { from: string; id: string; timestamp: string; type: string; text?: { body: string }; image?: { caption?: string }; video?: { caption?: string }; document?: { filename?: string; caption?: string }; audio?: unknown; location?: { latitude: number; longitude: number; name?: string }; button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }; reaction?: { emoji: string } }[];
  statuses?: { id: string; status: string; timestamp: string; recipient_id: string; errors?: { title?: string; message?: string }[] }[];
};

function waText(m: NonNullable<WaValue["messages"]>[number]) {
  switch (m.type) {
    case "text": return m.text?.body ?? "";
    case "image": return `📷 Photo${m.image?.caption ? `: ${m.image.caption}` : ""}`;
    case "video": return `🎬 Video${m.video?.caption ? `: ${m.video.caption}` : ""}`;
    case "document": return `📎 ${m.document?.filename ?? "Document"}${m.document?.caption ? `: ${m.document.caption}` : ""}`;
    case "audio": return "🎤 Voice message";
    case "location": return `📍 Location: ${m.location?.name ?? `${m.location?.latitude}, ${m.location?.longitude}`}`;
    case "button": return m.button?.text ?? "";
    case "interactive": return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "reaction": return `Reacted ${m.reaction?.emoji ?? ""}`;
    default: return `[${m.type} message]`;
  }
}

export type IngestResult = { messages: number; statuses: number; unknown: number };

export async function ingestWebhook(db: Db, payload: { object?: string; entry?: unknown[] }): Promise<IngestResult> {
  const out: IngestResult = { messages: 0, statuses: 0, unknown: 0 };
  for (const entry of (payload.entry ?? []) as { id?: string; changes?: { field: string; value: WaValue }[]; messaging?: unknown[] }[]) {
    if (payload.object === "whatsapp_business_account") {
      for (const ch of entry.changes ?? []) {
        if (ch.field === "message_template_status_update") {
          // Meta tells us when a template is approved / rejected / paused.
          const tv = ch.value as unknown as { event?: string; message_template_name?: string; message_template_language?: string; reason?: string };
          const { data: accs } = await db.from("channel_accounts").select("id, meta").eq("provider", "whatsapp").eq("waba_id", entry.id ?? "");
          for (const a of accs ?? []) {
            const templates = ((a.meta?.templates ?? []) as WaTemplate[]).map((t) => t.name === tv.message_template_name && (!tv.message_template_language || t.language === tv.message_template_language) ? { ...t, status: tv.event ?? t.status, reason: tv.reason && tv.reason !== "NONE" ? tv.reason : null } : t);
            await db.from("channel_accounts").update({ meta: { ...a.meta, templates } }).eq("id", a.id);
          }
          out.statuses++;
          continue;
        }
        if (ch.field !== "messages") continue;
        const v = ch.value;
        const pid = v.metadata?.phone_number_id;
        const { data: acc } = await db.from("channel_accounts").select("*").eq("provider", "whatsapp").eq("external_id", pid ?? "").maybeSingle<ChannelAccount>();
        if (!acc) { out.unknown++; continue; }
        for (const m of v.messages ?? []) {
          const { data: dup } = await db.from("messages").select("id").eq("external_id", m.id).maybeSingle();
          if (dup) continue;
          const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
          const lead = await contactFor(db, acc, m.from, name);
          if (!lead) continue;
          const threadId = await threadFor(db, acc, lead.id, m.from);
          const at = new Date(Number(m.timestamp) * 1000).toISOString();
          const body = waText(m);
          await db.from("messages").insert({ owner_id: acc.owner_id, thread_id: threadId, lead_id: lead.id, direction: "in", channel: "whatsapp", from_email: `+${m.from}`, subject: "WhatsApp", body_text: body, status: "received", sent_at: at, external_id: m.id, media_type: m.type !== "text" ? m.type : null });
          await afterInbound(db, acc.owner_id, lead, threadId, at, `${lead.name} on WhatsApp: “${body.slice(0, 80)}”`);
          waMarkRead(acc.external_id, tokenOf(acc), m.id); // blue ticks for them
          out.messages++;
        }
        for (const s of v.statuses ?? []) {
          const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };
          const { data: msg } = await db.from("messages").select("id, delivery").eq("external_id", s.id).maybeSingle();
          if (!msg) continue;
          if ((rank[s.status] ?? 0) > (rank[msg.delivery ?? ""] ?? 0) || s.status === "failed") {
            const err = s.errors?.[0]?.message ?? s.errors?.[0]?.title;
            await db.from("messages").update({ delivery: s.status, ...(s.status === "read" ? { opened_at: new Date(Number(s.timestamp) * 1000).toISOString() } : {}), ...(s.status === "failed" ? { status: "failed", error: err ?? "Not delivered" } : {}) }).eq("id", msg.id);
          }
          out.statuses++;
        }
      }
    } else if (payload.object === "page" || payload.object === "instagram") {
      const provider: Provider = payload.object === "page" ? "facebook" : "instagram";
      const { data: acc } = await db.from("channel_accounts").select("*").eq("provider", provider).eq("external_id", entry.id ?? "").maybeSingle<ChannelAccount>();
      if (!acc) { out.unknown++; continue; }
      for (const ev of (entry.messaging ?? []) as { sender: { id: string }; recipient: { id: string }; timestamp: number; message?: { mid: string; text?: string; is_echo?: boolean; attachments?: { type: string }[] }; read?: { mid?: string; watermark?: number } }[]) {
        if (ev.read) continue; // read receipts for DMs aren't tracked yet
        const m = ev.message;
        if (!m || m.is_echo || ev.sender.id === acc.external_id) continue;
        const { data: dup } = await db.from("messages").select("id").eq("external_id", m.mid).maybeSingle();
        if (dup) continue;
        const token = tokenOf(acc);
        const { data: existing } = await db.from("leads").select("id").eq("owner_id", acc.owner_id).eq(provider === "facebook" ? "fb_psid" : "ig_id", ev.sender.id).maybeSingle();
        const name = existing ? null : await profileName(ev.sender.id, token, provider);
        const lead = await contactFor(db, acc, ev.sender.id, name);
        if (!lead) continue;
        const threadId = await threadFor(db, acc, lead.id, ev.sender.id);
        const at = new Date(ev.timestamp).toISOString();
        const body = m.text ?? (m.attachments?.length ? `📎 ${m.attachments.map((a) => a.type).join(", ")}` : "");
        await db.from("messages").insert({ owner_id: acc.owner_id, thread_id: threadId, lead_id: lead.id, direction: "in", channel: channelOf(provider), from_email: lead.name, subject: provider === "instagram" ? "Instagram" : "Messenger", body_text: body, status: "received", sent_at: at, external_id: m.mid });
        await afterInbound(db, acc.owner_id, lead, threadId, at, `${lead.name} on ${provider === "instagram" ? "Instagram" : "Messenger"}: “${body.slice(0, 80)}”`);
        out.messages++;
      }
    }
  }
  return out;
}

async function afterInbound(db: Db, owner: string, lead: LeadRow, threadId: string, at: string, text: string) {
  const { data: stopSeqs } = await db.from("sequences").select("id").eq("owner_id", owner).eq("stop_on_reply", true);
  await Promise.all([
    db.from("threads").update({ unread: true, status: "open", last_message_at: at, last_inbound_at: at }).eq("id", threadId),
    db.from("leads").update({ last_replied_at: at }).eq("id", lead.id),
    stopSeqs?.length ? db.from("enrollments").update({ status: "replied" }).eq("lead_id", lead.id).eq("status", "active").in("sequence_id", stopSeqs.map((s) => s.id)) : null,
    activity(db, owner, "Closer", text, "Message"),
  ]);
  const { data: t } = await db.from("threads").select("channel").eq("id", threadId).maybeSingle();
  const ch = t?.channel === "whatsapp" ? "WhatsApp" : t?.channel === "instagram" ? "Instagram" : "Messenger";
  await notifyReply(owner, threadId, lead.name, ch, text.replace(/^.*?:\s*/, "").replace(/^“|”$/g, ""));
}

/* ───────── Sending from the inbox ───────── */

export function windowOpen(lastInbound: string | null) {
  return Boolean(lastInbound && Date.now() - new Date(lastInbound).getTime() < DAY);
}

export type SendDirectInput = { ownerId: string; threadId: string; text?: string; template?: { name: string; language: string; params: string[] } };

/** The text the customer actually sees for a template, so the chat shows the real message. */
export function renderTemplate(acc: ChannelAccount, name: string, language: string, params: string[]) {
  const tpl = ((acc.meta?.templates ?? []) as { name: string; language: string; body: string }[]).find((x) => x.name === name && x.language === language);
  return tpl?.body ? tpl.body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? "") : `📋 Template “${name}”${params.length ? ` — ${params.join(" · ")}` : ""}`;
}

export async function sendOnThread(db: Db, i: SendDirectInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: t } = await db.from("threads").select("*, leads(*)").eq("id", i.threadId).maybeSingle();
  if (!t || !t.channel_account_id) return { ok: false, error: "Conversation not found." };
  const { data: acc } = await db.from("channel_accounts").select("*").eq("id", t.channel_account_id).maybeSingle<ChannelAccount>();
  if (!acc) return { ok: false, error: "This channel was disconnected. Reconnect it in Channels." };
  const token = tokenOf(acc);
  const open = windowOpen(t.last_inbound_at);
  try {
    let extId: string;
    let body: string;
    const { data: biz } = await db.from("businesses").select("name, city").eq("owner_id", acc.owner_id).order("created_at").limit(1).maybeSingle();
    const vars = leadVars(t.leads ?? { name: "there" }, { business_name: biz?.name ?? "", city: biz?.city ?? "", sender_name: acc.name });
    const text = i.text ? personalize(i.text, vars) : "";
    if (acc.provider === "whatsapp") {
      if (i.template) {
        const params = i.template.params.map((p) => personalize(p, vars) || "-");
        extId = (await waSendTemplate(acc.external_id, token, t.external_key, i.template.name, i.template.language, params)).id;
        body = renderTemplate(acc, i.template.name, i.template.language, params);
      } else {
        if (!open) return { ok: false, error: "It's been more than 24 hours since they last messaged you. WhatsApp only allows an approved template now — pick one below." };
        extId = (await waSendText(acc.external_id, token, t.external_key, text)).id;
        body = text;
      }
    } else {
      if (!open) return { ok: false, error: `${acc.provider === "instagram" ? "Instagram" : "Messenger"} only lets businesses reply within 24 hours of the person's last message.` };
      extId = await sendDirect(acc.page_id || acc.external_id, token, t.external_key, text);
      body = text;
    }
    const at = nowIso();
    await Promise.all([
      db.from("messages").insert({ owner_id: i.ownerId, thread_id: t.id, lead_id: t.lead_id, direction: "out", channel: t.channel, subject: t.subject, body_text: body, status: "sent", sent_at: at, external_id: extId, delivery: "sent", template_name: i.template?.name ?? null }),
      db.from("threads").update({ last_message_at: at, unread: false }).eq("id", t.id),
      db.from("leads").update({ last_contacted_at: at }).eq("id", t.lead_id),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof GraphError || e instanceof Error ? e.message : "Couldn't send the message." };
  }
}

/** Starts (or continues) a WhatsApp chat with a lead using an approved template. */
export async function startWhatsApp(db: Db, ownerId: string, acc: ChannelAccount, lead: { id: string; name: string; phone: string | null; wa_id: string | null; company: string | null }, template: { name: string; language: string; params: string[] }, broadcastId?: string) {
  const to = lead.wa_id || (lead.phone ? normalizePhone(lead.phone) : null);
  if (!to) return { ok: false as const, error: `${lead.name} has no valid phone number.` };
  const { id, waId } = await waSendTemplate(acc.external_id, tokenOf(acc), to, template.name, template.language, template.params);
  if (!lead.wa_id) await db.from("leads").update({ wa_id: waId }).eq("id", lead.id);
  const threadId = await threadFor(db, acc, lead.id, waId);
  const at = nowIso();
  await Promise.all([
    db.from("messages").insert({ owner_id: ownerId, thread_id: threadId, lead_id: lead.id, direction: "out", channel: "whatsapp", subject: "WhatsApp chat", body_text: renderTemplate(acc, template.name, template.language, template.params), status: "sent", sent_at: at, external_id: id, delivery: "sent", template_name: template.name, broadcast_id: broadcastId ?? null }),
    db.from("threads").update({ last_message_at: at }).eq("id", threadId),
    db.from("leads").update({ last_contacted_at: at }).eq("id", lead.id),
  ]);
  return { ok: true as const, threadId };
}

/* ───────── Publishing ───────── */

export type PostResult = { account_id: string; provider: SocialProvider; name: string; ok: boolean; external_id?: string; permalink?: string; error?: string };

export type PostOptions = { youtube?: YtOptions };

/** Posts to one connected account. Throws a plain-English error when it can't. */
async function publishTo(acc: ChannelAccount, post: { caption: string; link: string | null; media: Media[]; options?: PostOptions }) {
  if (acc.status && acc.status !== "connected") throw new Error(`${acc.name} needs reconnecting in Channels${acc.last_error ? ` (${acc.last_error})` : ""}.`);
  const token = tokenOf(acc);
  switch (acc.provider) {
    case "facebook": return publishToPage(acc.external_id, token, post.caption, post.media, post.link);
    case "instagram":
      if (!post.media.length) throw new Error("Instagram needs a photo or video — add one and retry.");
      return publishToInstagram(acc.external_id, token, post.link ? `${post.caption}\n\n${post.link}` : post.caption, post.media);
    case "youtube": {
      const video = post.media.find((m) => m.type === "video");
      if (!video) throw new Error("YouTube needs a video — add one and retry.");
      const r = await uploadVideo(await accessFromRefresh(token), video.url, post.link ? `${post.caption}\n\n${post.link}` : post.caption, post.options?.youtube ?? {});
      return { id: r.id, permalink: r.permalink };
    }
    case "gbp": {
      const account = String(acc.meta?.account ?? "");
      if (!account) throw new Error("Reconnect Google Business Profile in Local.");
      const r = await createLocalPost(await accessFromRefresh(token), account, acc.external_id, { summary: post.caption, photo: post.media.find((m) => m.type === "image")?.url ?? null, url: post.link });
      return { id: r.name, permalink: r.searchUrl ?? undefined };
    }
    default: throw new Error("WhatsApp can't publish posts — use a WhatsApp broadcast.");
  }
}

export type Milestone = { key: string; title: string; body: string; count: number };

export async function publishPost(db: Db, postId: string, o: { by?: "user" | "schedule" } = {}): Promise<{ status: string; results: PostResult[]; milestone?: Milestone | null; count?: number }> {
  const { data: claimed } = await db.from("social_posts").update({ status: "publishing" }).eq("id", postId).in("status", ["draft", "scheduled", "failed", "partial"]).select("*").maybeSingle();
  if (!claimed) return { status: "skipped", results: [] };
  const post = claimed as { id: string; owner_id: string; caption: string; link: string | null; media: Media[]; targets: string[]; results: PostResult[]; content_item_id: string | null; options?: PostOptions; scheduled_at: string | null };
  // Safety net for older posts: convert browser-recorded videos before they go out (normally done when saving).
  if ((post.media ?? []).some((m) => m.type === "video" && needsStandardVideo(m.url))) {
    const media = await Promise.all(post.media.map(async (m) => (m.type === "video" ? { ...m, url: (await ensureStandardVideo(m.url, post.owner_id, 55_000)).url } : m)));
    if (media.some((m, i) => m.url !== post.media[i].url)) { post.media = media; await db.from("social_posts").update({ media }).eq("id", post.id); }
  }
  const already = new Set((post.results ?? []).filter((r) => r.ok).map((r) => r.account_id));
  const { data: accs } = await db.from("channel_accounts").select("*").in("id", post.targets.length ? post.targets : ["00000000-0000-0000-0000-000000000000"]);
  const found = new Map(((accs ?? []) as ChannelAccount[]).map((a) => [a.id, a]));
  const results: PostResult[] = (post.results ?? []).filter((r) => r.ok);
  for (const id of post.targets) {
    if (already.has(id)) continue;
    const acc = found.get(id);
    if (!acc) {
      const prev = (post.results ?? []).find((r) => r.account_id === id);
      results.push({ account_id: id, provider: prev?.provider ?? "facebook", name: prev?.name ?? "Removed account", ok: false, error: "This account was disconnected — reconnect it in Channels, then edit and retry the post." });
      continue;
    }
    try {
      const r = await publishTo(acc, post);
      results.push({ account_id: acc.id, provider: acc.provider, name: acc.name, ok: true, external_id: r.id, permalink: r.permalink });
    } catch (e) {
      results.push({ account_id: acc.id, provider: acc.provider, name: acc.name, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  const status = !post.targets.length ? "failed" : okCount === post.targets.length ? "published" : okCount ? "partial" : "failed";
  if (!post.targets.length) results.push({ account_id: "none", provider: "facebook", name: "No account", ok: false, error: "No connected account was chosen for this post." });
  await db.from("social_posts").update({ status, results, published_at: okCount ? nowIso() : null }).eq("id", post.id);
  // Keep the Content card honest: posted when it went out, back to "approved" with the error when it didn't.
  if (post.content_item_id) await db.from("content_items").update(okCount ? { status: "published", scheduled_at: nowIso() } : { status: "approved" }).eq("id", post.content_item_id);
  const names = results.filter((r) => r.ok).map((r) => r.name).join(", ");
  const bad = results.filter((r) => !r.ok);
  await activity(db, post.owner_id, "Distributor", okCount ? `Published to ${names}: “${post.caption.slice(0, 60)}”${bad.length ? ` — failed on ${bad.map((b) => b.name).join(", ")}` : ""}` : `Publishing failed: ${bad[0]?.error ?? "unknown error"}`, okCount ? "Live" : "Failed");
  // In-app: a toast/bell entry for every outcome, and a one-time celebration on milestones (1st, 10th, 25th … post).
  const live = results.filter((r) => r.ok);
  const scheduled = o.by === "schedule" || (o.by !== "user" && Boolean(post.scheduled_at));
  let milestone: Milestone | null = null, total = 0;
  if (okCount) {
    const m = await postMilestone(post.owner_id);
    total = m.count;
    if (m.milestone) {
      const { data: had } = await db.from("app_notifications").select("id").eq("owner_id", post.owner_id).eq("celebrate", m.milestone.key).limit(1).then((r) => r, () => ({ data: null }));
      if (!had?.length) milestone = { ...m.milestone, count: m.count };
    }
    const where = live.map((r) => r.name).join(", ");
    await pushInApp(db, post.owner_id, {
      kind: milestone ? "milestone" : "post_live",
      title: milestone ? milestone.title : scheduled ? `Your scheduled post is live on ${where}` : `Published to ${where}`,
      body: milestone ? milestone.body : `“${post.caption.slice(0, 120) || "Your post"}”${bad.length ? ` — didn't go out on ${bad.map((b) => b.name).join(", ")}.` : ""}`,
      url: live[0]?.permalink ?? "/app/publish", provider: live[0]?.provider ?? null, celebrate: milestone?.key ?? null,
    });
    // Scheduled posts go out while you're away — email when they're live (failures are emailed below).
    if (scheduled && !bad.length) {
      await notify({
        ownerId: post.owner_id, type: "posting", subject: `Your scheduled post is live on ${where}`.slice(0, 140), title: "Your post is live 🎉",
        body: `Growvia just published your scheduled post to ${where}:\n\n“${post.caption.slice(0, 300)}”\n\n${live.map((r) => `${r.name}: ${r.permalink ?? ""}`).join("\n")}`,
        cta: { label: live[0]?.permalink ? "See the post" : "Open Publish", url: live[0]?.permalink ?? "/app/publish" }, dedupe: `live:${post.id}`,
      }).catch(() => null);
    }
  }
  if (bad.length) {
    await pushInApp(db, post.owner_id, { kind: "post_failed", title: okCount ? `Posted, but not to ${bad.map((b) => b.name).join(", ")}` : "Your post wasn't published", body: bad.map((b) => `${b.name}: ${b.error}`).join(" · ").slice(0, 500), url: "/app/publish", provider: bad[0].provider });
    await notify({
      ownerId: post.owner_id, type: "posting", subject: okCount ? "A scheduled post only partly went out" : "A scheduled post didn't go out",
      title: okCount ? `Posted to ${names}, but not everywhere` : "Your post wasn't published",
      body: `${bad.map((b) => `${b.name}: ${b.error}`).join("\n")}\n\n“${post.caption.slice(0, 200)}”`, cta: { label: "Fix and retry", url: "/app/publish" }, dedupe: `post:${post.id}:${bad.length}:${(post.results ?? []).length}`,
    }).catch(() => null);
  }
  return { status, results, milestone, count: total };
}

export async function processDueSocial(db: Db, deadline: number, ownerId?: string) {
  // A post stuck in "publishing" (the server stopped mid-way) is marked failed so it can be checked and retried.
  const stale = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: stuck } = await db.from("social_posts").select("id, results, created_at").eq("status", "publishing").or(`scheduled_at.lt.${stale},and(scheduled_at.is.null,created_at.lt.${stale})`).limit(20);
  for (const p of stuck ?? []) await db.from("social_posts").update({ status: "failed", results: [...((p.results as PostResult[]) ?? []), { account_id: "unknown", provider: "facebook", name: "Growvia", ok: false, error: "Publishing didn't finish — check the page first, then retry if it isn't there." }] }).eq("id", p.id).eq("status", "publishing");
  let q = db.from("social_posts").select("id").eq("status", "scheduled").lte("scheduled_at", nowIso()).order("scheduled_at").limit(10);
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data } = await q;
  let published = 0;
  for (const p of data ?? []) {
    if (Date.now() > deadline) break;
    const r = await publishPost(db, p.id, { by: "schedule" });
    if (r.status === "published" || r.status === "partial") published++;
  }
  return published;
}

/** Content planned for a channel Growvia can't post to (or isn't connected): email a reminder when it's due. */
export async function processDueReminders(db: Db, deadline: number) {
  const { data } = await db.from("content_items").select("id, owner_id, campaign_id, channel, title, body, scheduled_at").eq("status", "approved").not("scheduled_at", "is", null).lte("scheduled_at", nowIso()).is("reminded_at", null).gt("scheduled_at", new Date(Date.now() - 3 * DAY).toISOString()).limit(25);
  let sent = 0;
  for (const c of data ?? []) {
    if (Date.now() > deadline) break;
    const { data: claimed } = await db.from("content_items").update({ reminded_at: nowIso() }).eq("id", c.id).is("reminded_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    const { data: camp } = await db.from("campaigns").select("business_id").eq("id", c.campaign_id).maybeSingle();
    await notify({
      ownerId: c.owner_id, businessId: camp?.business_id ?? null, type: "posting", subject: `Time to post on ${c.channel}: ${c.title}`.slice(0, 140),
      title: `Time to post on ${c.channel}`, body: `You planned “${c.title}” for now. Growvia doesn't post to ${c.channel} for you, so copy it from Content and post it by hand:\n\n${c.body.slice(0, 900)}`,
      cta: { label: "Open Content", url: "/app/content?s=approved" }, dedupe: `remind:${c.id}`,
    }).catch(() => null);
    await activity(db, c.owner_id, "Distributor", `Reminder: time to post “${c.title}” on ${c.channel} (by hand).`, "Reminder");
    sent++;
  }
  return sent;
}

/* ───────── WhatsApp broadcasts ───────── */

export async function runBroadcast(db: Db, id: string, deadline: number) {
  const { data: bc } = await db.from("wa_broadcasts").select("*").eq("id", id).maybeSingle();
  if (!bc || !["scheduled", "sending"].includes(bc.status)) return { sent: 0, failed: 0 };
  await db.from("wa_broadcasts").update({ status: "sending" }).eq("id", id);
  const { data: acc } = await db.from("channel_accounts").select("*").eq("id", bc.account_id).maybeSingle<ChannelAccount>();
  if (!acc) { await db.from("wa_broadcasts").update({ status: "failed" }).eq("id", id); return { sent: 0, failed: 0 }; }
  // Number protection: while Meta rates quality LOW, broadcasts wait (chats keep working).
  if ((acc.meta?.health as { paused?: boolean } | undefined)?.paused) {
    await db.from("wa_broadcasts").update({ status: "scheduled", scheduled_at: new Date(Date.now() + 6 * 3600_000).toISOString() }).eq("id", id);
    return { sent: 0, failed: 0 };
  }
  const { data: done } = await db.from("messages").select("lead_id").eq("broadcast_id", id);
  const doneSet = new Set((done ?? []).map((d) => d.lead_id));
  const todo = (bc.lead_ids as string[]).filter((l) => !doneSet.has(l));
  const { data: leads } = await db.from("leads").select("id, name, phone, wa_id, company").in("id", todo.length ? todo : ["00000000-0000-0000-0000-000000000000"]);
  const { data: biz } = await db.from("businesses").select("name, city").eq("owner_id", bc.owner_id).order("created_at").limit(1).maybeSingle();
  let sent = 0, failed = 0;
  for (const lead of leads ?? []) {
    if (Date.now() > deadline) break;
    const vars = leadVars(lead, { business_name: biz?.name ?? "", city: biz?.city ?? "", sender_name: acc.name });
    const params = (bc.params as string[]).map((p) => personalize(p, vars) || "-");
    try {
      const r = await startWhatsApp(db, bc.owner_id, acc, lead, { name: bc.template_name, language: bc.language, params }, id);
      if (r.ok) sent++;
      else { failed++; await recordBroadcastFailure(db, bc.owner_id, acc, lead, id, r.error); }
    } catch (e) {
      failed++;
      await recordBroadcastFailure(db, bc.owner_id, acc, lead, id, e instanceof Error ? e.message : "Failed");
    }
  }
  const remaining = todo.length - sent - failed;
  await db.from("wa_broadcasts").update({ sent_count: (bc.sent_count ?? 0) + sent, failed_count: (bc.failed_count ?? 0) + failed, status: remaining > 0 ? "sending" : "sent" }).eq("id", id);
  if (remaining <= 0) await activity(db, bc.owner_id, "Distributor", `WhatsApp broadcast “${bc.name}” finished — ${(bc.sent_count ?? 0) + sent} sent${(bc.failed_count ?? 0) + failed ? `, ${(bc.failed_count ?? 0) + failed} failed` : ""}.`, "Live");
  return { sent, failed };
}

async function recordBroadcastFailure(db: Db, owner: string, acc: ChannelAccount, lead: { id: string; wa_id: string | null; phone: string | null }, broadcastId: string, error: string) {
  const key = lead.wa_id || (lead.phone ? normalizePhone(lead.phone) : null) || "unknown";
  const threadId = await threadFor(db, acc, lead.id, key);
  await db.from("messages").insert({ owner_id: owner, thread_id: threadId, lead_id: lead.id, direction: "out", channel: "whatsapp", subject: "WhatsApp chat", body_text: "Broadcast not delivered", status: "failed", error, broadcast_id: broadcastId, delivery: "failed" });
}

export async function processDueBroadcasts(db: Db, deadline: number, ownerId?: string) {
  let q = db.from("wa_broadcasts").select("id").or(`and(status.eq.scheduled,scheduled_at.lte.${nowIso()}),status.eq.sending`).limit(5);
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data } = await q;
  let sent = 0;
  for (const b of data ?? []) {
    if (Date.now() > deadline) break;
    sent += (await runBroadcast(db, b.id, deadline)).sent;
  }
  return sent;
}

/** Re-checks templates still waiting for Meta's review (backup for the status webhook). */
export async function syncPendingTemplates(db: Db) {
  const { data: accs } = await db.from("channel_accounts").select("*").eq("provider", "whatsapp");
  let synced = 0;
  for (const a of (accs ?? []) as ChannelAccount[]) {
    const list = (a.meta?.templates ?? []) as WaTemplate[];
    const last = new Date(String(a.meta?.templates_synced_at ?? 0)).getTime();
    if (!a.waba_id || !list.some((t) => t.status === "PENDING" || t.status === "IN_APPEAL") || Date.now() - last < 5 * 60_000) continue;
    try {
      const templates = await waTemplates(a.waba_id, tokenOf(a));
      await db.from("channel_accounts").update({ meta: { ...a.meta, templates, templates_synced_at: new Date().toISOString() } }).eq("id", a.id);
      synced++;
    } catch { /* try again next tick */ }
  }
  return synced;
}
