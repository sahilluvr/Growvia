"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X, Send, Clock, RotateCcw, Trash2 } from "lucide-react";
import { createUploadUrlAction, deletePostAction, retryPostAction, savePostAction } from "@/app/channel-actions";
import { Notice, inputCls, textareaCls } from "@/components/ui/Form";
import { ChannelIcon } from "@/components/icons/Brand";
import { AiCaption, ImageDesigner, type Seed } from "./ai";
import { quietBell, useNotify, type ToastLink } from "@/components/app/Notify";

type Acc = { id: string; provider: string; name: string; username: string | null; picture: string | null };
type Media = { url: string; type: "image" | "video" };

export type Prefill = { contentItemId?: string; postId?: string; caption: string; media?: Media[]; targets?: string[]; ytTitle?: string; ytPrivacy?: string };

export function Composer({ accounts, prefill, photoReady = false, defaultTargets }: { accounts: Acc[]; prefill: Prefill | null; photoReady?: boolean; defaultTargets?: string[] }) {
  const [state, action] = useFormState(safe(savePostAction), undefined);
  const [targets, setTargets] = useState<string[]>(prefill?.targets?.length ? prefill.targets.filter((t) => accounts.some((a) => a.id === t)) : defaultTargets ?? accounts.map((a) => a.id));
  const [caption, setCaption] = useState(prefill?.caption ?? "");
  const [media, setMedia] = useState<Media[]>(prefill?.media ?? []);
  const [seed, setSeed] = useState<Seed | null>(null);
  const [uploading, setUploading] = useState(0);
  const [upErr, setUpErr] = useState("");
  const [intent, setIntent] = useState<"now" | "schedule" | "draft">("now");
  const [at, setAt] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => { if (state?.ok && (intent !== "draft" || prefill?.postId)) { setCaption(""); setMedia([]); setAt(""); setResetKey((k) => k + 1); } }, [state, intent, prefill?.postId]);
  const { toast, celebrate } = useNotify();
  const router = useRouter();
  // Results: a toast for every outcome, a celebration on milestones (first post, 10th …).
  useEffect(() => {
    const d = state?.data as PostOutcome | undefined;
    if (!state?.ok || !d) return;
    quietBell();
    showOutcome(d, { toast, celebrate });
    if (prefill?.postId) router.replace("/app/publish");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasIg = accounts.some((a) => a.provider === "instagram" && targets.includes(a.id));
  const hasYt = accounts.some((a) => a.provider === "youtube" && targets.includes(a.id));
  const hasGbp = accounts.some((a) => a.provider === "gbp" && targets.includes(a.id));

  const upload = async (files: FileList | null) => {
    setUpErr("");
    for (const f of Array.from(files ?? []).slice(0, 10)) {
      if (f.size > 50 * 1024 * 1024) { setUpErr(`${f.name} is over 50 MB.`); continue; }
      setUploading((n) => n + 1);
      try {
        const r = await createUploadUrlAction(f.name, f.type);
        if (!r.uploadUrl) throw new Error(r.error);
        const put = await fetch(r.uploadUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type, "x-upsert": "false" } });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        setMedia((m) => [...m, { url: r.publicUrl!, type: f.type.startsWith("video") ? "video" : "image" }]);
      } catch (e) {
        setUpErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <form ref={form} action={action} id="compose" className="card grid scroll-mt-6 gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="media" value={JSON.stringify(media)} />
      <input type="hidden" name="schedule_at" value={at} />
      {prefill?.contentItemId && <input type="hidden" name="content_item_id" value={prefill.contentItemId} />}
      {prefill?.postId && !state?.ok && <input type="hidden" name="id" value={prefill.postId} />}
      {prefill?.postId && <p className="rounded-xl bg-mist px-3 py-2 text-[13px] text-stone-600 lg:col-span-2">Editing a saved post. <a href="/app/publish" className="underline">Start a new one instead</a></p>}
      <div className="grid content-start gap-4">
        <div>
          <p className="text-[13px] font-medium">Post to</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {accounts.map((a) => {
              const on = targets.includes(a.id);
              return (
                <label key={a.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>
                  <input type="checkbox" name="targets" value={a.id} checked={on} onChange={() => setTargets((t) => (on ? t.filter((x) => x !== a.id) : [...t, a.id]))} className="sr-only" />
                  <ChannelIcon channel={a.provider} className="h-3.5 w-3.5" /> {a.username ? `@${a.username}` : a.name}
                </label>
              );
            })}
            {!accounts.length && <span className="text-[13px] text-stone-500">No accounts connected yet.</span>}
          </div>
        </div>
        <AiCaption channels={[...new Set(accounts.filter((a) => targets.includes(a.id)).map((a) => a.provider))]} onUse={(c, sd) => { setCaption(c); if (sd.headline) setSeed(sd); }} />
        <div>
          <textarea name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} maxLength={2200} className={textareaCls} placeholder="Write your caption… #hashtags work too" aria-label="Caption" />
          <div className="mt-1 text-right text-[12px] text-stone-400">{caption.length}/2200</div>
        </div>
        <div>
          <p className="text-[13px] font-medium">Photos / video {(hasIg || hasYt) && <span className="font-normal text-stone-500">— {hasYt ? "a video is required for YouTube" : "required for Instagram"}</span>}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {media.map((m, i) => (
              <div key={m.url} className="relative h-24 w-24 overflow-hidden rounded-xl bg-mist">
                {m.type === "video" ? <video src={m.url} className="h-full w-full object-cover" muted /> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
                <button type="button" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <ImageDesigner seed={seed} photoReady={photoReady} onImage={(url) => setMedia((m) => [{ url, type: "image" as const }, ...m].slice(0, 10))} />
            <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-stone-500 hover:border-ink">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime" multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Upload photos or video" />
            </label>
          </div>
          <div className="mt-2 flex gap-2">
            <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="…or paste an image URL" className={`${inputCls} h-9 text-[13px]`} aria-label="Image URL" />
            <button type="button" onClick={() => { if (/^https?:\/\//.test(urlDraft)) { setMedia((m) => [...m, { url: urlDraft, type: /\.(mp4|mov)(\?|$)/i.test(urlDraft) ? "video" : "image" }]); setUrlDraft(""); } }} className="btn-ghost h-9 shrink-0 px-3 text-[13px]">Add</button>
          </div>
          {upErr && <p className="mt-1 text-[13px] text-red-600">{upErr}</p>}
        </div>
        {hasYt && (
          <div className="grid gap-2 rounded-xl border border-red-100 bg-red-50/40 p-3" data-testid="yt-options">
            <p className="text-[13px] font-medium">YouTube</p>
            <input name="yt_title" defaultValue={prefill?.ytTitle ?? ""} maxLength={100} className={`${inputCls} h-9 text-[13px]`} placeholder="Video title (defaults to the caption's first line)" aria-label="YouTube title" />
            <select name="yt_privacy" defaultValue={prefill?.ytPrivacy ?? "public"} className={`${inputCls} h-9 text-[13px]`} aria-label="YouTube visibility">
              <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
            </select>
            <p className="text-[12px] text-stone-500">Uses the video you add below (MP4 up to 50 MB). Vertical videos under 3 minutes show as Shorts. The caption becomes the description.</p>
          </div>
        )}
        {hasGbp && <p className="rounded-xl bg-blue-50 px-3 py-2 text-[12px] text-blue-900">Google Business shows this as a “What&apos;s new” update on your profile — up to 1,500 characters and one photo (no video). The link becomes a “Learn more” button.</p>}
        <input name="link" className={inputCls} placeholder="Link (optional — link preview on Facebook, “Learn more” on Google)" aria-label="Link" />
        <div className="flex flex-wrap items-center gap-2">
          <IntentButton value="now" onPick={setIntent} disabled={uploading > 0} className="btn-primary h-11 px-5 text-[14px]"><Send className="h-4 w-4 text-lime" /> Publish now</IntentButton>
          <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1 pl-3">
            <Clock className="h-4 w-4 text-stone-500" />
            <input key={resetKey} type="datetime-local" onChange={(e) => setAt(e.target.value ? new Date(e.target.value).toISOString() : "")} className="h-9 bg-transparent text-[13px] outline-none" aria-label="Schedule time" />
            <IntentButton value="schedule" onPick={setIntent} disabled={!at || uploading > 0} className="btn-primary h-9 px-4 text-[13px] disabled:opacity-40">Schedule</IntentButton>
          </div>
          <IntentButton value="draft" onPick={setIntent} className="btn-ghost h-11 px-4 text-[14px]">Save draft</IntentButton>
        </div>
        <PublishingStatus video={media.some((m) => m.type === "video")} networks={[...new Set(accounts.filter((a) => targets.includes(a.id)).map((a) => a.provider))]} />
        {state?.error && <Notice state={state} />}
      </div>
      <aside className="grid content-start gap-3">
        <p className="text-[13px] font-medium">Preview</p>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center gap-2 p-3"><span className="h-7 w-7 rounded-full bg-mist" /><span className="text-[13px] font-medium">{accounts.find((a) => targets.includes(a.id))?.name ?? "Your page"}</span></div>
          {media[0] ? (media[0].type === "video" ? <video src={media[0].url} className="aspect-square w-full bg-mist object-cover" muted controls /> : <img src={media[0].url} alt="" className="aspect-square w-full bg-mist object-cover" />) : <div className="grid aspect-square w-full place-items-center bg-mist text-[12px] text-stone-400">{hasIg ? "Instagram needs an image or video" : "Text post"}</div>}
          <p className="whitespace-pre-line p-3 text-[13px] leading-relaxed">{caption || <span className="text-stone-400">Your caption appears here.</span>}</p>
        </div>
      </aside>
    </form>
  );
}

export function PostActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const { toast, celebrate } = useNotify();
  const retry = () => start(async () => {
    const r = await retryPostAction(id);
    quietBell();
    if (r.status === "skipped") return;
    if (!r.live.length) toast({ tone: "error", title: "Still not published", body: r.failed.map((f) => `${f.name}: ${f.error}`).join(" · ") });
    else showOutcome({ kind: "published", postId: id, live: r.live, failed: r.failed, milestone: r.milestone, count: r.count }, { toast, celebrate });
  });
  return (
    <div className="mt-2 flex gap-2">
      {(status === "failed" || status === "partial" || status === "draft") && (
        <button disabled={pending} onClick={retry} className="btn-ghost h-8 px-3 text-[12px]">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === "draft" ? <Send className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} {status === "draft" ? "Publish now" : "Retry"}</button>
      )}
      {status !== "publishing" && status !== "published" && (
        <button disabled={pending} onClick={() => { if (confirm("Delete this post?")) start(() => deletePostAction(id)); }} className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[12px] text-stone-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
      )}
    </div>
  );
}

/** Submit button that sends which action was chosen (the browser includes the clicked button's name/value). */
function IntentButton({ value, onPick, className, disabled, children }: { value: "now" | "schedule" | "draft"; onPick: (v: "now" | "schedule" | "draft") => void; className: string; disabled?: boolean; children: React.ReactNode }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("intent") === value;
  return (
    <button type="submit" name="intent" value={value} onClick={() => onPick(value)} disabled={disabled || pending} className={`${className} disabled:opacity-60`}>
      {mine ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {children}
    </button>
  );
}

/* ───────── Outcomes: toasts, celebrations, and a live "what's happening" line while publishing ───────── */

type Live = { name: string; provider: string; permalink: string | null };
type PostOutcome =
  | { kind: "published"; postId: string; live: Live[]; failed: { name: string; provider: string; error: string }[]; milestone?: { key: string; title: string; body: string; count: number } | null; count?: number; video?: boolean }
  | { kind: "scheduled"; postId: string; at: string; targets: { name: string; provider: string }[]; firstSchedule?: boolean }
  | { kind: "draft"; postId: string };

const NETWORK: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", gbp: "Google" };
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function showOutcome(d: PostOutcome, ui: { toast: ReturnType<typeof useNotify>["toast"]; celebrate: ReturnType<typeof useNotify>["celebrate"] }) {
  if (d.kind === "published") {
    const links: ToastLink[] = d.live.filter((l) => l.permalink).map((l) => ({ label: `View on ${NETWORK[l.provider] ?? l.name}${d.live.filter((x) => x.provider === l.provider).length > 1 ? ` (${l.name})` : ""}`, href: l.permalink!, external: true }));
    if (d.milestone) ui.celebrate({ ...d.milestone, links });
    else ui.toast({ tone: "success", title: d.video ? "Your video is live 🎬" : "Your post is live 🎉", body: `Published to ${list(d.live.map((l) => l.name))}.${d.video ? " The full-length video is processing on the network — it may take a minute to show in HD." : ""}`, links, provider: d.live[0]?.provider });
    if (d.failed.length) ui.toast({ tone: "error", title: `Didn't go out on ${list(d.failed.map((f) => f.name))}`, body: d.failed.map((f) => `${f.name}: ${f.error}`).join(" · "), links: [{ label: "Fix and retry", href: "/app/publish#attention" }] });
  } else if (d.kind === "scheduled") {
    const when = new Date(d.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    ui.toast({
      tone: "scheduled", title: "Scheduled ✓", provider: d.targets[0]?.provider,
      body: `Goes out ${when} on ${list(d.targets.map((t) => t.name))}. ${d.firstSchedule ? "Growvia publishes it even when you're offline — " : ""}we'll notify you the moment it's live.`,
      links: [{ label: "See your schedule", href: "/app/publish#scheduled" }], ms: 10_000,
    });
  } else ui.toast({ tone: "info", title: "Draft saved", body: "Find it under Drafts whenever you're ready.", ms: 5000 });
}

/** While "Publish now" runs: plain-English steps, so a 30-second video upload never feels stuck. */
function PublishingStatus({ video, networks }: { video: boolean; networks: string[] }) {
  const { pending, data } = useFormStatus();
  const now = pending && data?.get("intent") === "now";
  const [step, setStep] = useState(0);
  useEffect(() => { if (!now) { setStep(0); return; } const id = setInterval(() => setStep((x) => x + 1), 4500); return () => clearInterval(id); }, [now]);
  if (!now) return null;
  const names = networks.map((n) => NETWORK[n] ?? n);
  const steps = [
    "Preparing your post…",
    ...(video ? ["Optimizing your video (full length, HD MP4)…"] : []),
    ...names.map((n) => `Uploading to ${n}…`),
    ...(video && networks.includes("instagram") ? ["Instagram is processing the video — this can take up to a minute…"] : []),
    "Almost there — confirming it's live…",
  ];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] text-stone-600" role="status" data-testid="publishing-status">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lime-600" />
      <span className="flex-1">{steps[Math.min(step, steps.length - 1)]}</span>
      <span className="font-mono text-[11px] text-stone-400">keep this tab open</span>
    </div>
  );
}
