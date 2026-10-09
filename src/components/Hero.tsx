import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { GrowthEngine } from "./GrowthEngine";
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
        <div className="mx-auto max-w-4xl text-center">
          <span className="eyebrow rise-in">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime-500" /> AI-POWERED GROWTH FOR <Rotator words={["RESTAURANTS", "CLINICS", "SALONS", "AGENCIES", "STARTUPS", "STORES", "COACHES"]} className="text-ink" />
          </span>
          <h1 className="h-display rise-in mt-6" style={{ animationDelay: "120ms" }}>
            Your AI <span className="relative whitespace-nowrap">
              Growth
              <svg className="absolute -bottom-2 left-0 h-3 w-full sm:-bottom-3 sm:h-4" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 9 C 50 9, 90 8, 120 6 S 180 2, 198 2" fill="none" stroke="#C5F23A" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>{" "}
            Team.
          </h1>
          <p className="lead rise-in mx-auto mt-7 max-w-2xl" style={{ animationDelay: "260ms" }}>
            SEO and AI-search visibility, AI-written emails, social posts, ads and short videos, website forms, WhatsApp and one shared
            inbox — Growvia plans the work, does it with you, and shows what&apos;s bringing customers.
          </p>
          <div className="rise-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "380ms" }}>
            <Magnetic className="w-full sm:w-auto">
              <Link href="/signup" className="btn-primary shine group h-[52px] w-full px-7 sm:w-auto">
                Start Growing Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <Link href="/features" className="btn-ghost h-[52px] w-full px-7 sm:w-auto">
              See Everything It Does
            </Link>
          </div>
          <ul className="rise-in mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-stone-500">
            {["Free forever plan", "14-day Pro trial, no card", "Your first growth plan in 5 minutes"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-lime-700" strokeWidth={3} /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rise-frame relative mx-auto mt-14 max-w-[1120px] sm:mt-20">
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
