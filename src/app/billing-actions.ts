"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { repo } from "@/lib/data";
import { adminClient } from "@/lib/server/admin";
import { billingReady, prepaidReady, CHARGE_CURRENCIES, PLAN_INFO, PLAN_RANK, PRICES, RZP, fmtMoney, isPaidPlan, type Currency, type Interval, type PaidPlan } from "@/lib/billing/config";
import { bustPlan, freshPlan as planFor } from "@/lib/billing/plan";
import { checkoutSignatureOk, orderSignatureOk, priceFor, rzp, RazorpayError } from "@/lib/billing/razorpay";
import { applyPrepaid, prepaidEnd } from "@/lib/billing/prepaid";
import { applySubscription, recordPayment, refreshFromRazorpay } from "@/lib/billing/sync";
import { p as para, rows } from "@/lib/notify";
import { layout, sendSystemEmail } from "@/lib/mail/system";
import { CONTACT_EMAIL as CONTACT } from "@/lib/site/features";

type R<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };
export type Checkout = { subscriptionId?: string; orderId?: string; amount?: number; currency?: string; notes?: Record<string, string>; keyId: string; script: string; description: string; prefill: { name: string; email: string }; startsLater?: string };

const done = () => { revalidatePath("/app/billing"); revalidatePath("/app", "layout"); };

async function me() {
  const user = await repo().getUser();
  if (!user) throw new Error("signin");
  return user;
}

function friendly(e: unknown, currency?: Currency): string {
  if (e instanceof RazorpayError) {
    if (currency === "USD" && /currency/i.test(e.message)) return "Paying in US dollars isn't available yet — please choose Indian rupees (₹). It's the same plan, and international cards work too.";
    if (e.status === 401) return "Payments aren't set up correctly yet (Razorpay rejected the API keys) — nothing was charged. Please try again later or email support. (Admin: open /api/health → razorpay:keys for the fix.)";
    if (e.status === 0) return e.message;
    return `Razorpay said: ${e.message}. Nothing was charged — try again, or contact support.`;
  }
  if (e instanceof Error && e.message === "signin") return "Please sign in again.";
  return "Something went wrong on our side — nothing was charged. Please try again.";
}

/* Razorpay can refuse US-dollar subscriptions until the account has international payments switched on.
   When that happens we remember it for 12 hours (so the dollar option is hidden), and charge the same plan in rupees. */
const USD_OFF = "usd-off";
const isCurrencyErr = (e: unknown) => e instanceof RazorpayError && /currency|international|not (enabled|supported)/i.test(e.message);
async function markUsdOff() { await adminClient()?.from("billing_plans").upsert({ key: USD_OFF, rzp_plan_id: new Date().toISOString() }, { onConflict: "key" }); }
type SubOpts = { ownerId: string; email: string; startAt?: number; replaces?: string; tier?: PaidPlan; mode?: "upgrade" | "downgrade" | "keep" | "new" };
/** Creates the subscription; if dollars are refused, retries in rupees. */
async function subscribe(interval: Interval, currency: Currency, o: SubOpts) {
  const tier = o.tier ?? "pro";
  try {
    const { id, amount } = await planId(interval, currency, tier);
    return { s: await rzp.createSubscription({ planId: id, interval, ...o, tier }), amount, currency, fellBack: false };
  } catch (e) {
    if (currency !== "USD" || !isCurrencyErr(e) || !CHARGE_CURRENCIES.includes("INR")) throw e;
    await markUsdOff();
    const { id, amount } = await planId(interval, "INR", tier);
    return { s: await rzp.createSubscription({ planId: id, interval, ...o, tier }), amount, currency: "INR" as Currency, fellBack: true };
  }
}

/** Razorpay plan key: Pro keeps the original "month-INR-168000" form; other plans are prefixed ("growth:month-INR-…"). */
const planKey = async (tier: PaidPlan, interval: Interval, currency: Currency, amount: number) => `${tier === "pro" ? "" : `${tier}:`}${interval}-${currency}-${amount}`;

