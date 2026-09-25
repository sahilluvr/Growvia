import { Logo } from "./Logo";

const COLS = [
  ["Product", ["How it works", "AI growth team", "Growth plan", "Pricing", "Integrations"]],
  ["For", ["Local businesses", "Creators & coaches", "Ecommerce", "Startups", "Agencies"]],
  ["Company", ["About", "Careers", "Blog", "Contact"]],
  ["Legal", ["Privacy", "Terms", "Security"]],
] as const;

export function Footer() {
  return (
    <footer className="pb-10 pt-16">
      <div className="container-x">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-stone-500">Your AI Growth Team. Give Growvia your business — Growvia helps you find your customers.</p>
          </div>
          {COLS.map(([h, items]) => (
            <div key={h}>
              <p className="text-[13px] font-medium">{h}</p>
              <ul className="mt-4 grid gap-2.5">
                {items.map((i) => (
                  <li key={i}><a href="#top" className="text-[14px] text-stone-500 transition-colors hover:text-ink">{i}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-[13px] text-stone-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Growvia. All rights reserved.</p>
          <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime-500" /> All systems growing</p>
        </div>
      </div>
    </footer>
  );
}
