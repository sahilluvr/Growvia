"use client";
import { safe } from "@/lib/client/safe-action";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Loader2, MessageSquareReply, Sparkles, Trash2, Check } from "lucide-react";
import { Run } from "../seo/client2";
import { addLocalKeywordsAction, applyDescriptionAction, checkLocalRanksAction, disconnectLocalAction, pickLocationAction, reloadLocationsAction, removeLocalKeywordAction, replyReviewAction, suggestReplyAction, syncLocalAction, writeDescriptionAction } from "@/app/local-actions";
import { Notice, Submit, textareaCls } from "@/components/ui/Form";
import { CopyButton } from "@/components/app/bits";

export const SyncLocal = () => <Run run={syncLocalAction} label="Refresh from Google" busy="Loading your profile…" />;
export const ReloadLocations = () => <Run run={reloadLocationsAction} label="Load my locations" busy="Asking Google…" ghost={false} />;
export const CheckRanks = () => <Run run={checkLocalRanksAction} label="Check now" busy="Searching Google Maps…" icon="play" ghost={false} />;
export const DisconnectLocal = () => <Run run={async () => (confirm("Disconnect Google Business Profile? History is kept.") ? disconnectLocalAction() : undefined)} label="Disconnect" busy="Disconnecting…" />;

export function LocationPicker({ locations, current }: { locations: { name: string; title: string; address: string }[]; current?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="grid gap-2">
      {locations.map((l) => (
        <button key={l.name} disabled={pending} onClick={() => start(async () => { const r = await pickLocationAction(l.name); setMsg(r?.error ?? r?.message ?? ""); router.refresh(); })} className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-[14px] ${current === l.name ? "border-ink bg-mist" : "border-line hover:border-ink"}`}>
          <span><b>{l.title}</b><br /><span className="text-[12px] text-stone-500">{l.address || "No address (service-area business)"}</span></span>
          {current === l.name ? <Check className="h-4 w-4" /> : pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-[12px] text-stone-500">Track this</span>}
        </button>
      ))}
      {msg && <p className="text-[13px] text-stone-600">{msg}</p>}
    </div>
  );
}

export function AddLocalKeywords({ suggestions }: { suggestions: string[] }) {
  const [state, action] = useFormState(safe(addLocalKeywordsAction), undefined);
  const [text, setText] = useState("");
  return (
    <form action={action} className="grid gap-2">
      <textarea name="keywords" value={text} onChange={(e) => setText(e.target.value)} rows={3} className={textareaCls} placeholder={"One search per line, e.g.\ndentist near me\nteeth whitening mohali"} aria-label="Searches to track on Google Maps" />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => <button type="button" key={s} onClick={() => setText((t) => (t.split("\n").includes(s) ? t : [t.trim(), s].filter(Boolean).join("\n")))} className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-stone-600 hover:border-ink">+ {s}</button>)}
        </div>
      )}
      <div><Submit className="btn-primary h-9 px-4 text-[13px]" pendingText="Saving…">Track these searches</Submit></div>
      <Notice state={state} />
    </form>
  );
}

export function RemoveLocalKeyword({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await removeLocalKeywordAction(id); router.refresh(); })} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Stop tracking ${label}`}><Trash2 className="h-3.5 w-3.5" /></button>;
}

export function ReviewReply({ id, canReply }: { id: string; canReply: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  if (!canReply) return null;
  const suggest = () => start(async () => { const r = await suggestReplyAction(id); if (r.reply) setText(r.reply); if (r.error) setMsg({ t: r.error, bad: true }); });
  return (
    <div className="mt-2">
      {!open ? (
        <button onClick={() => { setOpen(true); if (!text) suggest(); }} className="btn-ghost h-8 px-3 text-[12px]"><MessageSquareReply className="h-3.5 w-3.5" /> Reply</button>
      ) : (
        <div className="grid gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} className={textareaCls} placeholder={busy ? "Writing a suggestion…" : "Your reply"} aria-label="Reply to review" />
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy || !text.trim()} onClick={() => start(async () => { const r = await replyReviewAction(id, text); setMsg(r?.error ? { t: r.error, bad: true } : { t: r?.message ?? "Posted." }); if (r?.ok) { setOpen(false); router.refresh(); } })} className="btn-primary h-8 px-3 text-[12px]">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Post reply on Google</button>
            <button disabled={busy} onClick={suggest} className="btn-ghost h-8 px-3 text-[12px]"><Sparkles className="h-3.5 w-3.5" /> New suggestion</button>
            <button onClick={() => setOpen(false)} className="text-[12px] text-stone-500">Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className={`mt-1 text-[12px] ${msg.bad ? "text-red-600" : "text-lime-800"}`}>{msg.t}</p>}
    </div>
  );
}

export function DescriptionWriter({ current, canApply }: { current: string; canApply: boolean }) {
  const [text, setText] = useState(current);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  return (
    <div className="grid gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={750} className={textareaCls} aria-label="Business description" placeholder="Your Google description…" />
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-stone-500">
        <button disabled={busy} onClick={() => start(async () => { const r = await writeDescriptionAction(); if (r.text) setText(r.text); if (r.error) setMsg({ t: r.error, bad: true }); })} className="btn-ghost h-8 px-3 text-[12px]">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Write with AI</button>
        {canApply && <button disabled={busy || text.trim().length < 50} onClick={() => start(async () => { const r = await applyDescriptionAction(text); setMsg(r?.error ? { t: r.error, bad: true } : { t: r?.message ?? "Saved." }); })} className="btn-primary h-8 px-3 text-[12px]">Update on Google</button>}
        <CopyButton text={text} className="h-8" />
        <span>{text.length}/750</span>
      </div>
      {msg && <p className={`text-[12px] ${msg.bad ? "text-red-600" : "text-lime-800"}`}>{msg.t}</p>}
    </div>
  );
}
