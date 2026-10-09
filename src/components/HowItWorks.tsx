"use client";
import { useEffect, useState } from "react";
import { Words } from "./motion";
import { Globe, Sparkles, Repeat } from "lucide-react";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "01",
    icon: Globe,
    title: "Give Growvia your business",
    body: "Answer a few quick questions and add your website. Connect your mailbox, WhatsApp, Facebook, Instagram and Google Search Console when you're ready.",
    detail: ["Website or 5 questions", "Connect channels", "Set your goal"],
  },
  {
    n: "02",
    icon: Sparkles,
    title: "Get your growth plan",
    body: "Growvia builds a plan — who to reach, what to say, where to show up — and audits your website for Google and AI search.",
    detail: ["Ideal customers", "Weekly priorities", "SEO & AI-search audit"],
  },
  {
    n: "03",
    icon: Repeat,
    title: "Your AI team runs it — every day",
    body: "Emails and posts go out, website enquiries come in, follow-ups happen, and you get alerted to what matters.",
    detail: ["You approve first", "Leads in one inbox", "Weekly summary email"],
  },
];

const LOOP = ["Business", "Understand", "Strategy", "Content", "Distribution", "Leads", "Conversion", "Revenue", "Learn", "Improve"];
const LOOP_COPY: Record<string, string> = {
  Business: "You tell Growvia what you sell, who you serve and what a win looks like.",
  Understand: "It maps your customers, your website, and how Google and AI assistants see you.",
  Strategy: "It picks the few moves most likely to bring customers this week.",
  Content: "It writes emails, captions and campaigns in your voice, and designs on-brand images.",
  Distribution: "It publishes to Facebook and Instagram and sends email and WhatsApp at the right times.",
  Leads: "It captures every enquiry — website forms, WhatsApp, DMs, bookings — with where it came from.",
  Conversion: "It follows up automatically, keeps every reply in one inbox, and lets people book a time.",
  Revenue: "It tracks leads through your pipeline to won customers and deal value.",
  Learn: "It measures opens, replies, rankings and AI mentions to see what worked.",
  Improve: "It feeds those lessons into next week's plan. The loop gets sharper every cycle.",
};

function Loop() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % LOOP.length), 2200);
    return () => clearInterval(id);
  }, [paused]);

  const R = 42; // percent radius
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
      {/* circle (md+) */}
      <div
        className="relative mx-auto hidden aspect-square w-full max-w-[520px] md:block"
        onMouseLeave={() => setPaused(false)}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
          <circle
            cx="50" cy="50" r={R} fill="none" stroke="#C5F23A" strokeWidth="0.6" strokeLinecap="round"
            pathLength={100} strokeDasharray={`${((active + 1) / LOOP.length) * 100} 100`}
            transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)" }}
          />
        </svg>
        {LOOP.map((s, i) => {
          const a = (i / LOOP.length) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + R * Math.cos(a);
          const y = 50 + R * Math.sin(a);
          const on = i === active;
          const done = i < active;
          return (
            <button
              key={s}
              onMouseEnter={() => { setPaused(true); setActive(i); }}
              onFocus={() => { setPaused(true); setActive(i); }}
              onClick={() => { setPaused(true); setActive(i); }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-pressed={on}
            >
              <span
                className={`block whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all duration-300 ${
                  on ? "scale-110 border-lime bg-lime text-ink shadow-glow" : done ? "border-lime/30 bg-ink-800 text-white" : "border-white/10 bg-ink-800 text-white/50"
                }`}
              >
                {s}
              </span>
            </button>
          );
        })}
        <div className="absolute inset-[22%] flex flex-col items-center justify-center text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">Step {String(active + 1).padStart(2, "0")} / 10</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{LOOP[active]}</div>
          <p className="mt-3 text-[14px] leading-relaxed text-white/60">{LOOP_COPY[LOOP[active]]}</p>
        </div>
      </div>

      {/* list (mobile) */}
      <ol className="grid gap-2 md:hidden">
        {LOOP.map((s, i) => (
          <li key={s} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="font-mono text-[12px] text-lime">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="font-medium text-white">{s}</div>
              <p className="mt-1 text-[14px] leading-snug text-white/55">{LOOP_COPY[s]}</p>
            </div>
          </li>
        ))}
      </ol>

      <div>
        <span className="eyebrow-dark">The Growth Loop</span>
        <h3 className="mt-5 text-[34px] font-semibold leading-[1.05] tracking-tightest text-white sm:text-[44px]">
          Not a tool you use.<br />A loop that never stops.
        </h3>
        <p className="mt-5 text-[17px] leading-relaxed text-white/60">
          Most software stops at &ldquo;here&apos;s your content.&rdquo; Growvia keeps going — all the way to revenue — then learns from
          the result and starts again, smarter. Every week your growth engine knows more about what brings you customers.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-2">
          {[
            ["Always on", "Runs daily, not when you remember"],
            ["Connected", "Every step informs the next"],
            ["Compounding", "Week 12 beats week 1"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
              <div className="text-[14px] font-medium text-lime">{k}</div>
              <div className="mt-1 text-[12px] leading-snug text-white/50 sm:text-[13px]">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <>
      <section id="how" className="scroll-mt-16 py-24 sm:py-32">
        <div className="container-x">
          <Reveal className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="h-section mt-5"><Words text="Three steps. Then it just keeps growing." /></h2>
            <p className="lead mx-auto mt-5 max-w-xl">No marketing degree, no agency retainer, no dashboard to babysit.</p>
          </Reveal>
          <Reveal className="relative mt-14 grid gap-4 md:grid-cols-3">
            <div aria-hidden="true" className="line-grow pointer-events-none absolute left-[8%] right-[8%] top-[46px] hidden h-px bg-gradient-to-r from-lime-500 via-ink/40 to-lime-500 md:block" />
            {STEPS.map((s, i) => {
              const I = s.icon;
              return (
                <Reveal key={s.n} delay={i * 140} className="card group relative flex flex-col p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-frame">
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-lime transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <I className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-[13px] text-stone-400">{s.n}</span>
                  </div>
                  <h3 className="mt-8 text-[22px] font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-stone-500">{s.body}</p>
                  <ul className="mt-auto flex flex-wrap gap-1.5 pt-7">
                    {s.detail.map((d) => (
                      <li key={d} className="rounded-full bg-mist px-2.5 py-1 text-[12px] text-stone-600">{d}</li>
                    ))}
                  </ul>
                </Reveal>
              );
            })}
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink py-24 sm:py-32">
        <div className="grid-bg-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="container-x relative">
          <Loop />
        </div>
      </section>
    </>
  );
}
