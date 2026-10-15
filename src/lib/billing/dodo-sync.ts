import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRICES, isPaidPlan, type Interval, type PaidPlan } from "./catalog";
import { bustPlan } from "./plan";
import { dodo, planOfProduct, type DodoPayment, type DodoStatus, type DodoSubscription } from "./dodo";
import { rzp } from "./razorpay";

/*
 * Dodo subscriptions live on the same one-row-per-account `subscriptions` table as Razorpay ones:
 * provider "dodo", rzp_subscription_id = Dodo's subscription id. Statuses are translated to the ones
 * resolvePlan already understands, so plan limits work unchanged.
 */

/** Dodo status → our status. */
export function mapDodoStatus(s: DodoStatus): string {
  switch (s) {
    case "active": return "active";
    case "past_due": return "pending";    // renewal failed, grace period: keep access, show "update payment"
    case "on_hold": return "halted";      // renewal failed, no grace left: access until the paid period ends
    case "paused": return "paused";
    case "cancelled": return "cancelled";
    case "expired": return "completed";
    case "failed": return "failed";
    default: return "created";            // pending: checkout not finished
  }
}

const meta = (s: { metadata?: Record<string, unknown> | null }, k: string) => {
  const v = s.metadata?.[k];
  return v === undefined || v === null ? undefined : String(v);
};
const ivOf = (s: DodoSubscription): Interval | null => {
  const p = planOfProduct(s.product_id);
  if (p) return p.interval;
  const f = (s.payment_frequency_interval ?? "").toLowerCase();
  return f === "year" ? "year" : f === "month" ? "month" : null;
};

type Cur = { plan?: string | null; status?: string | null; provider?: string | null; rzp_subscription_id?: string | null; current_end?: string | null; payment_method?: string | null } | null;

/** The row to store for this Dodo subscription, or null when the event must not change the account. Pure. */
export function dodoRow(s: DodoSubscription, ownerId: string, cur: Cur, now = Date.now()) {
  const same = Boolean(cur?.rzp_subscription_id && cur.rzp_subscription_id === s.subscription_id);
  // A different subscription only takes over once it's actually paid for (abandoned or failed checkouts never touch the plan).
  if (!same && !["active", "past_due"].includes(s.status)) return null;
  const curLive = Boolean(cur?.rzp_subscription_id && !same && cur.provider !== "prepaid" &&
    (["active", "authenticated", "pending"].includes(cur.status ?? "") || (cur.current_end && Date.parse(cur.current_end) > now)));
  const p = planOfProduct(s.product_id);
  const metaTier = meta(s, "plan");
  const tier: PaidPlan = p?.tier ?? (isPaidPlan(metaTier) ? metaTier : isPaidPlan(cur?.plan) ? (cur!.plan as PaidPlan) : "pro");
  const interval = ivOf(s);
  const status = mapDodoStatus(s.status);
  const ended = s.status === "cancelled" || s.status === "expired";
  const next = s.next_billing_date ?? null;
  // An immediate cancel ends access now; a cancel at period end arrives at (or after) the end anyway.
  const end = ended ? new Date(Math.min(next ? Date.parse(next) : now, s.cancelled_at ? Date.parse(s.cancelled_at) : now, now)).toISOString() : next;
  const sc = s.scheduled_change ? planOfProduct(s.scheduled_change.product_id) : null;
  const scheduled = s.scheduled_change && sc
    ? sc.tier !== tier
      ? { plan: sc.tier, interval: sc.interval, at: s.scheduled_change.effective_at, amount: PRICES[sc.tier][sc.interval] * 100, currency: "USD" }
      : sc.interval !== interval ? { interval: sc.interval, at: s.scheduled_change.effective_at, amount: PRICES[sc.tier][sc.interval] * 100, currency: "USD" } : null
    : null;
  const row = {
    owner_id: ownerId, plan: tier, status, provider: "dodo", rzp_subscription_id: s.subscription_id, rzp_plan_id: s.product_id,
    rzp_customer_id: s.customer?.customer_id ?? null, payment_method: same ? cur?.payment_method ?? "Card" : "Card", short_url: null,
    billing_interval: interval, currency: (s.currency || "USD").toUpperCase(), amount: s.recurring_pre_tax_amount ?? null,
    current_start: s.previous_billing_date ?? s.created_at ?? null, current_end: end,
    cancel_at_period_end: Boolean(s.cancel_at_next_billing_date) && !ended,
    cancelled_at: ended ? s.cancelled_at ?? new Date(now).toISOString() : null,
    scheduled_change: scheduled, replaces: !same && curLive ? cur!.rzp_subscription_id! : same ? undefined : null,
    updated_at: new Date(now).toISOString(),
  };
  if (row.replaces === undefined) delete (row as Partial<typeof row>).replaces;
  return { row, replaced: !same && curLive ? { id: cur!.rzp_subscription_id!, provider: cur!.provider ?? "razorpay" } : null };
}

