import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { derivedToken, derivedTokens } from "../server/crypto";

// Meta Graph API (Facebook Pages, Instagram, WhatsApp Cloud API).
export const META_APP_ID = process.env.META_APP_ID?.trim() || "";
export const META_APP_SECRET = process.env.META_APP_SECRET?.trim() || "";
export const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN?.trim() || derivedToken("meta-webhook-verify");
export const META_VERIFY_TOKENS = process.env.META_VERIFY_TOKEN?.trim() ? [META_VERIFY_TOKEN] : derivedTokens("meta-webhook-verify");
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || "v23.0";
const GRAPH_BASE = (process.env.META_GRAPH_BASE?.trim() || "https://graph.facebook.com").replace(/\/$/, "");
const DIALOG_BASE = (process.env.META_DIALOG_BASE?.trim() || "https://www.facebook.com").replace(/\/$/, "");
export const metaLoginReady = Boolean(META_APP_ID && META_APP_SECRET);

export const FB_SCOPES = [
  "pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata", "pages_messaging",
  "instagram_basic", "instagram_content_publish", "instagram_manage_messages", "instagram_manage_comments", "business_management",
];

export class GraphError extends Error {
  constructor(message: string, public code?: number, public subcode?: number, public status?: number) { super(message); }
}

type Opts = { token?: string; query?: Record<string, string | number | undefined>; body?: unknown; timeout?: number };

export async function graph<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, o: Opts = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  Object.entries(o.query ?? {}).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));
  const res = await fetch(url, {
    method,
    headers: { ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}), ...(o.body ? { "Content-Type": "application/json" } : {}) },
    body: o.body ? JSON.stringify(o.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(o.timeout ?? 20000),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok || data.error) {
    const e = (data.error ?? {}) as { message?: string; code?: number; error_subcode?: number; error_user_msg?: string };
    throw new GraphError(friendlyGraph(e.error_user_msg || e.message || `Meta API error ${res.status}`, e.code), e.code, e.error_subcode, res.status);
  }
  return data as T;
}

function friendlyGraph(msg: string, code?: number) {
  if (code === 190) return "Your Meta connection expired or was revoked — reconnect it in Channels.";
  if (code === 10 || code === 200) return `Permission missing: ${msg}`;
  if (code === 131047 || /re-engagement|24 hours/i.test(msg)) return "More than 24 hours since this person last messaged you — send an approved template to restart the chat.";
  if (code === 131026) return "This number isn't on WhatsApp or can't receive messages.";
  if (code === 132001) return "That template doesn't exist or isn't approved for this language.";
  if (code === 368) return "Meta temporarily blocked sending from this account (policy). Try again later.";
  return msg;
}

