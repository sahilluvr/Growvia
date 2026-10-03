import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bustPlan } from "./plan";
import { rzp, type RzpPayment, type RzpSubscription } from "./razorpay";
import { PLAN_RANK, isPaidPlan, type PaidPlan } from "./catalog";

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);
const noteOf = (s: RzpSubscription, k: string) => (Array.isArray(s.notes) ? undefined : s.notes?.[k]);

/**
 * Writes Razorpay's view of a subscription onto the account. Safe to call many times (checkout, webhook, refresh).
 * Ignores events for an older subscription once a newer one has taken over.
 */
export async function applySubscription(db: SupabaseClient, s: RzpSubscription, extra0: { ownerId?: string; interval?: "month" | "year"; currency?: string; amount?: number } = {}) {
  const extra = extra0;
  const ownerId = extra.ownerId ?? noteOf(s, "owner_id");
  if (!ownerId) return { ok: false as const, reason: "no owner" };
  const { data: cur } = await db.from("subscriptions").select("plan, replaces, rzp_subscription_id, status, current_start, current_end, billing_interval, currency, amount, scheduled_change, provider").eq("owner_id", ownerId).maybeSingle();
  // A prepaid (PayPal) period never blocks a new card/UPI subscription — that one simply starts when it ends.
  const curLive = cur?.rzp_subscription_id && cur.provider !== "prepaid" && (["active", "authenticated", "pending"].includes(cur.status) || (cur.current_end && Date.parse(cur.current_end) > Date.now()));
  const takesOver = ["authenticated", "active"].includes(s.status) && (!curLive || noteOf(s, "replaces") === cur?.rzp_subscription_id);
  const isCurrent = !cur?.rzp_subscription_id || cur.rzp_subscription_id === s.id || takesOver;
  // Anything else is an old subscription (replaced by a plan switch) or an abandoned checkout — never let it change the plan.
  if (!isCurrent) return { ok: true as const, ignored: true };
  const replaced = cur?.rzp_subscription_id && cur.rzp_subscription_id !== s.id && cur.provider !== "prepaid" ? cur.rzp_subscription_id : null;
  // The plan id says what's being paid for (it changes after a monthly ↔ yearly switch).
  const { data: bp } = await db.from("billing_plans").select("key").eq("rzp_plan_id", s.plan_id).maybeSingle();
  // Keys look like "month-INR-168000" (Pro) or "growth:month-INR-405000".
  const rawKey = bp?.key ?? "";
  const keyTier = rawKey.includes(":") ? rawKey.split(":")[0] : rawKey ? "pro" : "";
  const [pi, pc, pa] = (rawKey.includes(":") ? rawKey.split(":")[1] : rawKey).split("-");
  const noteTier = noteOf(s, "plan");
  const tier: PaidPlan = isPaidPlan(noteTier) ? noteTier : isPaidPlan(keyTier) ? keyTier : "pro";
  const keep = !replaced;
  const interval = (pi as "month" | "year") || extra.interval || (keep ? cur?.billing_interval : null) || null;
  const currency = pc || extra.currency || (keep ? cur?.currency : null) || null;
  const amount = Number(pa) || extra.amount || (keep ? cur?.amount : null) || null;
  const cancelled = s.status === "cancelled" || s.status === "completed" || s.status === "expired";
  // A move to a cheaper plan that starts later: keep today's plan (already paid for) until the new one begins.
  const startsLater = s.status === "authenticated" && (s.start_at ?? 0) * 1000 > Date.now() + 60_000;
  const prev = isPaidPlan(cur?.plan) ? (cur!.plan as PaidPlan) : null;
  const pendingDown = (cur?.scheduled_change as { plan?: string } | null)?.plan === tier;
  const holdPlan = startsLater && prev && PLAN_RANK[prev] > PLAN_RANK[tier] && (replaced || pendingDown) ? prev : null;
  const row = {
    owner_id: ownerId, plan: holdPlan ?? tier, status: s.status, provider: "razorpay", rzp_subscription_id: s.id, rzp_plan_id: s.plan_id, rzp_customer_id: s.customer_id ?? null,
    payment_method: s.payment_method ?? null, short_url: s.short_url ?? null, billing_interval: interval, currency, amount,
    current_start: iso(s.current_start), current_end: iso(s.current_end) ?? (s.status === "authenticated" ? iso(s.start_at ?? s.charge_at) : null),
    ...(cancelled ? { cancelled_at: new Date().toISOString() } : {}),
    // A brand-new subscription starts clean (no leftover "cancel at period end" from an older one).
    ...(!cancelled && cur?.rzp_subscription_id !== s.id ? { cancel_at_period_end: false, cancelled_at: null } : {}),
    ...(replaced ? { replaces: replaced, cancel_at_period_end: false, cancelled_at: null } : {}),
    ...(replaced || (cur?.scheduled_change && pi && (cur.scheduled_change as { interval?: string }).interval === pi) ? { scheduled_change: null } : {}),
    ...(!holdPlan && !startsLater && (cur?.scheduled_change as { plan?: string } | null)?.plan ? { scheduled_change: null } : {}),
    ...(holdPlan ? { scheduled_change: { plan: tier, interval, at: iso(s.start_at), amount, currency } } : {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "owner_id" });
  if (error) throw error;
  bustPlan(ownerId);
  if (replaced && noteOf(s, "mode") === "upgrade" && !startsLater) {
    // Upgraded straight away: stop the old plan now and refund the days it won't be used.
    await rzp.cancel(replaced, false).catch(() => {});
    // If a cheaper plan was waiting to start, the plan being used today is the one it replaced.
    const paidSub = cur?.scheduled_change && cur?.replaces ? cur.replaces : replaced;
    if (paidSub !== replaced) await rzp.cancel(paidSub, false).catch(() => {});
    await refundUnused(db, ownerId, paidSub, cur).catch((e) => console.error("[billing] refund failed", paidSub, e));
  } else if (replaced) {
    // The switch is done: stop the old subscription at the end of what's already paid (no double charge).
    await rzp.cancel(replaced, true).catch(() => rzp.cancel(replaced, false).catch(() => {}));
  }
  return { ok: true as const, ownerId, replaced };
}

/** Refunds the unused share of the old plan's last payment (pro-rated by time left in the paid period). */
async function refundUnused(db: SupabaseClient, ownerId: string, oldSub: string, cur: { current_start?: string | null; current_end?: string | null } | null) {
  const end = cur?.current_end ? Date.parse(cur.current_end) : 0;
  if (!end || end <= Date.now()) return;
  const { data: pay } = await db.from("payments").select("id, amount, currency, paid_at").eq("subscription_id", oldSub).eq("status", "paid").gt("amount", 0).order("paid_at", { ascending: false }).limit(1).maybeSingle();
  if (!pay) return;
  const { data: done } = await db.from("payments").select("id").eq("subscription_id", oldSub).eq("status", "refunded").limit(1);
  if (done?.length) return; // already refunded (checkout and webhook both land here)
  const start = cur?.current_start ? Date.parse(cur.current_start) : Date.parse(pay.paid_at);
  if (!start || start >= end) return;
  const share = Math.min(1, (end - Date.now()) / (end - start));
  const amount = Math.floor((pay.amount * share) / 100) * 100; // whole rupees / dollars
  if (amount < 100) return;
  const r = await rzp.refund(pay.id, amount, { reason: "upgrade", owner_id: ownerId });
  await db.from("payments").upsert({ id: r.id, owner_id: ownerId, subscription_id: oldSub, amount: -amount, currency: pay.currency, status: "refunded", method: "refund", paid_at: new Date().toISOString() }, { onConflict: "id" });
}

/** Saves one payment in the history (idempotent). */
export async function recordPayment(db: SupabaseClient, ownerId: string, subId: string | null, p: RzpPayment) {
  await db.from("payments").upsert({
    id: p.id, owner_id: ownerId, subscription_id: subId, amount: p.amount, currency: p.currency,
    status: p.status === "captured" || p.status === "authorized" ? "paid" : p.status, method: p.method ?? null, invoice_id: p.invoice_id ?? null,
    paid_at: iso(p.created_at) ?? new Date().toISOString(),
  }, { onConflict: "id" });
}

/** Pulls the latest state straight from Razorpay (used right after checkout and by "Refresh"). */
export async function refreshFromRazorpay(db: SupabaseClient, ownerId: string, subId: string) {
  const s = await rzp.getSubscription(subId);
  await applySubscription(db, s, { ownerId });
  return s;
}
