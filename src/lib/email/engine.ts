import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { simpleParser, type ParsedMail } from "mailparser";
import { buildEmail, leadVars, personalize } from "./render";
import { credsOf, friendlyMailError, imapClient, sendMail } from "./transport";
import type { Enrollment, Mailbox, Message, Sequence, Step } from "./types";

/**
 * The email engine. Every function takes a Supabase client:
 *  - the signed-in user's client (RLS-scoped) when triggered from the app, or
 *  - the service-role client when run by the scheduler for all accounts.
 * All inserts set owner_id explicitly so both work.
 */

type Db = SupabaseClient;
type LeadRow = { id: string; owner_id: string; name: string; email: string | null; company: string | null; stage: string; unsubscribed: boolean; email_status: string };

const nowIso = () => new Date().toISOString();
const DAY = 86_400_000;

export type SendContext = { siteUrl: string; businessName: string; city?: string | null; bookingLink?: string | null };

async function ctxFor(db: Db, ownerId: string, siteUrl: string): Promise<SendContext> {
  const [{ data: b }, { data: bp }] = await Promise.all([
    db.from("businesses").select("name, city").eq("owner_id", ownerId).maybeSingle(),
    db.from("booking_pages").select("slug, active").eq("owner_id", ownerId).maybeSingle(),
  ]);
  return { siteUrl, businessName: b?.name ?? "", city: b?.city ?? null, bookingLink: bp?.active ? `${siteUrl}/book/${bp.slug}` : null };
}

async function activity(db: Db, ownerId: string, agent: string, text: string, tag: string) {
  await db.from("activity").insert({ owner_id: ownerId, agent, text, tag });
}

function domainOf(email: string) {
  return email.split("@")[1]?.toLowerCase() || "growvia.local";
}

/* ───────────────────────── Sending ───────────────────────── */

export type SendInput = {
  ownerId: string;
  mailbox: Mailbox;
  lead: LeadRow;
  subject: string;
  body: string;
  threadId?: string | null;
  sequenceId?: string | null;
  stepId?: string | null;
  scheduledAt?: string | null; // future → queue instead of sending
  ctx: SendContext;
  senderName?: string;
};

export type SendResult = { ok: true; messageId: string; threadId: string; scheduled?: boolean } | { ok: false; error: string; bounced?: boolean; threadId?: string };

export async function sendToLead(db: Db, i: SendInput): Promise<SendResult> {
  const { lead, mailbox } = i;
  if (!lead.email) return { ok: false, error: "This lead has no email address." };
  if (lead.unsubscribed) return { ok: false, error: `${lead.name} unsubscribed from your emails.` };
  if (lead.email_status === "bounced") return { ok: false, error: `${lead.email} bounced before — fix the address first.`, bounced: true };

  const vars = leadVars(lead, {
    business_name: i.ctx.businessName,
    sender_name: i.senderName || mailbox.from_name,
    booking_link: i.ctx.bookingLink ?? "",
    city: i.ctx.city ?? "",
  });
  const subject = personalize(i.subject, vars).trim() || "(no subject)";
  const body = personalize(i.body, vars);

  // Thread: continue an existing conversation or start a new one.
  let threadId: string;
  if (i.threadId) threadId = i.threadId;
  else {
    const { data: t, error } = await db.from("threads").insert({ owner_id: i.ownerId, lead_id: lead.id, subject: subject.replace(/^re:\s*/i, "") }).select("id").single();
    if (error || !t) return { ok: false, error: error?.message ?? "Couldn't start a conversation" };
    threadId = t.id as string;
  }

  const id = randomUUID();
  const headerId = `<${id}@${domainOf(mailbox.from_email)}>`;
  const scheduled = i.scheduledAt && new Date(i.scheduledAt).getTime() > Date.now() + 30_000;
  const { error: insErr } = await db.from("messages").insert({
    id, owner_id: i.ownerId, thread_id: threadId, lead_id: lead.id, direction: "out",
    from_email: mailbox.from_email, to_email: lead.email, subject, body_text: body, message_id: headerId,
    status: scheduled ? "scheduled" : "sending", scheduled_at: scheduled ? i.scheduledAt : null,
    sequence_id: i.sequenceId ?? null, step_id: i.stepId ?? null, mailbox_id: mailbox.id,
  });
  if (insErr) return { ok: false, error: insErr.message, threadId };
  if (scheduled) return { ok: true, messageId: id, threadId, scheduled: true };

  const r = await deliver(db, id, mailbox, lead, i.ctx.siteUrl);
  return r.ok ? { ok: true, messageId: id, threadId } : { ok: false, error: r.error, bounced: r.bounced, threadId };
}

