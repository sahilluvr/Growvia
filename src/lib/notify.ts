import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "./server/admin";
import { esc, layout, sendSystemEmail, systemMailReady } from "./mail/system";

/* Growvia's automatic emails to you and your team, respecting everyone's notification choices. */

export const NOTIFY_TYPES = [
  { id: "new_lead", label: "New lead", desc: "Someone fills your website form, messages you, or books" },
  { id: "reply", label: "New reply", desc: "A lead replies by email, WhatsApp, Instagram or Messenger" },
  { id: "meeting", label: "Meeting booked", desc: "Someone books a time on your booking page" },
  { id: "seo_audit", label: "SEO check finished", desc: "Your scheduled website check is done" },
  { id: "seo_alert", label: "SEO alerts", desc: "Score drops or new critical problems" },
  { id: "rank_alert", label: "Keyword ranking changes", desc: "Keywords entering or leaving Google's top 10" },
  { id: "geo_alert", label: "AI visibility changes", desc: "ChatGPT/Gemini/Perplexity mention you more or less" },
  { id: "review", label: "New Google reviews", desc: "Someone reviews your Google Business Profile" },
  { id: "posting", label: "Scheduled posts", desc: "A scheduled post fails, or it's time to post something by hand" },
  { id: "health", label: "Sending health alerts", desc: "A mailbox is paused, a domain setting breaks, or a WhatsApp number's quality drops" },
  { id: "digest", label: "Weekly summary", desc: "Every Monday: leads, replies, emails, SEO & AI visibility" },
] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number]["id"];

type Db = SupabaseClient;
const hash = (s: string) => { let h = 0; for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };

async function log(db: Db, row: { owner_id: string; business_id?: string | null; type: string; recipients: string[]; subject: string; status: string; error?: string | null; dedupe?: string | null }) {
  const { error } = await db.from("email_log").insert({ ...row, business_id: row.business_id ?? null, error: row.error ?? null, dedupe: row.dedupe ?? null });
  return !error; // a unique-violation on dedupe means "already sent"
}

