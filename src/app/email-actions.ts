"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { encrypt } from "@/lib/server/crypto";
import { credsOf, friendlyMailError, sendMail, verifyCreds } from "@/lib/email/transport";
import { processDue, sendToLead, syncMailbox } from "@/lib/email/engine";
import { buildEmail } from "@/lib/email/render";
import { starterSequence, starterTemplates } from "@/lib/email/starters";
import type { Mailbox, Sequence, Step } from "@/lib/email/types";
import type { FormState } from "./actions";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const int = (f: FormData, k: string, d: number, min: number, max: number) => {
  const n = Number(f.get(k));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Signed-in context: user-scoped Supabase client (RLS applies to every query). */
async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return { db: supabaseServer(), user, business };
}
const done = () => revalidatePath("/app", "layout");

/* ═════════════ Mailboxes ═════════════ */

export async function saveMailboxAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const id = str(f, "id", 64);
  const from_email = str(f, "from_email", 200).toLowerCase();
  const from_name = str(f, "from_name", 100);
  const username = str(f, "username", 200) || from_email;
  const password = String(f.get("password") ?? "");
  const smtp_host = str(f, "smtp_host", 200);
  const smtp_port = int(f, "smtp_port", 465, 1, 65535);
  const smtp_secure = f.get("smtp_secure") === "on" || smtp_port === 465;
  const imap_host = str(f, "imap_host", 200) || null;
  const imap_port = int(f, "imap_port", 993, 1, 65535);
  if (!from_name) return { error: "Add the name people will see (e.g. your name or business)." };
  if (!EMAIL_RE.test(from_email)) return { error: "Enter a valid email address." };
  if (!smtp_host) return { error: "Add your SMTP server (e.g. smtp.gmail.com)." };

  let password_enc: string;
  if (password) password_enc = encrypt(password);
  else if (id) {
    const { data: ex } = await db.from("mailboxes").select("password_enc").eq("id", id).maybeSingle();
    if (!ex) return { error: "Mailbox not found." };
    password_enc = ex.password_enc;
  } else return { error: "Enter the password (or app password) for this mailbox." };

  const row = {
    owner_id: user.id, label: str(f, "label", 60) || "Main mailbox", from_name, from_email, username, password_enc,
    smtp_host, smtp_port, smtp_secure, imap_host, imap_port,
    daily_limit: int(f, "daily_limit", 100, 1, 2000), signature: String(f.get("signature") ?? "").slice(0, 2000) || null,
  };
  const problem = await verifyCreds(credsOf({ ...row, password_enc } as Mailbox));
  if (problem) return { error: problem };

  const q = id
    ? db.from("mailboxes").update({ ...row, status: "connected", last_error: null }).eq("id", id).select("*").single()
    : db.from("mailboxes").insert({ ...row, status: "connected" }).select("*").single();
  const { data: mb, error } = await q;
  if (error || !mb) return { error: error?.message ?? "Couldn't save the mailbox." };
  // Baseline: read the last week of replies right away.
  if (mb.imap_host) await syncMailbox(db, mb as Mailbox);
  await db.from("sequences").update({ mailbox_id: mb.id }).eq("owner_id", user.id).is("mailbox_id", null);
  done();
  return { ok: true, message: `Connected ${from_email}. Emails will send from this address and replies will show in your Inbox.` };
}

export async function deleteMailboxAction(id: string) {
  const { db } = await me();
  await db.from("mailboxes").delete().eq("id", id);
  done();
}

export async function sendTestEmailAction(id: string): Promise<FormState> {
  const { db, business } = await me();
  const { data: mb } = await db.from("mailboxes").select("*").eq("id", id).maybeSingle<Mailbox>();
  if (!mb) return { error: "Mailbox not found." };
  const { text, html } = buildEmail({ body: `This is a test from Growvia${business ? ` for ${business.name}` : ""}.\n\nIf you're reading this, sending works. Replies to your campaigns will appear in your Growvia Inbox.`, signature: mb.signature, messageId: crypto.randomUUID(), siteUrl: siteOrigin(), track: false, unsubscribe: false });
  try {
    await sendMail(credsOf(mb), { from: { name: mb.from_name, address: mb.from_email }, to: mb.from_email, subject: "Growvia test email ✓", text, html, messageId: `<${crypto.randomUUID()}@${mb.from_email.split("@")[1]}>` });
    return { ok: true, message: `Test email sent to ${mb.from_email}. Check your inbox.` };
  } catch (e) {
    return { error: friendlyMailError(e) };
  }
}