/** Sends a stored message row (status sending). */
async function deliver(db: Db, id: string, mailbox: Mailbox, lead: LeadRow, siteUrl: string): Promise<{ ok: true } | { ok: false; error: string; bounced?: boolean }> {
  const { data: m } = await db.from("messages").select("*").eq("id", id).single<Message>();
  if (!m) return { ok: false, error: "Message not found" };
  // References for proper threading in the recipient's mail app.
  const { data: prior } = await db.from("messages").select("message_id").eq("thread_id", m.thread_id).neq("id", id).order("created_at", { ascending: true }).limit(20);
  const refs = (prior ?? []).map((p) => p.message_id).filter(Boolean) as string[];
  const { text, html, oneClickUrl } = buildEmail({ body: m.body_text ?? "", signature: mailbox.signature, messageId: id, siteUrl, track: true, unsubscribe: Boolean(m.sequence_id) });
  try {
    await sendMail(credsOf(mailbox), {
      from: { name: mailbox.from_name, address: mailbox.from_email },
      to: lead.email!,
      subject: m.subject ?? "",
      text,
      html,
      messageId: m.message_id!,
      inReplyTo: refs.at(-1) ?? null,
      references: refs,
      listUnsubscribe: m.sequence_id ? oneClickUrl : undefined,
    });
  } catch (e) {
    const msg = friendlyMailError(e);
    const bounced = /\b55[0-4]\b|user unknown|no such user|does not exist|recipient.*rejected/i.test(e instanceof Error ? e.message : "");
    await db.from("messages").update({ status: "failed", error: msg }).eq("id", id);
    if (bounced) await db.from("leads").update({ email_status: "bounced" }).eq("id", lead.id);
    return { ok: false, error: msg, bounced };
  }
  const t = nowIso();
  await Promise.all([
    db.from("messages").update({ status: "sent", sent_at: t, body_html: html }).eq("id", id),
    db.from("threads").update({ last_message_at: t }).eq("id", m.thread_id),
    db.from("leads").update({ last_contacted_at: t, ...(lead.stage === "new" ? { stage: "contacted" } : {}) }).eq("id", lead.id),
  ]);
  return { ok: true };
}

/* ───────────────────────── Send windows ───────────────────────── */

function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hour12: false });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { dow, hour: Number(parts.hour) % 24 };
}

export function inWindow(d: Date, s: Pick<Sequence, "send_days" | "send_start" | "send_end" | "timezone">) {
  const { dow, hour } = localParts(d, s.timezone || "UTC");
  return s.send_days.includes(dow) && hour >= s.send_start && hour < s.send_end;
}

export function nextWindow(from: Date, s: Pick<Sequence, "send_days" | "send_start" | "send_end" | "timezone">): Date {
  if (!s.send_days.length) return new Date(from.getTime() + DAY);
  const t = new Date(from);
  t.setUTCMinutes(Math.ceil(t.getUTCMinutes() / 15) * 15, 0, 0);
  for (let i = 0; i < 8 * 96; i++) {
    if (inWindow(t, s)) return t;
    t.setTime(t.getTime() + 15 * 60_000);
  }
  return new Date(from.getTime() + DAY);
}

/* ───────────────────────── Scheduler ───────────────────────── */

async function sentToday(db: Db, mailboxId: string) {
  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("mailbox_id", mailboxId).eq("direction", "out").eq("status", "sent").gte("sent_at", new Date(Date.now() - DAY).toISOString());
  return count ?? 0;
}

export type TickResult = { sent: number; scheduledSent: number; deferred: number; failed: number; completed: number; errors: string[] };

