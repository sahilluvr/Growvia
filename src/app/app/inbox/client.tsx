"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { RefreshCw, Loader2, CheckCircle2, RotateCcw, MailOpen } from "lucide-react";
import { markThreadAction, replyAction, syncNowAction } from "@/app/email-actions";
import { channelReplyAction } from "@/app/channel-actions";
import { Notice, Submit, textareaCls } from "@/components/ui/Form";

export function InboxSync({ hasMailbox }: { hasMailbox: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "done">("idle");
  const [msg, setMsg] = useState("");
  const run = async () => {
    setState("syncing");
    const r = await syncNowAction();
    setMsg(r.error ? `⚠ ${r.error}` : r.replies ? `${r.replies} new repl${r.replies === 1 ? "y" : "ies"}` : "Up to date");
    setState("done");
    if (r.replies || r.sent) router.refresh();
  };
  useEffect(() => { if (hasMailbox) run(); /* check for replies on open */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!hasMailbox) return null;
  return (
    <button onClick={run} disabled={state === "syncing"} className="btn-ghost h-10 px-4 text-[14px]">
      {state === "syncing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {state === "syncing" ? "Checking for replies…" : msg || "Check for replies"}
    </button>
  );
}

export function MarkRead({ id }: { id: string }) {
  useEffect(() => { markThreadAction(id, { unread: false }); }, [id]);
  return null;
}

export function ThreadActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 gap-2">
      <button disabled={pending} onClick={() => start(() => markThreadAction(id, { unread: true }))} className="btn-ghost h-9 px-3 text-[13px]"><MailOpen className="h-3.5 w-3.5" /> Mark unread</button>
      {status === "open" ? (
        <button disabled={pending} onClick={() => start(() => markThreadAction(id, { status: "closed" }))} className="btn-ghost h-9 px-3 text-[13px]"><CheckCircle2 className="h-3.5 w-3.5" /> Close</button>
      ) : (
        <button disabled={pending} onClick={() => start(() => markThreadAction(id, { status: "open" }))} className="btn-ghost h-9 px-3 text-[13px]"><RotateCcw className="h-3.5 w-3.5" /> Reopen</button>
      )}
    </div>
  );
}

export function ReplyBox({ threadId, templates, disabled }: { threadId: string; templates: { id: string; name: string; body: string }[]; disabled: boolean }) {
  const [state, action] = useFormState(replyAction, undefined);
  const ref = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && ref.current) ref.current.value = ""; }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-2">
      <input type="hidden" name="thread_id" value={threadId} />
      <textarea ref={ref} name="body" rows={4} required disabled={disabled} className={textareaCls} placeholder={disabled ? "Connect a mailbox in Settings to reply" : "Write a reply…  (⌘/Ctrl + Enter to send)"}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.current?.requestSubmit(); }} />
      <div className="flex flex-wrap items-center gap-2">
        <Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Sending…">Send reply</Submit>
        {templates.length > 0 && (
          <select aria-label="Insert template" className="h-10 rounded-full border border-line bg-white px-3 text-[13px] text-stone-600" value=""
            onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t && ref.current) ref.current.value = t.body; }}>
            <option value="">Insert template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <span className="text-[12px] text-stone-400">Sent from your mailbox, in the same email thread. {"{{first_name}}"} works here too.</span>
      </div>
      {state?.error && <Notice state={state} />}
    </form>
  );
}