/** Reads new replies and sends anything due for this account. Called when you open the Inbox. */
export async function syncNowAction(): Promise<{ replies: number; sent: number; error?: string }> {
  const { db, user } = await me();
  const { data: boxes } = await db.from("mailboxes").select("*");
  let replies = 0;
  let error: string | undefined;
  for (const m of (boxes ?? []) as Mailbox[]) {
    const r = await syncMailbox(db, m);
    replies += r.replies;
    if (r.error) error = r.error;
  }
  const sent = await processDue(db, { siteUrl: siteOrigin(), ownerId: user.id, limit: 20 });
  if (replies || sent.sent || sent.scheduledSent) done();
  return { replies, sent: sent.sent + sent.scheduledSent, error };
}

/* ═════════════ Templates ═════════════ */

export async function saveTemplateAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const id = str(f, "id", 64);
  const name = str(f, "name", 100);
  const subject = str(f, "subject", 200);
  const body = String(f.get("body") ?? "").slice(0, 10000);
  if (!name) return { error: "Give the template a name." };
  if (!subject) return { error: "Add a subject line." };
  if (!body.trim()) return { error: "Write the email body." };
  const row = { owner_id: user.id, name, subject, body, category: str(f, "category", 40) || "General", updated_at: new Date().toISOString() };
  const { error } = id ? await db.from("email_templates").update(row).eq("id", id) : await db.from("email_templates").insert(row);
  if (error) return { error: error.message };
  done();
  return { ok: true, message: id ? "Template saved." : "Template created." };
}

export async function deleteTemplateAction(id: string) {
  const { db } = await me();
  await db.from("email_templates").delete().eq("id", id);
  done();
}

export async function duplicateTemplateAction(id: string) {
  const { db, user } = await me();
  const { data: t } = await db.from("email_templates").select("*").eq("id", id).maybeSingle();
  if (t) await db.from("email_templates").insert({ owner_id: user.id, name: `${t.name} (copy)`, subject: t.subject, body: t.body, category: t.category });
  done();
}

/** Seeds a starter library the first time someone opens Templates. */
export async function ensureStarterTemplates() {
  const { db, user, business } = await me();
  const { count } = await db.from("email_templates").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;
  await db.from("email_templates").insert(starterTemplates(business?.segment ?? "restaurant").map((t) => ({ ...t, owner_id: user.id })));
}

/* ═════════════ Sequences (email campaigns) ═════════════ */

export async function createSequenceAction(f: FormData) {
  const { db, user, business } = await me();
  const name = str(f, "name", 100) || "New email campaign";
  const templateId = str(f, "template", 64);
  const { data: mb } = await db.from("mailboxes").select("id").order("created_at").limit(1).maybeSingle();
  const { data: seq, error } = await db.from("sequences").insert({ owner_id: user.id, name, mailbox_id: mb?.id ?? null }).select("id").single();
  if (error || !seq) throw new Error(error?.message ?? "Couldn't create the campaign");
  let steps = starterSequence(business?.segment ?? "restaurant");
  if (templateId) {
    const { data: t } = await db.from("email_templates").select("subject, body").eq("id", templateId).maybeSingle();
    if (t) steps = [{ wait_days: 0, subject: t.subject, body: t.body }, ...steps.slice(1)];
  }
  await db.from("sequence_steps").insert(steps.map((s, i) => ({ ...s, owner_id: user.id, sequence_id: seq.id, position: i })));
  done();
  redirect(`/app/email/${seq.id}`);
}

export async function updateSequenceAction(_: FormState, f: FormData): Promise<FormState> {
  const { db } = await me();
  const id = str(f, "id", 64);
  const days = f.getAll("send_days").map(Number).filter((n) => n >= 0 && n <= 6);
  const start = int(f, "send_start", 9, 0, 23);
  const end = int(f, "send_end", 18, 1, 24);
  if (end <= start) return { error: "The sending window must end after it starts." };
  if (!days.length) return { error: "Pick at least one sending day." };
  const { error } = await db.from("sequences").update({
    name: str(f, "name", 100) || "Email campaign",
    mailbox_id: str(f, "mailbox_id", 64) || null,
    stop_on_reply: f.get("stop_on_reply") === "on",
    send_days: days, send_start: start, send_end: end,
    timezone: str(f, "timezone", 60) || "Asia/Kolkata",
  }).eq("id", id);
  if (error) return { error: error.message };
  done();
  return { ok: true, message: "Settings saved." };
}

