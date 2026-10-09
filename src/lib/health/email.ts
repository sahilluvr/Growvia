import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Mailbox } from "../email/types";
import type { DomainReport } from "./domain";
import type { PmDay } from "../google/postmaster";

/* Mailbox health: real delivery numbers + domain setup + Gmail's own view → a score, plain-English reasons,
   a safe warm-up (gradual daily limit), and automatic pausing before a mailbox gets burned. */

type Db = SupabaseClient;
const DAY = 86_400_000;

export type Warmup = { enabled?: boolean; started_at?: string; start?: number; step?: number };
export type Reason = { level: "bad" | "warn" | "info"; text: string; fix?: { label: string; href: string } };
/** sentN = emails that went out; triedN = sent + rejected on the spot (bounce rates use tried). */
export type Stats = { sent7: number; sent30: number; bounced7: number; bounced30: number; replies30: number; unsubs30: number; failed7: number; sent24: number; bounced24: number; tried7: number; tried30: number; tried24: number };
export type Health = {
  score: number; status: "good" | "watch" | "risk" | "new"; reasons: Reason[]; stats: Stats; checked_at: string;
  paused?: boolean; paused_reason?: string | null; paused_at?: string | null; resumed_at?: string | null;
  domain?: string; domainScore?: number | null; reputation?: string | null; spamRate?: number | null;
};
export type MailboxH = Mailbox & { warmup?: Warmup | null; health?: Partial<Health> | null };

export const WARMUP_PRESETS = {
  new: { start: 10, step: 3, label: "New mailbox or domain", desc: "Starts at 10 emails a day and adds 3 a day" },
  steady: { start: 25, step: 5, label: "Already used for normal email", desc: "Starts at 25 a day and adds 5 a day" },
} as const;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

/** Today's warm-up limit, where the ramp is, and when it reaches the full daily limit. */
export function warmupPlan(mb: Pick<MailboxH, "daily_limit" | "warmup">, now = Date.now()) {
  const w = mb.warmup ?? {};
  if (!w.enabled || !w.started_at) return { active: false, limit: mb.daily_limit, day: 0, target: mb.daily_limit, doneOn: null as string | null };
  const start = Math.max(1, w.start ?? 10), step = Math.max(1, w.step ?? 3), target = mb.daily_limit;
  const day = Math.max(1, Math.floor((now - new Date(w.started_at).getTime()) / DAY) + 1);
  const limit = Math.min(target, start + step * (day - 1));
  const daysLeft = Math.max(0, Math.ceil((target - start) / step) - (day - 1));
  return { active: limit < target, limit, day, target, doneOn: daysLeft ? new Date(now + daysLeft * DAY).toISOString().slice(0, 10) : null };
}

/** How many emails the scheduler may send from this mailbox in 24 hours right now. */
export function effectiveLimit(mb: MailboxH) {
  if (mb.health?.paused) return { limit: 0, why: `Paused to protect your sender reputation: ${mb.health.paused_reason ?? "delivery problems"}. Open Sending health to fix and resume.` };
  const w = warmupPlan(mb);
  if (w.active && (mb.health?.status === "watch" || mb.health?.status === "risk")) {
    // Warm-up holds (and eases back) while bounce or spam numbers are high.
    const start = mb.warmup?.start ?? 10;
    return { limit: Math.max(start, Math.round(w.limit * 0.7)), why: "Warm-up is holding while your delivery numbers recover — continuing later." };
  }
  return { limit: w.limit, why: w.active ? `Warm-up: day ${w.day}, up to ${w.limit} emails today — continuing tomorrow.` : "Daily sending limit reached — continuing later." };
}

export async function mailboxStats(db: Db, mailboxId: string): Promise<Stats> {
  const since = (d: number) => new Date(Date.now() - d * DAY).toISOString();
  const c = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const out = () => db.from("messages").select("id", { count: "exact", head: true }).eq("mailbox_id", mailboxId).eq("direction", "out");
  const [sent7, sent30, sent24, bounced7, bounced30, bounced24, unsubs30, failed7, replies30, rej7, rej30, rej24] = await Promise.all([
    c(out().not("sent_at", "is", null).gte("sent_at", since(7))),
    c(out().not("sent_at", "is", null).gte("sent_at", since(30))),
    c(out().not("sent_at", "is", null).gte("sent_at", since(1))),
    c(out().not("bounced_at", "is", null).gte("bounced_at", since(7))),
    c(out().not("bounced_at", "is", null).gte("bounced_at", since(30))),
    c(out().not("bounced_at", "is", null).gte("bounced_at", since(1))),
    c(out().not("unsubscribed_at", "is", null).gte("unsubscribed_at", since(30))),
    c(out().eq("status", "failed").is("bounced_at", null).gte("created_at", since(7))),
    c(db.from("messages").select("id", { count: "exact", head: true }).eq("mailbox_id", mailboxId).eq("direction", "in").gte("sent_at", since(30))),
    c(out().is("sent_at", null).gte("bounced_at", since(7))),
    c(out().is("sent_at", null).gte("bounced_at", since(30))),
    c(out().is("sent_at", null).gte("bounced_at", since(1))),
  ]);
  return { sent7, sent30, sent24, bounced7, bounced30, bounced24, unsubs30, failed7, replies30, tried7: sent7 + rej7, tried30: sent30 + rej30, tried24: sent24 + rej24 };
}