/** Sends everything that is due. Safe to run concurrently: each item is claimed before sending. */
export async function processDue(db: Db, opts: { siteUrl: string; ownerId?: string; sequenceId?: string; limit?: number; deadline?: number }): Promise<TickResult> {
  const res: TickResult = { sent: 0, scheduledSent: 0, deferred: 0, failed: 0, completed: 0, errors: [] };
  const limit = opts.limit ?? 40;
  const deadline = opts.deadline ?? Date.now() + 45_000;
  const mailboxes = new Map<string, Mailbox | null>();
  const counts = new Map<string, number>();
  const ctxs = new Map<string, SendContext>();
  const getMailbox = async (id: string | null) => {
    if (!id) return null;
    if (!mailboxes.has(id)) {
      const { data } = await db.from("mailboxes").select("*").eq("id", id).maybeSingle<Mailbox>();
      mailboxes.set(id, data ?? null);
    }
    return mailboxes.get(id)!;
  };
  const getCtx = async (owner: string) => {
    if (!ctxs.has(owner)) ctxs.set(owner, await ctxFor(db, owner, opts.siteUrl));
    return ctxs.get(owner)!;
  };
  const underCap = async (m: Mailbox) => {
    if (!counts.has(m.id)) counts.set(m.id, await sentToday(db, m.id));
    return counts.get(m.id)! < m.daily_limit;
  };
  const bump = (m: Mailbox) => counts.set(m.id, (counts.get(m.id) ?? 0) + 1);

  // 1) One-off scheduled emails
  let q = db.from("messages").select("*").eq("status", "scheduled").lte("scheduled_at", nowIso()).limit(limit);
  if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
  const { data: due } = await q;
  for (const m of (due ?? []) as Message[]) {
    if (Date.now() > deadline) break;
    const { data: claimed } = await db.from("messages").update({ status: "sending" }).eq("id", m.id).eq("status", "scheduled").select("id");
    if (!claimed?.length) continue;
    const mb = await getMailbox(m.mailbox_id);
    const { data: lead } = await db.from("leads").select("*").eq("id", m.lead_id!).maybeSingle<LeadRow>();
    if (!mb || !lead) {
      await db.from("messages").update({ status: "failed", error: "Mailbox or lead no longer exists" }).eq("id", m.id);
      res.failed++;
      continue;
    }
    if (!(await underCap(mb))) {
      await db.from("messages").update({ status: "scheduled", scheduled_at: new Date(Date.now() + 3600_000).toISOString() }).eq("id", m.id);
      res.deferred++;
      continue;
    }
    const r = await deliver(db, m.id, mb, lead, opts.siteUrl);
    if (r.ok) { res.scheduledSent++; bump(mb); } else { res.failed++; res.errors.push(r.error); }
  }

  // 2) Sequence steps
  let eq = db.from("enrollments").select("*, sequences!inner(*), leads!inner(*)").eq("status", "active").eq("sequences.status", "active").lte("next_run_at", nowIso()).order("next_run_at").limit(limit);
  if (opts.ownerId) eq = eq.eq("owner_id", opts.ownerId);
  if (opts.sequenceId) eq = eq.eq("sequence_id", opts.sequenceId);
  const { data: rows, error } = await eq;
  if (error) res.errors.push(error.message);
  const stepsBySeq = new Map<string, Step[]>();

  for (const row of (rows ?? []) as (Enrollment & { sequences: Sequence; leads: LeadRow })[]) {
    if (Date.now() > deadline) break;
    const e = row, seq = row.sequences, lead = row.leads;
    // Claim with a 10-minute lease so a parallel run can't double-send.
    const lease = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data: claimed } = await db.from("enrollments").update({ next_run_at: lease }).eq("id", e.id).eq("next_run_at", e.next_run_at).eq("status", "active").select("id");
    if (!claimed?.length) continue;
    const set = (patch: Partial<Enrollment>) => db.from("enrollments").update(patch).eq("id", e.id);

    if (!stepsBySeq.has(seq.id)) {
      const { data } = await db.from("sequence_steps").select("*").eq("sequence_id", seq.id).order("position");
      stepsBySeq.set(seq.id, (data ?? []) as Step[]);
    }
    const steps = stepsBySeq.get(seq.id)!;
    const step = steps[e.step_index];
    if (!step) { await set({ status: "completed" }); res.completed++; continue; }
    if (lead.unsubscribed) { await set({ status: "unsubscribed" }); continue; }
    if (lead.email_status === "bounced") { await set({ status: "bounced" }); continue; }
    if (!lead.email) { await set({ status: "failed", last_error: "No email address" }); res.failed++; continue; }

    const now = new Date();
    if (!inWindow(now, seq)) { await set({ next_run_at: nextWindow(now, seq).toISOString() }); res.deferred++; continue; }
    const mb = await getMailbox(seq.mailbox_id);
    if (!mb) { await set({ next_run_at: new Date(Date.now() + 3600_000).toISOString(), last_error: "Connect a mailbox to send this campaign" }); res.deferred++; continue; }
    if (!(await underCap(mb))) { await set({ next_run_at: new Date(Date.now() + 3600_000).toISOString(), last_error: "Daily sending limit reached — continuing later" }); res.deferred++; continue; }

    let subject = step.subject;
    if (!subject.trim() && e.thread_id) {
      const { data: t } = await db.from("threads").select("subject").eq("id", e.thread_id).maybeSingle();
      subject = `Re: ${t?.subject ?? ""}`;
    }
    const r = await sendToLead(db, {
      ownerId: e.owner_id, mailbox: mb, lead, subject: subject || "(no subject)", body: step.body, threadId: e.thread_id,
      sequenceId: seq.id, stepId: step.id, ctx: await getCtx(e.owner_id),
    });
    if (r.ok) {
      bump(mb);
      res.sent++;
      const next = steps[e.step_index + 1];
      if (next) await set({ step_index: e.step_index + 1, thread_id: r.threadId, last_error: null, next_run_at: new Date(Date.now() + Number(next.wait_days) * DAY).toISOString() });
      else { await set({ step_index: e.step_index + 1, thread_id: r.threadId, last_error: null, status: "completed" }); res.completed++; }
    } else {
      res.failed++;
      res.errors.push(r.error);
      if (r.bounced) await set({ status: "bounced", last_error: r.error, thread_id: r.threadId ?? e.thread_id });
      else await set({ last_error: r.error, next_run_at: new Date(Date.now() + 3600_000).toISOString(), thread_id: r.threadId ?? e.thread_id });
    }
  }

  // Sequences with nobody left to email are finished.
  if (opts.sequenceId) {
    const { count } = await db.from("enrollments").select("id", { count: "exact", head: true }).eq("sequence_id", opts.sequenceId).eq("status", "active");
    if (count === 0) {
      const { count: total } = await db.from("enrollments").select("id", { count: "exact", head: true }).eq("sequence_id", opts.sequenceId);
      if ((total ?? 0) > 0) await db.from("sequences").update({ status: "completed" }).eq("id", opts.sequenceId).eq("status", "active");
    }
  }
  return res;
}