export async function saveStepAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const id = str(f, "id", 64);
  const sequence_id = str(f, "sequence_id", 64);
  const body = String(f.get("body") ?? "").slice(0, 10000);
  const subject = str(f, "subject", 200);
  const wait = Math.max(0, Math.min(90, Number(f.get("wait_days") ?? 0) || 0));
  if (!body.trim()) return { error: "Write the email." };
  if (id) {
    const { error } = await db.from("sequence_steps").update({ subject, body, wait_days: wait }).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { count } = await db.from("sequence_steps").select("id", { count: "exact", head: true }).eq("sequence_id", sequence_id);
    const { error } = await db.from("sequence_steps").insert({ owner_id: user.id, sequence_id, position: count ?? 0, subject, body, wait_days: wait || 3 });
    if (error) return { error: error.message };
  }
  done();
  return { ok: true, message: "Saved" };
}

async function renumber(db: ReturnType<typeof supabaseServer>, sequenceId: string, ordered: Step[]) {
  await Promise.all(ordered.map((s, i) => (s.position === i ? null : db.from("sequence_steps").update({ position: i }).eq("id", s.id))));
}

export async function deleteStepAction(id: string, sequenceId: string) {
  const { db } = await me();
  await db.from("sequence_steps").delete().eq("id", id);
  const { data } = await db.from("sequence_steps").select("*").eq("sequence_id", sequenceId).order("position");
  await renumber(db, sequenceId, (data ?? []) as Step[]);
  done();
}

export async function moveStepAction(id: string, sequenceId: string, dir: -1 | 1) {
  const { db } = await me();
  const { data } = await db.from("sequence_steps").select("*").eq("sequence_id", sequenceId).order("position");
  const list = (data ?? []) as Step[];
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await renumber(db, sequenceId, list);
  done();
}

