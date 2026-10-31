"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";

/* Dashboard spotlight for the Lead finder: pick who + where, go. Works as a plain GET form too. */
export function FindLeadsCard({ suggestions, area, leads }: { suggestions: string[]; area: string; leads: number }) {
  const [what, setWhat] = useState(suggestions[0] ?? "");
  const [where, setWhere] = useState(area);
  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-ink/10 bg-ink p-5 text-white sm:p-7" data-testid="dash-find-leads">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-lime"><Sparkles className="h-3.5 w-3.5" /> Lead finder</p>
          <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]">{leads < 10 ? "Need more leads? Let Growvia find them." : "Find your next customers in a minute."}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">Pick who you want to reach and where. Growvia finds the businesses on Google Maps, gets their contact emails, adds them as leads and writes the emails — you just press Launch.</p>
        </div>
        <form action="/app/leads/find" method="get" className="grid gap-3 rounded-2xl bg-white/[.06] p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 6).map((s) => (
              <button key={s} type="button" onClick={() => setWhat(s)} aria-pressed={what === s} className={`rounded-full px-3 py-1.5 text-[13px] transition ${what === s ? "bg-lime text-ink" : "bg-white/10 text-white/85 hover:bg-white/15"}`}>{s}</button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input name="what" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Who — e.g. property managers" aria-label="Who to find" maxLength={80} className="h-11 rounded-xl border border-white/10 bg-white px-3.5 text-[14px] text-ink outline-none" />
            <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input name="where" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Where — city or area" aria-label="Where" maxLength={80} className="h-11 w-full rounded-xl border border-white/10 bg-white pl-9 pr-3 text-[14px] text-ink outline-none" /></div>
            <button className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-lime px-5 text-[14px] font-semibold text-ink hover:brightness-95">Find leads <ArrowRight className="h-4 w-4" /></button>
          </div>
        </form>
      </div>
    </section>
  );
}
