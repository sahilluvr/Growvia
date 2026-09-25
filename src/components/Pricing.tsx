"use client";
import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

const PLANS = [
  {
    name: "Starter",
    tagline: "See what AI growth feels like",
    monthly: 0,
    cta: "Start Free",
    features: ["1 business", "Growth plan + weekly priorities", "20 AI-created posts / month", "2 connected channels", "Lead inbox"],
  },
  {
    name: "Growth",
    tagline: "Your full AI growth team",
    monthly: 49,
    popular: true,
    cta: "Start Growing Free",
    features: ["Everything in Starter", "All 6 AI specialists", "Unlimited content & campaigns", "All channels + auto-publishing", "Lead finding & AI follow-up", "Revenue tracking & weekly report"],
  },
  {
    name: "Scale",
    tagline: "For businesses ready to push",
    monthly: 149,
    cta: "Start Free Trial",
    features: ["Everything in Growth", "Up to 3 locations or brands", "Ad campaign management", "Advanced lead scoring", "Priority support"],
  },
  {
    name: "Agency",
    tagline: "Run growth for every client",
    monthly: 399,
    cta: "Talk to Us",
    features: ["Up to 15 client workspaces", "Client approvals & portal", "White-label reports", "Team seats & roles", "Dedicated success manager"],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);
  return (
    <section id="pricing" className="scroll-mt-16 py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="flex flex-col items-center text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="h-section mt-5 max-w-3xl">Less than one marketing tool. More than a marketing team.</h2>
          <div className="mt-8 inline-flex items-center rounded-full border border-line bg-white p-1 text-[14px]" role="group" aria-label="Billing period">
            <button onClick={() => setYearly(false)} aria-pressed={!yearly} className={`rounded-full px-4 py-2 transition-colors ${!yearly ? "bg-ink text-white" : "text-stone-500"}`}>Monthly</button>
            <button onClick={() => setYearly(true)} aria-pressed={yearly} className={`flex items-center gap-2 rounded-full px-4 py-2 transition-colors ${yearly ? "bg-ink text-white" : "text-stone-500"}`}>
              Yearly <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${yearly ? "bg-lime text-ink" : "bg-mist text-stone-600"}`}>−20%</span>
            </button>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => {
            const price = yearly ? Math.round(p.monthly * 0.8) : p.monthly;
            const dark = p.popular;
            return (
              <Reveal
                key={p.name}
                delay={i * 70}
                className={`relative flex flex-col rounded-2xl p-6 sm:p-7 ${dark ? "bg-ink text-white shadow-frame" : "card"}`}
              >
                {dark && (
                  <span className="absolute right-5 top-5 rounded-full bg-lime px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink">Most popular</span>
                )}
                <h3 className="text-[18px] font-semibold tracking-tight">{p.name}</h3>
                <p className={`mt-1 text-[14px] ${dark ? "text-white/55" : "text-stone-500"}`}>{p.tagline}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-[44px] font-semibold leading-none tracking-tightest tabular-nums">${price}</span>
                  <span className={`text-[14px] ${dark ? "text-white/50" : "text-stone-500"}`}>{p.monthly === 0 ? "forever" : "/ month"}</span>
                </div>
                <p className={`mt-1 h-5 text-[12px] ${dark ? "text-white/40" : "text-stone-400"}`}>
                  {p.monthly > 0 && yearly ? `Billed $${price * 12} yearly` : p.monthly > 0 ? "Billed monthly" : ""}
                </p>
                <a href={p.name === "Agency" ? "mailto:hello@growvia.ai?subject=Growvia%20Agency%20plan" : "/signup"} className={`mt-6 w-full ${dark ? "btn-lime" : "btn-ghost"}`}>
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </a>
                <ul className="mt-7 grid gap-2.5">
                  {p.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-[14px] ${dark ? "text-white/80" : "text-stone-600"}`}>
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-lime" : "text-lime-700"}`} strokeWidth={2.5} /> {f}
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[13px] text-stone-500">14-day free trial on paid plans · Cancel anytime · Ad spend billed separately by the ad platform</p>
      </div>
    </section>
  );
}
