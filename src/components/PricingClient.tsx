"use client";
import { safe } from "@/lib/client/safe-action";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Loader2, Minus } from "lucide-react";
import { HIGHLIGHTS, PAID_PLANS, PLAN_INFO, PRICES, isPaidPlan, type PlanId } from "@/lib/billing/catalog";
import { contactSalesAction } from "@/app/billing-actions";

type Iv = "month" | "year";
const FEATURES: Record<PlanId, string[]> = {
  free: ["1 project (business or website)", "Unlimited SEO audits, AI experts & reports", "Leads, inbox, WhatsApp & Instagram — unlimited", "10 keywords · 5 AI-visibility questions (monthly)", "2 competitors · 1 mailbox · 300 emails a month", "1 website form · 10 posts a month", "1 video ad a month (watermarked)"],
  pro: ["Everything in Free, plus:", ...HIGHLIGHTS.pro],
  growth: ["Everything in Pro, with more room:", ...HIGHLIGHTS.growth.slice(0, 4), "Priority email & chat support"],
  agency: ["Everything in Growth, at agency scale:", ...HIGHLIGHTS.agency],
};

/** The four plan cards with one monthly/yearly switch. Every button goes to sign-up with the plan + period chosen. */
export function PricingPlans({ trialDays }: { trialDays: number }) {
  const [iv, setIv] = useState<Iv>("month");
  return (
    <>
      <div className="mt-10 flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-line bg-white p-1 text-[13px] shadow-sm">
          {(["month", "year"] as const).map((i) => (
            <button key={i} role="radio" aria-checked={iv === i} onClick={() => setIv(i)} data-testid={`price-${i}`} className={`rounded-full px-4 py-1.5 transition ${iv === i ? "bg-ink text-white" : "text-stone-600 hover:text-ink"}`}>{i === "month" ? "Monthly" : "Yearly · 2 months free"}</button>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(["free", ...PAID_PLANS] as PlanId[]).map((t) => {
          const dark = t === "growth";
          const paid = isPaidPlan(t);
          const p = paid ? PRICES[t] : null;
          const href = paid ? `/signup?plan=${t}&interval=${iv}` : "/signup";
          return (
            <div key={t} data-testid={`plan-${t}`} className={`relative flex flex-col rounded-2xl p-6 sm:p-7 ${dark ? "ring-glow bg-ink text-white shadow-frame" : "card"}`}>
              {dark && <span className="absolute right-5 top-5 rounded-full bg-lime px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink">Best value</span>}
              {t === "pro" && <span className="absolute right-5 top-5 rounded-full bg-mist px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-stone-600">Most popular</span>}
              <h3 className="text-[18px] font-semibold tracking-tight">{PLAN_INFO[t].name}</h3>
              <p className={`mt-1 text-[14px] ${dark ? "text-white/60" : "text-stone-500"}`}>{PLAN_INFO[t].tagline}.</p>
              <p className="mt-5 flex items-baseline gap-1.5" data-testid={`price-${t}`}>
                <span className="text-[40px] font-semibold leading-none tracking-tightest">${p ? p[iv] : 0}</span>
                <span className={`text-[14px] ${dark ? "text-white/55" : "text-stone-500"}`}>{p ? `/${iv === "month" ? "month" : "year"}` : "forever"}</span>
              </p>
              <p className={`mt-1 h-4 text-[12px] ${dark ? "text-white/50" : "text-stone-500"}`}>{p ? (iv === "year" ? `$${(p.year / 12).toFixed(2)}/month — save $${p.month * 12 - p.year}` : `or $${p.year}/year (2 months free)`) : "No card needed"}</p>
              <ul className="mt-6 grid gap-2.5">{FEATURES[t].map((f, i) => (
                <li key={f} className={`flex items-start gap-2.5 text-[14px] ${dark ? (i === 0 && paid ? "text-white/60" : "text-white/85") : i === 0 && paid ? "text-stone-500" : "text-stone-700"}`}>
                  {i === 0 && paid ? <Minus className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-white/40" : "text-stone-300"}`} /> : <Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-lime" : "text-lime-700"}`} strokeWidth={2.5} />} {f}
                </li>
              ))}</ul>
              <div className="mt-auto pt-8">
                <a href={href} data-testid={`cta-${t}`} className={`${dark ? "btn-lime shine" : t === "free" ? "btn-ghost" : "btn-primary"} w-full`}>{paid ? `Get ${PLAN_INFO[t].name}` : "Start free"}</a>
                <p className={`mt-3 text-center text-[12px] ${dark ? "text-white/45" : "text-stone-400"}`}>{paid ? "Starts the moment you pay · cancel anytime" : t === "free" ? `Includes a ${trialDays}-day Pro trial, no card` : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Send() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="btn-primary h-11 w-full text-[14px]">{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send"}</button>;
}

export function AgencyForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(safe(contactSalesAction), undefined);
  if (state?.ok) return <p role="status" className="mt-8 rounded-xl border border-lime-500/40 bg-lime/15 p-4 text-[14px] text-lime-900" data-testid="agency-sent">{state.message}</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost h-11 px-5" data-testid="agency-open">Talk to us</button>;
  const cls = "h-10 w-full rounded-xl border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
  return (
    <form action={action} className="mt-4 grid w-full max-w-md gap-2.5" data-testid="agency-form">
      <input name="name" required placeholder="Your name" aria-label="Your name" className={cls} autoComplete="name" />
      <input name="email" type="email" required placeholder="Work email" aria-label="Work email" className={cls} autoComplete="email" />
      <input name="company" placeholder="Agency name" aria-label="Agency name" className={cls} autoComplete="organization" />
      <input name="clients" placeholder="How many client accounts?" aria-label="How many client accounts?" className={cls} />
      <textarea name="message" rows={2} placeholder="Anything we should know? (optional)" aria-label="Message" className="w-full rounded-xl border border-line bg-white p-3 text-[14px] outline-none focus:border-ink" />
      <input name="website_url" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state?.error && <p role="alert" className="text-[13px] text-red-600">{state.error}</p>}
      <Send />
    </form>
  );
}
