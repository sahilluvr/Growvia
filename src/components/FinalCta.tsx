import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section id="start" className="scroll-mt-16 px-4 py-6 sm:px-6 sm:py-10">
      <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[28px] bg-ink px-6 py-20 text-white sm:px-12 sm:py-28">
        <div className="grid-bg-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_100%,black,transparent)]" />
        <div className="pointer-events-none absolute bottom-[-220px] left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-lime/25 blur-[120px]" />
        <svg className="pointer-events-none absolute bottom-0 left-0 h-40 w-full opacity-60" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 150 C 200 145, 350 140, 500 120 S 800 70, 950 40 S 1150 10, 1200 5" fill="none" stroke="#C5F23A" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="eyebrow-dark"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime" /> Your team is ready</span>
          <h2 className="mt-6 text-[40px] font-semibold leading-[1] tracking-tightest sm:text-[64px] lg:text-[76px]">
            Give Growvia your business.
            <span className="block text-lime">We&apos;ll help you find your customers.</span>
          </h2>
          <form action="/signup" method="get" className="mx-auto mt-10 grid max-w-2xl gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur sm:grid-cols-[1fr_1fr_auto]">
            <label className="sr-only" htmlFor="cta-site">Business name</label>
            <input id="cta-site" name="name" placeholder="Your business name" maxLength={80}
              className="h-12 rounded-xl bg-white/5 px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:bg-white/10" />
            <label className="sr-only" htmlFor="cta-email">Work email</label>
            <input id="cta-email" name="email" type="email" required placeholder="you@business.com"
              className="h-12 rounded-xl bg-white/5 px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:bg-white/10" />
            <button type="submit" className="btn-lime h-12 rounded-xl">Start Growing Free <ArrowRight className="h-4 w-4" /></button>
          </form>
          <p className="mt-5 text-[13px] text-white/45">Free forever plan · No credit card · Set up in 5 minutes</p>
        </div>
      </div>
    </section>
  );
}