/** Keeps chats live: refreshes the page data every few seconds while the tab is visible. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible" && !document.querySelector("textarea:focus, input:focus")) router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

type WaTpl = { name: string; language: string; body: string; vars: number; category: string };

export function TemplateFields({ templates, value, onChange }: { templates: WaTpl[]; value: string; onChange: (v: string) => void }) {
  const t = templates.find((x) => `${x.name}|${x.language}` === value);
  const [vals, setVals] = useState<string[]>([]);
  const tKey = t ? `${t.name}|${t.language}` : "";
  useEffect(() => setVals(Array.from({ length: t?.vars ?? 0 }, (_, i) => (i === 0 ? "{{first_name}}" : ""))), [tKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = t ? t.body.replace(/\{\{(\d+)\}\}/g, (_, n) => vals[Number(n) - 1] || `{{${n}}}`) : "";
  return (
    <div className="grid gap-2">
      <select name="template" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-[14px]" aria-label="Template">
        <option value="">Choose an approved template…</option>
        {templates.map((x) => <option key={`${x.name}|${x.language}`} value={`${x.name}|${x.language}`}>{x.name} · {x.language} · {x.category.toLowerCase()}</option>)}
      </select>
      {t && (
        <>
          {Array.from({ length: t.vars }, (_, i) => (
            <input key={i} name="param" value={vals[i] ?? ""} onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))} className="h-10 rounded-xl border border-line bg-white px-3 text-[14px]" placeholder={`Value for {{${i + 1}}} — you can use {{first_name}}`} aria-label={`Template value ${i + 1}`} />
          ))}
          <p className="whitespace-pre-line rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">{preview}</p>
        </>
      )}
    </div>
  );
}

export function ChannelReplyBox({ threadId, channel, lastInbound, templates, leadName, disconnected }: { threadId: string; channel: string; lastInbound: string | null; templates: WaTpl[]; leadName: string; disconnected: boolean }) {
  const [state, action] = useFormState(channelReplyAction, undefined);
  const open = Boolean(lastInbound && Date.now() - new Date(lastInbound).getTime() < 86_400_000);
  const [mode, setMode] = useState<"text" | "template">(open || channel !== "whatsapp" ? "text" : "template");
  const [tpl, setTpl] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { if (ref.current) ref.current.value = ""; setTpl(""); } }, [state]);
  if (disconnected) return <p className="rounded-xl bg-mist px-4 py-3 text-[14px] text-stone-600">This channel was disconnected. Reconnect it in Channels to reply.</p>;
  const hoursLeft = lastInbound ? Math.max(0, 24 - Math.floor((Date.now() - new Date(lastInbound).getTime()) / 3_600_000)) : 0;
  return (
    <form ref={form} action={action} className="grid gap-2">
      <input type="hidden" name="thread_id" value={threadId} />
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={`rounded-full px-2.5 py-1 font-medium ${open ? "bg-lime/25 text-lime-800" : "bg-amber-50 text-amber-800"}`}>
          {open ? `Reply window open · ${hoursLeft}h left` : channel === "whatsapp" ? "24h window closed — send a template" : "24h reply window closed"}
        </span>
        {channel === "whatsapp" && (
          <div className="ml-auto inline-flex rounded-full border border-line p-0.5">
            <button type="button" onClick={() => setMode("text")} disabled={!open} className={`rounded-full px-3 py-1 ${mode === "text" ? "bg-ink text-white" : "text-stone-600"} disabled:opacity-40`}>Message</button>
            <button type="button" onClick={() => setMode("template")} className={`rounded-full px-3 py-1 ${mode === "template" ? "bg-ink text-white" : "text-stone-600"}`}>Template</button>
          </div>
        )}
      </div>
      {mode === "text" ? (
        <textarea ref={ref} name="body" rows={3} required disabled={!open} className={textareaCls} placeholder={open ? `Message ${leadName}…  (⌘/Ctrl + Enter to send)` : "You can reply once they message you again."}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.current?.requestSubmit(); }} />
      ) : templates.length ? (
        <TemplateFields templates={templates} value={tpl} onChange={setTpl} />
      ) : (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">No approved templates yet. Create one in WhatsApp Manager (e.g. “Hi {"{{1}}"}, thanks for contacting us…”), then refresh templates in Channels.</p>
      )}
      <div className="flex items-center gap-2">
        <Submit className={`btn h-10 px-5 text-[14px] text-white ${channel === "whatsapp" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-ink hover:bg-ink-700"}`} pendingText="Sending…">Send</Submit>
        {state?.error && <span className="text-[13px] text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
