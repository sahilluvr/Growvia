import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../server/crypto";
import { accessFromRefresh } from "../google/gsc";
import { pmStats, type PmDay } from "../google/postmaster";
import { notify } from "../notify";
import type { ChannelAccount } from "../meta/channels";
import { checkDomain, domainOf, type DomainReport } from "./domain";
import { assess, mailboxStats, shouldPause, type Health, type MailboxH } from "./email";
import { refreshWaHealth } from "./whatsapp";

type Db = SupabaseClient;
const H = 3600_000;
const old = (iso: string | null | undefined, hours: number) => !iso || Date.now() - new Date(iso).getTime() > hours * H;

type DomainRow = { id: string; owner_id: string; domain: string; checks: DomainReport | Record<string, never>; postmaster: { days?: PmDay[]; at?: string; error?: string | null } | null; checked_at: string | null };

/** The latest DNS/blocklist report for a domain (re-checked when older than `maxAgeH`). Alerts when something that worked breaks. */
export async function domainReport(db: Db, ownerId: string, domain: string, smtpHost?: string | null, maxAgeH = 20): Promise<{ report: DomainReport; row: DomainRow }> {
  const { data } = await db.from("sender_domains").select("*").eq("owner_id", ownerId).eq("domain", domain).maybeSingle<DomainRow>();
  if (data && !old(data.checked_at, maxAgeH) && (data.checks as DomainReport).checks) return { report: data.checks as DomainReport, row: data };
  const report = await checkDomain(domain, { smtpHost });
  const prev = (data?.checks as DomainReport | undefined)?.checks ?? [];
  const broke = report.checks.filter((c) => c.status === "bad" && prev.find((p) => p.id === c.id)?.status === "ok");
  const { data: row } = await db.from("sender_domains").upsert({ owner_id: ownerId, domain, checks: report, checked_at: report.at }, { onConflict: "owner_id,domain" }).select("*").single<DomainRow>();
  if (broke.length) {
    await notify({ ownerId, type: "health", subject: `${domain}: ${broke.map((b) => b.title).join(", ")}`, title: `Something changed on ${domain}`, body: broke.map((b) => `${b.title} — ${b.detail}`).join("\n\n"), cta: { label: "Fix it", url: `/app/health?tab=domains&d=${domain}` }, dedupe: `dom:${domain}:${broke.map((b) => b.id).join(",")}:${report.at.slice(0, 10)}` }).catch(() => null);
  }
  return { report, row: (row ?? data) as DomainRow };
}

/** Recomputes a mailbox's health, pauses it when needed, and alerts the team. */
export async function refreshMailboxHealth(db: Db, mb: MailboxH, opts: { domainMaxAgeH?: number } = {}) {
  const domain = domainOf(mb.from_email);
  const d = domain ? await domainReport(db, mb.owner_id, domain, mb.smtp_host, opts.domainMaxAgeH ?? 20).catch(() => null) : null;
  const stats = await mailboxStats(db, mb.id);
  const h = assess(mb, stats, d?.report ?? null, d?.row.postmaster?.days ?? null);
  return save(db, mb, h);
}

async function save(db: Db, mb: MailboxH, h: Health) {
  const prev = mb.health ?? {};
  const pauseWhy = shouldPause(mb, h);
  const next: Health = { ...h, paused: pauseWhy ? true : Boolean(prev.paused), paused_reason: pauseWhy ?? prev.paused_reason ?? null, paused_at: pauseWhy ? new Date().toISOString() : prev.paused_at ?? null, resumed_at: prev.resumed_at ?? null };
  await db.from("mailboxes").update({ health: next }).eq("id", mb.id);
  if (pauseWhy) {
    await db.from("activity").insert({ owner_id: mb.owner_id, agent: "Guardian", text: `Paused campaigns from ${mb.from_email}: ${pauseWhy}.`, tag: "Paused" });
    await notify({ ownerId: mb.owner_id, type: "health", subject: `Campaigns from ${mb.from_email} are paused`, title: "We paused your campaigns to protect your email", body: `${pauseWhy}. Sending more now could get ${mb.from_email} blocked or sent to spam for weeks.\n\nWhat to do: remove bad addresses (Sending health → Check your contact list), then resume. One-to-one emails from the Inbox still work.`, cta: { label: "Review and resume", url: "/app/health?tab=email" }, dedupe: `pause:${mb.id}:${next.paused_at?.slice(0, 13)}` }).catch(() => null);
  } else if (prev.status === "good" && next.status === "risk") {
    await notify({ ownerId: mb.owner_id, type: "health", subject: `${mb.from_email} needs attention`, title: `Email health dropped to ${next.score}/100`, body: next.reasons.filter((r) => r.level !== "info").map((r) => `• ${r.text}`).join("\n"), cta: { label: "Open Sending health", url: "/app/health?tab=email" }, dedupe: `risk:${mb.id}:${new Date().toISOString().slice(0, 10)}` }).catch(() => null);
  }
  return next;
}

