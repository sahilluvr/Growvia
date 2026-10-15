"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, Sparkles } from "lucide-react";

const CHECKS = ["Google ranking", "ChatGPT", "Gemini", "Perplexity", "Page speed", "Google Maps", "Competitors"];
const EXAMPLES = ["yourbakery.com", "brightsmiledental.com", "urbanfitstudio.com", "acme-plumbing.co"];

/** Hero call to action: type your website → one-step sign-up → live AI analysis. */
export function HeroAnalyze() {
  const router = useRouter();
  const [site, setSite] = useState("");
  const [ph, setPh] = useState(EXAMPLES[0]);
  const [lit, setLit] = useState(0);
  useEffect(() => { let i = 0; const id = setInterval(() => { i = (i + 1) % EXAMPLES.length; setPh(EXAMPLES[i]); }, 2600); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setLit((x) => (x + 1) % CHECKS.length), 900); return () => clearInterval(id); }, []);
  const go = (e: React.FormEvent) => { e.preventDefault(); const w = site.trim(); router.push(w ? `/signup?website=${encodeURIComponent(w)}` : "/signup?website="); };
  return (
    <div className="mx-auto w-full max-w-xl lg:mx-0">
      <form onSubmit={go} className="gv-glass gv-glow-border flex flex-col gap-2 rounded-2xl p-2 sm:flex-row sm:items-center" data-testid="hero-analyze">
        <label className="flex flex-1 items-center gap-2 px-3">
          <Globe2 className="h-5 w-5 shrink-0 text-stone-400" />
          <span className="sr-only">Your website</span>
          <input value={site} onChange={(e) => { setSite(e.target.value); dispatchEvent(new CustomEvent("gv:domain", { detail: e.target.value })); }} inputMode="url" autoComplete="url" placeholder={ph} className="h-12 w-full bg-transparent text-[16px] outline-none placeholder:text-stone-400" />
        </label>
        <button type="submit" className="btn-primary shine group h-12 shrink-0 px-6 text-[15px]">
          <Sparkles className="h-4 w-4 text-lime" /> Analyse my business free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[12px] lg:justify-start" aria-hidden>
        <span className="text-stone-500">AI checks:</span>
        {CHECKS.map((c, i) => <span key={c} className={`rounded-full border px-2.5 py-0.5 transition-all duration-500 ${i === lit ? "border-lime-500 bg-lime/30 text-ink" : "border-line bg-white/70 text-stone-500"}`}>{c}</span>)}
      </div>
    </div>
  );
}
