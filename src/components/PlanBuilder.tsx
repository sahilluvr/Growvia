"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Target, Users, Zap, Megaphone, CalendarDays, RotateCcw } from "lucide-react";
import { SEGMENTS } from "@/lib/plans";
import { Reveal } from "./Reveal";

const THINKING = ["Understanding your business", "Mapping your ideal customers", "Scanning your market for opportunities", "Drafting your first campaign"];

export function PlanBuilder() {
  const [segId, setSegId] = useState(SEGMENTS[0].id);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<"idle" | "thinking" | "done">("idle");
  const [step, setStep] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const seg = useMemo(() => SEGMENTS.find((s) => s.id === segId)!, [segId]);
  const bizName = name.trim() || seg.placeholder;
  const where = city.trim();

  useEffect(() => {
    if (state !== "thinking") return;
    setStep(0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 60 : 650;
    const timers = THINKING.map((_, i) => setTimeout(() => setStep(i + 1), ms * (i + 1)));
    const done = setTimeout(() => setState("done"), ms * (THINKING.length + 1));
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [state]);

  useEffect(() => {
    if (state === "done" && resultRef.current && window.innerWidth < 1024) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setState("thinking");
  };

  return (
    <section id="plan" className="scroll-mt-16 py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Try it · 30 seconds</span>
          <h2 className="h-section mt-5">See what Growvia would do for your business.</h2>
          <p className="lead mx-auto mt-5 max-w-xl">
            Pick your business type. Get a preview of the growth plan your AI team would start running this week.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-[400px_1fr]">
          {/* form */}
          <form onSubmit={submit} className="card flex flex-col gap-6 p-6 sm:p-7 lg:sticky lg:top-24 lg:self-start">
            <fieldset>
              <legend className="text-[13px] font-medium">What kind of business?</legend>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {SEGMENTS.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => { setSegId(s.id); if (state === "done") setState("idle"); }}
                    aria-pressed={s.id === segId}
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                      s.id === segId ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-[13px] font-medium">Business name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={seg.placeholder}
                maxLength={48}
                className="mt-2 h-12 w-full rounded-xl border border-line bg-paper px-4 text-[15px] outline-none transition-colors placeholder:text-stone-400 focus:border-ink focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium">City <span className="font-normal text-stone-400">(optional)</span></span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin, London, Mumbai…"
                maxLength={40}
                className="mt-2 h-12 w-full rounded-xl border border-line bg-paper px-4 text-[15px] outline-none transition-colors placeholder:text-stone-400 focus:border-ink focus:bg-white"
              />
            </label>
            <button type="submit" disabled={state === "thinking"} className="btn-primary w-full disabled:opacity-70">
              {state === "thinking" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Building your plan…</>) : (<>Build my growth plan <ArrowRight className="h-4 w-4" /></>)}
            </button>
            <p className="-mt-2 text-center text-[12px] text-stone-400">Instant preview. No signup needed.</p>
          </form>

          {/* result */}
          <div ref={resultRef} className="scroll-mt-20 min-h-[520px] overflow-hidden rounded-2xl bg-ink text-white shadow-frame">
            {state === "idle" && (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-10 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-lime">
                  <Target className="h-6 w-6" />
                </div>
                <p className="mt-5 text-xl font-semibold tracking-tight">Your growth plan will appear here</p>
                <p className="mt-2 max-w-sm text-[14px] text-white/50">
                  Ideal customers, top opportunities, a ready-to-run first campaign and a 30-day roadmap.
                </p>
              </div>
            )}

            {state === "thinking" && (
              <div className="flex h-full min-h-[520px] flex-col justify-center p-8 sm:p-12">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">Growvia is working</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{bizName}</p>
                <ul className="mt-8 grid gap-3">
                  {THINKING.map((t, i) => (
                    <li key={t} className={`flex items-center gap-3 text-[15px] transition-opacity duration-300 ${i <= step ? "opacity-100" : "opacity-30"}`}>
                      <span className={`grid h-6 w-6 place-items-center rounded-full ${i < step ? "bg-lime text-ink" : "border border-white/20"}`}>
                        {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin text-lime" /> : null}
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state === "done" && (
              <div className="animate-feedIn p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">Growth plan · preview</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{bizName}</h3>
                    <p className="mt-1 text-[14px] text-white/50">{seg.label}{where ? ` · ${where}` : ""} · Goal: {seg.goal.toLowerCase()}</p>
                  </div>
                  <button onClick={() => setState("idle")} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/60 hover:bg-white/5">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <Block icon={Users} title="Who we'll reach">
                    <ul className="grid gap-2">
                      {seg.customers.map((c) => (
                        <li key={c} className="flex gap-2 text-[14px] text-white/75"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />{where ? c.replace("the area", where).replace("within 5 km", `in ${where}`) : c}</li>
                      ))}
                    </ul>
                  </Block>
                  <Block icon={Zap} title="Top opportunities">
                    <ol className="grid gap-2.5">
                      {seg.opportunities.map((o, i) => (
                        <li key={o.title} className="flex gap-2.5">
                          <span className="font-mono text-[12px] text-lime">0{i + 1}</span>
                          <div>
                            <div className="text-[14px] font-medium">{o.title}</div>
                            <div className="text-[13px] text-white/50">{o.why}</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </Block>
                  <Block icon={Megaphone} title={`First campaign · “${seg.campaign.name}”`} className="md:col-span-2">
                    <div className="flex flex-wrap gap-1.5">
                      {seg.campaign.channels.map((c) => (
                        <span key={c} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/70">{c}</span>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {seg.campaign.pieces.map((p) => (
                        <div key={p} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2.5 text-[13px] text-white/80">
                          <Check className="h-3.5 w-3.5 shrink-0 text-lime" strokeWidth={3} /> {p}
                        </div>
                      ))}
                    </div>
                  </Block>
                  <Block icon={CalendarDays} title="Your first 30 days" className="md:col-span-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {seg.days.map((d, i) => (
                        <div key={d} className="rounded-lg border border-white/10 p-3">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-white/40">Day {[1, 10, 30][i]}</div>
                          <div className="mt-1 text-[13px] leading-snug text-white/80">{d}</div>
                        </div>
                      ))}
                    </div>
                  </Block>
                </div>

                <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl bg-lime p-5 text-ink sm:flex-row sm:items-center">
                  <div>
                    <div className="font-semibold">Want Growvia to run this plan for {bizName}?</div>
                    <div className="text-[13px] text-ink/70">Your full plan uses your real website, reviews and channel data.</div>
                  </div>
                  <a href={`/signup?${new URLSearchParams({ segment: seg.id, name: bizName, ...(where ? { city: where } : {}) })}`} className="btn h-11 shrink-0 bg-ink px-5 text-white hover:bg-ink-700">
                    Start Growing Free <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Block({ icon: I, title, children, className = "" }: { icon: React.ElementType; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2 text-[13px] font-medium text-white">
        <I className="h-4 w-4 text-lime" /> {title}
      </div>
      {children}
    </div>
  );
}
