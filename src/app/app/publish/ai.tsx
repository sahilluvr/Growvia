"use client";
import { safe } from "@/lib/client/safe-action";
import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Sparkles, Loader2, X, ImagePlus, CalendarRange } from "lucide-react";
import { aiImageAction, aiSocialAction, planWeekAction } from "@/app/social-ai-actions";
import { Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import type { SocialIdea } from "@/lib/ai/write";

const TONES = ["Friendly", "Professional", "Playful", "Persuasive", "Inspirational", "Short & direct"];
export const PALETTE_SWATCH: Record<string, [string, string]> = { ink: ["#0B0D0C", "#C8F169"], lime: ["#C8F169", "#0B0D0C"], ocean: ["#0E3B5C", "#7FD3FF"], sunset: ["#FF6B3D", "#FFE3A3"], paper: ["#F6F4EE", "#FF6B3D"], plum: ["#3B1D4A", "#F7B2E6"] };
export type Seed = { headline: string; sub: string; prompt: string };

/** Brief → caption options with hashtags and an image idea. */
export function AiCaption({ channels, onUse }: { channels: string[]; onUse: (caption: string, seed: Seed) => void }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("Friendly");
  const [opts, setOpts] = useState<SocialIdea[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setErr("");
    const r = await aiSocialAction({ brief, tone, channels });
    if (r.ok) setOpts(r.options); else setErr(r.error);
  });
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-lime/30 px-3 py-1.5 text-[13px] font-medium hover:border-ink"><Sparkles className="h-3.5 w-3.5" /> Write with AI</button>
  );
  return (
    <div className="rounded-2xl border border-line bg-paper p-3.5" data-testid="ai-caption">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Sparkles className="h-3.5 w-3.5" /> Write a post with AI</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close AI writer" className="rounded-full p-1 text-stone-400 hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={1200} className={`${textareaCls} mt-2 text-[14px]`} aria-label="What is the post about?" placeholder="e.g. new monsoon menu launches Friday, 2 new dishes, book a table" />
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone" className={`${inputCls} h-9 w-auto py-0 text-[13px]`}>{TONES.map((t) => <option key={t}>{t}</option>)}</select>
        <button type="button" disabled={pending || !brief.trim()} onClick={run} className="btn-primary h-9 px-4 text-[13px] disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Write 3 options"}</button>
      </div>
      {err && <p role="alert" className="mt-2 text-[13px] text-red-700">{err}</p>}
      <div className="mt-3 grid gap-2">
        {opts.map((o, i) => (
          <div key={i} className="rounded-xl border border-line bg-white p-3">
            <p className="line-clamp-5 whitespace-pre-line text-[13px]">{o.caption}</p>
            {o.hashtags.length > 0 && <p className="mt-1 text-[12px] text-sky-700">{o.hashtags.join(" ")}</p>}
            {o.image.headline && <p className="mt-1 text-[12px] text-stone-500">Image idea: “{o.image.headline}”</p>}
            <button type="button" onClick={() => { onUse([o.caption, o.hashtags.join(" ")].filter(Boolean).join("\n\n"), { headline: o.image.headline, sub: o.image.sub, prompt: o.image.prompt }); setOpts([]); setOpen(false); }} className="mt-2 rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-white">Use this</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Branded image generator → adds the PNG to the post. */
export function ImageDesigner({ seed, onImage, photoReady }: { seed: Seed | null; onImage: (url: string) => void; photoReady: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ headline: "", sub: "", cta: "", palette: "ink", layout: "bold", size: "square", usePhoto: false, photoPrompt: "" });
  const [seen, setSeen] = useState<Seed | null>(null);
  if (seed && seed !== seen) { setSeen(seed); setF((x) => ({ ...x, headline: seed.headline || x.headline, sub: seed.sub || x.sub, photoPrompt: seed.prompt || x.photoPrompt })); setOpen(true); }
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState("");
  const [last, setLast] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const go = () => start(async () => {
    setErr(""); setWarn("");
    const r = await aiImageAction(f);
    if (!r.ok) return setErr(r.error);
    setLast(r.url); onImage(r.url); if (r.warning) setWarn(r.warning);
  });
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="grid h-24 w-24 place-items-center rounded-xl border-2 border-dashed border-line text-center text-[11px] text-stone-500 hover:border-ink">
      <span className="grid place-items-center gap-1"><Sparkles className="h-5 w-5" />Create image</span>
    </button>
  );
  return (
    <div className="w-full rounded-2xl border border-line bg-paper p-3.5" data-testid="image-designer">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold"><ImagePlus className="h-3.5 w-3.5" /> Create an image</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close image designer" className="rounded-full p-1 text-stone-400 hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input value={f.headline} onChange={(e) => set("headline", e.target.value)} maxLength={90} className={`${inputCls} h-9 text-[13px]`} placeholder="Headline, e.g. Monsoon menu is here" aria-label="Image headline" />
        <input value={f.sub} onChange={(e) => set("sub", e.target.value)} maxLength={140} className={`${inputCls} h-9 text-[13px]`} placeholder="Subline (optional)" aria-label="Image subline" />
        <input value={f.cta} onChange={(e) => set("cta", e.target.value)} maxLength={40} className={`${inputCls} h-9 text-[13px]`} placeholder="Button text (optional), e.g. Book now" aria-label="Image button text" />
        <div className="flex gap-2">
          <select value={f.layout} onChange={(e) => set("layout", e.target.value)} aria-label="Layout" className={`${inputCls} h-9 py-0 text-[13px]`}>
            <option value="bold">Bold</option><option value="minimal">Minimal</option><option value="quote">Quote</option><option value="photo">Photo</option>
          </select>
          <select value={f.size} onChange={(e) => set("size", e.target.value)} aria-label="Size" className={`${inputCls} h-9 py-0 text-[13px]`}>
            <option value="square">Square 1:1</option><option value="portrait">Portrait 4:5</option><option value="story">Story 9:16</option><option value="landscape">Wide 1.91:1</option>
          </select>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colours">
        {Object.entries(PALETTE_SWATCH).map(([k, [bg, ac]]) => (
          <button key={k} type="button" role="radio" aria-checked={f.palette === k} aria-label={k} onClick={() => set("palette", k)} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${f.palette === k ? "border-ink" : "border-transparent"}`} style={{ background: bg }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ac }} />
          </button>
        ))}
      </div>
      {photoReady && (
        <div className="mt-2 grid gap-2">
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.usePhoto} onChange={(e) => set("usePhoto", e.target.checked)} /> Add an AI-generated photo (takes ~20s)</label>
          {f.usePhoto && <textarea value={f.photoPrompt} onChange={(e) => set("photoPrompt", e.target.value)} rows={2} maxLength={600} className={`${textareaCls} text-[13px]`} placeholder="Describe the photo, e.g. steaming bowl of ramen on a wooden table, rainy window" aria-label="Photo description" />}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || !f.headline.trim()} onClick={go} className="btn-primary h-9 px-4 text-[13px] disabled:opacity-50">{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : last ? "Make another" : "Create image"}</button>
        {last && <a href={last} target="_blank" download className="text-[12px] text-stone-500 underline">Download PNG</a>}
      </div>
      {err && <p role="alert" className="mt-2 text-[13px] text-red-700">{err}</p>}
      {warn && <p className="mt-2 text-[12px] text-amber-700">{warn}</p>}
    </div>
  );
}

/** “Plan my week” — N posts with captions, hashtags and images, as drafts or scheduled. */
export function PlanWeek({ accounts }: { accounts: { id: string; name: string; provider: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(safe(planWeekAction), undefined);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Kolkata";
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="card mb-4 flex w-full items-center gap-3 p-4 text-left transition-shadow hover:shadow-frame">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-lime/40"><CalendarRange className="h-4 w-4" /></span>
      <span><span className="block text-[15px] font-semibold">Plan a week of posts with AI</span><span className="text-[13px] text-stone-500">Captions, hashtags and on-brand images for the next 7 days — review, then schedule.</span></span>
    </button>
  );
  return (
    <form action={action} className="card mb-4 grid gap-3 p-5" data-testid="plan-week">
      <input type="hidden" name="tz" value={tz} />
      <p className="flex items-center gap-2 text-[15px] font-semibold"><CalendarRange className="h-4 w-4" /> Plan a week of posts</p>
      <label className="block"><span className="text-[13px] font-medium">Anything to focus on? <span className="font-normal text-stone-400">optional</span></span>
        <textarea name="focus" rows={2} maxLength={600} className={`${textareaCls} mt-1.5`} placeholder="e.g. weekend brunch launch, festive offers, hiring a chef" /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="text-[13px] font-medium">Posts</span><select name="posts" defaultValue="5" className={`${inputCls} mt-1.5`}>{[3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium">Tone</span><select name="tone" className={`${inputCls} mt-1.5`}>{TONES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium">Image colours</span><select name="palette" className={`${inputCls} mt-1.5`}>{Object.keys(PALETTE_SWATCH).map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
      </div>
      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[13px]">
          {accounts.map((a) => <label key={a.id} className="flex items-center gap-1.5"><input type="checkbox" name="targets" value={a.id} defaultChecked /> {a.name} <span className="text-stone-400">({a.provider})</span></label>)}
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-[13px]">
        {accounts.length > 0 && <label className="flex items-center gap-2"><input type="checkbox" name="schedule" /> Schedule them straight away (otherwise saved as drafts to review)</label>}
        <label className="flex items-center gap-2"><input type="checkbox" name="photos" /> Use AI photos (slower)</label>
      </div>
      <Notice state={state} />
      <div className="flex gap-2">
        <Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Planning your week…">Plan my week</Submit>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost h-10 px-4 text-[14px]">Close</button>
      </div>
    </form>
  );
}
