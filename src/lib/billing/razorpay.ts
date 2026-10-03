import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { RZP, PRICES, PLAN_INFO, type Currency, type Interval, type PaidPlan } from "./config";

/* Minimal Razorpay Subscriptions client (plans, subscriptions, cancel, update, invoices). */

export type RzpSubscription = {
  id: string; plan_id: string; customer_id?: string | null; status: string; current_start?: number | null; current_end?: number | null;
  charge_at?: number | null; start_at?: number | null; ended_at?: number | null; short_url?: string | null; payment_method?: string | null;
  notes?: Record<string, string> | []; has_scheduled_changes?: boolean; total_count?: number; paid_count?: number;
};
export type RzpPayment = { id: string; amount: number; currency: string; status: string; method?: string; invoice_id?: string | null; created_at?: number; error_description?: string | null; order_id?: string | null; notes?: Record<string, string> | [] };
export type RzpInvoice = { id: string; payment_id?: string | null; short_url?: string | null; amount: number; currency: string; status: string; paid_at?: number | null };

export type RzpOrder = { id: string; amount: number; currency: string; status: string; receipt?: string; notes?: Record<string, string> | [] };

export class RazorpayError extends Error {
  constructor(message: string, public status: number, public code = "") { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${RZP.keyId}:${RZP.keySecret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${RZP.api}/v1${path}`, {
      method, cache: "no-store", signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new RazorpayError("Couldn't reach Razorpay — check your connection and try again.", 0);
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (j as { error?: { description?: string; code?: string } }).error;
    throw new RazorpayError(d?.description || `Razorpay error ${res.status}`, res.status, d?.code ?? "");
  }
  return j as T;
}

export const rzp = {
  createPlan: (interval: Interval, currency: Currency, amount: number, tier: PaidPlan = "pro") =>
    call<{ id: string }>("POST", "/plans", {
      period: interval === "month" ? "monthly" : "yearly", interval: 1,
      item: { name: `Growvia ${PLAN_INFO[tier].name} (${interval === "month" ? "monthly" : "yearly"})`, amount, currency, description: interval === "month" ? `$${PRICES[tier].month}/month` : `$${PRICES[tier].year}/year — 2 months free` },
      notes: { app: "growvia", plan: tier },
    }),
  createSubscription: (o: { planId: string; interval: Interval; ownerId: string; email: string; startAt?: number; replaces?: string; tier?: PaidPlan; mode?: "upgrade" | "downgrade" | "keep" | "new" }) =>
    call<RzpSubscription>("POST", "/subscriptions", {
      plan_id: o.planId, total_count: o.interval === "month" ? 120 : 10, quantity: 1, customer_notify: 1,
      ...(o.startAt ? { start_at: o.startAt } : {}),
      notes: { owner_id: o.ownerId, email: o.email, plan: o.tier ?? "pro", ...(o.replaces ? { replaces: o.replaces } : {}), ...(o.mode ? { mode: o.mode } : {}) },
    }),
  getSubscription: (id: string) => call<RzpSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`),
  cancel: (id: string, atCycleEnd: boolean) => call<RzpSubscription>("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  changePlan: (id: string, planId: string) => call<RzpSubscription>("PATCH", `/subscriptions/${encodeURIComponent(id)}`, { plan_id: planId, schedule_change_at: "cycle_end", customer_notify: 1 }),
  invoices: (subId: string) => call<{ items: RzpInvoice[] }>("GET", `/invoices?subscription_id=${encodeURIComponent(subId)}&count=50`),
  getPayment: (id: string) => call<RzpPayment>("GET", `/payments/${encodeURIComponent(id)}`),
  /** One-time order (PayPal / prepaid). Razorpay shows PayPal only when the order isn't in INR. */
  createOrder: (o: { amount: number; currency: Currency; receipt: string; notes: Record<string, string> }) =>
    call<RzpOrder>("POST", "/orders", { amount: o.amount, currency: o.currency, receipt: o.receipt.slice(0, 40), notes: o.notes }),
  getOrder: (id: string) => call<RzpOrder>("GET", `/orders/${encodeURIComponent(id)}`),
  /** Partial refund (minor units) — used to give back unused days after an immediate upgrade. */
  refund: (paymentId: string, amount: number, notes: Record<string, string> = {}) => call<{ id: string; amount: number }>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, speed: "normal", notes }),
};

const safeEq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/** Checkout success signature: HMAC-SHA256(payment_id|subscription_id, key_secret). */
export function checkoutSignatureOk(paymentId: string, subscriptionId: string, signature: string) {
  if (!RZP.keySecret || !signature) return false;
  return safeEq(createHmac("sha256", RZP.keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex"), signature);
}

/** One-time order checkout signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function orderSignatureOk(orderId: string, paymentId: string, signature: string) {
  if (!RZP.keySecret || !signature) return false;
  return safeEq(createHmac("sha256", RZP.keySecret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret). */
export function webhookSignatureOk(raw: string, signature: string | null) {
  if (!RZP.webhookSecret || !signature) return false;
  return safeEq(createHmac("sha256", RZP.webhookSecret).update(raw).digest("hex"), signature);
}

/* ── Currency conversion (USD → INR) for customers who'd rather pay in rupees ── */

let fx: { rate: number; at: number } | null = null;
/** Today's USD→INR rate (free public source, cached 6h). Falls back to BILLING_USD_INR or 88. */
export async function usdToInr(): Promise<number> {
  if (fx && Date.now() - fx.at < 6 * 3600_000) return fx.rate;
  const fallback = Number(process.env.BILLING_USD_INR) || 88;
  try {
    const r = await fetch(process.env.BILLING_FX_URL || "https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(2500), next: { revalidate: 21600 } });
    const j = (await r.json()) as { rates?: Record<string, number> };
    const rate = j.rates?.INR;
    if (rate && rate > 40 && rate < 200) { fx = { rate, at: Date.now() }; return rate; }
  } catch { /* use fallback */ }
  fx = { rate: fallback, at: Date.now() - 5 * 3600_000 }; // retry the live rate in an hour
  return fallback;
}

/** Price in minor units for an interval + currency. INR is converted at today's rate and rounded up to ₹10. */
export async function priceFor(interval: Interval, currency: Currency, tier: PaidPlan = "pro"): Promise<{ amount: number; rate?: number }> {
  const usd = PRICES[tier][interval];
  if (currency === "USD") return { amount: usd * 100 };
  const rate = await usdToInr();
  return { amount: Math.ceil((usd * rate) / 10) * 10 * 100, rate };
}
