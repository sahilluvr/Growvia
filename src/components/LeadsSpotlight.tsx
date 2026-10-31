"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Check, Loader2, Mail, MapPin, Rocket, Sparkles } from "lucide-react";

/* Home page: the Lead finder. Pick your business → see who Growvia would reach → a short demo plays →
   "Find my leads" (plain GET form to /find-leads, works without JavaScript). Demo rows are clearly examples. */

const BIZ: { id: string; label: string; reach: string[] }[] = [
  { id: "plumber", label: "Plumbing / HVAC", reach: ["Property managers", "Real estate agencies", "Home builders"] },
  { id: "dentist", label: "Dental clinic", reach: ["Corporate offices", "Schools", "Gyms"] },
  { id: "lawyer", label: "Law firm", reach: ["Accounting firms", "Real estate agencies", "Insurance agencies"] },
  { id: "agency", label: "Marketing / IT agency", reach: ["Restaurants", "Dental clinics", "Law firms"] },
  { id: "realestate", label: "Real estate", reach: ["Mortgage brokers", "Moving companies", "Interior designers"] },
  { id: "accountant", label: "Accounting firm", reach: ["Restaurants", "Contractors", "Medical practices"] },
  { id: "restaurant", label: "Restaurant / catering", reach: ["Corporate offices", "Event planners", "Hotels"] },
];
const NAMES = ["Summit", "Oakline", "Harbor", "Northgate", "Bluebell", "Crestview"];

export function LeadsSpotlight() {
  const [biz, setBiz] = useState(BIZ[0]);
  const [what, setWhat] = useState(BIZ[0].reach[0]);
  const [where, setWhere] = useState("");
  const [step, setStep] = useState(0); // 0 idle · 1 searching · 2..5 rows · 6 campaign
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSeen(true); }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setStep(6); return; }
    setStep(1);
    const ts = [700, 1250, 1750, 2250, 2750, 3500].map((ms, i) => setTimeout(() => setStep(i + 1 === 6 ? 6 : i + 2), ms));
    return () => ts.forEach(clearTimeout);
  }, [seen, what]);

  const pick = (b: typeof BIZ[number]) => { setBiz(b); setWhat(b.reach[0]); };
  const area = where.trim() || "your city";
  const noun = what.toLowerCase().replace(/ies$/, "y").replace(/s$/, "");
  const rows = NAMES.slice(0, 4).map((n, i) => ({ name: `${n} ${what.split(" ")[0]}`, email: `${["info", "hello", "office", "contact"][i]}@${n.toLowerCase()}.example`, ok: i !== 2 }));

  return (
    <section className="relative overflow-hidden py-24 sm:py-32" aria-labelledby="leads-title" data-testid="leads-spotlight">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(640px_360px_at_15%_20%,rgba(197,242,58,.18),transparent_60%),radial-gradient(620px_360px_at_90%_85%,rgba(143,211,255,.16),transparent_60%)]" />
      <div className="container-x relative grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <span className="gv-chip-ai">New · Lead finder</span>
          <h2 id="leads-title" className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">Struggling to find leads? <span className="gv-hero-word">Growvia finds them for you.</span></h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-stone-600">Tell Growvia who you want to reach and where. It finds the businesses, gets their contact emails, adds them to your leads and writes the emails. You read them and press Launch.</p>
          <ul className="mt-6 grid gap-2.5 text-[15px] text-stone-700">
            {["Pick who and where — no lists to buy, no spreadsheets", "Businesses from Google Maps, emails from their own websites", "An AI-written 3-email campaign, ready to launch"].map((t) => <li key={t} className="flex items-center gap-2.5"><BadgeCheck className="h-5 w-5 shrink-0 text-lime-700" /> {t}</li>)}
          </ul>
          <p className="mt-5 text-[13px] text-stone-500">Businesses only. Every email has an unsubscribe link and sending follows your mailbox&apos;s daily limit. Free plan includes 20 lookups a month.</p>
        </div>

        <div ref={box} className="card relative grid gap-5 p-5 sm:p-7">
          <div>
            <p className="text-[13px] font-semibold text-stone-500">1. I run a…</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BIZ.map((b) => <button key={b.id} type="button" onClick={() => pick(b)} aria-pressed={biz.id === b.id} className={`rounded-full border px-3 py-1.5 text-[13px] transition ${biz.id === b.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-stone-400"}`}>{b.label}</button>)}
            </div>
          </div>
          <form action="/find-leads" method="get" className="grid gap-3">
            <div>
              <p className="text-[13px] font-semibold text-stone-500">2. Growvia suggests reaching…</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {biz.reach.map((r) => <button key={r} type="button" onClick={() => setWhat(r)} aria-pressed={what === r} className={`rounded-full px-3 py-1.5 text-[13px] transition ${what === r ? "bg-lime text-ink" : "bg-mist text-stone-700 hover:bg-stone-200"}`}>{r}</button>)}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
              <input name="what" value={what} onChange={(e) => setWhat(e.target.value)} aria-label="Who to find" maxLength={80} className="h-11 rounded-xl border border-line bg-white px-3.5 text-[14px] outline-none focus:border-ink" />
              <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input name="where" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City — e.g. Austin, TX" aria-label="Where" maxLength={80} className="h-11 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[14px] outline-none focus:border-ink" /></div>
            </div>

            <div className="rounded-2xl border border-line bg-mist/50 p-4" aria-live="polite">
              <div className="mb-3 flex items-center justify-between text-[12px] text-stone-500">
                <span className="flex items-center gap-1.5">{step >= 1 && step < 6 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-lime-700" />} {step < 2 ? `Searching Google Maps for ${what.toLowerCase()} in ${area}…` : step < 6 ? "Finding contact emails on their websites…" : `Found ${what.toLowerCase()} in ${area}`}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px]">Example preview</span>
              </div>
              <ul className="grid gap-1.5">
                {rows.map((r, i) => (
                  <li key={r.name} className={`flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-[13px] transition-all duration-500 ${step >= i + 2 ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
                    <span className="truncate font-medium">{r.name}</span>
                    {r.ok ? <span className="flex items-center gap-1 truncate text-lime-800"><Mail className="h-3 w-3" />{r.email}</span> : <span className="text-stone-400">no email found</span>}
                  </li>
                ))}
              </ul>
              <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl bg-ink px-3.5 py-2.5 text-[13px] text-white transition-all duration-500 ${step >= 6 ? "opacity-100" : "opacity-0"}`}>
                <span className="flex items-center gap-2"><Check className="h-4 w-4 text-lime" /> 3 emails written for every {noun}</span>
                <span className="flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[12px] font-semibold text-ink"><Rocket className="h-3 w-3" /> Launch</span>
              </div>
            </div>

            <button className="btn-primary h-12 text-[15px]">Find my leads free <ArrowRight className="h-4 w-4 text-lime" /></button>
          </form>
        </div>
      </div>
    </section>
  );
}
