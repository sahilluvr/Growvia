"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { onboardingAction } from "@/app/actions";
import { SEGMENTS } from "@/lib/plans";
import { ALL_CHANNELS, GOALS, defaultChannels } from "@/lib/engine";
import { Logo } from "@/components/Logo";
import { Field, Notice, inputCls } from "@/components/ui/Form";

const VOICES = [
  { id: "Friendly", ex: "“Come say hi — we saved you a seat.”" },
  { id: "Professional", ex: "“Book your consultation today.”" },
  { id: "Bold", ex: "“Stop scrolling. This is the one.”" },
  { id: "Playful", ex: "“Guess what just landed? 👀”" },
];
const STEPS = ["Your business", "Goal & customers", "Channels & voice"];

type Init = { name: string; segment: string; city: string; website: string };

export function Wizard({ userName, initial }: { userName: string; initial: Init }) {
  const [state, action] = useFormState(onboardingAction, undefined);
  const [step, setStep] = useState(0);
  const [v, setV] = useState({ ...initial, goal: GOALS[0], audience: "", offer: "", voice: "Friendly" });
  const [channels, setChannels] = useState<string[]>(initial.segment ? defaultChannels(initial.segment) : []);
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const stepError = step === 0 ? (!v.name.trim() ? "Add your business name." : !v.segment ? "Pick your business type." : "") : step === 2 && channels.length === 0 ? "Pick at least one channel." : "";

  const next = () => {
    setTouched(true);
    if (stepError) return;
    setTouched(false);
    setStep((s) => Math.min(2, s + 1));
  };
  const pickSegment = (id: string) => {
    setV((s) => ({ ...s, segment: id }));
    setChannels(defaultChannels(id));
  };

  return (
    <div className="min-h-dvh bg-paper">
      <header className="container-x flex h-16 items-center justify-between">
        <Link href="/" aria-label="Growvia home"><Logo /></Link>
        <form action="/auth/signout" method="post"><button className="text-[13px] text-stone-500 hover:text-ink">Sign out</button></form>
      </header>
      <main className="container-x max-w-[720px] pb-20 pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime-700">Step {step + 1} of 3 · {STEPS[step]}</p>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-ink" : "bg-line"}`} />)}
        </div>
        <h1 className="mt-8 text-[32px] font-semibold leading-tight tracking-tightest sm:text-[40px]">
          {step === 0 && <>Hi {userName} — tell us about your business.</>}
          {step === 1 && <>What does growth look like for {v.name || "you"}?</>}
          {step === 2 && <>Where should your AI team show up?</>}
        </h1>

        <form
          action={action}
          className="mt-8"
          onKeyDown={(e) => {
            if (e.key === "Enter" && step < 2 && (e.target as HTMLElement).tagName === "INPUT") {
              e.preventDefault();
              next();
            }
          }}
        >
          {/* All inputs stay mounted so the final submit includes every step. */}
          <section aria-hidden={step !== 0} className={step === 0 ? "grid gap-5" : "hidden"}>
            <Field label="Business name"><input name="name" value={v.name} onChange={set("name")} className={inputCls} placeholder="e.g. Bella's Trattoria" maxLength={80} autoFocus /></Field>
            <fieldset>
              <legend className="text-[13px] font-medium">What kind of business is it?</legend>
              <input type="hidden" name="segment" value={v.segment} />
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SEGMENTS.map((s) => (
                  <button type="button" key={s.id} onClick={() => pickSegment(s.id)} aria-pressed={v.segment === s.id}
                    className={`rounded-xl border px-3 py-3 text-left text-[14px] transition-all ${v.segment === s.id ? "border-ink bg-ink text-white shadow-card" : "border-line bg-white hover:border-stone-400"}`}>
                    <span className="block font-medium">{s.label}</span>
                    <span className={`text-[12px] ${v.segment === s.id ? "text-white/55" : "text-stone-400"}`}>{s.group}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Website" hint="optional"><input name="website" value={v.website} onChange={set("website")} className={inputCls} placeholder="yourbusiness.com" maxLength={200} /></Field>
              <Field label="City" hint="optional"><input name="city" value={v.city} onChange={set("city")} className={inputCls} placeholder="Austin, London, Mohali…" maxLength={60} /></Field>
            </div>
          </section>

          <section aria-hidden={step !== 1} className={step === 1 ? "grid gap-5" : "hidden"}>
            <fieldset>
              <legend className="text-[13px] font-medium">Your main goal</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <label key={g} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[14px] transition-colors ${v.goal === g ? "border-ink bg-white shadow-card" : "border-line bg-white hover:border-stone-400"}`}>
                    <input type="radio" name="goal" value={g} checked={v.goal === g} onChange={set("goal")} className="sr-only" />
                    <span className={`grid h-4 w-4 place-items-center rounded-full border ${v.goal === g ? "border-ink bg-ink" : "border-stone-400"}`}>{v.goal === g && <span className="h-1.5 w-1.5 rounded-full bg-lime" />}</span>
                    {g}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Who is your ideal customer?" hint="optional"><input name="audience" value={v.audience} onChange={set("audience")} className={inputCls} placeholder="e.g. Young families within 5 km" maxLength={160} /></Field>
            <Field label="Your best offer right now" hint="optional"><input name="offer" value={v.offer} onChange={set("offer")} className={inputCls} placeholder="e.g. Free first class · 20% off first order" maxLength={160} /></Field>
          </section>

          <section aria-hidden={step !== 2} className={step === 2 ? "grid gap-6" : "hidden"}>
            <fieldset>
              <legend className="text-[13px] font-medium">Channels <span className="font-normal text-stone-400">— we pre-picked the best ones for your business</span></legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_CHANNELS.map((c) => {
                  const on = channels.includes(c);
                  return (
                    <label key={c} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600 hover:border-stone-400"}`}>
                      <input type="checkbox" name="channels" value={c} checked={on} onChange={() => setChannels((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))} className="sr-only" />
                      {on && <Check className="h-3.5 w-3.5 text-lime" strokeWidth={3} />} {c}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[13px] font-medium">Brand voice</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {VOICES.map((x) => (
                  <label key={x.id} className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors ${v.voice === x.id ? "border-ink bg-white shadow-card" : "border-line bg-white hover:border-stone-400"}`}>
                    <input type="radio" name="voice" value={x.id} checked={v.voice === x.id} onChange={set("voice")} className="sr-only" />
                    <span className="block text-[14px] font-medium">{x.id}</span>
                    <span className="text-[13px] text-stone-500">{x.ex}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          {touched && stepError && <p role="alert" className="mt-5 text-[14px] text-red-600">{stepError}</p>}
          <div className="mt-5"><Notice state={state} /></div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className={`btn-ghost ${step === 0 ? "invisible" : ""}`}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < 2 ? (
              <button type="button" onClick={next} className="btn-primary">Continue <ArrowRight className="h-4 w-4" /></button>
            ) : (
              <BuildButton disabled={channels.length === 0} />
            )}
          </div>
          <BuildingOverlay name={v.name} />
        </form>
      </main>
    </div>
  );
}

function BuildButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-lime" />} Build my growth plan
    </button>
  );
}

function BuildingOverlay({ name }: { name: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-sm text-white">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">Your AI team is working</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{name}</p>
        <ul className="mt-6 grid gap-3 text-[15px]">
          {["Understanding your business", "Mapping your ideal customers", "Finding growth opportunities", "Drafting your first campaign"].map((t, i) => (
            <li key={t} className="flex items-center gap-3 opacity-0 animate-feedIn" style={{ animationDelay: `${i * 350}ms` }}>
              <Loader2 className="h-4 w-4 animate-spin text-lime" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
