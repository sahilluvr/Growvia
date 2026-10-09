"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2, AlertTriangle, Mail, Plus, Send, Trash2, Loader2, Pencil, ExternalLink, Sparkles } from "lucide-react";
import { deleteMailboxAction, detectMailboxAction, saveMailboxAction, sendTestEmailAction } from "@/app/email-actions";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import { Dialog } from "@/components/ui/Dialog";
import { MAILBOX_PRESETS, type Mailbox, type MailboxPresetKey } from "@/lib/email/types";
import { timeAgo } from "@/lib/format";

type Safe = Omit<Mailbox, "password_enc"> & { business_id?: string | null };
type Project = { id: string; name: string };

export function MailboxManager({ mailboxes, projects = [], current }: { mailboxes: Safe[]; projects?: Project[]; current?: string }) {
  const projectName = (id?: string | null) => projects.find((p) => p.id === id)?.name;
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
            {projects.length > 1 && (m.business_id && projectName(m.business_id)
              ? <div className="text-[13px] text-stone-600">Sends for <b className="font-medium">{projectName(m.business_id)}</b> only</div>
              : <div className="text-[13px] text-amber-700">Not assigned to a project — edit it and choose the project it sends for.</div>)}
            <div className="text-[13px] text-stone-500">
              {m.smtp_host} · up to {m.daily_limit}/day · {m.imap_host ? `replies checked ${m.last_sync_at ? timeAgo(m.last_sync_at) : "soon"}` : "replies not connected"}
            </div>
            {(m as Safe & { health?: { score?: number; paused?: boolean } }).health?.score != null && (
              <a href="/app/health?tab=email" className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-stone-600 underline-offset-2 hover:underline">
                <span className={`h-2 w-2 rounded-full ${(m as Safe & { health?: { score?: number; paused?: boolean } }).health!.paused ? "bg-red-500" : ((m as Safe & { health?: { score?: number } }).health!.score ?? 0) >= 80 ? "bg-lime-500" : ((m as Safe & { health?: { score?: number } }).health!.score ?? 0) >= 60 ? "bg-amber-400" : "bg-red-500"}`} />
                Sending health {(m as Safe & { health?: { score?: number; paused?: boolean } }).health!.paused ? "· campaigns paused" : `${(m as Safe & { health?: { score?: number } }).health!.score}/100`}
              </a>
            )}
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
      {editing && <MailboxDialog m={editing === "new" ? null : editing} onClose={() => setEditing(null)} projects={projects} current={current} />}
    </div>
  );
}

