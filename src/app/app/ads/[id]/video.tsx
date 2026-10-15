"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, ImagePlus, Loader2, Mic, Pause, Play, Send, Sparkles, Square, Volume2 } from "lucide-react";
import { adUploadUrlAction, postAdAction, saveRenderAction, startExportAction, saveVideoAction, voiceSampleAction, voiceoverAction, writeScriptAction } from "@/app/ad-actions";
import { inputCls, textareaCls } from "@/components/ui/Form";
import { AVATARS, PALETTES, SIZES, drawAvatar, drawPhotoAvatar, drawFrame, loadImage, pickMime, play, sceneTimes, totalOf, type Input, type Player } from "@/components/ads/engine";
import type { Brief, Scene, VideoSettings } from "@/lib/ai/ads";
import type { AdRow } from "./client";
import { useJob } from "@/components/app/Jobs";

const FORMATS = [["9:16", "Reels · Stories · TikTok · Shorts"], ["1:1", "Feed square"], ["16:9", "YouTube · website"]] as const;
const KIND: Record<string, string> = { hook: "Hook", problem: "Problem", solution: "Solution", benefit: "Benefit", proof: "Why us", offer: "Offer", cta: "Call to action" };

function AvatarThumb({ id, on, onPick }: { id: string; on: boolean; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const a = AVATARS.find((x) => x.id === id);
  useEffect(() => { const c = ref.current?.getContext("2d"); if (!c || !a) return; c.clearRect(0, 0, 80, 80); c.fillStyle = "#F1EFE8"; c.fillRect(0, 0, 80, 80); drawAvatar(c, a, 40, 36, 17, 0.5, 0); }, [a]);
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={`grid justify-items-center gap-1 rounded-xl border-2 p-1.5 text-[11px] ${on ? "border-ink" : "border-transparent hover:border-line"}`}>
      {a ? <canvas ref={ref} width={80} height={80} className="h-14 w-14 rounded-lg" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-mist text-stone-400">None</span>}
      <span>{a?.name ?? "No presenter"}</span>
    </button>
  );
}

/** Shrinks a photo to a 720px JPEG before upload (faster to load, draw and store). */
async function shrinkPhoto(f: File): Promise<Blob> {
  const url = URL.createObjectURL(f);
  try {
    const img = await loadImage(url);
    if (!img) throw new Error("That file isn't a readable photo.");
    const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read the photo."))), "image/jpeg", 0.88));
  } finally { URL.revokeObjectURL(url); }
}

function PhotoThumb({ img, on, onPick }: { img: HTMLImageElement | null; on: boolean; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext("2d"); if (!c || !img) return; c.clearRect(0, 0, 80, 80); c.fillStyle = "#F1EFE8"; c.fillRect(0, 0, 80, 80); drawPhotoAvatar(c, img, 40, 40, 30, 0.5, 0, "#C8F169"); }, [img]);
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={`grid justify-items-center gap-1 rounded-xl border-2 p-1.5 text-[11px] ${on ? "border-ink" : "border-transparent hover:border-line"}`}>
      <canvas ref={ref} width={80} height={80} className="h-14 w-14 rounded-lg" />
      <span>You</span>
    </button>
  );
}

