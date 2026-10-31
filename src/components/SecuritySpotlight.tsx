"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Globe2, Lock, ShieldCheck, XCircle } from "lucide-react";

/* Home page: Security health. Type a website → a shield fills while checks tick off one by one → example score.
   Clearly an example preview; "Check my website free" carries the website into sign-up (no retyping). */

type St = "pass" | "warn" | "fail";
const CHECKS: { label: string; st: St; note: string }[] = [
  { label: "HTTPS & certificate", st: "pass", note: "Valid for 71 more days" },
  { label: "http → https redirect", st: "pass", note: "Old links land on the secure site" },
  { label: "Exposed private files", st: "pass", note: ".git, .env, backups — none public" },
  { label: "Browser protection headers", st: "warn", note: "Clickjacking protection missing" },
  { label: "Email spoofing (DMARC)", st: "fail", note: "Anyone can send email as you" },
  { label: "Domain expiry & lock", st: "pass", note: "Renews in 210 days · locked" },
];
const SCORE = 78;

export function SecuritySpotlight() {
  const [site, setSite] = useState("");
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const host = site.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || "your-website.com";

  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSeen(true); }, { threshold: 0.35 });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setStep(CHECKS.length); return; }
    setStep(0);
    const ts = CHECKS.map((_, i) => setTimeout(() => setStep(i + 1), 500 + i * 450));
    return () => ts.forEach(clearTimeout);
  }, [seen, host]);

  const pct = step / CHECKS.length;
  const shown = Math.round(SCORE * pct);
  const R = 70, C = 2 * Math.PI * R;
  return (
    <section className="relative overflow-hidden py-24 sm:py-32" aria-labelledby="sec-title" data-testid="security-spotlight">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(600px_340px_at_85%_20%,rgba(197,242,58,.16),transparent_60%),radial-gradient(560px_320px_at_10%_90%,rgba(143,211,255,.14),transparent_60%)]" />
      <div className="container-x relative grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div ref={box} className="card relative order-2 grid gap-5 p-5 sm:p-7 lg:order-1">
          <form action="/signup" method="get" className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1"><Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input name="website" value={site} onChange={(e) => setSite(e.target.value)} placeholder="your-website.com" aria-label="Your website" className="h-11 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[14px] outline-none focus:border-ink" /></label>
            <button className="btn-primary h-11 px-5 text-[14px]">Check my website free <ArrowRight className="h-4 w-4 text-lime" /></button>
          </form>
          <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
            <div className="relative mx-auto h-[172px] w-[172px]">
              <svg viewBox="0 0 172 172" className="h-full w-full" role="img" aria-label={`Example security score ${SCORE}`}>
                <circle cx="86" cy="86" r={R} fill="none" stroke="#ecebe6" strokeWidth="12" />
                <circle cx="86" cy="86" r={R} fill="none" stroke={pct < 1 ? "#C5F23A" : "#84cc16"} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(SCORE / 100) * pct * C} ${C}`} transform="rotate(-90 86 86)" style={{ transition: "stroke-dasharray 450ms ease-out" }} />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div><Lock className={`mx-auto h-6 w-6 transition-colors ${pct === 1 ? "text-lime-700" : "text-stone-400"}`} /><p className="mt-1 text-[34px] font-semibold leading-none tabular-nums">{shown}</p><p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">{pct === 1 ? "grade C" : "checking"}</p></div>
              </div>
            </div>
            <ul className="grid gap-1.5" aria-live="polite">
              {CHECKS.map((c, i) => {
                const done = i < step;
                const I = c.st === "pass" ? CheckCircle2 : c.st === "warn" ? AlertTriangle : XCircle;
                return (
                  <li key={c.label}>
                    <button type="button" onClick={() => setOpen(open === i ? null : i)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-all duration-500 ${done ? "bg-mist/70 opacity-100" : "opacity-40"} hover:bg-mist`}>
                      {done ? <I className={`h-4 w-4 shrink-0 ${c.st === "pass" ? "text-lime-600" : c.st === "warn" ? "text-amber-600" : "text-red-600"}`} /> : <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-stone-300" />}
                      <span className="flex-1 font-medium">{c.label}</span>
                    </button>
                    {done && open === i && <p className="px-9 pb-1 text-[12px] text-stone-500">{c.note}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-center text-[11px] uppercase tracking-[0.18em] text-stone-400">Example preview for {host} · tap a check</p>
        </div>
        <div className="order-1 lg:order-2">
          <span className="gv-chip-ai">New · Security health</span>
          <h2 id="sec-title" className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">Is your website <span className="gv-hero-word">safe for your customers?</span></h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-stone-600">Growvia checks your site the way browsers and attackers see it, scores it out of 100 and tells you exactly what to fix, step by step for WordPress, Shopify, Wix and more.</p>
          <ul className="mt-6 grid gap-2.5 text-[15px] text-stone-700">
            {["Certificate and domain expiry alerts before your site goes down", "Exposed private files caught early", "Email spoofing protection checked", "Rechecked every week, right on your dashboard"].map((t) => <li key={t} className="flex items-center gap-2.5"><ShieldCheck className="h-5 w-5 shrink-0 text-lime-700" /> {t}</li>)}
          </ul>
          <p className="mt-5 text-[13px] text-stone-500">An outside-in health check of your own website — not a penetration test.</p>
        </div>
      </div>
    </section>
  );
}
