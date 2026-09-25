import { X, Check, ArrowRight } from "lucide-react";
import { LogoMark } from "./Logo";
import { Reveal } from "./Reveal";

const TOOLS = [
  "AI copywriter", "Design app", "Social scheduler", "Email platform", "CRM",
  "Ads manager", "SEO tool", "Review manager", "Landing page builder", "Analytics",
];

const DOES = [
  "Learns your business, customers and offers",
  "Decides what to do this week — and why",
  "Creates the posts, emails, ads and pages",
  "Publishes everywhere your customers are",
  "Finds leads and follows up until they reply",
  "Measures what worked and does more of it",
];

export function Problem() {
  return (
    <section className="py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="max-w-3xl">
          <span className="eyebrow">The problem</span>
          <h2 className="h-section mt-5">
            Stop managing 10 marketing tools.
            <span className="text-stone-400"> Give Growvia your business and let AI handle your growth.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <Reveal className="card relative overflow-hidden p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500">Today</p>
              <p className="text-[13px] text-stone-500">10 logins · 10 bills · 0 strategy</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {TOOLS.map((t, i) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-[14px] text-stone-600"
                  style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}
                >
                  <X className="h-3.5 w-3.5 text-stone-400" /> {t}
                </span>
              ))}
            </div>
            <p className="mt-8 text-[15px] leading-relaxed text-stone-500">
              Each tool helps you <em className="not-italic text-ink">create</em> something. None of them know your business,
              talk to each other, or tell you if it brought in a single customer. You&apos;re the glue — and you&apos;re busy running a business.
            </p>
          </Reveal>

          <div className="hidden items-center justify-center lg:flex">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white shadow-card">
              <ArrowRight className="h-5 w-5" />
            </span>
          </div>

          <Reveal delay={120} className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white shadow-frame sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime/20 blur-3xl" />
            <div className="relative flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">With Growvia</p>
              <p className="text-[13px] text-white/50">1 team · 1 plan · measured in customers</p>
            </div>
            <div className="relative mt-6 flex items-center gap-3">
              <LogoMark className="h-10 w-10 [&>rect]:fill-white/10" />
              <div>
                <div className="text-lg font-semibold tracking-tight">Growvia</div>
                <div className="text-[13px] text-white/50">Your AI growth team</div>
              </div>
            </div>
            <ul className="relative mt-6 grid gap-2.5">
              {DOES.map((d) => (
                <li key={d} className="flex items-start gap-2.5 text-[15px] text-white/80">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime text-ink">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {d}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