export async function enrollAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const sequenceId = str(f, "sequence_id", 64);
  const mode = str(f, "mode", 20);
  let q = db.from("leads").select("id, email, unsubscribed, email_status, tags, stage").not("email", "is", null);
  if (mode === "tag") q = q.contains("tags", [str(f, "tag", 60)]);
  if (mode === "stage") q = q.in("stage", f.getAll("stages").map(String));
  if (mode === "ids") q = q.in("id", String(f.get("ids") ?? "").split(",").filter(Boolean));
  const { data: leads, error } = await q;
  if (error) return { error: error.message };
  const ok = (leads ?? []).filter((l) => l.email && !l.unsubscribed && l.email_status !== "bounced");
  if (!ok.length) return { error: "No matching leads with a valid email (unsubscribed and bounced leads are skipped)." };
  const { data: seq } = await db.from("sequences").select("status").eq("id", sequenceId).single();
  const { data: ins, error: e2 } = await db.from("enrollments")
    .upsert(ok.map((l) => ({ owner_id: user.id, sequence_id: sequenceId, lead_id: l.id })), { onConflict: "sequence_id,lead_id", ignoreDuplicates: true })
    .select("id");
  if (e2) return { error: e2.message };
  if (seq?.status === "active") await processDue(db, { siteUrl: siteOrigin(), ownerId: user.id, sequenceId, limit: 25 });
  done();
  const skipped = (leads?.length ?? 0) - ok.length;
  return { ok: true, message: `Added ${ins?.length ?? 0} lead${ins?.length === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped: unsubscribed or bounced)` : ""}.` };
}

export async function launchSequenceAction(id: string): Promise<FormState> {
  const { db, user } = await me();
  const [{ data: seq }, { count: steps }, { count: people }] = await Promise.all([
    db.from("sequences").select("*").eq("id", id).single<Sequence>(),
    db.from("sequence_steps").select("id", { count: "exact", head: true }).eq("sequence_id", id),
    db.from("enrollments").select("id", { count: "exact", head: true }).eq("sequence_id", id),
  ]);
  if (!seq) return { error: "Campaign not found." };
  if (!seq.mailbox_id) return { error: "Connect a mailbox first (Settings → Email sending), then choose it in this campaign's settings." };
  if (!steps) return { error: "Add at least one email." };
  if (!people) return { error: "Add some leads to this campaign first." };
  await db.from("sequences").update({ status: "active" }).eq("id", id);
  // Nudge paused enrollments that were waiting.
  const r = await processDue(db, { siteUrl: siteOrigin(), ownerId: user.id, sequenceId: id, limit: 25 });
  await db.from("activity").insert({ owner_id: user.id, agent: "Distributor", text: `Launched email campaign “${seq.name}” — ${r.sent} sent now${r.deferred ? `, ${r.deferred} scheduled for the next sending window` : ""}.`, tag: "Live" });
  done();
  return { ok: true, message: r.sent ? `Live — ${r.sent} email${r.sent === 1 ? "" : "s"} sent.` : r.deferred ? "Live — emails will go out in your next sending window." : r.errors[0] ? `Live, but: ${r.errors[0]}` : "Live." };
}

export async function setSequenceStatusAction(id: string, status: "paused" | "active" | "draft") {
  const { db, user } = await me();
  await db.from("sequences").update({ status }).eq("id", id);
  if (status === "active") await processDue(db, { siteUrl: siteOrigin(), ownerId: user.id, sequenceId: id, limit: 25 });
  done();
}

export async function deleteSequenceAction(id: string) {
  const { db } = await me();
  await db.from("sequences").delete().eq("id", id);
  done();
  redirect("/app/email");
}

export async function stopEnrollmentAction(id: string) {
  const { db } = await me();
  await db.from("enrollments").update({ status: "stopped" }).eq("id", id).eq("status", "active");
  done();
}

/* ═════════════ Inbox ═════════════ */

async function firstMailbox(db: ReturnType<typeof supabaseServer>, preferred?: string | null) {
  if (preferred) {
    const { data } = await db.from("mailboxes").select("*").eq("id", preferred).maybeSingle<Mailbox>();
    if (data) return data;
  }
  const { data } = await db.from("mailboxes").select("*").order("created_at").limit(1).maybeSingle<Mailbox>();
  return data ?? null;
}

async function ctx(db: ReturnType<typeof supabaseServer>, userId: string) {
  const site = siteOrigin();
  const [{ data: b }, { data: bp }] = await Promise.all([
    db.from("businesses").select("name, city").eq("owner_id", userId).maybeSingle(),
    db.from("booking_pages").select("slug, active").maybeSingle(),
  ]);
  return { siteUrl: site, businessName: b?.name ?? "", city: b?.city ?? null, bookingLink: bp?.active ? `${site}/book/${bp.slug}` : null };
}

export async function replyAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const threadId = str(f, "thread_id", 64);
  const body = String(f.get("body") ?? "").slice(0, 10000);
  if (!body.trim()) return { error: "Write your reply." };
  const { data: t } = await db.from("threads").select("*, leads(*)").eq("id", threadId).maybeSingle();
  if (!t?.leads) return { error: "Conversation not found." };
  const { data: lastIn } = await db.from("messages").select("mailbox_id").eq("thread_id", threadId).not("mailbox_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const mb = await firstMailbox(db, lastIn?.mailbox_id);
  if (!mb) return { error: "Connect a mailbox in Settings to reply from Growvia." };
  const r = await sendToLead(db, { ownerId: user.id, mailbox: mb, lead: t.leads, subject: `Re: ${t.subject}`, body, threadId, ctx: await ctx(db, user.id) });
  if (!r.ok) return { error: r.error };
  await db.from("threads").update({ unread: false }).eq("id", threadId);
  done();
  return { ok: true, message: "Sent" };
}

export async function composeAction(_: FormState, f: FormData): Promise<FormState> {
  const { db, user } = await me();
  const leadId = str(f, "lead_id", 64);
  const subject = str(f, "subject", 200);
  const body = String(f.get("body") ?? "").slice(0, 10000);
  const when = str(f, "schedule_at", 40);
  if (!subject) return { error: "Add a subject." };
  if (!body.trim()) return { error: "Write your email." };
  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "Lead not found." };
  const mb = await firstMailbox(db, str(f, "mailbox_id", 64) || null);
  if (!mb) return { error: "Connect a mailbox in Settings first." };
  const scheduledAt = when ? new Date(when).toISOString() : null;
  const r = await sendToLead(db, { ownerId: user.id, mailbox: mb, lead, subject, body, scheduledAt, ctx: await ctx(db, user.id) });
  if (!r.ok) return { error: r.error };
  done();
  return { ok: true, message: r.scheduled ? `Scheduled for ${new Date(scheduledAt!).toLocaleString()}.` : `Sent to ${lead.email}.` };
}

export async function markThreadAction(id: string, patch: { unread?: boolean; status?: "open" | "closed" }) {
  const { db } = await me();
  await db.from("threads").update(patch).eq("id", id);
  done();
}

export async function cancelScheduledAction(messageId: string) {
  const { db } = await me();
  await db.from("messages").delete().eq("id", messageId).eq("status", "scheduled");
  done();
}

/* ═════════════ Leads: import, tags, bulk ═════════════ */

type ImportRow = { name?: string; email?: string; phone?: string; company?: string; tags?: string; notes?: string; value?: string };

export async function importLeadsAction(rows: ImportRow[], tag: string): Promise<FormState> {
  const { db, user, business } = await me();
  if (!business) return { error: "Finish setting up your business first." };
  if (!Array.isArray(rows) || !rows.length) return { error: "No rows found in the file." };
  if (rows.length > 5000) return { error: "Import up to 5,000 leads at a time." };
  const { data: existing } = await db.from("leads").select("email");
  const seen = new Set((existing ?? []).map((l) => (l.email ?? "").toLowerCase()).filter(Boolean));
  const extraTag = tag.trim().slice(0, 40);
  const clean = [];
  let skipped = 0;
  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    const name = (r.name ?? "").trim() || email.split("@")[0];
    if (!name || (email && !EMAIL_RE.test(email)) || (email && seen.has(email))) { skipped++; continue; }
    if (email) seen.add(email);
    const tags = [...new Set([...(r.tags ?? "").split(/[;,|]/).map((t) => t.trim()).filter(Boolean), ...(extraTag ? [extraTag] : [])])].slice(0, 10);
    clean.push({
      owner_id: user.id, business_id: business.id, name: name.slice(0, 120), email: email || null, phone: (r.phone ?? "").slice(0, 40) || null,
      company: (r.company ?? "").slice(0, 120) || null, notes: (r.notes ?? "").slice(0, 2000) || null, source: "import", stage: "new",
      value: Number(r.value) > 0 ? Number(r.value) : 0, tags,
    });
  }
  for (let i = 0; i < clean.length; i += 500) {
    const { error } = await db.from("leads").insert(clean.slice(i, i + 500));
    if (error) return { error: error.message };
  }
  if (clean.length) await db.from("activity").insert({ owner_id: user.id, agent: "Lead Finder", text: `Imported ${clean.length} leads${extraTag ? ` tagged “${extraTag}”` : ""}.`, tag: `+${clean.length} leads` });
  done();
  return { ok: true, message: `Imported ${clean.length} lead${clean.length === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped} (duplicates or invalid emails)` : ""}.` };
}