/** Pure scoring — used by the page and by the scheduler. */
export function assess(mb: MailboxH, s: Stats, domain?: DomainReport | null, pm?: PmDay[] | null): Health {
  const reasons: Reason[] = [];
  let score = 100;
  const hit = (n: number, r: Reason) => { score -= n; reasons.push(r); };
  const b7 = pct(s.bounced7, s.tried7), b30 = pct(s.bounced30, s.tried30);
  const u30 = pct(s.unsubs30, s.sent30), r30 = pct(s.replies30, s.sent30);
  if (mb.status !== "connected") hit(25, { level: "bad", text: `Growvia can't log in to this mailbox${mb.last_error ? ` (${mb.last_error})` : ""}.`, fix: { label: "Fix mailbox", href: "/app/settings?tab=email" } });
  if (s.tried7 >= 10 && b7 >= 5) hit(35, { level: "bad", text: `${b7}% of emails bounced this week (keep it under 2%). Your list has old or wrong addresses.`, fix: { label: "Clean your list", href: "/app/health?tab=email#list" } });
  else if (s.tried7 >= 10 && b7 >= 2) hit(15, { level: "warn", text: `${b7}% bounce rate this week — a bit high (aim for under 2%).`, fix: { label: "Clean your list", href: "/app/health?tab=email#list" } });
  else if (s.tried30 >= 30 && b30 >= 3) hit(10, { level: "warn", text: `${b30}% of emails bounced in the last 30 days.`, fix: { label: "Clean your list", href: "/app/health?tab=email#list" } });
  if (s.sent30 >= 50 && u30 >= 2) hit(15, { level: "warn", text: `${u30}% of people unsubscribed in 30 days — a sign emails feel unwanted. Send to people who asked to hear from you, less often.` });
  if (s.failed7 >= 5) hit(10, { level: "warn", text: `${s.failed7} emails failed to send this week (not bounces) — check the mailbox connection.`, fix: { label: "Open mailbox", href: "/app/settings?tab=email" } });
  const last = [...(pm ?? [])].reverse().find((d) => d.reputation || d.spamRate != null);
  const spam = last?.spamRate ?? null, rep = last?.reputation ?? null;
  if (spam != null && spam >= 0.003) hit(40, { level: "bad", text: `Gmail users marked ${(spam * 100).toFixed(2)}% of your emails as spam — Google's limit is 0.3%. Stop sending to people who don't engage.` });
  else if (spam != null && spam >= 0.001) hit(15, { level: "warn", text: `Spam complaints at ${(spam * 100).toFixed(2)}% on Gmail (keep under 0.1%).` });
  if (rep === "BAD") hit(45, { level: "bad", text: "Gmail rates your domain reputation BAD — most of your emails go to spam." });
  else if (rep === "LOW") hit(25, { level: "warn", text: "Gmail rates your domain reputation LOW — many emails go to spam." });
  if (domain && !domain.free) {
    for (const c of domain.checks) {
      if (c.status === "bad") hit(c.id === "blocklist" ? 30 : c.id === "dmarc" ? 10 : 15, { level: c.id === "blocklist" ? "bad" : "warn", text: `${c.title}: ${c.detail}`, fix: { label: "Fix in Domains", href: `/app/health?tab=domains&d=${domain.domain}` } });
      else if (c.status === "warn") hit(5, { level: "warn", text: `${c.title}: ${c.detail}`, fix: { label: "Details", href: `/app/health?tab=domains&d=${domain.domain}` } });
    }
  } else if (domain?.free) hit(10, { level: "warn", text: domain.checks[0].detail });
  const w = warmupPlan(mb);
  if (!w.active && !mb.warmup?.enabled && s.sent30 < 30 && mb.daily_limit > 50 && !(domain?.free)) reasons.push({ level: "info", text: "This mailbox has little sending history. Turn on warm-up so volume grows gradually.", fix: { label: "Turn on warm-up", href: "/app/health?tab=email" } });
  if (s.sent30 >= 20 && r30 >= 5) reasons.push({ level: "info", text: `${r30}% of people reply — great engagement, which inboxes reward.` });
  score = Math.max(0, Math.min(100, score));
  const status: Health["status"] = s.tried30 === 0 && !reasons.some((r) => r.level === "bad") ? "new" : score >= 80 ? "good" : score >= 60 ? "watch" : "risk";
  return { score, status, reasons, stats: s, checked_at: new Date().toISOString(), domain: domain?.domain, domainScore: domain?.score ?? null, reputation: rep, spamRate: spam };
}

/** When to stop sending automatically (only with enough volume to be sure, and not right after a manual resume). */
export function shouldPause(mb: MailboxH, h: Health): string | null {
  if (mb.health?.paused) return null;
  const resumed = mb.health?.resumed_at ? Date.now() - new Date(mb.health.resumed_at).getTime() < 2 * DAY : false;
  if (resumed) return null;
  const s = h.stats;
  if (s.tried24 >= 20 && s.bounced24 / s.tried24 >= 0.1) return `${Math.round((s.bounced24 / s.tried24) * 100)}% of emails bounced in the last 24 hours`;
  if (s.tried7 >= 30 && s.bounced7 / s.tried7 >= 0.08) return `${Math.round((s.bounced7 / s.tried7) * 100)}% of emails bounced this week`;
  if (h.spamRate != null && h.spamRate >= 0.003) return `Gmail spam complaints reached ${(h.spamRate * 100).toFixed(2)}%`;
  if (h.reputation === "BAD") return "Gmail rates your domain reputation BAD";
  return null;
}
