"use client";
import { HIGHLIGHTS, PAID_PLANS, PLAN_INFO, PLAN_RANK, PRICES, isPaidPlan, type PaidPlan, type PlanId } from "@/lib/billing/catalog";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, RefreshCw } from "lucide-react";
import { cancelSubscriptionAction, changePaymentMethodAction, refreshBillingAction, startCheckoutAction, switchIntervalAction, verifyCheckoutAction, verifyPrepaidAction, type Checkout } from "@/app/billing-actions";

type Interval = "month" | "year";
type Currency = "USD" | "INR";
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, f: (r: { error?: { description?: string } }) => void) => void } } }

let loading: Promise<void> | null = null;
function loadScript(src: string) {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => res();
    s.onerror = () => { loading = null; rej(new Error("Couldn't load the payment window — check your connection or turn off ad blockers for this site.")); };
    document.head.appendChild(s);
  });
  return loading;
}

type M = { ok: boolean; text: string } | null;
/* The result message lives outside the buttons, so it stays on screen when the page updates (e.g. the upgrade box disappears once you're on Pro). */
let flash: M = null;
const setFlash = (m: M | ((cur: M) => M)) => { flash = typeof m === "function" ? m(flash) : m; dispatchEvent(new Event("gv:billing-msg")); };

export function BillingFlash() {
  const [m, setM] = useState<M>(flash);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const on = () => setM(flash); addEventListener("gv:billing-msg", on); return () => { removeEventListener("gv:billing-msg", on); flash = null; }; }, []);
  useEffect(() => { if (m) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [m]);
  return m ? <div ref={ref} className="mb-5 scroll-mt-20"><Msg m={m} /></div> : null;
}

/** Opens Razorpay Checkout and verifies the result on our server. */
function useCheckout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const setMsg = setFlash;
  // After a change, drop ?plan=…&interval=… from the address so the picker shows the new state.
  const reload = () => { if (window.location.search) router.replace(window.location.pathname, { scroll: false }); router.refresh(); };
  const open = async (c: Checkout) => {
    await loadScript(c.script);
    await new Promise<void>((resolve) => {
      const rz = new window.Razorpay!({
        key: c.keyId, name: "Growvia", image: `${window.location.origin}/logo.png`, description: c.description,
        ...(c.orderId ? { order_id: c.orderId, amount: c.amount, currency: c.currency, notes: c.notes } : { subscription_id: c.subscriptionId }),
        prefill: c.prefill, theme: { color: "#0B0D0C" }, remember_customer: true,
        handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id?: string; razorpay_order_id?: string; razorpay_signature: string }) => {
          setMsg({ ok: true, text: "Confirming your payment…" });
          const lost = { ok: false as const, error: "Connection lost while confirming — refresh in a moment; if you were charged, your plan switches on automatically." };
          const v = r.razorpay_order_id
            ? await verifyPrepaidAction({ razorpay_payment_id: r.razorpay_payment_id, razorpay_order_id: r.razorpay_order_id, razorpay_signature: r.razorpay_signature }).catch(() => lost)
            : await verifyCheckoutAction({ razorpay_payment_id: r.razorpay_payment_id, razorpay_subscription_id: r.razorpay_subscription_id ?? "", razorpay_signature: r.razorpay_signature }).catch(() => lost);
          setMsg(v.ok ? { ok: true, text: v.message ?? "You're all set." } : { ok: false, text: v.error });
          reload();
          resolve();
        },
        modal: { ondismiss: () => { setMsg((m) => m ?? { ok: false, text: "Payment window closed — nothing was charged." }); resolve(); }, confirm_close: true },
      });
      rz.on("payment.failed", (r) => setMsg({ ok: false, text: `Payment failed: ${r.error?.description ?? "please try another method"}. Nothing was charged.` }));
      rz.open();
    });
  };
  const run = async (start: () => Promise<{ ok: true; checkout?: Checkout; message?: string } | { ok: false; error: string }>) => {
    setBusy(true); setMsg(null);
    try {
      const r = await start();
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      if (r.checkout) await open(r.checkout);
      else { setMsg({ ok: true, text: r.message ?? "Done." }); reload(); }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong — nothing was charged." });
    } finally { setBusy(false); }
  };
  return { busy, run };
}

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <p role={m.ok ? "status" : "alert"} data-testid="billing-msg" className={`rounded-xl border px-3.5 py-2.5 text-[14px] ${m.ok ? "border-lime-500/40 bg-lime/15 text-lime-800" : "border-red-200 bg-red-50 text-red-700"}`}>{m.text}</p>;
}

type Tier = PaidPlan;
const TIERS: Tier[] = PAID_PLANS;

/**
 * Pick any paid plan, monthly or yearly. Works from Free, the trial, or a paid plan:
 * higher plan = starts now (unused days refunded) · lower plan = starts when the paid period ends.
 */
