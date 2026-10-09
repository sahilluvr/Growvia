"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ImagePlus, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { addAdImageAction, adPhotoAction, adUploadUrlAction, deleteAdAction, saveBriefAction, saveTextAdsAction, writeTextAdsAction } from "@/app/ad-actions";
import { aiImageAction } from "@/app/social-ai-actions";
import { inputCls, textareaCls } from "@/components/ui/Form";
import type { Brief, TextAds, VideoData } from "@/lib/ai/ads";
import { VideoEditor } from "./video";
import { useJob } from "@/components/app/Jobs";

export type AdRow = { id: string; name: string; url: string | null; brief: Brief; text_ads: TextAds; video: VideoData; audio_url: string | null; video_url: string | null };

const TABS = [["text", "Text ads"], ["video", "Video ad"], ["brief", "Brief & images"]] as const;

export function AdStudio({ ad, businessName, photoReady, voices, styles, initialTab, videoPlan }: { ad: AdRow; businessName: string; photoReady: boolean; voices: { id: string; feel: string }[]; styles: { id: string; label: string }[]; initialTab: "text" | "video" | "brief"; videoPlan: { watermark: boolean; left: number; limit: number } }) {
  const [tab, setTab] = useState(initialTab);
  const [brief, setBrief] = useState(ad.brief);
  const [pending, start] = useTransition();
  return (
    <div className="mt-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tightest sm:text-[34px]">{ad.name}</h1>
          <p className="mt-1 truncate text-[14px] text-stone-500">{brief.summary}</p>
        </div>
        <button disabled={pending} onClick={() => { if (confirm("Delete this ad? This can't be undone.")) start(() => deleteAdAction(ad.id)); }} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-3 text-[13px] text-stone-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /> Delete</button>
      </div>
      <nav aria-label="Ad sections" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] ${tab === k ? "border-ink font-semibold" : "border-transparent text-stone-500 hover:text-ink"}`}>{l}</button>
        ))}
      </nav>
      {tab === "text" && <TextAdsTab id={ad.id} initial={ad.text_ads} brief={brief} businessName={businessName} />}
      {tab === "video" && <VideoEditor ad={ad} brief={brief} voices={voices} styles={styles} videoPlan={videoPlan} onImages={(images) => setBrief((b) => ({ ...b, images }))} />}
      {tab === "brief" && <BriefTab id={ad.id} brief={brief} setBrief={setBrief} photoReady={photoReady} />}
    </div>
  );
}

/* ───────── Brief ───────── */

export function ImageLibrary({ id, images, onChange, photoReady }: { id: string; images: string[]; onChange: (x: string[]) => void; photoReady: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [prompt, setPrompt] = useState("");
  const upload = async (files: FileList | null) => {
    setErr("");
    for (const f of Array.from(files ?? []).slice(0, 6)) {
      setBusy(true);
      try {
        const r = await adUploadUrlAction(f.name, f.type);
        if (!r.ok) throw new Error(r.error);
        const put = await fetch(r.uploadUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type } });
        if (!put.ok) throw new Error("Upload failed — try again.");
        const a = await addAdImageAction(id, r.publicUrl);
        if (a.ok) onChange(a.images); else throw new Error(a.error);
      } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); } finally { setBusy(false); }
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((u, i) => (
          <div key={u} className="relative h-20 w-20 overflow-hidden rounded-xl bg-mist">
            <img src={u} alt="" className="h-full w-full object-cover" />
            <span className="absolute left-1 top-1 rounded bg-ink/70 px-1 text-[10px] text-white">{i + 1}</span>
            <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => { const next = images.filter((x) => x !== u); onChange(next); saveBriefAction(id, { images: next }); }} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-[11px] text-white">×</button>
          </div>
        ))}
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-stone-500 hover:border-ink">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Upload images" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {!images.length && <p className="mt-2 text-[12px] text-stone-500">No photos found on the website. Upload a few — video scenes look best with real photos.</p>}
      {photoReady && (
        <div className="mt-3 flex gap-2">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} className={`${inputCls} h-9 text-[13px]`} placeholder="…or describe an AI photo, e.g. happy family at a restaurant table" aria-label="AI photo description" />
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); setErr(""); const r = await adPhotoAction(id, prompt); setBusy(false); if (r.ok) { onChange(r.images); setPrompt(""); } else setErr(r.error); }} className="btn-ghost h-9 shrink-0 px-3 text-[13px]"><ImagePlus className="h-4 w-4" /> AI photo</button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-[13px] text-red-700">{err}</p>}
    </div>
  );
}

function BriefTab({ id, brief, setBrief, photoReady }: { id: string; brief: Brief; setBrief: (b: Brief | ((x: Brief) => Brief)) => void; photoReady: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const f = (k: keyof Brief) => ({ value: String(brief[k] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setBrief((b) => ({ ...b, [k]: e.target.value })) });
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section className="card grid gap-3 p-5">
        <p className="text-[13px] text-stone-500">Everything Growvia writes for this ad starts from this brief. Edit anything that&apos;s off.</p>
        <label className="block"><span className="text-[13px] font-medium">Business name</span><input {...f("business")} className={`${inputCls} mt-1.5`} /></label>
        <label className="block"><span className="text-[13px] font-medium">What they sell</span><textarea {...f("summary")} rows={3} className={`${textareaCls} mt-1.5`} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-[13px] font-medium">Promote</span><input {...f("offer")} className={`${inputCls} mt-1.5`} /></label>
          <label className="block"><span className="text-[13px] font-medium">Audience</span><input {...f("audience")} className={`${inputCls} mt-1.5`} /></label>
          <label className="block"><span className="text-[13px] font-medium">Tone</span><input {...f("tone")} className={`${inputCls} mt-1.5`} /></label>
          <label className="block"><span className="text-[13px] font-medium">Call to action</span><input {...f("cta")} maxLength={30} className={`${inputCls} mt-1.5`} /></label>
        </div>
        <label className="block"><span className="text-[13px] font-medium">Selling points <span className="font-normal text-stone-400">one per line</span></span>
          <textarea value={brief.usps.join("\n")} onChange={(e) => setBrief((b) => ({ ...b, usps: e.target.value.split("\n") }))} rows={4} className={`${textareaCls} mt-1.5`} /></label>
        <div className="flex items-center gap-3">
          <button disabled={pending} onClick={() => start(async () => { const r = await saveBriefAction(id, { ...brief, usps: brief.usps.filter((x) => x.trim()) }); setMsg(r.ok ? "Saved." : r.error); })} className="btn-primary h-10 px-5 text-[14px]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save brief"}</button>
          {msg && <span role="status" className="text-[13px] text-stone-600">{msg}</span>}
        </div>
      </section>
      <section className="card grid content-start gap-3 p-5">
        <p className="text-[15px] font-semibold">Images</p>
        <p className="text-[13px] text-stone-500">Copied from {brief.site?.url ? new URL(brief.site.url).host : "your uploads"}. Used in video scenes and image ads.</p>
        <ImageLibrary id={id} images={brief.images ?? []} photoReady={photoReady} onChange={(images) => setBrief((b) => ({ ...b, images }))} />
        {brief.logo && <div className="mt-2 flex items-center gap-3 text-[13px] text-stone-500"><img src={brief.logo} alt="Logo" className="h-10 max-w-[120px] rounded bg-white object-contain p-1" /> Logo (shown on the video end card)</div>}
      </section>
    </div>
  );
}

/* ───────── Text ads ───────── */

const PLATFORMS = [["google", "Google Search"], ["meta", "Facebook & Instagram"], ["linkedin", "LinkedIn"], ["x", "X"], ["display", "Display banners"]] as const;
const TONES = ["Clear & friendly", "Bold & punchy", "Premium", "Playful", "Professional", "Urgent (no fake deadlines)"];

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); }).catch(() => {}); }} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-stone-600 hover:border-ink">
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {ok ? "Copied" : label}
    </button>
  );
}
function Field({ value, max, onChange, multiline, label }: { value: string; max: number; onChange: (v: string) => void; multiline?: boolean; label: string }) {
  const over = value.length > max;
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] text-stone-500"><span>{label}</span><span className={`tabular-nums ${over ? "font-semibold text-red-600" : ""}`}>{value.length}/{max}</span></span>
      {multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={`${textareaCls} mt-1 text-[14px] ${over ? "border-red-300" : ""}`} aria-label={label} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mt-1 h-9 text-[14px] ${over ? "border-red-300" : ""}`} aria-label={label} />}
    </label>
  );
}

