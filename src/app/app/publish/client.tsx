"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ImagePlus, Loader2, X, Send, Clock, RotateCcw, Trash2 } from "lucide-react";
import { createUploadUrlAction, deletePostAction, retryPostAction, savePostAction } from "@/app/channel-actions";
import { Notice, inputCls, textareaCls } from "@/components/ui/Form";
import { ChannelIcon } from "@/components/icons/Brand";

type Acc = { id: string; provider: string; name: string; username: string | null; picture: string | null };
type Media = { url: string; type: "image" | "video" };

export function Composer({ accounts, prefill }: { accounts: Acc[]; prefill: { contentItemId: string; caption: string } | null }) {
  const [state, action] = useFormState(savePostAction, undefined);
  const [targets, setTargets] = useState<string[]>(accounts.map((a) => a.id));
  const [caption, setCaption] = useState(prefill?.caption ?? "");
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(0);
  const [upErr, setUpErr] = useState("");
  const [intent, setIntent] = useState<"now" | "schedule" | "draft">("now");
  const [at, setAt] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && intent !== "draft") { setCaption(""); setMedia([]); } }, [state, intent]);
  const hasIg = accounts.some((a) => a.provider === "instagram" && targets.includes(a.id));

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
    <form ref={form} action={action} className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="media" value={JSON.stringify(media)} />
      <input type="hidden" name="schedule_at" value={at} />
      {prefill && <input type="hidden" name="content_item_id" value={prefill.contentItemId} />}
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
        <div>
          <textarea name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} maxLength={2200} className={textareaCls} placeholder="Write your caption… #hashtags work too" aria-label="Caption" />
          <div className="mt-1 text-right text-[12px] text-stone-400">{caption.length}/2200</div>
        </div>
        <div>
          <p className="text-[13px] font-medium">Photos / video {hasIg && <span className="font-normal text-stone-500">— required for Instagram</span>}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {media.map((m, i) => (
              <div key={m.url} className="relative h-24 w-24 overflow-hidden rounded-xl bg-mist">
                {m.type === "video" ? <video src={m.url} className="h-full w-full object-cover" muted /> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
                <button type="button" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
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
        <input name="link" className={inputCls} placeholder="Link (optional — shows as a link preview on Facebook)" aria-label="Link" />
        <div className="flex flex-wrap items-center gap-2">
          <IntentButton value="now" onPick={setIntent} disabled={uploading > 0} className="btn-primary h-11 px-5 text-[14px]"><Send className="h-4 w-4 text-lime" /> Publish now</IntentButton>
          <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1 pl-3">
            <Clock className="h-4 w-4 text-stone-500" />
            <input type="datetime-local" onChange={(e) => setAt(e.target.value ? new Date(e.target.value).toISOString() : "")} className="h-9 bg-transparent text-[13px] outline-none" aria-label="Schedule time" />
            <IntentButton value="schedule" onPick={setIntent} disabled={!at || uploading > 0} className="btn-primary h-9 px-4 text-[13px] disabled:opacity-40">Schedule</IntentButton>
          </div>
          <IntentButton value="draft" onPick={setIntent} className="btn-ghost h-11 px-4 text-[14px]">Save draft</IntentButton>
        </div>
        <Notice state={state} />
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
  return (
    <div className="mt-2 flex gap-2">
      {(status === "failed" || status === "partial" || status === "draft") && (
        <button disabled={pending} onClick={() => start(() => retryPostAction(id))} className="btn-ghost h-8 px-3 text-[12px]">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === "draft" ? <Send className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} {status === "draft" ? "Publish now" : "Retry"}</button>
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