/** Finds (or creates once) the Razorpay plan for this price. */
async function planId(interval: Interval, currency: Currency, tier: PaidPlan = "pro") {
  const db = adminClient()!;
  const { amount } = await priceFor(interval, currency, tier);
  const key = await planKey(tier, interval, currency, amount);
  const { data } = await db.from("billing_plans").select("rzp_plan_id").eq("key", key).maybeSingle();
  if (data) return { id: data.rzp_plan_id as string, amount };
  const p = await rzp.createPlan(interval, currency, amount, tier);
  await db.from("billing_plans").upsert({ key, rzp_plan_id: p.id }, { onConflict: "key" });
  return { id: p.id, amount };
}

const per = (i: Interval) => (i === "month" ? "monthly" : "yearly");
const day = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric" });

const notReady = (): { ok: false; error: string } => ({ ok: false, error: adminClient() ? "Online payments aren't switched on yet. Email us and we'll upgrade you by hand." : "Billing needs the server key (SUPABASE_SERVICE_ROLE_KEY) — please tell support." });

/**
 * Step 1 of choosing a plan: creates the subscription and returns what Razorpay Checkout needs.
 * - From Free or the trial: the chosen plan starts now and is charged now.
 * - A higher plan than today's: starts now; the old plan stops now and its unused days are refunded.
 * - A lower plan: starts when the current paid period ends (you keep today's plan until then).
 * - Same plan, other billing period: monthly ↔ yearly switch.
 */
export async function startCheckoutAction(interval: Interval, currency: Currency, tierIn: PaidPlan = "pro"): Promise<R<{ checkout?: Checkout }>> {
  try {
    const user = await me();
    if (!billingReady() || !adminClient()) return notReady();
    const tier: PaidPlan = isPaidPlan(tierIn) ? tierIn : "pro";
    if (!["month", "year"].includes(interval)) return { ok: false, error: "Pick monthly or yearly." };
    const prepaid = currency === "USD" && prepaidReady();
    if (!CHARGE_CURRENCIES.includes(currency) && !prepaid) return { ok: false, error: `Payments in ${currency} aren't available — choose ${CHARGE_CURRENCIES.join(" or ")}.` };
    const plan = await planFor(user.id);
    const sub = plan.sub;
    if (prepaid) return startPrepaid(user, plan, tier, interval);
    const name = PLAN_INFO[tier].name;
    const live = plan.source === "paid" && !plan.endsAt && sub?.rzp_subscription_id && sub.provider !== "prepaid";
    let startAt: number | undefined;
    let mode: SubOpts["mode"] = "new";
    if (live) {
      const curTier = plan.plan as PaidPlan;
      const end = sub?.current_end ? Math.floor(Date.parse(sub.current_end) / 1000) : 0;
      if (sub?.scheduled_change?.plan && curTier === tier) {
        // Undo a scheduled move to a cheaper plan: carry on with this plan from the end of the paid period (no charge today).
        mode = "keep";
        startAt = end > Date.now() / 1000 + 20 * 60 ? end : undefined;
      } else if (curTier === tier && sub?.billing_interval === interval) return { ok: false, error: `You're already on ${name} (${per(interval)}).` };
      else if (curTier === tier) return switchIntervalAction(interval, currency);
      else if (PLAN_RANK[tier] > PLAN_RANK[curTier]) mode = "upgrade";
      else {
        mode = "downgrade";
        startAt = end > Date.now() / 1000 + 20 * 60 ? end : undefined;
      }
    } else {
      // Charged at once, even during the free trial. The only wait is for time already paid for:
      // a cancelled plan that hasn't ended yet, or complimentary access with an end date.
      const until = plan.source === "paid" || plan.source === "comp" ? plan.endsAt : null;
      startAt = until && Date.parse(until) > Date.now() + 15 * 60_000 ? Math.floor(Date.parse(until) / 1000) : undefined;
    }
    const { s, amount, currency: cur } = await subscribe(interval, currency, { ownerId: user.id, email: user.email, startAt, replaces: sub?.provider !== "prepaid" ? sub?.rzp_subscription_id ?? undefined : undefined, tier, mode });
    const what = `${name} ${per(interval)} — ${fmtMoney(amount, cur)}${cur === "INR" ? ` (≈ $${PRICES[tier][interval]})` : ""}`;
    return {
      ok: true,
      checkout: {
        subscriptionId: s.id, keyId: RZP.keyId, script: RZP.checkoutJs, prefill: { name: user.name, email: user.email },
        description: mode === "upgrade" ? `${what}. Unused days of ${plan.label} are refunded.` : mode === "downgrade" && startAt ? `${what} from ${day(startAt)}` : what,
        startsLater: startAt ? new Date(startAt * 1000).toISOString() : undefined,
      },
    };
  } catch (e) { return { ok: false, error: friendly(e, currency) }; }
}