export async function bulkLeadsAction(ids: string[], op: "tag" | "untag" | "stage" | "delete" | "wa_opt_in", value = ""): Promise<FormState> {
  const { db } = await me();
  if (!ids.length) return { error: "Select some leads first." };
  if (op === "delete") {
    await db.from("leads").delete().in("id", ids);
  } else if (op === "wa_opt_in") {
    await db.from("leads").update({ wa_opt_in: value !== "off" }).in("id", ids);
  } else if (op === "stage") {
    await db.from("leads").update({ stage: value }).in("id", ids);
  } else {
    const { data } = await db.from("leads").select("id, tags").in("id", ids);
    const t = value.trim().slice(0, 40);
    if (!t) return { error: "Enter a tag." };
    await Promise.all((data ?? []).map((l) => db.from("leads").update({ tags: op === "tag" ? [...new Set([...(l.tags ?? []), t])] : (l.tags ?? []).filter((x: string) => x !== t) }).eq("id", l.id)));
  }
  done();
  return { ok: true, message: `Updated ${ids.length} lead${ids.length === 1 ? "" : "s"}.` };
}

export async function setLeadTagsAction(id: string, tags: string[]) {
  const { db } = await me();
  await db.from("leads").update({ tags: [...new Set(tags.map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20) }).eq("id", id);
  done();
}

export async function resubscribeLeadAction(id: string) {
  const { db } = await me();
  await db.from("leads").update({ unsubscribed: false, email_status: "ok" }).eq("id", id);
  done();
}
