import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_INFO, PRICES, isPaidPlan, type Interval, type PaidPlan } from "./catalog";
import { bustPlan } from "./plan";
import { rzp, type RzpOrder, type RzpPayment } from "./razorpay";
import { recordPayment } from "./sync";

/*
 * Prepaid plans (PayPal through Razorpay). PayPal can't renew automatically, so a payment buys one month or one
 * year: the plan stays on until `current_end`, then the account moves to Free unless it's renewed.
 * Stored on the normal subscriptions row: provider "prepaid", status "prepaid", rzp_subscription_id "prepaid_<payment>".
 */

const DAY = 86_400_000;
export const periodMs = (i: Interval) => (i === "year" ? 365 : 30) * DAY;
const perMs = (t: PaidPlan, i: Interval) => (PRICES[t][i] * 100) / periodMs(i); // cents per ms

type Cur = { plan?: string | null; status?: string | null; provider?: string | null; billing_interval?: string | null; current_end?: string | null } | null;

/**
 * When the new prepaid period ends.
 * - Same plan: added on top of the time already paid (renew early, lose nothing).
 * - Different plan: starts now, and the value of the unused days is converted into extra days of the new plan.
 */
export function prepaidEnd(cur: Cur, tier: PaidPlan, interval: Interval, now = Date.now()) {
  const left = cur?.current_end ? Math.max(0, Date.parse(cur.current_end) - now) : 0;
  const curTier = isPaidPlan(cur?.plan) ? (cur!.plan as PaidPlan) : null;
  const curIv = (cur?.billing_interval === "year" ? "year" : "month") as Interval;
  const prepaidLive = cur?.provider === "prepaid" && left > 0 && curTier;
  if (!prepaidLive) return { start: now, end: now + periodMs(interval), creditDays: 0 };
  if (curTier === tier) return { start: now, end: now + left + periodMs(interval), creditDays: Math.round(left / DAY) };
  const credit = Math.floor(left * (perMs(curTier, curIv) / perMs(tier, interval)));
  return { start: now, end: now + periodMs(interval) + credit, creditDays: Math.round(credit / DAY) };
}

const noteOf = (n: Record<string, string> | [] | undefined, k: string) => (Array.isArray(n) ? undefined : n?.[k]);

/**
 * Switches the plan on after a captured prepaid payment. Idempotent: the browser handler and the webhook can both
 * call it; the payment id is recorded once and the period is only extended once.
 */
export async function applyPrepaid(db: SupabaseClient, order: RzpOrder, pay: RzpPayment) {
  const ownerId = noteOf(order.notes, "owner_id");
  const tier = noteOf(order.notes, "plan");
  const interval = noteOf(order.notes, "interval") as Interval | undefined;
  if (!ownerId || !isPaidPlan(tier) || (interval !== "month" && interval !== "year")) return { ok: false as const, reason: "not a prepaid order" };
  if (!["captured", "authorized"].includes(pay.status) || pay.amount < order.amount) return { ok: false as const, reason: `payment ${pay.status}` };
  const { data: seen } = await db.from("payments").select("id").eq("id", pay.id).maybeSingle();
  if (seen) return { ok: true as const, ownerId, already: true };
  const { data: cur } = await db.from("subscriptions").select("plan, status, provider, billing_interval, current_end, rzp_subscription_id").eq("owner_id", ownerId).maybeSingle();
  // A running card/UPI subscription is a different thing — never overwrite it with a prepaid period.
  if (cur?.rzp_subscription_id && cur.provider !== "prepaid" && ["active", "authenticated", "pending"].includes(cur.status ?? "")) {
    await recordPayment(db, ownerId, null, pay);
    return { ok: false as const, reason: "has a live subscription" };
  }
  const { end } = prepaidEnd(cur, tier as PaidPlan, interval);
  const row = {
    owner_id: ownerId, plan: tier, status: "prepaid", provider: "prepaid", rzp_subscription_id: `prepaid_${pay.id}`, rzp_plan_id: null, payment_method: pay.method === "wallet" ? "PayPal" : pay.method ?? "PayPal",
    billing_interval: interval, currency: order.currency, amount: order.amount, current_start: new Date().toISOString(), current_end: new Date(end).toISOString(),
    cancel_at_period_end: false, cancelled_at: null, scheduled_change: null, replaces: null, updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "owner_id" });
  if (error) throw error;
  await recordPayment(db, ownerId, `prepaid_${pay.id}`, { ...pay, method: pay.method === "wallet" || !pay.method ? "PayPal" : pay.method });
  bustPlan(ownerId);
  return { ok: true as const, ownerId, tier: tier as PaidPlan, interval, end: new Date(end).toISOString(), name: PLAN_INFO[tier as PaidPlan].name };
}

/** Looks up the order behind a payment and applies it (webhook path). */
export async function applyPrepaidPayment(db: SupabaseClient, pay: RzpPayment) {
  if (!pay.order_id) return { ok: false as const, reason: "no order" };
  const order = await rzp.getOrder(pay.order_id);
  if (noteOf(order.notes, "mode") !== "prepaid") return { ok: false as const, reason: "not prepaid" };
  return applyPrepaid(db, order, pay);
}
