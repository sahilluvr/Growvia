"use client";
import { AiOrb } from "@/components/app/GrowthUI";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { guessBusinessAction, onboardingAction } from "@/app/actions";
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
type NewProject = { workspaceId: string; workspaceName: string } | null;

export function Wizard({ userName, initial, newProject = null, chosen = null }: { userName: string; initial: Init; newProject?: NewProject; chosen?: { plan: string; interval: string } | null }) {
  const [state, action] = useFormState(safe(onboardingAction), undefined);
  const [v, setV] = useState({ ...initial });
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  // Typing a website fills in a business name guess (they can change it).
  const fromSite = (w: string) => { try { const h = new URL(/^https?:/i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, ""); return h.split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); } catch { return ""; } };
  // Growvia AI reads the website and fills in the name and type (the user only confirms).
  const [ai, setAi] = useState<"idle" | "reading" | "found" | "unsure">("idle");
  const asked = useRef("");
  useEffect(() => {
    const w = v.website.trim();
    if (!/\.[a-z]{2,}/i.test(w) || asked.current === w) return;
    const id = setTimeout(async () => {
      asked.current = w; setAi("reading");
      const g = await guessBusinessAction(w).catch(() => ({ name: null, segment: null }));
      if (asked.current !== w) return;
      setV((s) => ({ ...s, name: s.name.trim() ? s.name : g.name ?? fromSite(w), segment: s.segment || g.segment || "" }));
      setAi(g.segment ? "found" : "unsure");
    }, initial.website && asked.current === "" ? 50 : 700);
    return () => clearTimeout(id);
  }, [v.website]); // eslint-disable-line react-hooks/exhaustive-deps
  const segLabel = SEGMENTS.find((x) => x.id === v.segment)?.label;
  const error = !v.name.trim() ? "Add your business name." : !v.segment ? "Pick your business type." : "";
  const channels = v.segment ? defaultChannels(v.segment) : [];

  return (
    <div className="gv-aurora min-h-dvh">
      <header className="container-x flex h-16 items-center justify-between">
        <Link href="/" aria-label="Growvia home"><Logo /></Link>
        {newProject ? <Link href="/app/projects" className="text-[13px] text-stone-500 hover:text-ink">Cancel</Link> : <form action="/auth/signout" method="post"><button className="text-[13px] text-stone-500 hover:text-ink">Sign out</button></form>}
      </header>
      <main className="container-x max-w-[760px] pb-20 pt-4">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500"><Sparkles className="h-3.5 w-3.5 text-lime-700" /> One step · about 30 seconds</p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tightest sm:text-[40px]">
          {newProject ? <>New project in {newProject.workspaceName}</> : <>Hi {userName} — let&apos;s see how <span className="gv-ai-text">{v.name || "your business"}</span> shows up online.</>}
        </h1>
        <p className="mt-2 text-[15px] text-stone-600">Growvia AI checks your website, asks AI assistants about you and builds your plan — live, in about two minutes.</p>

        <form action={action} className="gv-glass mt-8 grid gap-5 rounded-3xl p-5 sm:p-7" onSubmit={(e) => { if (error) { e.preventDefault(); setTouched(true); } }}>
          {chosen && <><input type="hidden" name="chosen_plan" value={chosen.plan} /><input type="hidden" name="chosen_interval" value={chosen.interval} /></>}
          {newProject && <><input type="hidden" name="new_project" value="1" /><input type="hidden" name="workspace_id" value={newProject.workspaceId} /></>}
          <input type="hidden" name="goal" value={GOALS[0]} />
          <input type="hidden" name="voice" value="Friendly" />
          {channels.map((c) => <input key={c} type="hidden" name="channels" value={c} />)}
          <input type="hidden" name="segment" value={v.segment} />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Website" hint="recommended"><input name="website" value={v.website} onChange={set("website")} onBlur={() => { if (!v.name.trim() && v.website.trim()) setV((s) => ({ ...s, name: fromSite(s.website) })); }} inputMode="url" className={inputCls} placeholder="yourbusiness.com" maxLength={200} /></Field>
            <Field label="Business name"><input name="name" value={v.name} onChange={set("name")} className={inputCls} placeholder="e.g. Bright Smile Dental" maxLength={80} /></Field>
          </div>
          {ai !== "idle" && (
            <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] ${ai === "reading" ? "gv-shimmer text-stone-600" : ai === "found" ? "border border-lime-500/50 bg-lime/15 text-ink" : "border border-line bg-white/80 text-stone-600"}`} role="status">
              <Sparkles className={`h-4 w-4 ${ai === "reading" ? "animate-pulse text-stone-500" : "text-lime-700"}`} />
              {ai === "reading" ? "Growvia AI is reading your website…" : ai === "found" ? <>Growvia AI recognised <b>{v.name}</b>{segLabel ? <> as a <b>{segLabel.toLowerCase()}</b></> : null}. Change anything below if it&apos;s not right.</> : "We couldn't tell your business type from the website — pick it below."}
            </div>
          )}
          <fieldset>
            <legend className="text-[13px] font-medium">What kind of business is it?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SEGMENTS.map((sg) => (
                <button type="button" key={sg.id} onClick={() => setV((s) => ({ ...s, segment: sg.id }))} aria-pressed={v.segment === sg.id}
                  className={`rounded-xl border px-3 py-3 text-left text-[14px] transition-all ${v.segment === sg.id ? "border-ink bg-ink text-white shadow-card" : "border-line bg-white/80 hover:border-stone-400"}`}>
                  <span className="block font-medium">{sg.label}</span>
                  <span className={`text-[12px] ${v.segment === sg.id ? "text-white/55" : "text-stone-400"}`}>{sg.group}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="City" hint="optional — helps local results"><input name="city" value={v.city} onChange={set("city")} className={inputCls} placeholder="Austin, London, Dubai…" maxLength={60} /></Field>

          {touched && error && <p role="alert" className="text-[14px] text-red-600">{error}</p>}
          <Notice state={state} />
          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-stone-500">You can change any of this later in Settings.</p>
            <BuildButton disabled={false} />
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
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-lime" />} Analyse my business
    </button>
  );
}

function BuildingOverlay({ name }: { name: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="gv-aurora fixed inset-0 z-50 grid place-items-center p-6" role="status" aria-live="polite">
      <div className="gv-glass w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto w-fit"><AiOrb /></div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Growvia AI is getting to know</p>
        <p className="mt-1 text-[26px] font-semibold tracking-tight"><span className="gv-ai-text">{name || "your business"}</span></p>
        <ul className="mx-auto mt-6 grid max-w-xs gap-2.5 text-left text-[14px]">
          {["Understanding your business", "Mapping your ideal customers", "Preparing your website check", "Lining up AI assistant questions"].map((t, i) => (
            <li key={t} className="flex items-center gap-3 opacity-0 animate-feedIn" style={{ animationDelay: `${i * 450}ms` }}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ink"><Loader2 className="h-3.5 w-3.5 animate-spin text-lime" /></span> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
