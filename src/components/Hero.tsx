import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { GrowthEngine } from "./GrowthEngine";
import { HeroAnalyze } from "./HeroAnalyze";
import { GrowthRadar } from "./GrowthRadar";
import { CursorGlow, Magnetic, Rotator, Tilt } from "./motion";
import { CHANNELS_LIVE } from "@/lib/site/features";

const SEGMENTS = [
  "Restaurants", "Dentists", "Salons", "Gyms", "Real estate agents", "Coaches", "YouTubers",
  "Shopify stores", "DTC brands", "SaaS startups", "Consultants", "Agencies", "Clinics", "Law firms",
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-36">
      <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />
      <div className="aurora-1 pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-lime/25 blur-[120px]" />
      <div className="aurora-2 pointer-events-none absolute right-[-120px] top-[120px] h-[320px] w-[420px] rounded-full bg-[#7FD3FF]/20 blur-[110px]" />
      <div className="aurora-3 pointer-events-none absolute left-[-140px] top-[260px] h-[300px] w-[380px] rounded-full bg-[#FFB38A]/20 blur-[110px]" />
      <CursorGlow />

      <div className="container-x relative">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <span className="eyebrow rise-in">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime-500" /> AI-POWERED GROWTH FOR <Rotator words={["RESTAURANTS", "CLINICS", "SALONS", "AGENCIES", "STARTUPS", "STORES", "COACHES"]} className="text-ink" />
          </span>
          <h1 className="h-display rise-in mt-6 lg:text-[clamp(3rem,5.4vw,5.2rem)]" style={{ animationDelay: "120ms" }}>
            Your AI <span className="relative whitespace-nowrap">
              <span className="gv-hero-word">Growth</span>
              <svg className="absolute -bottom-2 left-0 h-3 w-full sm:-bottom-3 sm:h-4" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 9 C 50 9, 90 8, 120 6 S 180 2, 198 2" fill="none" stroke="#C5F23A" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>{" "}
            Team.
          </h1>
          <p className="lead rise-in mx-auto mt-7 max-w-2xl lg:mx-0" style={{ animationDelay: "260ms" }}>
            SEO and AI-search visibility, AI-written emails, social posts, ads and short videos, website forms, WhatsApp and one shared
            inbox — Growvia plans the work, does it with you, and shows what&apos;s bringing customers.
          </p>
          <div className="rise-in mt-9" style={{ animationDelay: "380ms" }}>
            <HeroAnalyze />
            <p className="mt-4 text-[13px] text-stone-500">Get your Growth Score in about 2 minutes · or <Link href="/features" className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">see everything it does</Link></p>
          </div>
          <ul className="rise-in mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-[13px] text-stone-500">
            {["Free forever plan", "14-day Pro trial, no card", "Your Growth Score in 2 minutes"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-lime-700" strokeWidth={3} /> {t}
              </li>
            ))}
          </ul>
        </div>
          {/* Growth Score radar: hover an area, type your website */}
          <div className="relative mx-auto aspect-square w-full max-w-[560px]">
            <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(197,242,58,.28),rgba(143,211,255,.14)_45%,transparent_70%)] blur-2xl" aria-hidden />
            <GrowthRadar className="absolute inset-0" />
          </div>
        </div>
        <div className="rise-frame relative mx-auto mt-14 max-w-[1120px] sm:mt-20">
          {/* Floating AI signals around the product */}
          <div className="pointer-events-none absolute -left-10 -top-7 z-10 hidden xl:block" aria-hidden><span className="gv-glass gv-float flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium"><span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-lime-400 via-sky-400 to-violet-500 text-[11px] text-white">AI</span> Recommended by AI assistants</span></div>
          <div className="pointer-events-none absolute -right-10 -top-7 z-10 hidden xl:block" aria-hidden><span className="gv-glass gv-float d2 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium"><span className="h-2 w-2 animate-pulseDot rounded-full bg-lime-500" /> New lead from your website</span></div>
          <div className="pointer-events-none absolute -bottom-6 left-1/2 z-10 hidden -translate-x-1/2 xl:block" aria-hidden><span className="gv-glass gv-float d3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium">Growth Score <b className="gv-hero-word">↑ 81</b></span></div>
          <Tilt max={4}><GrowthEngine /></Tilt>
        </div>
      </div>

      <div className="mt-16 border-y border-line bg-white py-5 sm:mt-24">
        <div className="container-x flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500">Built for</p>
          <div className="marquee-row relative grid w-full gap-2.5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex w-max animate-marquee gap-3">
              {[...SEGMENTS, ...SEGMENTS].map((s, i) => (
                <span key={i} className="whitespace-nowrap rounded-full border border-line bg-paper px-4 py-1.5 text-[14px] text-stone-600" aria-hidden={i >= SEGMENTS.length}>
                  {s}
                </span>
              ))}
            </div>
            <div className="flex w-max animate-marquee-rev gap-3" aria-hidden="true">
              {[...CHANNELS_LIVE, ...CHANNELS_LIVE].map((c, i) => (
                <span key={i} className="whitespace-nowrap rounded-full bg-ink px-4 py-1.5 text-[13px] text-white/80">{c}</span>
              ))}
</div>
          </div>
        </div>
      </div>
    </section>
  );
}
