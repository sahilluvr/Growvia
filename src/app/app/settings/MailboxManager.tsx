"use client";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2, AlertTriangle, Mail, Plus, Send, Trash2, Loader2, Pencil } from "lucide-react";
import { deleteMailboxAction, saveMailboxAction, sendTestEmailAction } from "@/app/email-actions";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import { Dialog } from "@/components/ui/Dialog";
import { MAILBOX_PRESETS, type Mailbox } from "@/lib/email/types";
import { timeAgo } from "@/lib/format";

type Safe = Omit<Mailbox, "password_enc">;

export function MailboxManager({ mailboxes }: { mailboxes: Safe[] }) {
  const [editing, setEditing] = useState<Safe | "new" | null>(null);
  const [test, setTest] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3">
      {mailboxes.map((m) => (
        <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${m.status === "connected" ? "bg-lime/25 text-lime-800" : "bg-amber-50 text-amber-700"}`}>
            {m.status === "connected" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">{m.from_name} &lt;{m.from_email}&gt;</div>
            <div className="text-[13px] text-stone-500">
              {m.smtp_host} · up to {m.daily_limit}/day · {m.imap_host ? `replies checked ${m.last_sync_at ? timeAgo(m.last_sync_at) : "soon"}` : "replies not connected"}
            </div>
            {m.last_error && <div className="mt-1 text-[13px] text-amber-700">{m.last_error}</div>}
            {test[m.id] && <div className="mt-1 text-[13px] text-stone-600">{test[m.id]}</div>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button disabled={pending} onClick={() => start(async () => { const r = await sendTestEmailAction(m.id); setTest((t) => ({ ...t, [m.id]: r?.error ?? r?.message ?? "" })); })} className="btn-ghost h-9 px-3 text-[13px]">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Test
            </button>
            <button onClick={() => setEditing(m)} className="btn-ghost h-9 px-3 text-[13px]"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button onClick={() => { if (confirm(`Disconnect ${m.from_email}?`)) start(() => deleteMailboxAction(m.id)); }} className="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Disconnect"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      ))}
      {!mailboxes.length && (
        <div className="rounded-xl border border-dashed border-stone-400/60 p-5">
          <p className="flex items-center gap-2 text-[15px] font-medium"><Mail className="h-4 w-4 text-lime-700" /> Connect the email address you send from</p>
          <p className="mt-1 text-[14px] text-stone-500">Emails go out from your own address, and replies land in your normal inbox <b>and</b> in Growvia&apos;s Inbox. Works with Gmail, Outlook, Zoho and any other provider.</p>
        </div>
      )}
      <div><button onClick={() => setEditing("new")} className="btn-primary h-10 px-4 text-[14px]"><Plus className="h-4 w-4" /> {mailboxes.length ? "Add another mailbox" : "Connect mailbox"}</button></div>
      {editing && <MailboxDialog m={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MailboxDialog({ m, onClose }: { m: Safe | null; onClose: () => void }) {
  const [state, action] = useFormState(saveMailboxAction, undefined);
  const guess = (Object.keys(MAILBOX_PRESETS) as (keyof typeof MAILBOX_PRESETS)[]).find((k) => m && MAILBOX_PRESETS[k].smtp_host === m.smtp_host) ?? (m ? "custom" : "gmail");
  const [preset, setPreset] = useState<keyof typeof MAILBOX_PRESETS>(guess);
  const p = MAILBOX_PRESETS[preset];
  const [host, setHost] = useState({ smtp_host: m?.smtp_host ?? p.smtp_host, smtp_port: m?.smtp_port ?? p.smtp_port, imap_host: m?.imap_host ?? p.imap_host, imap_port: m?.imap_port ?? p.imap_port, smtp_secure: m?.smtp_secure ?? p.smtp_secure });
  useEffect(() => { if (state?.ok) setTimeout(onClose, 900); }, [state, onClose]);
  const choose = (k: keyof typeof MAILBOX_PRESETS) => {
    setPreset(k);
    const q = MAILBOX_PRESETS[k];
    setHost({ smtp_host: q.smtp_host, smtp_port: q.smtp_port, imap_host: q.imap_host, imap_port: q.imap_port, smtp_secure: q.smtp_secure });
  };
  return (
    <Dialog title={m ? "Edit mailbox" : "Connect a mailbox"} onClose={onClose} wide>
      <form action={action} className="grid gap-4">
        {m && <input type="hidden" name="id" value={m.id} />}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MAILBOX_PRESETS) as (keyof typeof MAILBOX_PRESETS)[]).map((k) => (
            <button type="button" key={k} onClick={() => choose(k)} aria-pressed={preset === k}
              className={`rounded-full border px-3 py-1.5 text-[13px] ${preset === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{MAILBOX_PRESETS[k].label}</button>
          ))}
        </div>
        <p className="rounded-xl bg-mist px-4 py-3 text-[13px] text-stone-600">{p.help}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name (shown to recipients)"><input name="from_name" defaultValue={m?.from_name} required className={inputCls} placeholder="Sahil from Bella's" /></Field>
          <Field label="Email address"><input name="from_email" type="email" defaultValue={m?.from_email} required className={inputCls} placeholder="you@yourbusiness.com" /></Field>
          <Field label="Username" hint="usually your email"><input name="username" defaultValue={m?.username} className={inputCls} placeholder="Same as email" /></Field>
          <Field label={preset === "gmail" ? "App password" : "Password"} hint={m ? "leave blank to keep" : undefined}><input name="password" type="password" autoComplete="new-password" className={inputCls} placeholder={preset === "gmail" ? "16-character app password" : ""} /></Field>
        </div>
        <details className="rounded-xl border border-line p-4" open={preset === "custom"}>
          <summary className="cursor-pointer text-[14px] font-medium">Server settings</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-3"><Field label="SMTP server (sending)"><input name="smtp_host" value={host.smtp_host} onChange={(e) => setHost({ ...host, smtp_host: e.target.value })} className={inputCls} /></Field></div>
            <Field label="Port"><input name="smtp_port" type="number" value={host.smtp_port} onChange={(e) => setHost({ ...host, smtp_port: Number(e.target.value), smtp_secure: Number(e.target.value) === 465 })} className={inputCls} /></Field>
            <div className="sm:col-span-3"><Field label="IMAP server (reading replies)"><input name="imap_host" value={host.imap_host} onChange={(e) => setHost({ ...host, imap_host: e.target.value })} className={inputCls} placeholder="Leave blank to skip reply tracking" /></Field></div>
            <Field label="Port"><input name="imap_port" type="number" value={host.imap_port} onChange={(e) => setHost({ ...host, imap_port: Number(e.target.value) })} className={inputCls} /></Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-stone-600"><input type="checkbox" name="smtp_secure" checked={host.smtp_secure} onChange={(e) => setHost({ ...host, smtp_secure: e.target.checked })} /> Use SSL/TLS (port 465)</label>
        </details>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Email signature" hint="optional"><textarea name="signature" rows={3} defaultValue={m?.signature ?? ""} className={textareaCls} placeholder={"Sahil Aggarwal\nBella's Trattoria · +91 98xxx"} /></Field>
          <Field label="Max emails / day"><input name="daily_limit" type="number" min={1} max={2000} defaultValue={m?.daily_limit ?? (preset === "gmail" ? 100 : 200)} className={inputCls} /></Field>
        </div>
        <Notice state={state} />
        <div className="flex gap-2"><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Checking connection…">{m ? "Save & reconnect" : "Connect"}</Submit><button type="button" onClick={onClose} className="btn-ghost h-10 px-4 text-[14px]">Cancel</button></div>
        <p className="text-[12px] text-stone-400">Your password is encrypted before it&apos;s stored and is only used to send your emails and read replies from people in your leads list.</p>
      </form>
    </Dialog>
  );
}