/** Who should hear about something in this project: the owner + teammates with access, minus anyone who switched it off. */
export async function recipientsFor(db: Db, ownerId: string, businessId: string | null, type: NotifyType) {
  const [{ data: owner }, { data: team }, { data: biz }] = await Promise.all([
    db.from("profiles").select("id, email").eq("id", ownerId).maybeSingle(),
    db.from("team_members").select("user_id, email, workspace_ids").eq("owner_id", ownerId).eq("status", "active"),
    businessId ? db.from("businesses").select("workspace_id, seo_prefs").eq("id", businessId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const people = [
    ...(owner?.email ? [{ id: owner.id as string, email: owner.email as string }] : []),
    ...((team ?? []) as { user_id: string; email: string; workspace_ids: string[] | null }[])
      .filter((m) => m.user_id && (!m.workspace_ids || !biz || m.workspace_ids.includes(biz.workspace_id)))
      .map((m) => ({ id: m.user_id, email: m.email })),
  ];
  if (!people.length) return [];
  const { data: prefs } = await db.from("user_prefs").select("user_id, notify").in("user_id", people.map((p) => p.id));
  const off = new Set((prefs ?? []).filter((p) => p.notify?.[type] === false).map((p) => p.user_id));
  return [...new Map(people.filter((p) => !off.has(p.id)).map((p) => [p.email.toLowerCase(), p.email])).values()];
}

/**
 * Sends a notification to the project's people. `dedupe` stops the same alert going out twice.
 * Never throws — a failed notification must not break the action that triggered it.
 */
export async function notify(n: { ownerId: string; businessId?: string | null; type: NotifyType; subject: string; title: string; body: string; cta?: { label: string; url: string }; dedupe?: string }) {
  const db = adminClient();
  if (!db) return { ok: false, error: "no service key" };
  try {
    const to = await recipientsFor(db, n.ownerId, n.businessId ?? null, n.type);
    if (!to.length) return { ok: true, skipped: "nobody subscribed" };
    const dedupe = n.dedupe ? `${n.type}:${n.dedupe}` : null;
    if (!systemMailReady) { await log(db, { owner_id: n.ownerId, business_id: n.businessId, type: n.type, recipients: to, subject: n.subject, status: "skipped", error: "RESEND_API_KEY not set", dedupe }); return { ok: false, error: "email not configured" }; }
    if (dedupe) {
      // Claim the slot first so two parallel triggers can't both send.
      const claimed = await log(db, { owner_id: n.ownerId, business_id: n.businessId, type: n.type, recipients: to, subject: n.subject, status: "sending", dedupe });
      if (!claimed) return { ok: true, skipped: "already sent" };
    }
    const r = await sendSystemEmail({ to, subject: n.subject, html: layout({ title: n.title, preheader: n.subject, body: n.body, cta: n.cta }) });
    if (dedupe) await db.from("email_log").update({ status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error }).eq("dedupe", dedupe);
    else await log(db, { owner_id: n.ownerId, business_id: n.businessId, type: n.type, recipients: to, subject: n.subject, status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "notify failed" };
  }
}

/** One email to a specific address (welcome, invite, form auto-reply). */
export async function sendTo(m: { ownerId: string; businessId?: string | null; type: string; to: string; subject: string; title?: string; body?: string; html?: string; cta?: { label: string; url: string }; replyTo?: string; dedupe?: string }) {
  const db = adminClient();
  const dedupe = m.dedupe ? `${m.type}:${m.dedupe}` : null;
  if (db && dedupe) {
    const claimed = await log(db, { owner_id: m.ownerId, business_id: m.businessId, type: m.type, recipients: [m.to], subject: m.subject, status: "sending", dedupe });
    if (!claimed) return { ok: true, skipped: true };
  }
  const r = await sendSystemEmail({ to: m.to, subject: m.subject, html: m.html ?? layout({ title: m.title ?? m.subject, preheader: m.subject, body: m.body ?? "", cta: m.cta }), replyTo: m.replyTo });
  if (db) {
    if (dedupe) await db.from("email_log").update({ status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error }).eq("dedupe", dedupe);
    else await log(db, { owner_id: m.ownerId, business_id: m.businessId, type: m.type, recipients: [m.to], subject: m.subject, status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error });
  }
  return r;
}

export const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1D211F">${t}</p>`;
export const rows = (items: [string, string][]) => `<table role="presentation" width="100%" style="border-collapse:collapse;margin:8px 0 4px;font-size:14px">${items.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6E736D;width:40%">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`).join("")}</table>`;
export const hourKey = () => new Date().toISOString().slice(0, 13);
export const dayKey = () => new Date().toISOString().slice(0, 10);
export { esc, hash };

/* ───────── Ready-made alerts used around the app ───────── */

import { SITE_URL } from "./config";
const link = (path: string) => `${(SITE_URL || "").replace(/\/$/, "")}${path}`;

export async function notifyNewLead(db: Db, ownerId: string, businessId: string | null, leadId: string, name: string, source: string, extra: [string, string][] = []) {
  const { data: b } = businessId ? await db.from("businesses").select("name").eq("id", businessId).maybeSingle() : { data: null };
  return notify({ ownerId, businessId, type: "new_lead", subject: `New lead: ${name}${b ? ` — ${b.name}` : ""}`, title: `New lead from ${source}`, body: rows([["Name", name], ["Source", source], ...extra]), cta: { label: "Open the lead", url: link(`/app/leads/${leadId}`) } });
}

export async function notifyReply(ownerId: string, threadId: string, who: string, channel: string, preview: string) {
  return notify({ ownerId, type: "reply", subject: `${who} replied on ${channel}`, title: `New reply from ${who}`, body: p(`<i>“${esc(preview.slice(0, 400))}”</i>`), cta: { label: "Reply in Growvia", url: link(`/app/inbox?t=${threadId}`) }, dedupe: `${threadId}:${hourKey()}` });
}
