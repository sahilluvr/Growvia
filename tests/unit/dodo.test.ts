import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createHmac, randomBytes } from "crypto";
import { fakeDb } from "../integration/fakedb";

/* v069 — Dodo Payments (US-dollar card subscriptions). Covers config, webhook signatures, the status/plan mapping,
   the webhook route against an in-memory database, and the billing actions against a fake Dodo API. */

const SECRET = `whsec_${randomBytes(24).toString("base64")}`;
process.env.DODO_API_KEY = "test_key";
process.env.DODO_WEBHOOK_SECRET = SECRET;
process.env.DODO_MODE = "test";
process.env.SITE_URL = "https://usegrowvia.com";

const OWNER = "11111111-1111-4111-8111-111111111111";
let db = fakeDb();
vi.mock("@/lib/server/admin", () => ({ adminClient: () => db }));
vi.mock("@/lib/data/supabase", () => ({ supabaseServer: () => db }));
vi.mock("@/lib/data", () => ({ repo: () => ({ getUser: async () => ({ id: OWNER, name: "Jane Doe", email: "jane@example.com" }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@/lib/mail/system", () => ({ layout: () => "", sendSystemEmail: async () => ({ ok: true }) }));

type Dodo = typeof import("@/lib/billing/dodo");
type Sync = typeof import("@/lib/billing/dodo-sync");
type Plan = typeof import("@/lib/billing/plan");
let D: Dodo, S: Sync, P: Plan;
beforeAll(async () => {
  D = await import("@/lib/billing/dodo");
  S = await import("@/lib/billing/dodo-sync");
  P = await import("@/lib/billing/plan");
});

const day = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const sub = (o: Partial<import("@/lib/billing/dodo").DodoSubscription> = {}) => ({
  subscription_id: "sub_new1", status: "active" as const, product_id: "pdt_0NpmYW5dfjN6jbQgORRia", currency: "USD", recurring_pre_tax_amount: 4500,
  payment_frequency_interval: "Month", previous_billing_date: iso(Date.now() - day), next_billing_date: iso(Date.now() + 29 * day),
  cancel_at_next_billing_date: false, metadata: { owner_id: OWNER, plan: "growth", interval: "month" }, customer: { customer_id: "cus_1", email: "jane@example.com" },
  scheduled_change: null, ...o,
});

describe("config", () => {
  it("uses the test products in test mode and needs DODO_PRODUCTS in live mode", () => {
    expect(D.parseProducts("", "test")?.pro.month).toBe("pdt_0NpmYDTTTC7NJRABCQNpu");
    expect(D.parseProducts("", "live")).toBeNull();
    const live = JSON.stringify({ pro: { month: "pdt_a", year: "pdt_b" }, growth: { month: "pdt_c", year: "pdt_d" }, agency: { month: "pdt_e", year: "pdt_f" } });
    expect(D.parseProducts(live, "live")?.agency.year).toBe("pdt_f");
    expect(D.parseProducts('{"pro":{"month":"x"}}', "live")).toBeNull();
    expect(D.parseProducts("not json", "test")).toBeNull();
    expect(D.dodoReady()).toBe(true);
  });
  it("maps all six products both ways", () => {
    for (const t of ["pro", "growth", "agency"] as const) for (const i of ["month", "year"] as const) {
      const id = D.productFor(t, i)!;
      expect(id).toMatch(/^pdt_/);
      expect(D.planOfProduct(id)).toEqual({ tier: t, interval: i });
    }
    expect(D.planOfProduct("pdt_unknown")).toBeNull();
  });
});

const sign = (id: string, ts: number, body: string, secret = SECRET) =>
  `v1,${createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;

describe("webhook signature (Standard Webhooks)", () => {
  const body = JSON.stringify({ type: "subscription.active" });
  const ts = Math.floor(Date.now() / 1000);
  it("accepts a valid signature, also among several", () => {
    expect(D.dodoWebhookOk(body, { id: "msg_1", timestamp: String(ts), signature: sign("msg_1", ts, body) })).toBe(true);
    expect(D.dodoWebhookOk(body, { id: "msg_1", timestamp: String(ts), signature: `v1,AAAA ${sign("msg_1", ts, body)}` })).toBe(true);
  });
  it("rejects tampering, old timestamps, wrong secrets and missing headers", () => {
    expect(D.dodoWebhookOk(body + " ", { id: "msg_1", timestamp: String(ts), signature: sign("msg_1", ts, body) })).toBe(false);
    expect(D.dodoWebhookOk(body, { id: "msg_2", timestamp: String(ts), signature: sign("msg_1", ts, body) })).toBe(false);
    expect(D.dodoWebhookOk(body, { id: "msg_1", timestamp: String(ts - 3600), signature: sign("msg_1", ts - 3600, body) })).toBe(false);
    expect(D.dodoWebhookOk(body, { id: "msg_1", timestamp: String(ts), signature: sign("msg_1", ts, body, `whsec_${randomBytes(24).toString("base64")}`) })).toBe(false);
    expect(D.dodoWebhookOk(body, { id: null, timestamp: String(ts), signature: sign("msg_1", ts, body) })).toBe(false);
  });
});

describe("status and plan mapping", () => {
  it("translates Dodo statuses", () => {
    expect(["active", "past_due", "on_hold", "paused", "cancelled", "expired", "failed", "pending"].map((s) => S.mapDodoStatus(s as never)))
      .toEqual(["active", "pending", "halted", "paused", "cancelled", "completed", "failed", "created"]);
  });
  it("a paid subscription takes over from the trial and gives the plan's limits", () => {
    const r = S.dodoRow(sub(), OWNER, { status: "none", rzp_subscription_id: null })!;
    expect(r.row).toMatchObject({ plan: "growth", provider: "dodo", status: "active", billing_interval: "month", currency: "USD", amount: 4500, rzp_customer_id: "cus_1" });
    const st = P.resolvePlan({ ...r.row, trial_end: null } as never, null);
    expect(st).toMatchObject({ plan: "growth", source: "paid", pro: true, paymentIssue: false });
    expect(st.limits.projects).toBe(25);
  });
  it("abandoned or failed checkouts never change the plan", () => {
    expect(S.dodoRow(sub({ status: "pending" }), OWNER, null)).toBeNull();
    expect(S.dodoRow(sub({ status: "failed" }), OWNER, { rzp_subscription_id: "sub_old", status: "active", provider: "dodo" })).toBeNull();
  });
  it("renewal problems: past_due keeps access with a warning; on_hold ends at the paid date", () => {
    const cur = { rzp_subscription_id: "sub_new1", provider: "dodo", status: "active" };
    const pd = P.resolvePlan({ ...S.dodoRow(sub({ status: "past_due" }), OWNER, cur)!.row } as never, null);
    expect(pd).toMatchObject({ pro: true, paymentIssue: true });
    const oh = P.resolvePlan({ ...S.dodoRow(sub({ status: "on_hold", next_billing_date: iso(Date.now() - day) }), OWNER, cur)!.row } as never, null);
    expect(oh.plan).toBe("free");
  });
  it("cancel at period end keeps the plan until then; an immediate cancel ends it now", () => {
    const cur = { rzp_subscription_id: "sub_new1", provider: "dodo", status: "active" };
    const later = P.resolvePlan({ ...S.dodoRow(sub({ cancel_at_next_billing_date: true }), OWNER, cur)!.row } as never, null);
    expect(later).toMatchObject({ plan: "growth", pro: true });
    expect(later.endsAt).toBeTruthy();
    const now = S.dodoRow(sub({ status: "cancelled", cancelled_at: iso(Date.now() - 1000) }), OWNER, cur)!.row;
    expect(Date.parse(now.current_end!)).toBeLessThanOrEqual(Date.now());
    expect(P.resolvePlan({ ...now } as never, null).plan).toBe("free");
  });
  it("records a scheduled downgrade and a scheduled monthly → yearly switch", () => {
    const cur = { rzp_subscription_id: "sub_new1", provider: "dodo", status: "active" };
    const down = S.dodoRow(sub({ scheduled_change: { product_id: D.productFor("pro", "month")!, effective_at: iso(Date.now() + 29 * day) } }), OWNER, cur)!.row;
    expect(down.plan).toBe("growth");
    expect(down.scheduled_change).toMatchObject({ plan: "pro", interval: "month", amount: 1900, currency: "USD" });
    const yr = S.dodoRow(sub({ scheduled_change: { product_id: D.productFor("growth", "year")!, effective_at: iso(Date.now() + 29 * day) } }), OWNER, cur)!.row;
    expect(yr.scheduled_change).toMatchObject({ interval: "year", amount: 45000 });
    expect((yr.scheduled_change as { plan?: string }).plan).toBeUndefined();
  });
  it("taking over a live subscription marks the old one to stop at its period end", () => {
    const r = S.dodoRow(sub(), OWNER, { rzp_subscription_id: "sub_rzpOld", provider: "razorpay", status: "active", current_end: iso(Date.now() + 10 * day) })!;
    expect(r.replaced).toEqual({ id: "sub_rzpOld", provider: "razorpay" });
    expect(r.row.replaces).toBe("sub_rzpOld");
    // PayPal time doesn't count as a subscription to stop.
    expect(S.dodoRow(sub(), OWNER, { rzp_subscription_id: "prepaid_pay1", provider: "prepaid", status: "prepaid", current_end: iso(Date.now() + 10 * day) })!.replaced).toBeNull();
  });
});

/* ── Webhook route against the in-memory database ── */
describe("webhook route", () => {
  beforeEach(() => { db = fakeDb({ subscriptions: [{ owner_id: OWNER, plan: "free", status: "none", trial_end: iso(Date.now() + 5 * day), rzp_subscription_id: null }] }); });
  const post = async (type: string, data: unknown, id = `msg_${Math.random()}`, sig?: string) => {
    const { POST } = await import("@/app/api/billing/dodo-webhook/route");
    const body = JSON.stringify({ business_id: "bus_1", type, timestamp: new Date().toISOString(), data });
    const ts = Math.floor(Date.now() / 1000);
    return POST(new Request("https://usegrowvia.com/api/billing/dodo-webhook", { method: "POST", body, headers: { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": sig ?? sign(id, ts, body) } }));
  };
  it("activates the plan, records the payment, ignores duplicates and bad signatures", async () => {
    expect((await post("subscription.active", sub(), "m1", "v1,bad")).status).toBe(401);
    const r = await post("subscription.active", sub(), "m1");
    expect(r.status).toBe(200);
    const row = db.tables.subscriptions[0];
    expect(row).toMatchObject({ plan: "growth", provider: "dodo", rzp_subscription_id: "sub_new1", status: "active" });
    expect(await (await post("subscription.active", sub(), "m1")).json()).toMatchObject({ duplicate: true });
    await post("payment.succeeded", { payment_id: "pay_1", status: "succeeded", total_amount: 4500, currency: "USD", subscription_id: "sub_new1", card_network: "VISA", card_last_four: "4242", created_at: new Date().toISOString(), metadata: {} });
    expect(db.tables.payments[0]).toMatchObject({ id: "pay_1", owner_id: OWNER, amount: 4500, status: "paid", method: "VISA •••• 4242" });
    expect(db.tables.subscriptions[0].payment_method).toBe("VISA •••• 4242");
    // Later events on the same subscription (no metadata) still find the account.
    await post("subscription.renewed", sub({ metadata: {}, next_billing_date: iso(Date.now() + 59 * day) }));
    expect(Date.parse(db.tables.subscriptions[0].current_end as string)).toBeGreaterThan(Date.now() + 58 * day);
    await post("subscription.cancelled", sub({ metadata: {}, status: "cancelled", cancelled_at: new Date().toISOString() }));
    // Paid access is gone (what's left of the original free trial still applies, as with Razorpay).
    expect(P.resolvePlan(db.tables.subscriptions[0] as never, null).source).toBe("trial");
  });
});

/* ── Billing actions against a fake Dodo API ── */
describe("billing actions", () => {
  let calls: { method: string; url: string; body: Record<string, unknown> | null }[] = [];
  let remote: Record<string, ReturnType<typeof sub>> = {};
  beforeEach(() => {
    calls = []; remote = {};
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ method: init.method ?? "GET", url, body });
      const path = new URL(url).pathname;
      const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
      if (path === "/checkouts") return json({ session_id: "cks_1", checkout_url: "https://test.checkout.dodopayments.com/session/cks_1" });
      const m = path.match(/^\/subscriptions\/([^/]+)(\/.*)?$/);
      if (m) {
        const s = remote[m[1]]; if (!s) return json({ message: "not found" }, 404);
        if (!m[2] && init.method === "GET") return json(s);
        if (!m[2] && init.method === "PATCH") { if (body?.status === "cancelled") s.status = "cancelled" as never; if ("cancel_at_next_billing_date" in body!) s.cancel_at_next_billing_date = body!.cancel_at_next_billing_date as boolean; return json(s); }
        if (m[2] === "/change-plan") {
          if (body!.effective_at === "immediately") s.product_id = body!.product_id as string;
          else s.scheduled_change = { product_id: body!.product_id as string, effective_at: s.next_billing_date! };
          return json({});
        }
        if (m[2] === "/change-plan/scheduled") { s.scheduled_change = null; return new Response(null, { status: 204 }); }
      }
      if (/\/customer-portal\/session$/.test(path)) return json({ link: "https://customer.dodopayments.com/portal/x" });
      return json({ message: "unexpected " + path }, 500);
    });
  });
  const A = () => import("@/app/billing-actions");

  it("from the trial: opens Dodo checkout for the chosen plan with the account in metadata", async () => {
    db = fakeDb({ subscriptions: [{ owner_id: OWNER, plan: "free", status: "none", trial_end: iso(Date.now() + 5 * day), rzp_subscription_id: null }] });
    const r = await (await A()).startCheckoutAction("year", "USD", "agency");
    expect(r.ok && r.checkout?.redirect).toBe("https://test.checkout.dodopayments.com/session/cks_1");
    const c = calls.find((x) => x.url.endsWith("/checkouts"))!;
    expect(c.body).toMatchObject({ product_cart: [{ product_id: D.productFor("agency", "year"), quantity: 1 }], customer: { email: "jane@example.com" }, billing_currency: "USD", metadata: { owner_id: OWNER, plan: "agency", interval: "year" } });
    expect(c.body!.return_url).toBe("https://usegrowvia.com/app/billing?dodo=return");
    expect(c.body!.subscription_data).toBeUndefined(); // trial users are charged now, like Razorpay
  });

  it("back from checkout: confirms, switches the plan on, and refuses someone else's subscription", async () => {
    db = fakeDb({ subscriptions: [{ owner_id: OWNER, plan: "free", status: "none", trial_end: null, rzp_subscription_id: null }] });
    remote.sub_new1 = sub();
    remote.sub_other = sub({ subscription_id: "sub_other", metadata: { owner_id: "someone-else" } });
    const a = await A();
    expect(await a.confirmDodoAction("sub_other")).toMatchObject({ ok: false });
    expect(await a.confirmDodoAction("sub_new1")).toMatchObject({ ok: true });
    expect(db.tables.subscriptions[0]).toMatchObject({ plan: "growth", provider: "dodo", status: "active" });
  });

  it("upgrade now, downgrade at renewal, undo, cancel at period end, card portal", async () => {
    remote.sub_new1 = sub();
    db = fakeDb({ subscriptions: [{ ...S.dodoRow(sub(), OWNER, null)!.row, trial_end: null }] });
    const a = await A();
    // Growth → Agency: immediate, prorated.
    const up = await a.startCheckoutAction("month", "USD", "agency");
    expect(up).toMatchObject({ ok: true });
    expect(calls.find((c) => c.url.endsWith("/change-plan"))!.body).toMatchObject({ product_id: D.productFor("agency", "month"), proration_billing_mode: "prorated_immediately", effective_at: "immediately" });
    expect(db.tables.subscriptions[0].plan).toBe("agency");
    // Agency → Pro: at the next billing date, nothing charged now; plan stays Agency meanwhile.
    calls = [];
    const down = await a.startCheckoutAction("month", "USD", "pro");
    expect(down.ok && down.message).toMatch(/move to Pro/);
    expect(calls.find((c) => c.url.endsWith("/change-plan"))!.body).toMatchObject({ effective_at: "next_billing_date", proration_billing_mode: "do_not_bill" });
    expect(db.tables.subscriptions[0]).toMatchObject({ plan: "agency" });
    expect((db.tables.subscriptions[0].scheduled_change as { plan: string }).plan).toBe("pro");
    // Picking Agency again undoes the scheduled downgrade.
    const keep = await a.startCheckoutAction("month", "USD", "agency");
    expect(keep.ok && keep.message).toMatch(/staying on Agency/);
    expect(db.tables.subscriptions[0].scheduled_change).toBeNull();
    // Choosing rupees while paying in dollars is refused with a clear message (no double subscription).
    expect((await a.startCheckoutAction("month", "INR", "pro")).ok).toBe(false);
    // Change card → customer portal.
    const pm = await a.changePaymentMethodAction();
    expect(pm.ok && pm.checkout?.redirect).toBe("https://customer.dodopayments.com/portal/x");
    // Cancel at period end.
    const c = await a.cancelSubscriptionAction("end");
    expect(c.ok && c.message).toMatch(/You keep Agency until/);
    expect(remote.sub_new1.cancel_at_next_billing_date).toBe(true);
    expect(db.tables.subscriptions[0].cancel_at_period_end).toBe(true);
    // Same plan again before it ends: un-cancel, no new checkout.
    calls = [];
    const back = await a.startCheckoutAction("month", "USD", "agency");
    expect(back.ok && back.message).toMatch(/carries on/);
    expect(calls.some((x) => x.url.endsWith("/checkouts"))).toBe(false);
    expect(remote.sub_new1.cancel_at_next_billing_date).toBe(false);
  });

  it("a cancelled plan with time left: new checkout gets those days free", async () => {
    const row = { ...S.dodoRow(sub({ cancel_at_next_billing_date: true, next_billing_date: iso(Date.now() + 10 * day) }), OWNER, null)!.row, trial_end: null };
    db = fakeDb({ subscriptions: [row] });
    const r = await (await A()).startCheckoutAction("month", "USD", "pro");
    expect(r.ok).toBe(true);
    const c = calls.find((x) => x.url.endsWith("/checkouts"))!;
    expect((c.body!.subscription_data as { trial_period_days: number }).trial_period_days).toBe(10);
  });
});