/** Step 2: Razorpay Checkout finished — verify it really came from Razorpay and switch Pro on at once. */
export async function verifyCheckoutAction(r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }): Promise<R> {
  try {
    const user = await me();
    const db = adminClient();
    if (!db) return notReady();
    if (!checkoutSignatureOk(String(r.razorpay_payment_id), String(r.razorpay_subscription_id), String(r.razorpay_signature))) {
      return { ok: false, error: "We couldn't confirm that payment. If money left your account, it will be refunded automatically by Razorpay — or email us and we'll sort it out." };
    }
    let s = await rzp.getSubscription(r.razorpay_subscription_id);
    const owner = Array.isArray(s.notes) ? undefined : s.notes?.owner_id;
    if (owner && owner !== user.id) return { ok: false, error: "That payment belongs to a different account." };
    if (s.status === "created") s = { ...s, status: "authenticated" }; // Razorpay can take a moment to flip it
    await applySubscription(db, s, { ownerId: user.id });
    const pay = await rzp.getPayment(r.razorpay_payment_id).catch(() => null);
    if (pay && pay.amount > 0) await recordPayment(db, user.id, s.id, pay);
    bustPlan(user.id);
    done();
    const later = s.status === "authenticated" && s.start_at && s.start_at * 1000 > Date.now() + 60_000;
    const tierNote = Array.isArray(s.notes) ? undefined : s.notes?.plan;
    const name = PLAN_INFO[isPaidPlan(tierNote) ? tierNote : "pro"].name;
    const mode = Array.isArray(s.notes) ? undefined : s.notes?.mode;
    if (mode === "keep") return { ok: true, message: `Done — you're staying on ${name}${later ? `. Your next charge is on ${day(s.start_at!)}` : ""}.` };
    if (later && mode === "downgrade") return { ok: true, message: `All set — you'll move to ${name} on ${day(s.start_at!)}. You keep your current plan until then.` };
    return { ok: true, message: later ? `All set — you're on ${name}, and your next charge is on ${day(s.start_at!)}.` : `Payment received — you're on ${name}${mode === "upgrade" ? ". Unused days of your old plan are being refunded" : ""}. Thank you!` };
  } catch (e) { return { ok: false, error: friendly(e) }; }
}

const PREPAID_NOTE = "You paid with PayPal for a fixed period, so there's nothing to switch or cancel. Pick a plan below to renew or upgrade — unused days are carried over.";

/**
 * PayPal through Razorpay: a one-time order for one month or one year (PayPal can't renew automatically).
 * Same plan = time is added on top; another plan = starts now and unused days are converted into the new plan.
 */
async function startPrepaid(user: { id: string; name: string; email: string }, plan: Awaited<ReturnType<typeof planFor>>, tier: PaidPlan, interval: Interval): Promise<R<{ checkout?: Checkout }>> {
  const sub = plan.sub;
  if (plan.source === "paid" && sub?.provider !== "prepaid" && !plan.endsAt) return { ok: false, error: "You already pay by card or UPI subscription. To change plans, choose Indian rupees — or cancel it first and then pay with PayPal." };
  const amount = PRICES[tier][interval] * 100;
  const { end, creditDays } = prepaidEnd(sub ? { ...sub, provider: sub.provider ?? null } : null, tier, interval);
  const notes = { owner_id: user.id, email: user.email, plan: tier, interval, mode: "prepaid" };
  try {
    const order = await rzp.createOrder({ amount, currency: "USD", receipt: `gv-${user.id.slice(0, 8)}-${Date.now()}`, notes });
    const until = new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return {
      ok: true,
      checkout: {
        orderId: order.id, amount, currency: "USD", notes, keyId: RZP.keyId, script: RZP.checkoutJs, prefill: { name: user.name, email: user.email },
        description: `${PLAN_INFO[tier].name} — ${interval === "year" ? "1 year" : "1 month"} for $${PRICES[tier][interval]} (until ${until}${creditDays ? `, incl. ${creditDays} carried-over day${creditDays === 1 ? "" : "s"}` : ""})`,
      },
    };
  } catch (e) {
    if (e instanceof RazorpayError && /currency|international|not (enabled|supported)/i.test(e.message)) return { ok: false, error: "PayPal isn't switched on for Growvia yet — please pay in Indian rupees for now, or email us and we'll help." };
    return { ok: false, error: friendly(e) };
  }
}