/** Fast check after each sending run: pause straight away if bounces spike mid-campaign. */
export async function guardMailbox(db: Db, mailboxId: string) {
  const { data: mb } = await db.from("mailboxes").select("*").eq("id", mailboxId).maybeSingle<MailboxH>();
  if (!mb || mb.health?.paused) return;
  const stats = await mailboxStats(db, mb.id);
  if (stats.bounced24 < 2) return;
  const h = assess(mb, stats, null, null);
  if (shouldPause(mb, h)) await save(db, mb, { ...(mb.health as Health), ...h, reasons: h.reasons.length ? h.reasons : (mb.health?.reasons ?? []) });
}

/** Gmail Postmaster data for every domain the connected Google account can see. */
export async function refreshPostmaster(db: Db, ownerId: string) {
  const { data: link } = await db.from("postmaster_links").select("*").eq("owner_id", ownerId).maybeSingle();
  if (!link) return { ok: false as const, error: "Connect Gmail Postmaster Tools first." };
  let access: string;
  try { access = await accessFromRefresh(decrypt(link.refresh_enc)); } catch {
    await db.from("postmaster_links").update({ error: "Google access expired — connect Postmaster Tools again." }).eq("owner_id", ownerId);
    return { ok: false as const, error: "Google access expired — connect Postmaster Tools again." };
  }
  const { data: doms } = await db.from("sender_domains").select("id, domain").eq("owner_id", ownerId);
  let n = 0;
  for (const d of doms ?? []) {
    if (!link.domains.includes(d.domain)) { await db.from("sender_domains").update({ postmaster: { days: [], at: new Date().toISOString(), error: "not verified" } }).eq("id", d.id); continue; }
    try {
      const days = await pmStats(access, d.domain);
      await db.from("sender_domains").update({ postmaster: { days, at: new Date().toISOString(), error: null } }).eq("id", d.id);
      n++;
    } catch (e) {
      await db.from("sender_domains").update({ postmaster: { days: [], at: new Date().toISOString(), error: e instanceof Error ? e.message : "Postmaster error" } }).eq("id", d.id);
    }
  }
  await db.from("postmaster_links").update({ synced_at: new Date().toISOString(), error: null }).eq("owner_id", ownerId);
  return { ok: true as const, domains: n };
}

/** Daily background health checks: mailboxes (+ their domains, Gmail data) and WhatsApp numbers. */
export async function runHealthJobs(db: Db, deadline: number) {
  const out = { mailboxes: 0, numbers: 0, postmaster: 0 };
  const { data: links } = await db.from("postmaster_links").select("owner_id, synced_at").limit(200);
  for (const l of links ?? []) {
    if (Date.now() > deadline) break;
    if (old(l.synced_at, 20)) { const r = await refreshPostmaster(db, l.owner_id).catch(() => null); if (r?.ok) out.postmaster++; }
  }
  const { data: mbs } = await db.from("mailboxes").select("*").limit(300);
  for (const mb of (mbs ?? []) as MailboxH[]) {
    if (Date.now() > deadline) break;
    if (!old(mb.health?.checked_at, 20)) continue;
    await refreshMailboxHealth(db, mb).catch(() => null);
    out.mailboxes++;
  }
  const { data: nums } = await db.from("channel_accounts").select("*").eq("provider", "whatsapp").limit(200);
  for (const acc of (nums ?? []) as ChannelAccount[]) {
    if (Date.now() > deadline) break;
    const prevH = acc.meta?.health as { checked_at?: string; quality?: string } | undefined;
    if (!old(prevH?.checked_at, 20)) continue;
    const { h, prev } = await refreshWaHealth(db, acc).catch(() => ({ h: null, prev: null }));
    out.numbers++;
    if (h && prev && prev.quality !== h.quality && (h.quality === "YELLOW" || h.quality === "RED")) {
      await notify({ ownerId: acc.owner_id, type: "health", subject: `WhatsApp ${acc.phone_display ?? acc.name}: quality ${h.quality === "RED" ? "LOW" : "MEDIUM"}`, title: `Your WhatsApp number's quality dropped to ${h.quality === "RED" ? "LOW" : "MEDIUM"}`, body: h.reasons.filter((r) => r.level !== "info").map((r) => `• ${r.text}`).join("\n"), cta: { label: "Open Sending health", url: "/app/health?tab=whatsapp" }, dedupe: `wa:${acc.id}:${h.quality}:${new Date().toISOString().slice(0, 10)}` }).catch(() => null);
    }
  }
  return out;
}
