"use client";
import { safe } from "@/lib/client/safe-action";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { AlertTriangle, BellRing, Check, Clock, Pencil, Send, Undo2, X, Loader2, Zap } from "lucide-react";
import type { ContentItem } from "@/lib/data/types";
import { saveContentAction, setContentStatusAction } from "@/app/actions";
import { scheduleContentAction } from "@/app/channel-actions";
import { CONTENT_META, fmtDate } from "@/lib/format";
import { AUTO_POST, OTHER_TOOL, type ConnectedAcc, type LinkedPost } from "@/lib/social/autopost";
import { CopyButton } from "./bits";
import { Submit, inputCls, textareaCls } from "@/components/ui/Form";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Acc = ConnectedAcc & { status?: string };
type Msg = { ok?: boolean; text: string; href?: string };
// The card moves to another section after scheduling (and remounts), so its message is kept here for a moment.
const flash = new Map<string, { m: Msg; at: number }>();

export function ContentCard({ item, showCampaign, accounts = [], post }: { item: ContentItem; showCampaign?: string; accounts?: Acc[]; post?: LinkedPost }) {
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 86400000); d.setHours(18, 0, 0, 0); return toLocalInput(d); });
  const [pending, start] = useTransition();
  const [msg, setMsgState] = useState<Msg | null>(() => { const f = flash.get(item.id); return f && Date.now() - f.at < 15000 ? f.m : null; });
  const setMsg = (m: Msg | null) => { if (m) flash.set(item.id, { m, at: Date.now() }); else flash.delete(item.id); setMsgState(m); };
  const [state, save] = useFormState(safe(saveContentAction), undefined);
  useEffect(() => { if (state?.ok) setEditing(false); }, [state]);
  // Optimistic status: the card updates the moment you click; the server confirms in the background.
  const [optimistic, setOptimistic] = useState<ContentItem["status"] | null>(null);
  useEffect(() => setOptimistic(null), [item.status, item.scheduled_at]);
  const status = optimistic ?? item.status;

  const rule = AUTO_POST[item.channel];
  const mine = rule ? accounts.filter((a) => a.provider === rule.provider) : [];
  const live = mine.filter((a) => !a.status || a.status === "connected");
  const canAuto = Boolean(rule && live.length);
  const liveNames = live.map((a) => (a.username ? `@${a.username}` : a.name)).join(", ");
  const autoQueued = status === "scheduled" && post?.status === "scheduled";
  const planned = status === "approved" && Boolean(item.scheduled_at);
  const orphan = status === "scheduled" && !post && item.status === "scheduled"; // scheduled before v027 without a real post
  const failed = post && (post.status === "failed" || post.status === "partial") && status !== "published";
  const meta = planned ? { label: "Planned · reminder", cls: "bg-amber-50 text-amber-800" } : orphan ? { label: "Not auto-posting", cls: "bg-red-50 text-red-700" } : autoQueued ? { label: "Auto-post scheduled", cls: "bg-lime/25 text-lime-800" } : CONTENT_META[status];
  const other = OTHER_TOOL[item.channel];

  const setStatus = (s: ContentItem["status"]) => {
    setOptimistic(s);
    setScheduling(false);
    setMsg(null);
    start(async () => { await setContentStatusAction(item.id, s, item.title); });
  };
  const schedule = (remind = false) => {
    setMsg(null);
    start(async () => {
      const r = await scheduleContentAction(item.id, new Date(when).toISOString(), { remind });
      if (r?.error) return setMsg({ text: r.error, href: r.publishUrl });
      setScheduling(false);
      setMsg({ ok: true, text: r?.message ?? "Saved." });
    });
  };

  return (
    <article className="card flex flex-col p-5" data-status={status} data-mode={autoQueued ? "auto" : planned ? "planned" : orphan ? "orphan" : undefined}>
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

      {/* What will actually happen — never "scheduled" unless Growvia will really post it. */}
      {status === item.status && item.scheduled_at && (
        <div className="mt-3 grid gap-1 text-[12px]">
          {status === "published" && <p className="flex items-center gap-1.5 text-stone-500"><Check className="h-3.5 w-3.5" /> Posted {fmtDate(item.scheduled_at)}</p>}
          {autoQueued && <p className="flex items-center gap-1.5 text-lime-800"><Zap className="h-3.5 w-3.5" /> Posts automatically to {post!.names.join(", ")} · {fmtDate(item.scheduled_at)}</p>}
          {planned && (
            <p className="flex flex-wrap items-center gap-1.5 text-amber-800"><BellRing className="h-3.5 w-3.5" /> Reminder {fmtDate(item.scheduled_at)} — Growvia won&apos;t post this for you.
              {rule && !canAuto && <Link href={rule.connectHref} className="font-medium underline underline-offset-2">{rule.connectLabel} to auto-post</Link>}
              {canAuto && !rule?.needs && <button onClick={() => { setWhen(toLocalInput(new Date(item.scheduled_at!))); setScheduling(true); }} className="font-medium underline underline-offset-2">Switch to auto-post</button>}
            </p>
          )}
          {orphan && (
            <p className="flex flex-wrap items-center gap-1.5 text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> Set for {fmtDate(item.scheduled_at)}, but nothing is queued to post it.
              <button onClick={() => setScheduling(true)} className="font-medium underline underline-offset-2">Schedule again</button></p>
          )}
        </div>
      )}
      {failed && <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[12px] text-red-700"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> <span>Didn&apos;t post: {post!.error ?? "unknown error"} <Link href="/app/publish" className="font-medium underline">Fix &amp; retry</Link></span></p>}

      {scheduling && (
        <div className="mt-4 grid gap-2.5 rounded-xl border border-line bg-paper p-3" data-testid="schedule-panel">
          <div className="flex flex-wrap items-center gap-2">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${inputCls} h-9 w-auto flex-1 text-[14px]`} aria-label="Schedule time" />
            {canAuto && !rule!.needs && <button onClick={() => schedule()} disabled={pending} className="btn-primary h-9 px-3.5 text-[13px]">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-lime" />} Schedule post</button>}
            {canAuto && rule!.needs && <Link href={`/app/publish?content=${item.id}`} className="btn-primary h-9 px-3.5 text-[13px]"><Send className="h-3.5 w-3.5 text-lime" /> Add {rule!.needs === "video" ? "video" : "photo"} &amp; schedule</Link>}
            <button onClick={() => schedule(true)} disabled={pending} className={`${canAuto ? "btn-ghost" : "btn-primary"} h-9 px-3.5 text-[13px]`}>{pending && !canAuto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />} {canAuto ? "Just remind me" : "Plan & remind me"}</button>
            <button onClick={() => setScheduling(false)} className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 hover:bg-mist" aria-label="Cancel"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-[12px] leading-relaxed text-stone-600">
            {canAuto
              ? rule!.needs ? `${item.channel} needs a ${rule!.needs === "video" ? "video" : "photo or video"} — add it on the Publish page, then it posts automatically to ${liveNames}.` : `Growvia will post it automatically to ${liveNames}.`
              : rule
                ? <>{mine.length ? `${mine[0].name} needs reconnecting` : `${item.channel} isn't connected`}, so Growvia can&apos;t post this — you&apos;ll get a reminder email instead. <Link href={rule.connectHref} className="font-medium underline">{rule.connectLabel}</Link></>
                : <>Growvia can&apos;t post to {item.channel} automatically — you&apos;ll get a reminder email to post it yourself.{other && <> Or <Link href={other.href} className="font-medium underline">{other.label.toLowerCase()}</Link>.</>}</>}
          </p>
        </div>
      )}
      {msg && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${msg.ok ? "bg-lime/20 text-lime-900" : "bg-red-50 text-red-700"}`}>
          {msg.text} {msg.href && <Link href={msg.href} className="font-medium underline">Open Publish</Link>}
        </p>
      )}

      {!editing && (
        <footer className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          {status === "draft" && (
            <button onClick={() => setStatus("approved")} className="btn-primary h-9 px-3.5 text-[13px]">
              <Check className="h-3.5 w-3.5 text-lime" strokeWidth={3} /> Approve
            </button>
          )}
          {(status === "approved" || orphan) && !scheduling && (
            <button onClick={() => { if (item.scheduled_at && new Date(item.scheduled_at).getTime() > Date.now()) setWhen(toLocalInput(new Date(item.scheduled_at))); setScheduling(true); }} className="btn-primary h-9 px-3.5 text-[13px]"><Clock className="h-3.5 w-3.5 text-lime" /> {planned ? "Reschedule" : canAuto ? "Schedule" : "Plan"}</button>
          )}
          {(status === "approved" || status === "scheduled") && (
            <button onClick={() => { if (!autoQueued || confirm("Mark as posted? The scheduled auto-post will be cancelled.")) setStatus("published"); }} className="btn-ghost h-9 px-3.5 text-[13px]"><Send className="h-3.5 w-3.5" /> Mark as posted</button>
          )}
          {autoQueued && <button onClick={() => { if (confirm("Cancel the scheduled post?")) setStatus("approved"); }} className="btn-ghost h-9 px-3.5 text-[13px]"><X className="h-3.5 w-3.5" /> Cancel post</button>}
          {status !== "published" && <button onClick={() => setEditing(true)} className="btn-ghost h-9 px-3.5 text-[13px]"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
          <CopyButton text={item.body} className="h-9" />
          {rule && status !== "published" && (
            <a href={`/app/publish?content=${item.id}`} className="btn-ghost h-9 px-3.5 text-[13px]"><Send className="h-3.5 w-3.5" /> Publish</a>
          )}
          {status !== "draft" && (
            <button onClick={() => setStatus("draft")} className="ml-auto inline-flex h-9 items-center gap-1 px-2 text-[12px] text-stone-400 hover:text-ink" title="Move back to draft"><Undo2 className="h-3.5 w-3.5" /> Draft</button>
          )}
        </footer>
      )}
    </article>
  );
}