/** PayPal / one-time payment finished — verify with Razorpay and switch the plan on. */
export async function verifyPrepaidAction(r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }): Promise<R> {
  try {
    const user = await me();
    const db = adminClient();
    if (!db) return notReady();
    if (!orderSignatureOk(String(r.razorpay_order_id), String(r.razorpay_payment_id), String(r.razorpay_signature))) return { ok: false, error: "We couldn't confirm that payment. If money left your account it will be returned automatically — or email us and we'll sort it out." };
    const [order, pay] = await Promise.all([rzp.getOrder(r.razorpay_order_id), rzp.getPayment(r.razorpay_payment_id)]);
    const owner = Array.isArray(order.notes) ? undefined : order.notes?.owner_id;
    if (owner && owner !== user.id) return { ok: false, error: "That payment belongs to a different account." };
    const a = await applyPrepaid(db, order, pay);
    bustPlan(user.id); done();
    if (!a.ok) return { ok: false, error: a.reason === "has a live subscription" ? "Payment received, but you also have a running card/UPI subscription — email us and we'll apply it or refund it." : "Payment received — it can take a minute to show. Refresh this page shortly." };
    if ("already" in a) return { ok: true, message: "Payment received — your plan is on." };
    return { ok: true, message: `Payment received — you're on ${a.name} until ${new Date(a.end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. We'll remind you before it ends. Thank you!` };
  } catch (e) { return { ok: false, error: friendly(e) }; }
}

/** Monthly ↔ yearly. Card subscriptions change at renewal; others re-confirm the payment method (no charge until renewal). */
export async function switchIntervalAction(interval: Interval, currency?: Currency): Promise<R<{ checkout?: Checkout }>> {
  try {
    const user = await me();
    const db = adminClient();
    if (!billingReady() || !db) return notReady();
    const plan = await planFor(user.id);
    const sub = plan.sub;
    if (plan.source !== "paid" || !sub?.rzp_subscription_id) return { ok: false, error: "You don't have a paid plan to switch yet." };
    if (sub.provider === "prepaid") return { ok: false, error: PREPAID_NOTE };
    if (sub.billing_interval === interval) return { ok: false, error: "You're already on that billing period." };
    const cur = (currency ?? sub.currency ?? "USD") as Currency;
    const tier: PaidPlan = isPaidPlan(sub.plan) ? sub.plan : "pro";
    const { id, amount } = await planId(interval, cur, tier);
    const at = sub.current_end ?? new Date().toISOString();
    const when = new Date(at).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    if (sub.currency === cur && (sub.payment_method ?? "card") === "card") {
      try {
        await rzp.changePlan(sub.rzp_subscription_id, id);
        await db.from("subscriptions").update({ scheduled_change: { interval, amount, currency: cur, at } }).eq("owner_id", user.id);
        bustPlan(user.id); done();
        return { ok: true, message: `Done — you'll move to ${interval === "year" ? "yearly" : "monthly"} (${fmtMoney(amount, cur)}) on ${when}.` };
      } catch { /* not allowed for this payment method — fall through */ }
    }
    // Start a new subscription that begins when the current period ends; the old one stops then (no double charge).
    const startAt = Math.max(Math.floor(Date.parse(at) / 1000), Math.floor(Date.now() / 1000) + 20 * 60);
    const r = await subscribe(interval, cur, { ownerId: user.id, email: user.email, startAt, replaces: sub.rzp_subscription_id, tier });
    return {
      ok: true,
      checkout: { subscriptionId: r.s.id, keyId: RZP.keyId, script: RZP.checkoutJs, prefill: { name: user.name, email: user.email }, description: `Switch to ${interval === "year" ? "yearly" : "monthly"} — ${fmtMoney(r.amount, r.currency)} from ${when}`, startsLater: new Date(startAt * 1000).toISOString() },
    };
  } catch (e) { return { ok: false, error: friendly(e, currency) }; }
}

