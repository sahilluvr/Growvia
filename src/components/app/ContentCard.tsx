"use client";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Check, Clock, Pencil, Send, Undo2, X, Loader2 } from "lucide-react";
import type { ContentItem } from "@/lib/data/types";
import { saveContentAction, setContentStatusAction } from "@/app/actions";
import { CONTENT_META, fmtDate } from "@/lib/format";
import { CopyButton } from "./bits";
import { Submit, inputCls, textareaCls } from "@/components/ui/Form";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ContentCard({ item, showCampaign }: { item: ContentItem; showCampaign?: string }) {
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 86400000); d.setHours(18, 0, 0, 0); return toLocalInput(d); });
  const [pending, start] = useTransition();
  const [state, save] = useFormState(saveContentAction, undefined);
  useEffect(() => { if (state?.ok) setEditing(false); }, [state]);
  // Optimistic status: the card updates the moment you click; the server confirms in the background.
  const [optimistic, setOptimistic] = useState<ContentItem["status"] | null>(null);
  useEffect(() => setOptimistic(null), [item.status]);
  const status = optimistic ?? item.status;
  const meta = CONTENT_META[status];
  const run = (s: ContentItem["status"], w?: string) => {
    setOptimistic(s);
    setScheduling(false);
    start(async () => { await setContentStatusAction(item.id, s, item.title, w ? new Date(w).toISOString() : undefined); });
  };

  return (
    <article className="card flex flex-col p-5" data-status={status}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-ink px-2 py-0.5 text-[12px] font-medium text-white">{item.channel}</span>
          <span className="truncate text-[12px] text-stone-500">{item.kind}{showCampaign ? ` · ${showCampaign}` : ""}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${meta.cls}`}>{meta.label}</span>
      </header>

      {editing ? (
        <form action={save} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={item.id} />
          <input name="title" defaultValue={item.title} className={inputCls} aria-label="Title" maxLength={200} />
          <textarea name="body" defaultValue={item.body} rows={8} className={textareaCls} aria-label="Content" maxLength={5000} />
          {state?.error && <p className="text-[13px] text-red-600">{state.error}</p>}
          <div className="flex gap-2">
            <Submit className="btn-primary h-9 px-4 text-[13px]" pendingText="Saving…">Save changes</Submit>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost h-9 px-4 text-[13px]">Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{item.title}</h3>
          <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-stone-600">{item.body}</p>
        </>
      )}

      {item.scheduled_at && status === item.status && status !== "draft" && status !== "approved" && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500"><Clock className="h-3.5 w-3.5" /> {status === "published" ? "Posted" : "Scheduled for"} {fmtDate(item.scheduled_at)}</p>
      )}

      {scheduling && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-3">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${inputCls} h-9 w-auto flex-1 text-[14px]`} aria-label="Schedule time" />
          <button onClick={() => run("scheduled", when)} disabled={pending} className="btn-primary h-9 px-3.5 text-[13px]">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />} Schedule</button>
          <button onClick={() => setScheduling(false)} className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 hover:bg-mist" aria-label="Cancel"><X className="h-4 w-4" /></button>
        </div>
      )}

      {!editing && (
        <footer className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          {status === "draft" && (
            <button onClick={() => run("approved")} className="btn-primary h-9 px-3.5 text-[13px]">
              <Check className="h-3.5 w-3.5 text-lime" strokeWidth={3} /> Approve
            </button>
          )}
          {status === "approved" && !scheduling && (
            <button onClick={() => setScheduling(true)} className="btn-primary h-9 px-3.5 text-[13px]"><Clock className="h-3.5 w-3.5 text-lime" /> Schedule</button>
          )}
          {(status === "approved" || status === "scheduled") && (
            <button onClick={() => run("published")} className="btn-ghost h-9 px-3.5 text-[13px]"><Send className="h-3.5 w-3.5" /> Mark as posted</button>
          )}
          {status !== "published" && <button onClick={() => setEditing(true)} className="btn-ghost h-9 px-3.5 text-[13px]"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
          <CopyButton text={item.body} className="h-9" />
          {["Instagram", "Facebook", "Meta Ads"].includes(item.channel) && status !== "published" && (
            <a href={`/app/publish?content=${item.id}`} className="btn-ghost h-9 px-3.5 text-[13px]"><Send className="h-3.5 w-3.5" /> Publish</a>
          )}
          {status !== "draft" && (
            <button onClick={() => run("draft")} className="ml-auto inline-flex h-9 items-center gap-1 px-2 text-[12px] text-stone-400 hover:text-ink" title="Move back to draft"><Undo2 className="h-3.5 w-3.5" /> Draft</button>
          )}
        </footer>
      )}
    </article>
  );
}