function MailboxDialog({ m, onClose, projects = [], current }: { m: Safe | null; onClose: () => void; projects?: Project[]; current?: string }) {
  const [state, action] = useFormState(safe(saveMailboxAction), undefined);
  const keys = Object.keys(MAILBOX_PRESETS) as MailboxPresetKey[];
  const guess = keys.find((k) => m && MAILBOX_PRESETS[k].smtp_host === m.smtp_host) ?? (m ? "custom" : null);
  const [preset, setPreset] = useState<MailboxPresetKey | null>(guess);
  const p = MAILBOX_PRESETS[preset ?? "custom"];
  const [host, setHost] = useState({ smtp_host: m?.smtp_host ?? p.smtp_host, smtp_port: m?.smtp_port ?? p.smtp_port, imap_host: m?.imap_host ?? p.imap_host, imap_port: m?.imap_port ?? p.imap_port, smtp_secure: m?.smtp_secure ?? p.smtp_secure });
  const [note, setNote] = useState<{ text: string; warn?: boolean } | null>(null);
  const [detecting, startDetect] = useTransition();
  const [lastEmail, setLastEmail] = useState(m?.from_email ?? "");
  useEffect(() => { if (state?.ok) setTimeout(onClose, 900); }, [state, onClose]);
  const choose = (k: MailboxPresetKey) => {
    setPreset(k);
    const q = MAILBOX_PRESETS[k];
    setHost({ smtp_host: q.smtp_host, smtp_port: q.smtp_port, imap_host: q.imap_host, imap_port: q.imap_port, smtp_secure: q.smtp_secure });
  };
  // Type your email → we work out who hosts it and fill the server settings.
  const detect = (email: string) => {
    if (m || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email === lastEmail) return;
    setLastEmail(email);
    startDetect(async () => {
      const d = await detectMailboxAction(email);
      if (d.preset) choose(d.preset);
      setNote(d.note ? { text: d.note, warn: d.personalOutlook } : d.preset ? { text: `Looks like ${MAILBOX_PRESETS[d.preset].label} — settings filled in.` } : null);
    });
  };
  return (
    <Dialog title={m ? "Edit mailbox" : "Connect your email"} onClose={onClose} wide>
      <form action={action} className="grid gap-4">
        {m && <input type="hidden" name="id" value={m.id} />}
        {projects.length > 1 ? (
          <Field label="Sends emails for (only this project uses this address)">
            <select name="business_id" defaultValue={m?.business_id ?? current ?? ""} className={inputCls}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field>
        ) : current ? <input type="hidden" name="business_id" value={m?.business_id ?? current} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your email address"><input name="from_email" type="email" defaultValue={m?.from_email} required className={inputCls} placeholder="you@yourbusiness.com" onBlur={(e) => detect(e.target.value.trim())} data-testid="mb-email" /></Field>
          <Field label="Your name (shown to people you email)"><input name="from_name" defaultValue={m?.from_name} required className={inputCls} placeholder="Sahil from Bella's" /></Field>
        </div>
        {detecting && <p className="flex items-center gap-2 text-[13px] text-stone-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding your email provider…</p>}
        {note && <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] ${note.warn ? "bg-amber-50 text-amber-900" : "bg-lime/15 text-lime-900"}`} data-testid="mb-detected">{note.warn ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}{note.text}</p>}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink">Email provider</p>
          <div className="flex flex-wrap gap-1.5">
            {keys.map((k) => (
              <button type="button" key={k} onClick={() => choose(k)} aria-pressed={preset === k}
                className={`rounded-full border px-3 py-1.5 text-[13px] ${preset === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{MAILBOX_PRESETS[k].label}</button>
            ))}
          </div>
        </div>
        {preset && (
          <div className="grid gap-2 rounded-xl bg-mist px-4 py-3 text-[13px] text-stone-700" data-testid="mb-steps">
            <p className="font-medium text-ink">{p.help}</p>
            <ol className="grid list-decimal gap-1 pl-5">{p.steps.map((t) => <li key={t}>{t}</li>)}</ol>
            {p.link && <a href={p.link.url} target="_blank" rel="noopener" className="btn-ghost h-9 justify-self-start px-3 text-[13px]">{p.link.label} <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
        )}
        <Field label={p.password} hint={m ? "leave blank to keep" : undefined}><input name="password" type="password" autoComplete="new-password" className={inputCls} placeholder={preset === "gmail" ? "abcd efgh ijkl mnop" : ""} /></Field>
        <details className="rounded-xl border border-line p-4" open={preset === "custom"}>
          <summary className="cursor-pointer text-[14px] font-medium">{preset === "custom" ? "Server settings" : "Server settings (filled in for you)"}</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-4"><Field label="Username" hint="usually your email"><input name="username" defaultValue={m?.username} className={inputCls} placeholder="Same as email" /></Field></div>
            <div className="sm:col-span-3"><Field label="SMTP server (sending)"><input name="smtp_host" value={host.smtp_host} onChange={(e) => setHost({ ...host, smtp_host: e.target.value })} className={inputCls} placeholder="e.g. mail.yourbusiness.com" /></Field></div>
            <Field label="Port"><input name="smtp_port" type="number" value={host.smtp_port} onChange={(e) => setHost({ ...host, smtp_port: Number(e.target.value), smtp_secure: Number(e.target.value) === 465 })} className={inputCls} /></Field>
            <div className="sm:col-span-3"><Field label="IMAP server (reading replies)"><input name="imap_host" value={host.imap_host} onChange={(e) => setHost({ ...host, imap_host: e.target.value })} className={inputCls} placeholder="Leave blank to skip reply tracking" /></Field></div>
            <Field label="Port"><input name="imap_port" type="number" value={host.imap_port} onChange={(e) => setHost({ ...host, imap_port: Number(e.target.value) })} className={inputCls} /></Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-stone-600"><input type="checkbox" name="smtp_secure" checked={host.smtp_secure} onChange={(e) => setHost({ ...host, smtp_secure: e.target.checked })} /> Use SSL/TLS (port 465)</label>
        </details>
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer text-[14px] font-medium">Signature and daily limit (optional)</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Email signature" hint="optional"><textarea name="signature" rows={3} defaultValue={m?.signature ?? ""} className={textareaCls} placeholder={"Sahil Aggarwal\nBella's Trattoria · +91 98xxx"} /></Field>
            <Field label="Max emails / day"><input name="daily_limit" type="number" min={1} max={2000} defaultValue={m?.daily_limit ?? p.dailyLimit} className={inputCls} /></Field>
          </div>
        </details>
        {!m && <label className="flex items-start gap-2 text-[13px] text-stone-600"><input type="checkbox" name="warmup" defaultChecked className="mt-0.5" /> <span><b className="text-ink">Warm up gradually</b> (recommended): campaigns start at 10 emails a day and grow by 3 a day, so inboxes learn to trust you.</span></label>}
        <Notice state={state} />
        <div className="flex gap-2"><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Checking connection…">{m ? "Save & reconnect" : "Connect"}</Submit><button type="button" onClick={onClose} className="btn-ghost h-10 px-4 text-[14px]">Cancel</button></div>
        <p className="text-[12px] text-stone-400">We test the connection before saving. Your password is encrypted and only used to send your emails and read replies from your leads.</p>
      </form>
    </Dialog>
  );
}