/* ───────────────────────── Replies (IMAP) ───────────────────────── */

const BOUNCE_FROM = /mailer-daemon|postmaster|mail delivery (subsystem|system)/i;

/** Strips the quoted history from a reply so the inbox shows just what they wrote. */
export function stripQuoted(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^On .{5,200}wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(l) || /^From:\s.+/.test(l) && out.length > 0) break;
    if (l.startsWith(">")) continue;
    out.push(l);
  }
  return out.join("\n").trim() || text.trim();
}

export type SyncResult = { fetched: number; replies: number; bounces: number; error?: string };

export async function syncMailbox(db: Db, mailbox: Mailbox): Promise<SyncResult> {
  const out: SyncResult = { fetched: 0, replies: 0, bounces: 0 };
  if (!mailbox.imap_host) return out;
  const client = imapClient(credsOf(mailbox));
  let maxUid = Number(mailbox.imap_last_uid) || 0;
  let uidValidity: number | null = mailbox.imap_uidvalidity ? Number(mailbox.imap_uidvalidity) : null;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      const uv = box && typeof box === "object" ? Number(box.uidValidity) : null;
      const fresh = !uidValidity || uv !== uidValidity || !maxUid;
      uidValidity = uv;
      if (fresh) maxUid = 0;
      const prevMax = maxUid;
      const range = fresh ? await client.search({ since: new Date(Date.now() - 7 * DAY) }, { uid: true }) : `${maxUid + 1}:*`;
      if (Array.isArray(range) && !range.length) {
        // nothing new; remember the newest uid so next time we only fetch new mail
        const status = await client.status("INBOX", { uidNext: true });
        maxUid = Math.max(maxUid, Number(status.uidNext ?? 1) - 1);
      } else {
        const parsed: { uid: number; mail: ParsedMail }[] = [];
        for await (const msg of client.fetch(range as string | number[], { uid: true, source: true }, { uid: true })) {
          if (msg.uid <= prevMax) continue; // "n:*" always returns the newest message, even if already seen
          if (!msg.source) continue;
          parsed.push({ uid: msg.uid, mail: await simpleParser(msg.source) });
          if (parsed.length >= 200) break;
        }
        for (const { uid, mail } of parsed) {
          maxUid = Math.max(maxUid, uid);
          out.fetched++;
          const kind = await ingest(db, mailbox, mail);
          if (kind === "reply") out.replies++;
          if (kind === "bounce") out.bounces++;
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await db.from("mailboxes").update({ imap_last_uid: maxUid, imap_uidvalidity: uidValidity, last_sync_at: nowIso(), status: "connected", last_error: null }).eq("id", mailbox.id);
  } catch (e) {
    out.error = friendlyMailError(e);
    try { await client.logout(); } catch {}
    await db.from("mailboxes").update({ last_sync_at: nowIso(), status: "error", last_error: `Reading replies failed: ${out.error}` }).eq("id", mailbox.id);
  }
  return out;
}

async function ingest(db: Db, mailbox: Mailbox, mail: ParsedMail): Promise<"reply" | "bounce" | "skip"> {
  const owner = mailbox.owner_id;
  const from = mail.from?.value?.[0]?.address?.toLowerCase() ?? "";
  const fromName = mail.from?.value?.[0]?.name ?? "";
  if (!from || from === mailbox.from_email.toLowerCase()) return "skip";
  const msgId = mail.messageId ?? null;
  if (msgId) {
    const { data: dup } = await db.from("messages").select("id").eq("owner_id", owner).eq("message_id", msgId).maybeSingle();
    if (dup) return "skip";
  }
  const refs = [mail.inReplyTo, ...(Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : [])].filter(Boolean) as string[];

  // Bounce notifications: find which of our messages failed.
  if (BOUNCE_FROM.test(from) || BOUNCE_FROM.test(fromName)) {
    const hay = `${mail.text ?? ""}\n${refs.join(" ")}`;
    const ids = Array.from(hay.matchAll(/<([0-9a-f-]{36})@[^>]+>/gi)).map((m) => m[1]);
    if (!ids.length) return "skip";
    const { data: hit } = await db.from("messages").select("id, lead_id").eq("owner_id", owner).in("id", ids).limit(1).maybeSingle();
    if (!hit?.lead_id) return "skip";
    await Promise.all([
      db.from("messages").update({ status: "failed", error: "Bounced — address rejected by the recipient's server" }).eq("id", hit.id),
      db.from("leads").update({ email_status: "bounced" }).eq("id", hit.lead_id),
      db.from("enrollments").update({ status: "bounced" }).eq("lead_id", hit.lead_id).eq("status", "active"),
    ]);
    return "bounce";
  }

  // Match to one of our conversations by headers, then by sender.
  let threadId: string | null = null;
  let leadId: string | null = null;
  if (refs.length) {
    const { data: hit } = await db.from("messages").select("thread_id, lead_id").eq("owner_id", owner).in("message_id", refs).limit(1).maybeSingle();
    if (hit) { threadId = hit.thread_id; leadId = hit.lead_id; }
  }
  if (!leadId) {
    const { data: lead } = await db.from("leads").select("id").eq("owner_id", owner).ilike("email", from.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle();
    if (!lead) return "skip"; // not someone in your CRM — leave it in your mailbox
    leadId = lead.id;
  }
  const subject = (mail.subject ?? "").trim() || "(no subject)";
  if (!threadId) {
    const { data: t } = await db.from("threads").select("id").eq("owner_id", owner).eq("lead_id", leadId).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    threadId = t?.id ?? null;
  }
  if (!threadId) {
    const { data: t } = await db.from("threads").insert({ owner_id: owner, lead_id: leadId, subject: subject.replace(/^re:\s*/i, "") }).select("id").single();
    threadId = t!.id;
  }
  const at = (mail.date ?? new Date()).toISOString();
  const text = stripQuoted(mail.text ?? "");
  await db.from("messages").insert({
    owner_id: owner, thread_id: threadId, lead_id: leadId, direction: "in", from_email: from, to_email: mailbox.from_email,
    subject, body_text: text, message_id: msgId, in_reply_to: mail.inReplyTo ?? null, status: "received", sent_at: at, mailbox_id: mailbox.id,
  });
  const { data: lead } = await db.from("leads").select("name, stage").eq("id", leadId).single();
  const { data: stopSeqs } = await db.from("sequences").select("id").eq("owner_id", owner).eq("stop_on_reply", true);
  await Promise.all([
    db.from("threads").update({ unread: true, last_message_at: at, status: "open" }).eq("id", threadId),
    db.from("leads").update({ last_replied_at: at, ...(lead?.stage === "new" ? { stage: "contacted" } : {}) }).eq("id", leadId),
    stopSeqs?.length ? db.from("enrollments").update({ status: "replied" }).eq("lead_id", leadId).eq("status", "active").in("sequence_id", stopSeqs.map((s) => s.id)) : null,
    activity(db, owner, "Closer", `${lead?.name ?? from} replied: “${subject.slice(0, 80)}”`, "Reply"),
  ]);
  return "reply";
}