export function VideoEditor({ ad, brief, voices, styles, onImages, videoPlan }: { ad: AdRow; brief: Brief; voices: { id: string; feel: string }[]; styles: { id: string; label: string }[]; onImages: (x: string[]) => void; videoPlan: { watermark: boolean; left: number; limit: number } }) {
  void onImages;
  const router = useRouter();
  const [settings, setSettings] = useState<VideoSettings>(ad.video.settings);
  const [scenes, setScenes] = useState<Scene[]>(ad.video.scenes ?? []);
  const [direction, setDirection] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(ad.audio_url);
  const [timing, setTiming] = useState<number[] | null>(ad.video.timing ?? null);
  const [videoUrl, setVideoUrl] = useState<string | null>(ad.video_url);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "script" | "voice" | "sample" | "export" | "upload" | "optimize" | "post">("");
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [, startSave] = useTransition();
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<Player | null>(null);
  const imgs = useRef<(HTMLImageElement | null)[]>([]);
  const logo = useRef<HTMLImageElement | null>(null);
  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null);
  const voiceBuf = useRef<{ url: string; buf: AudioBuffer } | null>(null);
  const sample = useRef<HTMLAudioElement | null>(null);
  const samples = useRef(new Map<string, string>()); // each voice sample is made once (saves free AI quota)
  const [ready, setReady] = useState(false);
  const scriptJob = useJob("ad_script", (p) => p.adId === ad.id, (j) => {
    if (j.status === "done" && j.result?.video) { first.current = true; setScenes(j.result.video.scenes); setSettings(j.result.video.settings); setAudioUrl(null); setTiming(null); setT(0); }
    else if (j.status === "failed") setErr(j.message ?? "Couldn't write the story.");
  });
  const voiceJob = useJob("ad_voice", (p) => p.adId === ad.id, (j) => {
    if (j.status === "done" && j.result?.audioUrl) { setAudioUrl(j.result.audioUrl); setTiming(j.result.timing); voiceBuf.current = null; setT(0); setNote(`Voice-over recorded (${Math.round(j.result.seconds)}s).`); }
    else if (j.status === "failed") setErr(j.message ?? "Couldn't record the voice-over.");
  });
  const first = useRef(true);

  const [W, H] = SIZES[settings.format];
  const times = useMemo(() => sceneTimes(scenes, audioUrl ? timing : null), [scenes, timing, audioUrl]);
  const total = totalOf(times);
  const font = typeof window !== "undefined" ? getComputedStyle(document.body).fontFamily || "sans-serif" : "sans-serif";
  const input = useCallback((): Input => ({
    scenes, timing: times, images: imgs.current, settings,
    brand: { name: brief.business, host: brief.site?.url ? new URL(brief.site.url).host.replace(/^www\./, "") : "", cta: brief.cta || "Learn more", logo: logo.current }, font, watermark: videoPlan.watermark, avatarImg,
  }), [scenes, times, settings, brief, font, videoPlan.watermark, avatarImg]);

  // Your own presenter photo.
  useEffect(() => {
    if (!settings.avatarUrl) { setAvatarImg(null); return; }
    let dead = false;
    loadImage(settings.avatarUrl).then((img) => { if (!dead) setAvatarImg(img); });
    return () => { dead = true; };
  }, [settings.avatarUrl]);
  const uploadAvatar = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr("Use a JPG, PNG or WebP photo.");
    if (f.size > 15 * 1024 * 1024) return setErr("That photo is over 15 MB — use a smaller one.");
    setErr(""); setBusy("upload");
    try {
      const blob = await shrinkPhoto(f);
      const r = await adUploadUrlAction("presenter.jpg", "image/jpeg");
      if (!r.ok) throw new Error(r.error);
      const put = await fetch(r.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
      if (!put.ok) throw new Error(`Upload failed (${put.status}) — try again.`);
      setSettings((s) => ({ ...s, avatar: "custom", avatarUrl: r.publicUrl, avatarPos: s.avatarPos === "none" ? "corner" : s.avatarPos }));
      setNote("Your photo is now the presenter. Tip: a clear, front-facing head-and-shoulders photo works best.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(""); }
  };

  // Load images (from our storage → drawable on canvas).
  useEffect(() => {
    let dead = false;
    Promise.all([Promise.all((brief.images ?? []).map(loadImage)), brief.logo ? loadImage(brief.logo) : Promise.resolve(null)]).then(([list, lg]) => { if (dead) return; imgs.current = list; logo.current = lg; setReady(true); });
    return () => { dead = true; };
  }, [brief.images, brief.logo]);

  // Still frame whenever something changes (and not playing).
  useEffect(() => {
    if (playing || !canvas.current || !scenes.length) return;
    const c = canvas.current.getContext("2d")!;
    drawFrame(c, W, H, input(), times, Math.min(t, total - 0.01), 0);
  }, [playing, scenes, settings, t, W, H, times, total, input, ready]);

  // Autosave edits.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = setTimeout(() => startSave(async () => {
      const r = await saveVideoAction(ad.id, { scenes, settings });
      if (r.ok && r.voiceCleared) { setAudioUrl(null); setTiming(null); voiceBuf.current = null; setNote("You changed the words or voice — record the voice-over again."); }
    }), 800);
    return () => clearTimeout(id);
  }, [scenes, settings, ad.id]);

  const getVoice = async () => {
    if (!audioUrl) return null;
    if (voiceBuf.current?.url === audioUrl) return voiceBuf.current.buf;
    const ab = await (await fetch(audioUrl)).arrayBuffer();
    const ctx = new AudioContext(); const buf = await ctx.decodeAudioData(ab); ctx.close().catch(() => {});
    voiceBuf.current = { url: audioUrl, buf };
    return buf;
  };

  const stop = () => { player.current?.stop(); player.current = null; setPlaying(false); };
  const preview = async () => {
    if (playing) return stop();
    setErr("");
    try {
      const voice = await getVoice();
      const from = t >= total - 0.2 ? 0 : t;
      const p = await play(canvas.current!, input(), times, voice, { from, onTime: setT });
      player.current = p; setPlaying(true);
      p.done.then(() => { setPlaying(false); player.current = null; });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't play the preview."); }
  };

  const exportVideo = async () => {
    stop(); setErr(""); setNote("");
    if (!pickMime()) return setErr("This browser can't record video. Use Chrome, Edge or Safari on a computer.");
    setBusy("export");
    try {
      const gate = await startExportAction(ad.id);
      if (!gate.ok) throw new Error(gate.error);
      const voice = await getVoice();
      const p = await play(canvas.current!, input(), times, voice, { record: true, from: 0, onTime: setT });
      player.current = p; setPlaying(true);
      const blob = await p.done;
      setPlaying(false); player.current = null;
      if (!blob || blob.size < 1000) throw new Error("The recording came out empty — keep this tab open while it records, then try again.");
      setBusy("upload");
      const mp4 = blob.type.includes("mp4");
      const r = await adUploadUrlAction(`${(ad.name || "ad").slice(0, 30)}.${mp4 ? "mp4" : "webm"}`, mp4 ? "video/mp4" : "video/webm");
      if (!r.ok) throw new Error(r.error);
      const put = await fetch(r.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": mp4 ? "video/mp4" : "video/webm" } });
      if (!put.ok) throw new Error("Uploading the video failed — check your connection and try again.");
      setBusy("optimize");
      const s = await saveRenderAction(ad.id, r.publicUrl);
      if (!s.ok) throw new Error(s.error);
      setVideoUrl(s.url);
      const len = s.seconds ? ` (${Math.round(s.seconds)}s)` : "";
      setNote(s.converted ? `Video ready${len} — full-length HD MP4, ready for Facebook, Instagram, YouTube and TikTok.` : mp4 ? "Video ready (MP4)." : "Video ready (WebM). It will be converted to MP4 automatically when you post it.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Export failed."); } finally { setBusy(""); setPlaying(false); }
  };

  const upd = (i: number, patch: Partial<Scene>) => setScenes((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setS = <K extends keyof VideoSettings>(k: K, v: VideoSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const mm = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
  const locked = busy === "export" || busy === "upload" || busy === "optimize";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="grid content-start gap-5">
        <section className="card grid gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <p className="text-[13px] font-medium">Format</p>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Format">
                {FORMATS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={settings.format === k} disabled={locked} onClick={() => setS("format", k)} className={`rounded-xl border px-3 py-2 text-left text-[13px] ${settings.format === k ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}><b className="block">{k}</b><span className={settings.format === k ? "text-white/60" : "text-stone-500"}>{l}</span></button>)}
              </div>
            </div>
            <label className="block"><span className="text-[13px] font-medium">Length</span>
              <select value={settings.length} disabled={locked} onChange={(e) => setS("length", Number(e.target.value) as VideoSettings["length"])} className={`${inputCls} mt-1.5 h-10`}>{[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}</select></label>
            <label className="block sm:col-span-2"><span className="text-[13px] font-medium">Story style</span>
              <select value={settings.style} disabled={locked} onChange={(e) => setS("style", e.target.value)} className={`${inputCls} mt-1.5 h-10`}>{styles.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="block sm:col-span-3"><span className="text-[13px] font-medium">Direction <span className="font-normal text-stone-400">optional</span></span>
              <input value={direction} onChange={(e) => setDirection(e.target.value)} maxLength={400} className={`${inputCls} mt-1.5 h-10`} placeholder="e.g. mention free delivery, keep it fun, end on our weekend offer" /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={Boolean(busy) || scriptJob.running || voiceJob.running} onClick={async () => { stop(); setErr(""); setNote(""); const r = await scriptJob.start(() => writeScriptAction(ad.id, settings, direction)); if (!r.ok) setErr(r.error); }} className="btn-primary h-10 px-5 text-[14px]">
              {scriptJob.running ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing the story in the background…</> : <><Sparkles className="h-4 w-4" /> {scenes.length ? "Rewrite the story" : "Write the story"}</>}
            </button>
            <span className="text-[12px] text-stone-500">Uses your brief{brief.images?.length ? ` and ${brief.images.length} photos` : ""}.</span>
          </div>
        </section>

        {scenes.length > 0 && (
          <section className="grid gap-3" aria-label="Scenes">
            {scenes.map((s, i) => (
              <div key={s.id} className="card grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-[12px] text-stone-500"><span className="grid h-6 w-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-lime">{i + 1}</span> {KIND[s.kind] ?? s.kind} · {times[i]?.toFixed(1)}s</div>
                  <textarea value={s.voice} disabled={locked} onChange={(e) => upd(i, { voice: e.target.value })} rows={2} maxLength={400} className={`${textareaCls} text-[14px]`} aria-label={`Scene ${i + 1} voice-over`} />
                  <input value={s.text} disabled={locked} onChange={(e) => upd(i, { text: e.target.value })} maxLength={60} className={`${inputCls} h-9 text-[14px] font-semibold`} aria-label={`Scene ${i + 1} on-screen text`} />
                </div>
                <div className="flex flex-wrap content-start gap-1.5 sm:w-[168px]">
                  <button type="button" disabled={locked} onClick={() => upd(i, { image: null })} className={`grid h-12 w-12 place-items-center rounded-lg border-2 text-[10px] ${s.image == null ? "border-ink" : "border-line"}`} style={{ background: (PALETTES[settings.palette] ?? PALETTES.ink).bg, color: (PALETTES[settings.palette] ?? PALETTES.ink).fg }} aria-label={`Scene ${i + 1}: branded background`}>Aa</button>
                  {(brief.images ?? []).map((u, k) => <button key={u} type="button" disabled={locked} onClick={() => upd(i, { image: k })} aria-label={`Scene ${i + 1}: photo ${k + 1}`} className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${s.image === k ? "border-ink" : "border-transparent"}`}><img src={u} alt="" className="h-full w-full object-cover" /></button>)}
                </div>
              </div>
            ))}
            <p className="text-[12px] text-stone-500">Add or change photos on the <b>Brief & images</b> tab.</p>
          </section>
        )}
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-4">
        <div className="card overflow-hidden p-3">
          <div className="mx-auto overflow-hidden rounded-xl bg-ink" style={{ aspectRatio: `${W} / ${H}`, maxHeight: 560, maxWidth: "100%" }}>
            {scenes.length ? <canvas ref={canvas} width={W} height={H} className="h-full w-full" aria-label="Video preview" /> : <div className="grid h-full place-items-center p-6 text-center text-[13px] text-white/60">Write the story to see your video here.</div>}
          </div>
          {scenes.length > 0 && (
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={preview} disabled={locked} aria-label={playing ? "Pause preview" : "Play preview"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <input type="range" min={0} max={total} step={0.05} value={Math.min(t, total)} disabled={playing} onChange={(e) => setT(Number(e.target.value))} className="w-full accent-ink" aria-label="Seek" />
                <span className="shrink-0 font-mono text-[11px] text-stone-500">{mm(t)} / {mm(total)}</span>
              </div>
              <p className="text-[12px] text-stone-500">{audioUrl ? `AI voice-over on · ${Math.round(total)}s video.` : "No voice-over yet — the preview uses reading speed."}</p>
            </div>
          )}
        </div>

        {scenes.length > 0 && (
          <div className="card grid gap-4 p-4">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-medium"><Mic className="h-4 w-4" /> Voice</p>
              <div className="mt-1.5 flex gap-2">
                <select value={settings.voice} disabled={locked} onChange={(e) => setS("voice", e.target.value)} className={`${inputCls} h-10 text-[13px]`} aria-label="Voice">{voices.map((v) => <option key={v.id} value={v.id}>{v.id} — {v.feel}</option>)}</select>
                <button type="button" disabled={Boolean(busy)} onClick={async () => { const hit = samples.current.get(settings.voice); const playUrl = (u: string) => { sample.current?.pause(); sample.current = new Audio(u); sample.current.play().catch(() => {}); }; if (hit) return playUrl(hit); setBusy("sample"); setErr(""); const r = await voiceSampleAction(settings.voice); setBusy(""); if (r.ok) { samples.current.set(settings.voice, r.url); playUrl(r.url); } else setErr(r.error); }} className="btn-ghost h-10 shrink-0 px-3 text-[13px]" aria-label="Hear this voice">{busy === "sample" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}</button>
              </div>
              <button type="button" disabled={Boolean(busy) || scriptJob.running || voiceJob.running} onClick={async () => { stop(); setErr(""); setNote(""); const r = await voiceJob.start(async () => { await saveVideoAction(ad.id, { scenes, settings }); return voiceoverAction(ad.id); }); if (!r.ok) setErr(r.error); }} className="btn-primary mt-2 h-10 w-full text-[14px]">
                {voiceJob.running ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording the voice-over…</> : audioUrl ? "Re-record voice-over" : "Make AI voice-over"}
              </button>
            </div>
            <div>
              <p className="text-[13px] font-medium">Presenter</p>
              <div className="mt-1.5 grid grid-cols-4 gap-1" role="radiogroup" aria-label="Presenter">
                {settings.avatarUrl && <PhotoThumb img={avatarImg} on={settings.avatarPos !== "none" && settings.avatar === "custom"} onPick={() => setSettings((s) => ({ ...s, avatar: "custom", avatarPos: s.avatarPos === "none" ? "corner" : s.avatarPos }))} />}
                {AVATARS.map((a) => <AvatarThumb key={a.id} id={a.id} on={settings.avatarPos !== "none" && settings.avatar === a.id} onPick={() => setSettings((s) => ({ ...s, avatar: a.id, avatarPos: s.avatarPos === "none" ? "corner" : s.avatarPos }))} />)}
                <AvatarThumb id="none" on={settings.avatarPos === "none"} onPick={() => setS("avatarPos", "none")} />
                <label className={`grid cursor-pointer justify-items-center gap-1 rounded-xl border-2 border-dashed border-line p-1.5 text-[11px] hover:border-ink ${busy === "upload" ? "opacity-60" : ""}`}>
                  <span className="grid h-14 w-14 place-items-center rounded-lg bg-mist text-stone-500">{busy === "upload" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}</span>
                  <span>{settings.avatarUrl ? "New photo" : "Your photo"}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy === "upload"} onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ""; }} aria-label="Upload your own presenter photo" data-testid="avatar-upload" />
                </label>
              </div>
              {settings.avatarPos !== "none" && (
                <div className="mt-2 flex gap-1.5 text-[12px]">{(["corner", "presenter"] as const).map((p) => <button key={p} type="button" onClick={() => setS("avatarPos", p)} className={`rounded-full border px-3 py-1 ${settings.avatarPos === p ? "border-ink bg-ink text-white" : "border-line"}`}>{p === "corner" ? "Small, in a corner" : "Large presenter"}</button>)}</div>
              )}
              <p className="mt-1.5 text-[11px] text-stone-400">{settings.avatar === "custom" ? "Your photo moves and glows with the voice-over. Only use photos of yourself or people who agreed." : "Illustrated presenters lip-sync to the voice-over — or upload your own photo."}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-[13px] font-medium">Music</span>
                <select value={settings.music} onChange={(e) => setS("music", e.target.value as VideoSettings["music"])} className={`${inputCls} mt-1.5 h-10 text-[13px]`}><option value="upbeat">Upbeat</option><option value="corporate">Corporate</option><option value="calm">Calm</option><option value="none">No music</option></select></label>
              <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={settings.captions} onChange={(e) => setS("captions", e.target.checked)} /> Captions</label>
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colours">
              {Object.entries(PALETTES).map(([k, p]) => <button key={k} type="button" role="radio" aria-checked={settings.palette === k} aria-label={k} onClick={() => setS("palette", k)} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${settings.palette === k ? "border-ink" : "border-transparent"}`} style={{ background: p.bg }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.accent }} /></button>)}
            </div>
            <button type="button" disabled={Boolean(busy) && !locked} onClick={locked ? stop : exportVideo} className="btn-lime h-11 w-full text-[14px]">
              {busy === "export" ? <><Square className="h-4 w-4" /> Recording… {Math.round((t / total) * 100)}% (keep this tab open)</> : busy === "upload" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving the video…</> : busy === "optimize" ? <><Loader2 className="h-4 w-4 animate-spin" /> Optimizing for Facebook &amp; Instagram…</> : "Export video"}
            </button>
            <p className="-mt-2 text-[11px] text-stone-400">Rendered in your browser in real time — a 30-second ad takes about 30 seconds.</p>
            <p className="-mt-2 text-[11px] text-stone-500" data-testid="video-allowance">{videoPlan.left} of {videoPlan.limit} video{videoPlan.limit === 1 ? "" : "s"} left this month{videoPlan.watermark ? <> · includes a small “Made with Growvia” tag — <a href="/app/billing#upgrade" className="font-medium underline">remove it with Pro</a></> : ""}</p>
          </div>
        )}
        {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">{err}{/Upgrade to Pro/.test(err) && <> <a href="/app/billing#upgrade" className="font-medium underline">See Pro</a></>}</p>}
        {note && <p role="status" className="rounded-xl border border-lime-500/40 bg-lime/15 px-3.5 py-3 text-[13px] text-lime-900">{note}</p>}
        {videoUrl && (
          <div className="card grid gap-2 p-3" data-testid="video-ready">
            <video src={videoUrl} controls playsInline className="w-full rounded-xl bg-ink" style={{ maxHeight: 420 }} />
            <div className="flex flex-wrap gap-2">
              <a href={videoUrl} download className="btn-ghost h-9 px-3 text-[13px]"><Download className="h-4 w-4" /> Download</a>
              <button type="button" disabled={busy === "post"} onClick={async () => { setBusy("post"); const caption = [scenes[0]?.voice, brief.cta && brief.site?.url ? `${brief.cta}: ${brief.site.url}` : ""].filter(Boolean).join("\n\n"); const r = await postAdAction(ad.id, caption); setBusy(""); if (r.ok) router.push(`/app/publish?edit=${r.postId}`); else setErr(r.error); }} className="btn-primary h-9 px-3 text-[13px]"><Send className="h-4 w-4 text-lime" /> Post to Facebook / Instagram</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
