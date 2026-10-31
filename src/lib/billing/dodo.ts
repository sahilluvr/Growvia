import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { isPaidPlan, type Interval, type PaidPlan } from "./catalog";

/*
 * Dodo Payments (merchant of record) — US-dollar card subscriptions for customers outside India.
 * Razorpay keeps handling rupees. Environment variables on the Cloud Run service (see deploy/env.example.yaml):
 *   DODO_API_KEY         API key (Developer → API Keys) — test key while DODO_MODE=test
 *   DODO_WEBHOOK_SECRET  signing secret of the webhook endpoint (starts with whsec_)
 *   DODO_MODE            test (default) | live
 *   DODO_PRODUCTS        product ids as JSON, required in live mode:
 *                        {"pro":{"month":"pdt_…","year":"pdt_…"},"growth":{…},"agency":{…}}
 */

const env = (k: string) => (process.env[k] ?? "").trim();
const MODE = env("DODO_MODE").toLowerCase() === "live" ? "live" : "test";
export const DODO = {
  apiKey: env("DODO_API_KEY"),
  webhookSecret: env("DODO_WEBHOOK_SECRET"),
  mode: MODE as "test" | "live",
  api: (env("DODO_API_BASE") || (MODE === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com")).replace(/\/$/, ""),
};

type Products = Record<PaidPlan, Record<Interval, string>>;
/** The test-mode products created in the Dodo dashboard (2026-10-15). */
const TEST_PRODUCTS: Products = {
  pro: { month: "pdt_0NpmYDTTTC7NJRABCQNpu", year: "pdt_0NpmYOn6zxBZquADR67cK" },
  growth: { month: "pdt_0NpmYW5dfjN6jbQgORRia", year: "pdt_0NpmYfTwrYYSIHnFOQMTy" },
  agency: { month: "pdt_0NpmYlbLDUD8vPaxd0UER", year: "pdt_0NpmZ3fehulqxi9s8zxk3" },
};

/** Reads DODO_PRODUCTS; falls back to the test products only in test mode. Pure, so it's testable. */
export function parseProducts(raw: string, mode: "test" | "live"): Products | null {
  if (raw) {
    try {
      const v = JSON.parse(raw) as Partial<Products>;
      const ok = (["pro", "growth", "agency"] as PaidPlan[]).every((t) => /^pdt_/.test(v[t]?.month ?? "") && /^pdt_/.test(v[t]?.year ?? ""));
      if (ok) return v as Products;
      console.error("[dodo] DODO_PRODUCTS needs pro/growth/agency × month/year product ids (pdt_…)");
    } catch { console.error("[dodo] DODO_PRODUCTS isn't valid JSON"); }
    return null;
  }
  return mode === "test" ? TEST_PRODUCTS : null;
}
export const DODO_PRODUCTS = parseProducts(env("DODO_PRODUCTS"), DODO.mode);

/** Dollar card subscriptions through Dodo are on when the API key and product ids are set. */
export const dodoReady = () => Boolean(DODO.apiKey && DODO_PRODUCTS);

export const productFor = (tier: PaidPlan, interval: Interval, p: Products | null = DODO_PRODUCTS) => p?.[tier]?.[interval] ?? null;
/** Which plan a Dodo product id stands for. */
export function planOfProduct(id: string | null | undefined, p: Products | null = DODO_PRODUCTS): { tier: PaidPlan; interval: Interval } | null {
  if (!id || !p) return null;
  for (const tier of Object.keys(p) as PaidPlan[]) for (const interval of ["month", "year"] as Interval[]) if (p[tier][interval] === id && isPaidPlan(tier)) return { tier, interval };
  return null;
}

export type DodoStatus = "pending" | "active" | "on_hold" | "paused" | "cancelled" | "failed" | "expired" | "past_due";
export type DodoSubscription = {
  subscription_id: string; status: DodoStatus; product_id: string; currency: string; recurring_pre_tax_amount: number;
  payment_frequency_interval?: string; next_billing_date?: string | null; previous_billing_date?: string | null; created_at?: string;
  cancel_at_next_billing_date?: boolean; cancelled_at?: string | null; expires_at?: string | null; trial_period_days?: number;
  metadata?: Record<string, string | number | boolean> | null; customer?: { customer_id: string; email: string; name?: string } | null;
  scheduled_change?: { product_id: string; effective_at: string } | null; payment_method_id?: string | null;
};
export type DodoPayment = {
  payment_id: string; status?: string | null; total_amount: number; currency: string; subscription_id?: string | null;
  payment_method?: string | null; card_network?: string | null; card_last_four?: string | null; created_at?: string; invoice_id?: string | null; invoice_url?: string | null;
  metadata?: Record<string, string | number | boolean> | null; customer?: { customer_id: string; email: string } | null;
};

export class DodoError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  if (!DODO.apiKey) throw new DodoError("Dodo Payments isn't set up (DODO_API_KEY missing).", 0);
  let r: Response;
  try {
    r = await fetch(`${DODO.api}${path}`, {
      method, headers: { Authorization: `Bearer ${DODO.apiKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new DodoError("Couldn't reach Dodo Payments — please try again in a minute. Nothing was charged.", 0); }
  const text = await r.text();
  if (!r.ok) {
    let msg = text.slice(0, 300), code: string | undefined;
    try { const j = JSON.parse(text) as { message?: string; code?: string }; msg = j.message ?? msg; code = j.code; } catch { /* plain text */ }
    throw new DodoError(msg || `HTTP ${r.status}`, r.status, code);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export const dodo = {
  /** Hosted checkout for one subscription product. Returns the page to send the customer to. */
  createCheckout: (o: { productId: string; email: string; name?: string; returnUrl: string; cancelUrl?: string; metadata: Record<string, string>; trialDays?: number }) =>
    call<{ session_id: string; checkout_url: string | null }>("POST", "/checkouts", {
      product_cart: [{ product_id: o.productId, quantity: 1 }],
      customer: { email: o.email, ...(o.name ? { name: o.name } : {}) },
      billing_currency: "USD",
      return_url: o.returnUrl, ...(o.cancelUrl ? { cancel_url: o.cancelUrl } : {}),
      metadata: o.metadata,
      feature_flags: { allow_currency_selection: false },
      ...(o.trialDays ? { subscription_data: { trial_period_days: o.trialDays } } : {}),
    }),
  getSubscription: (id: string) => call<DodoSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`),
  /** Upgrade now (charged the prorated difference) or move at the next billing date. */
  changePlan: (id: string, productId: string, when: "now" | "renewal", metadata?: Record<string, string>) =>
    call<{ payment_id?: string | null }>("POST", `/subscriptions/${encodeURIComponent(id)}/change-plan`, {
      product_id: productId, quantity: 1,
      proration_billing_mode: when === "now" ? "prorated_immediately" : "do_not_bill",
      effective_at: when === "now" ? "immediately" : "next_billing_date",
      cancel_scheduled_change_plan: true,
      ...(when === "now" ? { on_payment_failure: "prevent_change" } : {}),
      ...(metadata ? { metadata } : {}),
    }),
  cancelScheduledChange: (id: string) => call<unknown>("DELETE", `/subscriptions/${encodeURIComponent(id)}/change-plan/scheduled`),
  update: (id: string, patch: Record<string, unknown>) => call<DodoSubscription>("PATCH", `/subscriptions/${encodeURIComponent(id)}`, patch),
  /** Customer portal link (update card, invoices). */
  portal: (customerId: string, returnUrl: string) => call<{ link: string }>("POST", `/customers/${encodeURIComponent(customerId)}/customer-portal/session?return_url=${encodeURIComponent(returnUrl)}`),
};

/**
 * Standard Webhooks signature check (what Dodo uses): HMAC-SHA256 over "id.timestamp.body" with the
 * base64 secret after "whsec_"; the header holds one or more "v1,<base64>" values. Rejects anything older than 5 minutes.
 */
export function dodoWebhookOk(raw: string, h: { id: string | null; timestamp: string | null; signature: string | null }, secret = DODO.webhookSecret, now = Date.now()): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  let key: Buffer;
  try { key = Buffer.from(secret.replace(/^whsec_/, ""), "base64"); } catch { return false; }
  if (!key.length) return false;
  const want = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${raw}`).digest();
  return h.signature.split(" ").some((part) => {
    const [ver, sig] = part.split(",");
    if (ver !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}