/** Writes Dodo's view of a subscription onto the account. Safe to call many times (return page, webhook, refresh). */
export async function applyDodoSubscription(db: SupabaseClient, s: DodoSubscription, o: { ownerId?: string } = {}) {
  let ownerId = o.ownerId ?? meta(s, "owner_id");
  if (!ownerId) {
    const { data } = await db.from("subscriptions").select("owner_id").eq("rzp_subscription_id", s.subscription_id).maybeSingle();
    ownerId = (data as { owner_id?: string } | null)?.owner_id;
  }
  if (!ownerId) return { ok: false as const, reason: "no owner" };
  const { data: cur } = await db.from("subscriptions").select("plan, status, provider, rzp_subscription_id, current_end, payment_method").eq("owner_id", ownerId).maybeSingle();
  const r = dodoRow(s, ownerId, cur as Cur);
  if (!r) return { ok: true as const, ownerId, ignored: true };
  const { error } = await db.from("subscriptions").upsert(r.row, { onConflict: "owner_id" });
  if (error) throw error;
  bustPlan(ownerId);
  // The old subscription stops at the end of what's already paid — never charged twice.
  if (r.replaced?.provider === "dodo") await dodo.update(r.replaced.id, { cancel_at_next_billing_date: true }).catch((e) => console.error("[dodo] stop old sub", e));
  else if (r.replaced && r.replaced.provider !== "prepaid") await rzp.cancel(r.replaced.id, true).catch(() => rzp.cancel(r.replaced!.id, false).catch(() => {}));
  return { ok: true as const, ownerId, replaced: r.replaced?.id ?? null };
}

/** Saves one Dodo payment in the history (idempotent). */
export async function recordDodoPayment(db: SupabaseClient, p: DodoPayment, ownerIn?: string) {
  let ownerId = ownerIn ?? (p.metadata?.owner_id ? String(p.metadata.owner_id) : undefined);
  if (!ownerId && p.subscription_id) {
    const { data } = await db.from("subscriptions").select("owner_id").eq("rzp_subscription_id", p.subscription_id).maybeSingle();
    ownerId = (data as { owner_id?: string } | null)?.owner_id;
  }
  if (!ownerId || !p.payment_id) return { ok: false as const };
  const st = (p.status ?? "succeeded").toLowerCase();
  const method = p.card_network && p.card_last_four ? `${p.card_network} •••• ${p.card_last_four}` : p.payment_method ?? "card";
  await db.from("payments").upsert({
    id: p.payment_id, owner_id: ownerId, subscription_id: p.subscription_id ?? null, amount: p.total_amount, currency: (p.currency || "USD").toUpperCase(),
    status: st === "succeeded" ? "paid" : st, method, invoice_id: p.invoice_id ?? null, invoice_url: p.invoice_url ?? null,
    paid_at: p.created_at ?? new Date().toISOString(),
  }, { onConflict: "id" });
  if (st === "succeeded" && p.card_network && p.subscription_id) {
    await db.from("subscriptions").update({ payment_method: method }).eq("rzp_subscription_id", p.subscription_id);
  }
  return { ok: true as const, ownerId };
}

/** Pulls the latest state straight from Dodo (return page and "Refresh"). */
export async function refreshFromDodo(db: SupabaseClient, ownerId: string, subId: string) {
  const s = await dodo.getSubscription(subId);
  const owner = meta(s, "owner_id");
  if (owner && owner !== ownerId) throw new Error("That subscription belongs to a different account.");
  await applyDodoSubscription(db, s, { ownerId });
  return s;
}
