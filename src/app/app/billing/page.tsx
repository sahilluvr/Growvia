import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { AlertTriangle, Check, CreditCard, Sparkles } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { adminClient } from "@/lib/server/admin";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { COMPARE, LIMIT_LABEL, PAID_PLANS, PLAN_INFO, PRICES, billingReady, prepaidReady, fmtMoney, isPaidPlan, nextPlan, type LimitKey, type PaidPlan } from "@/lib/billing/config";
import { planFor, usageFor } from "@/lib/billing/plan";
import { priceFor } from "@/lib/billing/razorpay";
import { BillingActions, BillingFlash, PlanPicker } from "./client";
import { UsageNudge } from "@/components/app/UsageNudge";
import { offeredCurrencies } from "@/app/billing-actions";
import { CONTACT_EMAIL } from "@/lib/site/features";

export const metadata: Metadata = { title: "Plan & billing" };
export const dynamic = "force-dynamic";

const d = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

export default async function BillingPage({ searchParams }: { searchParams: { upgrade?: string; plan?: string; interval?: string; welcome?: string } }) {
  const { user, business } = await requireBusiness();
  const db = adminClient() ?? supabaseServer();
  const currencies = await offeredCurrencies();
  const inrOn = currencies.includes("INR");
  const [plan, usage, payments, inrList, ownerName] = await Promise.all([
    planFor(user.id),
    usageFor(user.id),
    db.from("payments").select("id, amount, currency, status, method, invoice_url, paid_at").eq("owner_id", user.id).order("paid_at", { ascending: false }).limit(24).then((r) => r.data ?? []),
    inrOn ? Promise.all(PAID_PLANS.flatMap((t) => (["month", "year"] as const).map((i) => priceFor(i, "INR", t)))).catch(() => null) : null,
    business.owner_id !== user.id ? db.from("profiles").select("name").eq("id", business.owner_id).maybeSingle().then((r) => r.data?.name as string | undefined) : null,
  ]);
  const country = headers().get("x-vercel-ip-country") ?? "";
  const sub = plan.sub;
  const paidLive = plan.source === "paid";
  const prepaid = paidLive && sub?.provider === "prepaid";
  const live = paidLive && !plan.endsAt;
  const canBuy = plan.source === "free" || plan.source === "trial" || paidLive || (plan.source === "comp" && Boolean(plan.endsAt));
  const inr = inrList ? Object.fromEntries(PAID_PLANS.map((t, k) => [t, { month: fmtMoney(inrList[k * 2].amount, "INR"), year: fmtMoney(inrList[k * 2 + 1].amount, "INR") }])) as Record<PaidPlan, { month: string; year: string }> : null;
  const rate = inrList?.[0]?.rate ?? 0;
  const scheduled = isPaidPlan(sub?.scheduled_change?.plan) ? sub!.scheduled_change!.plan as PaidPlan : null;
  const asked = isPaidPlan(searchParams.plan) ? searchParams.plan : null;
  const defaultTier: PaidPlan = asked ?? (live && isPaidPlan(plan.plan) ? nextPlan(plan.plan) ?? plan.plan : "pro");
  const defaultInterval = searchParams.interval === "year" || searchParams.upgrade === "year" ? "year" : searchParams.interval === "month" ? "month" : live && sub?.billing_interval ? sub.billing_interval : "month";
  const priceOf = (t: PaidPlan, i: "month" | "year") => `$${PRICES[t][i]}`;
  const keys = Object.keys(LIMIT_LABEL) as LimitKey[];

  return (
    <>
      <PageHeader title="Plan & billing" sub="Your plan covers every project and teammate on your account." />
      <BillingFlash />
      {searchParams.welcome && asked && (
        <p className="mb-4 rounded-xl border border-lime-500/40 bg-lime/15 px-4 py-3 text-[14px] text-lime-900" data-testid="welcome-plan">Your workspace and first campaign are ready. Last step: confirm <b>{PLAN_INFO[asked].name}</b> below — or <Link href="/app?welcome=1" className="underline">skip for now</Link> and keep using {plan.label}.</p>
      )}
      {ownerName && (
        <p className="mb-4 rounded-xl border border-line bg-mist px-4 py-3 text-[14px] text-stone-600">You&apos;re working in <b>{business.name}</b>, which belongs to <b>{ownerName}</b>&apos;s account — their plan applies there. This page is for your own account.</p>
      )}

      <section className="card mb-5 grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid content-start gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-400">Current plan</p>
          <h2 className="flex items-center gap-2 text-[26px] font-semibold tracking-tight" data-testid="plan-label">{plan.pro && <Sparkles className="h-5 w-5 text-lime-700" />}{plan.label}</h2>
          {plan.source === "trial" && <p className="text-[14px] text-stone-600" data-testid="trial-note">Your free Pro trial has <b>{plan.trialDaysLeft} day{plan.trialDaysLeft === 1 ? "" : "s"}</b> left (until {d(plan.trialEnd)}). No card needed — after that you move to Free and keep everything.</p>}
          {plan.source === "free" && <p className="text-[14px] text-stone-600">Free forever for one business. Pro, Growth and Agency add more projects, keywords, competitors, AI-visibility checks, mailboxes, emails, forms, posts and videos — and remove Growvia branding.</p>}
          {paidLive && (
            <div className="grid gap-1 text-[14px] text-stone-600" data-testid="paid-note">
              {!scheduled && <p>{sub?.billing_interval === "year" ? "Yearly" : "Monthly"} · {sub?.amount && sub.currency ? fmtMoney(sub.amount, sub.currency) : priceOf(isPaidPlan(plan.plan) ? plan.plan : "pro", sub?.billing_interval ?? "month")}{sub?.currency === "INR" && isPaidPlan(plan.plan) ? ` (≈ ${priceOf(plan.plan, sub?.billing_interval ?? "month")})` : ""}{sub?.payment_method ? ` · ${sub.payment_method}` : ""}</p>}
              {plan.renewsAt && !scheduled && <p>{sub?.status === "authenticated" && !sub?.replaces ? "First charge" : sub?.status === "authenticated" ? "Next charge" : "Renews"} on <b>{d(plan.renewsAt)}</b>.</p>}
              {plan.endsAt && !prepaid && <p className="text-amber-800">Cancelled — {plan.label} stays on until <b>{d(plan.endsAt)}</b>, then you move to Free. You won&apos;t be charged again.</p>}
              {prepaid && <p data-testid="prepaid-note">Paid with PayPal until <b>{d(plan.endsAt)}</b>. It doesn&apos;t renew automatically — renew below anytime and the time is added on. We&apos;ll email you a week before it ends.</p>}
              {scheduled && !plan.endsAt && <p className="text-amber-900" data-testid="scheduled-note">Moving to <b>{PLAN_INFO[scheduled].name}</b> on <b>{d(sub?.scheduled_change?.at)}</b> ({sub?.scheduled_change?.amount && sub.scheduled_change.currency ? fmtMoney(sub.scheduled_change.amount, sub.scheduled_change.currency) : priceOf(scheduled, sub?.scheduled_change?.interval ?? "month")}/{sub?.scheduled_change?.interval === "year" ? "year" : "month"}). You keep {plan.label} until then.</p>}
              {sub?.scheduled_change && !scheduled && <p>Switching to {sub.scheduled_change.interval === "year" ? "yearly" : "monthly"} on {d(sub.scheduled_change.at)}.</p>}
            </div>
          )}
          {plan.source === "comp" && <p className="text-[14px] text-stone-600">{plan.label.replace(" (complimentary)", "")} is on the house for this account{plan.endsAt ? ` until ${d(plan.endsAt)}` : ""}.</p>}
          {plan.source === "agency" && <p className="text-[14px] text-stone-600">Custom Agency plan. Email us for changes or invoices.</p>}
          {plan.paymentIssue && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Your last payment didn&apos;t go through. Razorpay will retry automatically{sub?.short_url ? <> — or <a href={sub.short_url} target="_blank" rel="noopener" className="font-medium underline">update your payment</a> now</> : ""}. {plan.label} stays on meanwhile.</span></p>
          )}
          {paidLive && !prepaid && <BillingActions name={plan.label} interval={sub?.billing_interval ?? "month"} ending={Boolean(plan.endsAt)} startsLater={sub?.status === "authenticated" && !sub?.replaces} periodEnd={d(sub?.current_end)} method={sub?.payment_method} currencies={currencies} issue={plan.paymentIssue} />}
        </div>
        <div className="grid content-start gap-3" data-testid="usage">
          <UsageNudge plan={plan} usage={usage} here />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-400">Usage</p>
          {keys.map((k) => {
            const lim = plan.limits[k], used = usage[k] ?? 0, inf = !Number.isFinite(lim), pct = inf ? 4 : Math.min(100, Math.round((used / Math.max(1, lim)) * 100));
            return (
              <div key={k} className="grid gap-1">
                <div className="flex justify-between text-[13px]"><span>{LIMIT_LABEL[k].name}{LIMIT_LABEL[k].per === "month" ? <span className="text-stone-400"> · this month</span> : null}</span><span className="tabular-nums text-stone-500">{used.toLocaleString()} / {inf ? "∞" : lim.toLocaleString()}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-mist"><div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-lime-600"}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
              </div>
            );
          })}
          <p className="text-[12px] text-stone-500">Team members, SEO audits, AI experts, reports, leads and inbox are unlimited on every plan.</p>
        </div>
      </section>

      {canBuy && (
        <section id="upgrade" className="card mb-5 scroll-mt-20 p-5 sm:p-6">
          <h2 className="text-[18px] font-semibold tracking-tight">{prepaid ? "Renew or change plan" : live ? "Change plan" : plan.endsAt ? "Choose a plan to keep going" : "Choose your plan"}</h2>
          <p className="mt-1 text-[14px] text-stone-500">{prepaid ? `Renew with PayPal (time is added on), switch plans (unused days carry over), or set up an automatic rupee subscription that starts on ${d(plan.endsAt)}.` : live ? "Upgrade and the new plan starts straight away (unused days refunded). Move to a smaller plan and it starts when this period ends." : plan.source === "trial" ? "Pick any plan, monthly or yearly — it starts the moment you pay, and renews from today." : plan.endsAt ? `Subscribe again — the first charge is on ${d(plan.endsAt)}, when your current period ends.` : "Pick any plan, monthly or yearly. It starts the moment you pay; cancel anytime from this page."}</p>
          {billingReady() && adminClient() ? (
            <PlanPicker key={`${defaultTier}-${defaultInterval}`}
              current={plan.plan} live={Boolean(live)} curInterval={live ? sub?.billing_interval ?? null : null} scheduled={scheduled} periodEnd={d(sub?.current_end)}
              defaultTier={defaultTier} defaultInterval={defaultInterval}
              currencies={currencies}
              defaultCurrency={prepaid && currencies.includes("USD") ? "USD" : country === "IN" && inrOn ? "INR" : currencies[0]}
              inr={inr} rate={rate}
              paypal={prepaidReady()} prepaidUntil={prepaid ? d(plan.endsAt) : ""}
            />
          ) : (
            <p className="mt-4 rounded-xl border border-line bg-mist p-4 text-[14px] text-stone-600">Online payments are being switched on. Want a paid plan today? Email <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=Upgrade%20my%20plan`}>us</a> and we&apos;ll set it up by hand.</p>
          )}
          <p className="mt-4 text-[13px] text-stone-500">Need more than {COMPARE[0].agency} projects, custom limits or invoicing? <Link href="/contact" className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">Talk to us</Link>.</p>
        </section>
      )}
      {plan.source === "agency" && <p className="card mb-5 p-5 text-[14px] text-stone-600">You&apos;re on a custom Agency plan. To change limits or invoices, email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>}

      <section className="card mb-5 overflow-x-auto p-5 sm:p-6">
        <h2 className="mb-3 text-[18px] font-semibold tracking-tight">What&apos;s included</h2>
        <table className="w-full min-w-[720px] text-left text-[14px]" data-testid="compare">
          <thead><tr className="border-b border-line text-[12px] uppercase tracking-wide text-stone-400"><th className="py-2 font-medium" /><th className="py-2 font-medium">Free</th>{PAID_PLANS.map((t) => <th key={t} className={`py-2 font-medium ${t === plan.plan ? "text-ink" : ""}`}>{PLAN_INFO[t].name} · ${PRICES[t].month}/mo</th>)}</tr></thead>
          <tbody>{COMPARE.map((r) => <tr key={r.label} className="border-b border-line/70 last:border-0"><td className="py-2.5 pr-3 text-stone-600">{r.label}</td><td className={`py-2.5 pr-3 ${plan.plan === "free" ? "font-medium" : ""}`}>{r.free}</td>{PAID_PLANS.map((t) => <td key={t} className={`py-2.5 pr-3 ${t === plan.plan ? "font-medium" : ""}`}>{t === plan.plan && <Check className="mr-1 inline h-3.5 w-3.5 text-lime-700" />}{r[t]}</td>)}</tr>)}</tbody>
        </table>
        <p className="mt-4 text-[13px] text-stone-500">Yearly = 2 months free on every plan. Need more than {COMPARE[0].agency} projects? <Link href="/contact" className="font-medium text-ink underline">Talk to us</Link> about custom limits.</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-[18px] font-semibold tracking-tight"><CreditCard className="h-4 w-4" /> Payment history</h2>
        {payments.length === 0 ? <p className="text-[14px] text-stone-500">No payments yet.</p> : (
          <ul className="divide-y divide-line text-[14px]" data-testid="payments">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-40 text-stone-500">{d(p.paid_at)}</span>
                <span className="font-medium tabular-nums">{fmtMoney(p.amount, p.currency)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[12px] ${p.status === "paid" ? "bg-lime/20 text-lime-800" : p.status === "refunded" ? "bg-mist text-stone-600" : "bg-red-50 text-red-700"}`}>{p.status === "paid" ? "Paid" : p.status === "refunded" ? "Refunded" : p.status}</span>
                {p.method && <span className="text-[12px] text-stone-400">{p.method}</span>}
                {p.invoice_url && <a href={p.invoice_url} target="_blank" rel="noopener" className="ml-auto text-[13px] underline underline-offset-4">Invoice</a>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[12px] text-stone-500">Payments are processed securely by Razorpay{prepaidReady() ? " (PayPal for customers outside India)" : ""}. Prices are in US dollars; if you pay in rupees the amount is converted at that day&apos;s rate. See our <Link href="/refunds" className="underline">refund &amp; cancellation policy</Link>.</p>
      </section>
    </>
  );
}