/**
 * Add or change the card / UPI / currency used for Pro. Razorpay can't swap the payment method on a running
 * subscription, so we start a fresh one on the same plan: it takes over when the current period ends (no double
 * charge) — or right away if the last payment failed — and the old one stops automatically.
 */
export async function changePaymentMethodAction(currency?: Currency): Promise<R<{ checkout?: Checkout }>> {
  try {
    const user = await me();
    const db = adminClient();
    if (!billingReady() || !db) return notReady();
    const plan = await planFor(user.id);
    const sub = plan.sub;
    if (plan.source !== "paid" || !sub?.rzp_subscription_id) return { ok: false, error: "You don't have a paid plan yet — upgrade first, then you can change how you pay." };
    if (sub.provider === "prepaid") return { ok: false, error: PREPAID_NOTE };
    const interval = (sub.billing_interval ?? "month") as Interval;
    const cur = (currency ?? sub.currency ?? CHARGE_CURRENCIES[0]) as Currency;
    if (!CHARGE_CURRENCIES.includes(cur)) return { ok: false, error: `Payments in ${cur} aren't available — choose ${CHARGE_CURRENCIES.join(" or ")}.` };
    const end = sub.current_end && Date.parse(sub.current_end) > Date.now() + 20 * 60_000 ? Math.floor(Date.parse(sub.current_end) / 1000) : undefined;
    const startAt = plan.paymentIssue ? undefined : end;
    const tier: PaidPlan = isPaidPlan(sub.plan) ? sub.plan : "pro";
    const { s, amount, currency: paid } = await subscribe(interval, cur, { ownerId: user.id, email: user.email, startAt, replaces: sub.rzp_subscription_id, tier });
    const when = startAt ? new Date(startAt * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
    return {
      ok: true,
      checkout: {
        subscriptionId: s.id, keyId: RZP.keyId, script: RZP.checkoutJs, prefill: { name: user.name, email: user.email },
        description: when ? `New payment method — next charge ${fmtMoney(amount, paid)} on ${when}` : `Pay now with a new method — ${fmtMoney(amount, paid)}`,
        startsLater: startAt ? new Date(startAt * 1000).toISOString() : undefined,
      },
    };
  } catch (e) { return { ok: false, error: friendly(e, currency) }; }
}

/** Cancels the paid plan — at the end of the paid period (default) or right away. */
export async function cancelSubscriptionAction(when: "end" | "now", reason = ""): Promise<R> {
  try {
    const user = await me();
    const db = adminClient();
    if (!billingReady() || !db) return notReady();
    const plan = await planFor(user.id);
    const sub = plan.sub;
    if (!sub?.rzp_subscription_id || plan.source !== "paid") return { ok: false, error: "There's no active paid plan to cancel." };
    if (sub.provider === "prepaid") return { ok: true, message: "Nothing to cancel — PayPal payments don't renew. Your plan simply ends on its end date." };
    // A subscription that hasn't started charging yet can only be cancelled right away.
    const now = when === "now" || sub.status === "authenticated";
    // …but if it replaced one that's already paid (after a payment-method or monthly/yearly change), keep Pro until that paid time ends.
    const paidUntil = sub.status === "authenticated" && sub.replaces && when === "end" && sub.current_end && Date.parse(sub.current_end) > Date.now() ? sub.current_end : null;
    const s = await rzp.cancel(sub.rzp_subscription_id, !now);
    await applySubscription(db, s, { ownerId: user.id });
    const patch = paidUntil
      ? { status: "cancelled", current_end: paidUntil, cancel_at_period_end: false, cancelled_at: new Date().toISOString(), scheduled_change: null }
      : now
      ? { status: "cancelled", current_end: new Date().toISOString(), cancel_at_period_end: false, cancelled_at: new Date().toISOString(), scheduled_change: null }
      : { cancel_at_period_end: true, scheduled_change: null };
    await db.from("subscriptions").update(patch).eq("owner_id", user.id);
    if (reason.trim()) console.info("[billing] cancel reason", user.id, reason.slice(0, 500));
    bustPlan(user.id); done();
    if (paidUntil) return { ok: true, message: `Cancelled. You keep ${plan.label} until ${new Date(paidUntil).toLocaleDateString("en-US", { month: "long", day: "numeric" })}, then move to Free. You won't be charged again.` };
    return { ok: true, message: now ? `Your ${plan.label} plan is cancelled. You're on Free now — nothing was deleted.` : `Cancelled. You keep ${plan.label} until ${sub.current_end ? new Date(sub.current_end).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "the end of this period"}, then move to Free. You won't be charged again.` };
  } catch (e) { return { ok: false, error: friendly(e) }; }
}

/** Re-reads the subscription from Razorpay (in case a webhook was missed). */
export async function refreshBillingAction(): Promise<R> {
  try {
    const user = await me();
    const db = adminClient();
    if (!billingReady() || !db) return notReady();
    const plan = await planFor(user.id);
    if (!plan.sub?.rzp_subscription_id || plan.sub.provider === "prepaid") return { ok: true, message: "Up to date." };
    await refreshFromRazorpay(db, user.id, plan.sub.rzp_subscription_id);
    bustPlan(user.id); done();
    return { ok: true, message: "Up to date." };
  } catch (e) { return { ok: false, error: friendly(e) }; }
}

/** "Talk to us" for Agency pricing — emails the team. */
const recent = new Map<string, number>();
export async function contactSalesAction(_: unknown, f: FormData): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const v = (k: string, n = 500) => String(f.get(k) ?? "").trim().slice(0, n);
  if (v("website_url")) return { ok: true, message: "Thanks — we'll be in touch within one business day." }; // bot trap
  const name = v("name", 80), email = v("email", 254).toLowerCase(), company = v("company", 120), clients = v("clients", 40), note = v("message", 2000);
  if (!name) return { error: "Please add your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Please enter a valid email so we can reply." };
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (Date.now() - (recent.get(ip) ?? 0) < 30_000) return { error: "Thanks — we already got your message. We'll reply soon." };
  recent.set(ip, Date.now());
  const subject = `Agency pricing request — ${company || name}`;
  const body = rows([["Name", name], ["Email", email], ["Company", company || "—"], ["Clients / projects", clients || "—"]]) + (note ? para(note.replace(/</g, "&lt;").replace(/\n/g, "<br>")) : "");
  const r = await sendSystemEmail({ to: CONTACT, subject, replyTo: email, html: layout({ title: "New Agency enquiry", preheader: subject, body }) }).catch(() => ({ ok: false }));
  if (!r.ok) return { error: `We couldn't send that just now — please email ${CONTACT} directly.` };
  return { ok: true, message: "Thanks — we'll reply within one business day with pricing for your team." };
}

/** Which currencies to offer right now (dollars are hidden for 12 hours after Razorpay refuses them). */
export async function offeredCurrencies(): Promise<Currency[]> {
  // With PayPal on, dollars are always offered (paid once through PayPal, not as a card subscription).
  if (prepaidReady()) return CHARGE_CURRENCIES.includes("USD") ? CHARGE_CURRENCIES : ["USD", ...CHARGE_CURRENCIES];
  const db = adminClient();
  if (!db || !CHARGE_CURRENCIES.includes("USD") || !CHARGE_CURRENCIES.includes("INR")) return CHARGE_CURRENCIES;
  const { data } = await db.from("billing_plans").select("rzp_plan_id").eq("key", USD_OFF).maybeSingle();
  const off = data && Date.now() - Date.parse(data.rzp_plan_id as string) < 12 * 3600_000;
  return off ? CHARGE_CURRENCIES.filter((c) => c !== "USD") : CHARGE_CURRENCIES;
}