export function oauthDialogUrl(redirectUri: string, state: string) {
  const u = new URL(`${DIALOG_BASE}/${GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", META_APP_ID);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", FB_SCOPES.join(","));
  return u.toString();
}

/** Verifies X-Hub-Signature-256 on webhook payloads. */
export function verifySignature(raw: string, header: string | null, secrets: string[]) {
  if (!header?.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7), "hex");
  return secrets.filter(Boolean).some((s) => {
    const want = createHmac("sha256", s).update(raw).digest();
    return want.length === got.length && timingSafeEqual(want, got);
  });
}

/* ───────── WhatsApp Cloud API ───────── */

export function normalizePhone(input: string, defaultCountry = "91") {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = defaultCountry + d.slice(1);
  else if (d.length === 10) d = defaultCountry + d;
  return /^\d{8,15}$/.test(d) ? d : null;
}

export async function waPhoneInfo(phoneNumberId: string, token: string) {
  return graph<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }>("GET", phoneNumberId, { token, query: { fields: "display_phone_number,verified_name,quality_rating" } });
}

/** Every number in a WhatsApp Business Account — lets Growvia find the right Phone number ID itself. */
export async function waPhoneNumbers(wabaId: string, token: string) {
  const r = await graph<{ data: { id: string; display_phone_number: string; verified_name: string; quality_rating?: string }[] }>("GET", `${wabaId}/phone_numbers`, { token, query: { fields: "id,display_phone_number,verified_name,quality_rating", limit: "50" } });
  return r.data ?? [];
}

export async function waSendText(phoneNumberId: string, token: string, to: string, body: string) {
  const r = await graph<{ messages: { id: string }[]; contacts?: { wa_id: string }[] }>("POST", `${phoneNumberId}/messages`, { token, body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body } } });
  return { id: r.messages[0].id, waId: r.contacts?.[0]?.wa_id ?? to };
}

export async function waSendTemplate(phoneNumberId: string, token: string, to: string, name: string, language: string, params: string[]) {
  const components = params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [];
  const r = await graph<{ messages: { id: string }[]; contacts?: { wa_id: string }[] }>("POST", `${phoneNumberId}/messages`, { token, body: { messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: language }, components } } });
  return { id: r.messages[0].id, waId: r.contacts?.[0]?.wa_id ?? to };
}

export async function waMarkRead(phoneNumberId: string, token: string, messageId: string) {
  await graph("POST", `${phoneNumberId}/messages`, { token, body: { messaging_product: "whatsapp", status: "read", message_id: messageId } }).catch(() => {});
}

export type WaTemplate = { name: string; language: string; status: string; category: string; body: string; vars: number; id?: string; reason?: string | null; header?: string | null; footer?: string | null; buttons?: string[] };

export async function waTemplates(wabaId: string, token: string): Promise<WaTemplate[]> {
  const r = await graph<{ data: { id: string; name: string; language: string; status: string; category: string; rejected_reason?: string; components: { type: string; format?: string; text?: string; buttons?: { text: string }[] }[] }[] }>("GET", `${wabaId}/message_templates`, { token, query: { fields: "id,name,language,status,category,rejected_reason,components", limit: 200 } });
  return r.data.map((t) => {
    const body = t.components.find((c) => c.type === "BODY")?.text ?? "";
    const header = t.components.find((c) => c.type === "HEADER" && (c.format ?? "TEXT") === "TEXT")?.text ?? null;
    return {
      id: t.id, name: t.name, language: t.language, status: t.status, category: t.category, body, header,
      footer: t.components.find((c) => c.type === "FOOTER")?.text ?? null,
      buttons: t.components.find((c) => c.type === "BUTTONS")?.buttons?.map((b) => b.text) ?? [],
      reason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
      vars: new Set(body.match(/\{\{\d+\}\}/g) ?? []).size,
    };
  });
}

export type NewTemplate = { name: string; language: string; category: "MARKETING" | "UTILITY"; header?: string; body: string; footer?: string; examples: string[]; quickReplies?: string[]; urlButton?: { text: string; url: string } };

/** Submits a template to Meta for review. Approval usually takes minutes, occasionally up to 24 hours. */
export async function waCreateTemplate(wabaId: string, token: string, t: NewTemplate) {
  const components: Record<string, unknown>[] = [];
  if (t.header) components.push({ type: "HEADER", format: "TEXT", text: t.header });
  components.push({ type: "BODY", text: t.body, ...(t.examples.length ? { example: { body_text: [t.examples] } } : {}) });
  if (t.footer) components.push({ type: "FOOTER", text: t.footer });
  const buttons = [
    ...(t.quickReplies ?? []).map((text) => ({ type: "QUICK_REPLY", text })),
    ...(t.urlButton ? [{ type: "URL", text: t.urlButton.text, url: t.urlButton.url }] : []),
  ];
  if (buttons.length) components.push({ type: "BUTTONS", buttons });
  return graph<{ id: string; status: string; category: string }>("POST", `${wabaId}/message_templates`, { token, body: { name: t.name, language: t.language, category: t.category, components } });
}

export async function waDeleteTemplate(wabaId: string, token: string, name: string) {
  return graph("DELETE", `${wabaId}/message_templates`, { token, query: { name } });
}

/* ───────── Facebook Pages + Instagram ───────── */

export async function exchangeCode(code: string, redirectUri: string) {
  const short = await graph<{ access_token: string }>("GET", "oauth/access_token", { query: { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: redirectUri, code } });
  const long = await graph<{ access_token: string; expires_in?: number }>("GET", "oauth/access_token", { query: { grant_type: "fb_exchange_token", client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: short.access_token } });
  return long.access_token;
}

export type PageInfo = { id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string; name?: string } };

export async function listPages(userToken: string): Promise<PageInfo[]> {
  const r = await graph<{ data: PageInfo[] }>("GET", "me/accounts", { token: userToken, query: { fields: "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}", limit: 100 } });
  return r.data;
}

export async function subscribePage(pageId: string, pageToken: string) {
  await graph("POST", `${pageId}/subscribed_apps`, { token: pageToken, query: { subscribed_fields: "messages,messaging_postbacks,feed" } }).catch(() => {});
}

export type Media = { url: string; type: "image" | "video" };

export async function publishToPage(pageId: string, token: string, caption: string, media: Media[], link?: string | null) {
  let id: string;
  if (!media.length) id = (await graph<{ id: string }>("POST", `${pageId}/feed`, { token, body: { message: caption, ...(link ? { link } : {}) } })).id;
  else if (media[0].type === "video") id = (await graph<{ id: string }>("POST", `${pageId}/videos`, { token, body: { file_url: media[0].url, description: caption } })).id;
  else if (media.length === 1) id = (await graph<{ id: string; post_id?: string }>("POST", `${pageId}/photos`, { token, body: { url: media[0].url, caption } }).then((r) => r.post_id ?? r.id));
  else {
    const photos = await Promise.all(media.filter((m) => m.type === "image").slice(0, 10).map((m) => graph<{ id: string }>("POST", `${pageId}/photos`, { token, body: { url: m.url, published: false } })));
    id = (await graph<{ id: string }>("POST", `${pageId}/feed`, { token, body: { message: caption, attached_media: photos.map((p) => ({ media_fbid: p.id })) } })).id;
  }
  const info = await graph<{ permalink_url?: string }>("GET", id, { token, query: { fields: "permalink_url" } }).catch(() => ({} as { permalink_url?: string }));
  return { id, permalink: info.permalink_url ?? `https://www.facebook.com/${id}` };
}

async function waitContainer(id: string, token: string, maxMs = 50_000) {
  const t = Date.now();
  while (Date.now() - t < maxMs) {
    const s = await graph<{ status_code?: string; status?: string }>("GET", id, { token, query: { fields: "status_code,status" } });
    if (s.status_code === "FINISHED" || !s.status_code) return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new GraphError(`Instagram couldn't process the media (${s.status ?? s.status_code}). Check the file format and size.`);
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new GraphError("Instagram is still processing the video — it will be retried.");
}

export async function publishToInstagram(igId: string, token: string, caption: string, media: Media[]) {
  if (!media.length) throw new GraphError("Instagram posts need at least one image or video.");
  let creation: string;
  if (media.length === 1) {
    const m = media[0];
    creation = (await graph<{ id: string }>("POST", `${igId}/media`, { token, body: m.type === "video" ? { media_type: "REELS", video_url: m.url, caption } : { image_url: m.url, caption } })).id;
  } else {
    const children = [];
    for (const m of media.slice(0, 10)) {
      const c = (await graph<{ id: string }>("POST", `${igId}/media`, { token, body: m.type === "video" ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: true } : { image_url: m.url, is_carousel_item: true } })).id;
      if (m.type === "video") await waitContainer(c, token);
      children.push(c);
    }
    creation = (await graph<{ id: string }>("POST", `${igId}/media`, { token, body: { media_type: "CAROUSEL", children: children.join(","), caption } })).id;
  }
  await waitContainer(creation, token);
  const pub = await graph<{ id: string }>("POST", `${igId}/media_publish`, { token, body: { creation_id: creation } });
  const info = await graph<{ permalink?: string }>("GET", pub.id, { token, query: { fields: "permalink" } }).catch(() => ({} as { permalink?: string }));
  return { id: pub.id, permalink: info.permalink ?? "https://www.instagram.com/" };
}

/** Messenger + Instagram Direct replies (within 24h of their last message). */
export async function sendDirect(pageId: string, pageToken: string, recipientId: string, text: string) {
  const r = await graph<{ message_id: string }>("POST", `${pageId}/messages`, { token: pageToken, body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text } } });
  return r.message_id;
}

export async function profileName(id: string, token: string, provider: "facebook" | "instagram") {
  try {
    const r = await graph<{ name?: string; first_name?: string; last_name?: string; username?: string }>("GET", id, { token, query: { fields: provider === "instagram" ? "name,username" : "first_name,last_name" } });
    return provider === "instagram" ? r.name || (r.username ? `@${r.username}` : null) : [r.first_name, r.last_name].filter(Boolean).join(" ") || null;
  } catch {
    return null;
  }
}