function TextAdsTab({ id, initial, brief, businessName }: { id: string; initial: TextAds; brief: Brief; businessName: string }) {
  const [ads, setAds] = useState<TextAds>(initial ?? {});
  const [picked, setPicked] = useState<string[]>(["google", "meta"]);
  const [tone, setTone] = useState(TONES[0]);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const first = useRef(true);
  const job = useJob("ad_text", (p) => p.adId === id, (j) => { if (j.status === "done" && j.result?.ads) { first.current = true; setAds(j.result.ads); } else if (j.status === "failed") setErr(j.message ?? "Couldn't write the ads."); });
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => { const r = await saveTextAdsAction(id, ads); setSaved(r.ok ? "Saved" : r.error); }, 900);
    return () => clearTimeout(t);
  }, [ads, id]);
  const host = brief.site?.url ? new URL(brief.site.url).host : "yourbusiness.com";
  const set = (fn: (a: TextAds) => void) => setAds((a) => { const n = structuredClone(a); fn(n); return n; });
  const has = Boolean(ads.google || ads.meta || ads.linkedin || ads.x || ads.display);
  return (
    <div className="grid gap-5">
      <section className="card grid gap-3 p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Platforms">
          {PLATFORMS.map(([k, l]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${picked.includes(k) ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>
              <input type="checkbox" className="sr-only" checked={picked.includes(k)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, k] : p.filter((x) => x !== k))} /> {l}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone" className={`${inputCls} h-10 w-auto text-[13px]`}>{TONES.map((t) => <option key={t}>{t}</option>)}</select>
          <button disabled={job.running || !picked.length} onClick={async () => { setErr(""); const r = await job.start(() => writeTextAdsAction(id, picked, tone)); if (!r.ok) setErr(r.error); }} className="btn-primary h-10 px-5 text-[14px] disabled:opacity-50">
            {job.running ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing ads in the background…</> : <><Sparkles className="h-4 w-4" /> {has ? "Rewrite selected" : "Write ads"}</>}
          </button>
          {saved && has && <span className="text-[12px] text-stone-400">{saved}</span>}
        </div>
        {err && <p role="alert" className="text-[13px] text-red-700">{err}</p>}
      </section>

      {ads.google && (
        <section className="card grid gap-4 p-5" data-testid="ads-google">
          <div className="flex items-center justify-between"><h2 className="text-[17px] font-semibold">Google Search</h2><CopyBtn label="Copy all" text={[`Headlines:\n${ads.google.headlines.join("\n")}`, `Descriptions:\n${ads.google.descriptions.join("\n")}`, `Keywords:\n${ads.google.keywords.join("\n")}`, `Negative keywords:\n${ads.google.negatives.join("\n")}`].join("\n\n")} /></div>
          <div className="rounded-xl border border-line bg-white p-4" aria-label="Search ad preview">
            <p className="text-[12px] text-stone-600"><b className="text-ink">Sponsored</b> · {host}{ads.google.paths.map((p) => ` › ${p}`)}</p>
            <p className="mt-1 text-[18px] leading-snug text-[#1a0dab]">{ads.google.headlines.slice(0, 3).join(" | ")}</p>
            <p className="mt-1 text-[14px] text-stone-700">{ads.google.descriptions[0]}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">{ads.google.headlines.map((h, i) => <Field key={i} label={`Headline ${i + 1}`} value={h} max={30} onChange={(v) => set((a) => { a.google!.headlines[i] = v; })} />)}</div>
            <div className="grid content-start gap-2">
              {ads.google.descriptions.map((d, i) => <Field key={i} label={`Description ${i + 1}`} value={d} max={90} multiline onChange={(v) => set((a) => { a.google!.descriptions[i] = v; })} />)}
              <div><p className="text-[12px] font-medium">Keywords</p><div className="mt-1 flex flex-wrap gap-1.5">{ads.google.keywords.map((k) => <span key={k} className="rounded-full bg-mist px-2.5 py-1 text-[12px]">{k}</span>)}</div></div>
              <div><p className="text-[12px] font-medium">Negative keywords</p><div className="mt-1 flex flex-wrap gap-1.5">{ads.google.negatives.map((k) => <span key={k} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-stone-500">−{k}</span>)}</div></div>
              {ads.google.sitelinks.length > 0 && <div><p className="text-[12px] font-medium">Sitelinks</p><ul className="mt-1 grid gap-1 text-[13px]">{ads.google.sitelinks.map((s) => <li key={s.text}><b>{s.text}</b> — {s.desc}</li>)}</ul></div>}
            </div>
          </div>
        </section>
      )}

      {ads.meta && (
        <section className="grid gap-3" data-testid="ads-meta">
          <h2 className="text-[17px] font-semibold">Facebook & Instagram</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {ads.meta.variants.map((v, i) => <MetaAd key={i} v={v} images={brief.images ?? []} name={brief.business || businessName} onChange={(nv) => set((a) => { a.meta!.variants[i] = nv; })} />)}
          </div>
        </section>
      )}

      {ads.linkedin && (
        <section className="grid gap-3">
          <h2 className="text-[17px] font-semibold">LinkedIn</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {ads.linkedin.variants.map((v, i) => (
              <div key={i} className="card grid gap-2 p-4">
                <div className="flex items-center justify-between"><span className="text-[12px] font-medium text-stone-500">{v.angle}</span><CopyBtn text={`${v.intro}\n\n${v.headline}\nCTA: ${v.cta}`} /></div>
                <Field label="Intro text" value={v.intro} max={600} multiline onChange={(x) => set((a) => { a.linkedin!.variants[i].intro = x; })} />
                <Field label="Headline" value={v.headline} max={70} onChange={(x) => set((a) => { a.linkedin!.variants[i].headline = x; })} />
                <p className="text-[12px] text-stone-500">Button: <b>{v.cta}</b></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {ads.x && (
        <section className="grid gap-3">
          <h2 className="text-[17px] font-semibold">X</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {ads.x.variants.map((v, i) => (
              <div key={i} className="card grid gap-2 p-4">
                <div className="flex items-center justify-between"><span className="text-[12px] font-medium text-stone-500">{v.angle}</span><CopyBtn text={v.post} /></div>
                <Field label="Post" value={v.post} max={280} multiline onChange={(x) => set((a) => { a.x!.variants[i].post = x; })} />
              </div>
            ))}
          </div>
        </section>
      )}

      {ads.display && (
        <section className="card grid gap-3 p-5">
          <div className="flex items-center justify-between"><h2 className="text-[17px] font-semibold">Display banners</h2><CopyBtn label="Copy all" text={[...ads.display.short, "", ...ads.display.long].join("\n")} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">{ads.display.short.map((h, i) => <Field key={i} label={`Short headline ${i + 1}`} value={h} max={30} onChange={(x) => set((a) => { a.display!.short[i] = x; })} />)}</div>
            <div className="grid gap-2">{ads.display.long.map((h, i) => <Field key={i} label={`Long headline ${i + 1}`} value={h} max={90} onChange={(x) => set((a) => { a.display!.long[i] = x; })} />)}</div>
          </div>
        </section>
      )}
      {!has && <p className="rounded-xl border border-dashed border-line p-6 text-center text-[14px] text-stone-500">Pick the platforms and press <b>Write ads</b>. Every line respects that platform&apos;s character limits.</p>}
    </div>
  );
}

type MetaV = NonNullable<TextAds["meta"]>["variants"][number];
function MetaAd({ v, images, name, onChange }: { v: MetaV; images: string[]; name: string; onChange: (v: MetaV) => void }) {
  const [img, setImg] = useState<string | null>(images[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[12px] font-semibold text-lime">{name.slice(0, 1)}</span><span><span className="block text-[13px] font-semibold">{name}</span><span className="text-[11px] text-stone-500">Sponsored · {v.angle}</span></span></div>
      <p className="whitespace-pre-line px-3 pb-3 text-[13px] leading-relaxed">{v.primary}</p>
      {img ? <img src={img} alt="" className="aspect-square w-full bg-mist object-cover" /> : <div className="grid aspect-square w-full place-items-center bg-mist text-[12px] text-stone-400">No image</div>}
      <div className="flex items-center justify-between gap-2 bg-paper p-3">
        <span className="min-w-0"><span className="block truncate text-[14px] font-semibold">{v.headline}</span><span className="block truncate text-[12px] text-stone-500">{v.description}</span></span>
        <span className="shrink-0 rounded-md bg-mist px-3 py-1.5 text-[12px] font-semibold">{v.cta}</span>
      </div>
      <div className="grid gap-2 border-t border-line p-3">
        <Field label="Primary text" value={v.primary} max={500} multiline onChange={(x) => onChange({ ...v, primary: x })} />
        <Field label="Headline" value={v.headline} max={40} onChange={(x) => onChange({ ...v, headline: x })} />
        <Field label="Description" value={v.description} max={30} onChange={(x) => onChange({ ...v, description: x })} />
        <div className="flex flex-wrap gap-1.5">
          {images.slice(0, 6).map((u) => <button key={u} type="button" onClick={() => setImg(u)} aria-label="Use this image" className={`h-10 w-10 overflow-hidden rounded-lg border-2 ${img === u ? "border-ink" : "border-transparent"}`}><img src={u} alt="" className="h-full w-full object-cover" /></button>)}
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); setErr(""); const r = await aiImageAction({ headline: v.headline, sub: v.description, cta: v.cta, palette: "ink", layout: "bold", size: "square" }); setBusy(false); if (r.ok) setImg(r.url); else setErr(r.error); }} className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-2.5 text-[12px] hover:border-ink">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Design image</button>
        </div>
        {err && <p className="text-[12px] text-red-700">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <CopyBtn text={`${v.primary}\n\nHeadline: ${v.headline}\nDescription: ${v.description}\nButton: ${v.cta}`} />
          {img && <a href={img} target="_blank" download className="inline-flex items-center rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-stone-600 hover:border-ink">Download image</a>}
          <button type="button" onClick={() => router.push(`/app/publish?caption=${encodeURIComponent(v.primary)}${img ? `&image=${encodeURIComponent(img)}` : ""}`)} className="inline-flex items-center rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-stone-600 hover:border-ink">Use as a post</button>
        </div>
      </div>
    </div>
  );
}
