import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { waPhoneInfo } from "../meta/graph";
import { tokenOf, type ChannelAccount } from "../meta/channels";
import type { Reason } from "./email";

/* WhatsApp number health: Meta's quality rating + messaging tier, template health, and real delivery numbers. */

type Db = SupabaseClient;
const DAY = 86_400_000;
export const TIER_LIMIT: Record<string, number> = { TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: Infinity };
const OPT_OUT = /^\s*(stop|unsubscribe|stop all|no more|band karo|mat bhejo|don'?t message|remove me)\b/i;

export type WaStats = { sent30: number; delivered30: number; read30: number; failed30: number; replies30: number; optOuts30: number; newPeople24: number };
export type WaHealth = {
  quality: "GREEN" | "YELLOW" | "RED" | "UNKNOWN"; tier: string | null; tierLimit: number | null; leftToday: number | null;
  status: string | null; nameStatus: string | null; score: number; level: "good" | "watch" | "risk" | "new";
  reasons: Reason[]; stats: WaStats; templates: { approved: number; paused: number; rejected: number; pending: number };
  history: { day: string; q: string }[]; paused?: boolean; paused_reason?: string | null; resumed_at?: string | null; checked_at: string; error?: string | null;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const normQ = (q?: string | null): WaHealth["quality"] => (q === "GREEN" || q === "HIGH" ? "GREEN" : q === "YELLOW" || q === "MEDIUM" ? "YELLOW" : q === "RED" || q === "LOW" ? "RED" : "UNKNOWN");

export async function waStats(db: Db, accountId: string): Promise<WaStats> {
  const since = (d: number) => new Date(Date.now() - d * DAY).toISOString();
  const { data: threads } = await db.from("threads").select("id").eq("channel_account_id", accountId).limit(5000);
  const ids = (threads ?? []).map((t) => t.id);
  if (!ids.length) return { sent30: 0, delivered30: 0, read30: 0, failed30: 0, replies30: 0, optOuts30: 0, newPeople24: 0 };
  const chunk = ids.slice(0, 1000);
  const [{ data: out }, { data: inb }] = await Promise.all([
    db.from("messages").select("lead_id, delivery, status, broadcast_id, sent_at, created_at").in("thread_id", chunk).eq("direction", "out").gte("created_at", since(30)).limit(20000),
    db.from("messages").select("lead_id, body_text, sent_at").in("thread_id", chunk).eq("direction", "in").gte("sent_at", since(30)).limit(20000),
  ]);
  const o = out ?? [];
  const failed = o.filter((m) => m.delivery === "failed" || m.status === "failed").length;
  const day = since(1);
  return {
    sent30: o.filter((m) => m.status !== "failed").length,
    delivered30: o.filter((m) => m.delivery === "delivered" || m.delivery === "read").length,
    read30: o.filter((m) => m.delivery === "read").length,
    failed30: failed,
    replies30: new Set((inb ?? []).map((m) => m.lead_id)).size,
    optOuts30: (inb ?? []).filter((m) => OPT_OUT.test(m.body_text ?? "")).length,
    // Business-started (template) conversations count against the daily tier; replies inside 24h don't.
    newPeople24: new Set(o.filter((m) => m.broadcast_id && (m.sent_at ?? m.created_at) >= day).map((m) => m.lead_id)).size,
  };
}

export function assessWa(info: { quality?: string; tier?: string | null; status?: string | null; nameStatus?: string | null }, s: WaStats, templates: { status: string }[], prev?: Partial<WaHealth> | null, error?: string | null): WaHealth {
  const quality = normQ(info.quality);
  const reasons: Reason[] = [];
  let score = quality === "GREEN" ? 100 : quality === "YELLOW" ? 65 : quality === "RED" ? 25 : 80;
  if (quality === "YELLOW") reasons.push({ level: "warn", text: "Meta rates this number's quality MEDIUM — people are blocking or reporting some messages. Send only to people who opted in, and less often." });
  if (quality === "RED") reasons.push({ level: "bad", text: "Meta rates this number's quality LOW. Broadcasts are paused to avoid a ban or a lower messaging limit. Reply to chats normally; resume broadcasts in 7 days or once it turns green." });
  if (info.status && !/CONNECTED/i.test(info.status)) { score -= 20; reasons.push({ level: "bad", text: `Meta shows this number as ${info.status.toLowerCase().replace(/_/g, " ")}.` }); }
  if (info.nameStatus && /DECLINED|REJECTED/i.test(info.nameStatus)) { score -= 10; reasons.push({ level: "warn", text: "Your WhatsApp display name was rejected by Meta — update it in WhatsApp Manager so messages show your business name." }); }
  const fr = pct(s.failed30, s.sent30 + s.failed30);
  if (s.sent30 + s.failed30 >= 20 && fr >= 10) { score -= 15; reasons.push({ level: "warn", text: `${fr}% of messages failed in 30 days — usually wrong numbers or people not on WhatsApp.`, fix: { label: "Clean phone numbers", href: "/app/health?tab=whatsapp#phones" } }); }
  const or = pct(s.optOuts30, s.sent30);
  if (s.sent30 >= 30 && or >= 2) { score -= 15; reasons.push({ level: "warn", text: `${or}% of people replied STOP in 30 days. Make broadcasts more relevant and less frequent.` }); }
  const t = { approved: 0, paused: 0, rejected: 0, pending: 0 };
  for (const x of templates) { const st = (x.status ?? "").toUpperCase(); if (st === "APPROVED") t.approved++; else if (st === "PAUSED" || st === "DISABLED") t.paused++; else if (st === "REJECTED") t.rejected++; else if (st === "PENDING" || st === "IN_APPEAL") t.pending++; }
  if (t.paused) { score -= 10; reasons.push({ level: "warn", text: `${t.paused} template${t.paused === 1 ? " was" : "s were"} paused by Meta after low ratings from customers. Rewrite ${t.paused === 1 ? "it" : "them"} to be more useful.`, fix: { label: "Templates", href: "/app/whatsapp" } }); }
  const tier = info.tier ?? null, tierLimit = tier ? TIER_LIMIT[tier] ?? null : null;
  const leftToday = tierLimit == null ? null : tierLimit === Infinity ? null : Math.max(0, tierLimit - s.newPeople24);
  if (tierLimit != null && tierLimit !== Infinity && leftToday != null && leftToday < tierLimit * 0.1) reasons.push({ level: "warn", text: `You've used almost all of today's limit of ${tierLimit.toLocaleString("en-IN")} new conversations. Remaining broadcasts continue tomorrow.` });
  if (s.sent30 >= 20 && pct(s.read30, s.sent30) >= 60) reasons.push({ level: "info", text: `${pct(s.read30, s.sent30)}% of messages are read — strong engagement keeps quality green.` });
  const day = new Date().toISOString().slice(0, 10);
  const history = [...(prev?.history ?? []).filter((h) => h.day !== day), { day, q: quality }].slice(-30);
  score = Math.max(0, Math.min(100, score));
  const level: WaHealth["level"] = s.sent30 === 0 && quality !== "RED" ? "new" : score >= 80 ? "good" : score >= 55 ? "watch" : "risk";
  const resumedRecently = prev?.resumed_at ? Date.now() - new Date(prev.resumed_at).getTime() < 2 * DAY : false;
  const paused = quality === "RED" && !resumedRecently ? true : prev?.paused && quality !== "GREEN" ? true : false;
  return { quality, tier, tierLimit: tierLimit === Infinity ? null : tierLimit, leftToday, status: info.status ?? null, nameStatus: info.nameStatus ?? null, score, level, reasons, stats: s, templates: t, history, paused, paused_reason: paused ? "Quality rating is LOW" : null, resumed_at: prev?.resumed_at ?? null, checked_at: new Date().toISOString(), error: error ?? null };
}

/** Pulls the latest from Meta and our own numbers; saves it on the account. */
export async function refreshWaHealth(db: Db, acc: ChannelAccount) {
  let info: { quality?: string; tier?: string | null; status?: string | null; nameStatus?: string | null } = { quality: (acc.meta?.quality as string) ?? undefined };
  let error: string | null = null;
  try {
    const r = await waPhoneInfo(acc.external_id, tokenOf(acc), true);
    info = { quality: r.quality_rating, tier: r.messaging_limit_tier ?? null, status: r.status ?? null, nameStatus: r.name_status ?? null };
  } catch (e) { error = e instanceof Error ? e.message : "Couldn't reach Meta"; }
  const s = await waStats(db, acc.id);
  const prev = (acc.meta?.health ?? null) as Partial<WaHealth> | null;
  const h = assessWa(info, s, (acc.meta?.templates as { status: string }[]) ?? [], prev, error);
  await db.from("channel_accounts").update({ meta: { ...(acc.meta ?? {}), quality: info.quality ?? acc.meta?.quality ?? null, health: h } }).eq("id", acc.id);
  return { h, prev };
}