export function PlanPicker({ current, live, curInterval, scheduled, periodEnd, defaultTier, defaultInterval, currencies, defaultCurrency, inr, rate, paypal = false, prepaidUntil = "" }: {
  current: PlanId; live: boolean; curInterval: Interval | null; scheduled: Tier | null; periodEnd: string;
  defaultTier: Tier; defaultInterval: Interval; currencies: Currency[]; defaultCurrency: Currency;
  inr: Record<Tier, { month: string; year: string }> | null; rate: number;
  /** US dollars are paid once through PayPal (no auto-renew). */ paypal?: boolean; /** set when the current plan is a prepaid (PayPal) period */ prepaidUntil?: string;
}) {
  const [interval, setIv] = useState<Interval>(defaultInterval);
  const [tier, setTier] = useState<Tier>(defaultTier);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const { busy, run } = useCheckout();
  const usd = (t: Tier, i: Interval = interval) => `$${PRICES[t][i]}`;
  const price = (t: Tier) => (currency === "INR" && inr ? inr[t][interval] : usd(t));
  const per = interval === "month" ? "month" : "year";
  const name = PLAN_INFO[tier].name;
  const isCur = live && tier === current;
  const up = live && isPaidPlan(current) && PLAN_RANK[tier] > PLAN_RANK[current];
  const down = live && isPaidPlan(current) && PLAN_RANK[tier] < PLAN_RANK[current];
  const viaPaypal = paypal && currency === "USD";
  const same = isCur && curInterval === interval && !scheduled && !prepaidUntil;
  const label = same ? `You're on ${name} (${interval === "month" ? "monthly" : "yearly"})`
    : isCur && scheduled ? `Keep ${name} — cancel the switch to ${PLAN_INFO[scheduled].name}`
    : isCur ? `Switch ${name} to ${interval === "month" ? "monthly" : "yearly"}`
    : up ? `Upgrade to ${name} now — ${price(tier)}/${per}`
    : down ? `Switch to ${name} on ${periodEnd || "your renewal date"} — ${price(tier)}/${per}`
    : `Get ${name} — ${price(tier)}/${per}`;
  const note = same ? "Pick another plan above to change." : isCur && scheduled ? `Nothing is charged today; ${name} carries on from ${periodEnd || "your renewal date"}.`
    : isCur ? "The new billing period starts at your next renewal — no double charge."
    : up ? `${name} starts the moment you pay. The unused days of ${PLAN_INFO[current].name} are refunded to your card or UPI within 5–7 working days.`
    : down ? `You keep ${PLAN_INFO[current].name} until ${periodEnd || "the end of the period you paid for"}; ${name} starts then. Nothing is charged today.`
    : `${name} starts the moment you pay. Cancel anytime — you keep it until the end of the period you paid for.`;
  const span = interval === "month" ? "1 month" : "1 year";
  const ppLabel = prepaidUntil && tier === current ? `Add ${span} of ${name} with PayPal — ${usd(tier)}` : prepaidUntil ? `Switch to ${name} with PayPal — ${usd(tier)} for ${span}` : `Pay with PayPal — ${name}, ${span} for ${usd(tier)}`;
  const ppNote = prepaidUntil && tier === current ? `Added on top of your current time (now until ${prepaidUntil}).` : prepaidUntil ? `${name} starts now; the unused days of ${PLAN_INFO[current].name} are converted into extra days.` : `${name} starts the moment you pay.`;
  return (
    <div className="mt-5 grid gap-4" data-testid="plan-picker">
      <div role="radiogroup" aria-label="Billing period" className="inline-flex w-fit rounded-full bg-mist p-1 text-[13px]">
        {(["month", "year"] as const).map((i) => (
          <button key={i} role="radio" aria-checked={interval === i} onClick={() => setIv(i)} data-testid={`iv-${i}`} className={`rounded-full px-4 py-1.5 transition ${interval === i ? "bg-ink text-white" : "text-stone-600 hover:text-ink"}`}>{i === "month" ? "Monthly" : "Yearly · 2 months free"}</button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Plan" className="grid gap-3 md:grid-cols-3">
        {TIERS.map((t) => {
          const on = tier === t, mine = live && current === t;
          return (
            <button key={t} role="radio" aria-checked={on} onClick={() => setTier(t)} data-testid={`tier-${t}`} className={`relative grid content-start gap-2 rounded-2xl border p-4 text-left transition ${on ? "border-ink ring-2 ring-ink" : "border-line hover:border-stone-400"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">{PLAN_INFO[t].name}</span>
                {mine ? <span className="rounded-full bg-lime/30 px-2 py-0.5 text-[11px] text-lime-900">Your plan</span> : scheduled === t ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">From {periodEnd}</span> : t === "growth" ? <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-white">Best value</span> : null}
              </span>
              <span className="text-[24px] font-semibold tracking-tight">{price(t)}<span className="text-[13px] font-normal text-stone-500">/{per}</span></span>
              <span className="text-[12px] text-stone-500">{interval === "year" ? `$${(PRICES[t].year / 12).toFixed(2)}/month, billed yearly` : `or ${usd(t, "year")}/year`}</span>
              <ul className="mt-1 grid gap-1 text-[13px] text-stone-600">{HIGHLIGHTS[t].slice(0, 4).map((h) => <li key={h} className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-700" />{h}</li>)}</ul>
            </button>
          );
        })}
      </div>
      {currencies.length > 1 && inr && (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-1 text-[13px] font-medium">Pay in</legend>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-[14px] has-[:checked]:border-ink"><input type="radio" name="cur" checked={currency === "USD"} onChange={() => setCurrency("USD")} /> <span><b>US dollars</b> — {usd(tier)} <span className="text-stone-500">{paypal ? "(PayPal — outside India)" : "(international cards)"}</span></span></label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-[14px] has-[:checked]:border-ink"><input type="radio" name="cur" checked={currency === "INR"} onChange={() => setCurrency("INR")} /> <span><b>Indian rupees</b> — {inr[tier][interval]} <span className="text-stone-500">(₹{rate.toFixed(2)}/$; UPI, cards, netbanking)</span></span></label>
        </fieldset>
      )}
      <button disabled={busy || (same && !viaPaypal)} onClick={() => run(() => startCheckoutAction(interval, currency, tier))} className={`h-12 text-[15px] disabled:opacity-60 ${viaPaypal ? "btn inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFC439] font-semibold text-[#111] hover:brightness-95" : "btn-primary"}`} data-testid="checkout">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening secure checkout…</> : <><Lock className="h-4 w-4" /> {viaPaypal ? ppLabel : label}</>}
      </button>
      <p className="text-[12px] text-stone-500" data-testid="picker-note">{viaPaypal ? <>{ppNote} PayPal is a one-time payment: it doesn&apos;t renew automatically — we&apos;ll email you a week before it ends so you can renew. Secure payment by Razorpay + PayPal.</> : <>{note} Secure payment by Razorpay.</>}</p>
    </div>
  );
}

export function BillingActions({ name = "Pro", interval, ending, startsLater, periodEnd, method, currencies = [], issue = false }: { name?: string; interval: Interval; ending: boolean; startsLater: boolean; periodEnd: string; method?: string | null; currencies?: Currency[]; issue?: boolean }) {
  const [payCur, setPayCur] = useState<Currency | "">("");
  const { busy, run } = useCheckout();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const other: Interval = interval === "month" ? "year" : "month";
  return (
    <div className="mt-2 grid gap-3">
      {!ending && currencies.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-[13px] text-stone-600">New payment method pays in
          <select value={payCur} onChange={(e) => setPayCur(e.target.value as Currency | "")} className="h-8 rounded-lg border border-line bg-white px-2 text-[13px]" aria-label="Currency for the new payment method">
            <option value="">same currency as now</option>{currencies.map((c) => <option key={c} value={c}>{c === "USD" ? "US dollars (international cards)" : "Indian rupees (UPI, Indian cards)"}</option>)}
          </select>
        </label>
      )}
      {!ending && (
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => run(() => switchIntervalAction(other))} className="btn-ghost h-10 px-4 text-[14px]">{other === "year" ? "Switch to yearly (2 months free)" : "Switch to monthly"}</button>
          <button disabled={busy} onClick={() => run(() => changePaymentMethodAction(payCur || undefined))} className={`${issue ? "btn-primary" : "btn-ghost"} h-10 px-4 text-[14px]`} data-testid="change-method">{issue ? "Update payment method" : method ? "Change payment method" : "Add payment method"}</button>
          <button disabled={busy} onClick={() => setConfirm(true)} className="h-10 rounded-xl px-4 text-[14px] text-red-700 hover:bg-red-50" data-testid="cancel-open">Cancel subscription</button>
          <button disabled={pending} onClick={() => start(async () => { await refreshBillingAction(); router.refresh(); })} className="grid h-10 w-10 place-items-center rounded-xl text-stone-400 hover:bg-mist hover:text-ink" aria-label="Refresh billing status" title="Refresh"><RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /></button>
        </div>
      )}
      {confirm && !ending && (
        <div className="grid gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4" data-testid="cancel-box">
          <p className="text-[14px] font-medium">Cancel {name}?</p>
          <p className="text-[13px] text-stone-600">{startsLater ? "You haven't been charged yet — cancelling stops the subscription now, and you won't be charged." : `You keep ${name} until ${periodEnd || "the end of this period"} and won't be charged again. Nothing is deleted; anything above the Free limits just can't grow.`}</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Anything we could do better? (optional)" rows={2} className="rounded-xl border border-line bg-white p-2.5 text-[14px]" />
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => run(() => cancelSubscriptionAction("end", reason)).then(() => setConfirm(false))} className="h-10 rounded-xl bg-red-600 px-4 text-[14px] font-medium text-white hover:bg-red-700" data-testid="cancel-confirm">{startsLater ? "Cancel subscription" : `Cancel at period end`}</button>
            {!startsLater && <button disabled={busy} onClick={() => { if (window.confirm(`End ${name} right now? The rest of this period isn't refunded automatically.`)) run(() => cancelSubscriptionAction("now", reason)).then(() => setConfirm(false)); }} className="h-10 rounded-xl px-4 text-[13px] text-red-700 underline underline-offset-4">Cancel immediately</button>}
            <button onClick={() => setConfirm(false)} className="btn-ghost h-10 px-4 text-[14px]">Keep {name}</button>
          </div>
        </div>
      )}
    </div>
  );
}
