import { Words } from "./motion";
import { Reveal } from "./Reveal";
import { COMPARE, LIMITS, PAID_PLANS, PLAN_INFO, PRICES, TRIAL_DAYS } from "@/lib/billing/catalog";
import { AgencyForm, PricingPlans } from "./PricingClient";

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="flex flex-col items-center text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="h-section mt-5 max-w-3xl"><Words text={`Start free. Grow from $${PRICES.pro.month}.`} /></h2>
          <p className="lead mx-auto mt-5 max-w-2xl">Free shows you what to fix. Paid plans give you the room to fix it and grow — more sites, keywords, competitors and emails. Pick any plan, monthly or yearly; it starts the moment you pay, and you can move up or down any time.</p>
        </Reveal>

        <PricingPlans trialDays={TRIAL_DAYS} />

        <Reveal id="agency" className="card mt-6 flex scroll-mt-24 flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">More than {LIMITS.agency.projects} client accounts?</h3>
            <p className="mt-1 max-w-xl text-[14px] text-stone-500">We&apos;ll set up custom limits, volume pricing, help moving your clients over, and invoicing that suits your agency.</p>
          </div>
          <AgencyForm />
        </Reveal>

        <Reveal className="card mt-6 overflow-x-auto p-5 sm:p-7">
          <table className="w-full min-w-[760px] text-left text-[14px]" data-testid="compare">
            <caption className="mb-3 text-left text-[15px] font-semibold">Compare plans</caption>
            <thead><tr className="border-b border-line text-[12px] uppercase tracking-wide text-stone-400"><th className="py-2 font-medium" scope="col"><span className="sr-only">Feature</span></th><th className="py-2 font-medium" scope="col">Free</th>{PAID_PLANS.map((t) => <th key={t} className="py-2 font-medium" scope="col">{PLAN_INFO[t].name} · ${PRICES[t].month}/mo</th>)}</tr></thead>
            <tbody>{COMPARE.map((r) => <tr key={r.label} className="border-b border-line/70 last:border-0"><th scope="row" className="py-2.5 pr-3 font-normal text-stone-600">{r.label}</th><td className="py-2.5 pr-3">{r.free}</td>{PAID_PLANS.map((t) => <td key={t} className={`py-2.5 pr-3 ${t === "growth" ? "font-medium" : ""}`}>{r[t]}</td>)}</tr>)}</tbody>
          </table>
          <p className="mt-4 text-[12px] text-stone-500">Prices in US dollars; yearly = 2 months free. Paying from India? You can pay in rupees (UPI, cards, netbanking) at that day&apos;s exchange rate. Upgrade any time and it starts straight away — unused days of your old plan are refunded. Move to a smaller plan and it starts when your paid period ends. Some connections use your own free accounts — e.g. a Google Gemini key, Resend for emails, and Meta for WhatsApp/Instagram.</p>
        </Reveal>
      </div>
    </section>
  );
}
