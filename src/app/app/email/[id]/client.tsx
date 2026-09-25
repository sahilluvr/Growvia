"use client";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { ArrowDown, ArrowUp, Clock, Pause, Play, Plus, Rocket, Trash2, UserPlus, Loader2, StopCircle } from "lucide-react";
import {
  deleteSequenceAction, deleteStepAction, enrollAction, launchSequenceAction, moveStepAction, saveStepAction,
  setSequenceStatusAction, stopEnrollmentAction, updateSequenceAction,
} from "@/app/email-actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";
import { EmailEditor } from "@/components/app/EmailEditor";
import { TIMEZONES } from "@/lib/booking";
import { fmtDate } from "@/lib/format";
import type { Sequence, Step } from "@/lib/email/types";

const STATUS: Record<string, string> = { draft: "bg-mist text-stone-600", active: "bg-ink text-lime", paused: "bg-amber-50 text-amber-700", completed: "bg-lime/25 text-lime-800" };

export function SequenceHeader({ seq, stats, hasMailbox }: { seq: Sequence; stats: [string, string][]; hasMailbox: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string } | null>(null);
  return (
    <div className="mb-6 mt-3">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tightest sm:text-[34px]">{seq.name}</h1>
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium capitalize ${STATUS[seq.status]}`}>{seq.status}</span>
          </div>
          <p className="mt-1 text-[14px] text-stone-500">{seq.stop_on_reply ? "Stops for anyone who replies" : "Keeps sending after replies"} · sends {seq.send_start}:00–{seq.send_end}:00 {seq.timezone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(seq.status === "draft" || seq.status === "completed") && (
            <button disabled={pending} onClick={() => start(async () => setMsg((await launchSequenceAction(seq.id)) ?? null))} className="btn-primary h-10 px-5 text-[14px]">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4 text-lime" />} {seq.status === "completed" ? "Relaunch" : "Launch campaign"}
            </button>
          )}
          {seq.status === "active" && <button disabled={pending} onClick={() => start(() => setSequenceStatusAction(seq.id, "paused"))} className="btn-ghost h-10 px-4 text-[14px]"><Pause className="h-4 w-4" /> Pause</button>}
          {seq.status === "paused" && <button disabled={pending} onClick={() => start(() => setSequenceStatusAction(seq.id, "active"))} className="btn-primary h-10 px-4 text-[14px]"><Play className="h-4 w-4 text-lime" /> Resume</button>}
          <button onClick={() => { if (confirm(`Delete “${seq.name}”? Sent emails stay in your Inbox.`)) start(() => deleteSequenceAction(seq.id)); }} className="grid h-10 w-10 place-items-center rounded-full border border-line text-stone-400 hover:border-red-300 hover:text-red-600" aria-label="Delete campaign"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      {!hasMailbox && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">Choose a sending mailbox in <b>Settings</b> below (or connect one in Growvia Settings) before launching.</p>}
      {msg && <div className="mt-3"><Notice state={msg} /></div>}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className="card px-4 py-3"><div className="text-[12px] text-stone-500">{k}</div><div className="text-[22px] font-semibold tabular-nums">{v}</div></div>
        ))}
      </div>
    </div>
  );
}

export function StepsEditor({ sequenceId, steps, stats, businessName }: { sequenceId: string; steps: Step[]; stats: Record<string, { sent: number; opened: number; clicked: number }>; businessName: string }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-3">
      {steps.map((s, i) => (
        <div key={s.id}>
          {i > 0 && (
            <div className="flex items-center gap-2 py-2 pl-6 text-[13px] text-stone-500"><Clock className="h-3.5 w-3.5" /> Wait {Number(s.wait_days)} day{Number(s.wait_days) === 1 ? "" : "s"} · only if they haven&apos;t replied</div>
          )}
          <StepCard step={s} index={i} total={steps.length} sequenceId={sequenceId} stat={stats[s.id]} businessName={businessName} />
        </div>
      ))}
      {adding ? (
        <StepCard step={null} index={steps.length} total={steps.length + 1} sequenceId={sequenceId} businessName={businessName} onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-400/60 p-5 text-[14px] text-stone-600 hover:border-ink hover:text-ink"><Plus className="h-4 w-4" /> Add follow-up email</button>
      )}
    </div>
  );
}

function StepCard({ step, index, total, sequenceId, stat, businessName, onDone }: { step: Step | null; index: number; total: number; sequenceId: string; stat?: { sent: number; opened: number; clicked: number }; businessName: string; onDone?: () => void }) {
  const [open, setOpen] = useState(!step);
  const [state, action] = useFormState(saveStepAction, undefined);
  const [pending, start] = useTransition();
  useEffect(() => { if (state?.ok) { setOpen(false); onDone?.(); } }, [state, onDone]);
  return (
    <article className="card p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-lime">{index + 1}</span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium">{step ? step.subject || "Reply in the same thread" : "New follow-up"}</div>
            {stat && <div className="text-[12px] text-stone-500">{stat.sent} sent · {stat.sent ? Math.round((stat.opened / stat.sent) * 100) : 0}% opened · {stat.clicked} clicks</div>}
          </div>
        </div>
        {step && (
          <div className="flex shrink-0 gap-1">
            <button disabled={index === 0 || pending} onClick={() => start(() => moveStepAction(step.id, sequenceId, -1))} className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-mist disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
            <button disabled={index === total - 1 || pending} onClick={() => start(() => moveStepAction(step.id, sequenceId, 1))} className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-mist disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
            <button onClick={() => setOpen((o) => !o)} className="btn-ghost h-8 px-3 text-[13px]">{open ? "Close" : "Edit"}</button>
            <button onClick={() => { if (confirm("Delete this email?")) start(() => deleteStepAction(step.id, sequenceId)); }} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete email"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </header>
      {!open && step && <p className="mt-3 line-clamp-3 whitespace-pre-line pl-11 text-[14px] leading-relaxed text-stone-500">{step.body}</p>}
      {open && (
        <form action={action} className="mt-4 grid gap-3">
          {step && <input type="hidden" name="id" value={step.id} />}
          <input type="hidden" name="sequence_id" value={sequenceId} />
          {index > 0 && (
            <label className="flex items-center gap-2 text-[14px]">Send
              <input name="wait_days" type="number" min={0} max={90} step={0.5} defaultValue={step ? Number(step.wait_days) : 3} className={`${inputCls} h-9 w-20`} />
              days after the previous email, if there&apos;s no reply
            </label>
          )}
          <EmailEditor subject={step?.subject ?? ""} body={step?.body ?? "Hi {{first_name}},\n\n\n\n{{sender_name}}"} businessName={businessName} allowEmptySubject={index > 0}
            subjectPlaceholder={index > 0 ? "Leave blank to reply in the same thread (recommended)" : "Subject line"} />
          <Notice state={state?.error ? state : undefined} />
          <div className="flex gap-2"><Submit className="btn-primary h-9 px-4 text-[13px]" pendingText="Saving…">Save email</Submit>
            <button type="button" onClick={() => { setOpen(false); onDone?.(); }} className="btn-ghost h-9 px-4 text-[13px]">Cancel</button></div>
        </form>
      )}
    </article>
  );
}

export function EnrollPanel({ sequenceId, tags, reachable }: { sequenceId: string; tags: string[]; reachable: number }) {
  const [state, action] = useFormState(enrollAction, undefined);
  const [mode, setMode] = useState<"all" | "tag" | "stage">("all");
  return (
    <form action={action} className="card grid gap-4 p-5">
      <input type="hidden" name="sequence_id" value={sequenceId} />
      <input type="hidden" name="mode" value={mode} />
      <div className="flex items-center gap-2 text-[15px] font-medium"><UserPlus className="h-4 w-4 text-lime-700" /> Add leads to this campaign</div>
      <div className="flex flex-wrap gap-1.5">
        {([["all", `All leads with email (${reachable})`], ["tag", "By tag"], ["stage", "By stage"]] as const).map(([k, l]) => (
          <button type="button" key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-full border px-3 py-1.5 text-[13px] ${mode === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{l}</button>
        ))}
      </div>
      {mode === "tag" && (tags.length ? (
        <select name="tag" className={`${inputCls} max-w-xs`}>{tags.map((t) => <option key={t}>{t}</option>)}</select>
      ) : <p className="text-[13px] text-stone-500">No tags yet — add tags to leads (or tag them when importing a CSV).</p>)}
      {mode === "stage" && (
        <div className="flex flex-wrap gap-3 text-[14px]">{["new", "contacted", "qualified", "won", "lost"].map((s) => <label key={s} className="flex items-center gap-1.5 capitalize"><input type="checkbox" name="stages" value={s} defaultChecked={s === "new"} /> {s}</label>)}</div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Adding…">Add leads</Submit>
        <span className="text-[12px] text-stone-400">Unsubscribed and bounced addresses are skipped automatically. If the campaign is live, the first email goes out right away (within your sending hours).</span>
      </div>
      <Notice state={state} />
    </form>
  );
}

const PSTATUS: Record<string, string> = { active: "bg-sky-50 text-sky-700", replied: "bg-lime/25 text-lime-800", completed: "bg-mist text-stone-600", unsubscribed: "bg-stone-100 text-stone-500", bounced: "bg-red-50 text-red-700", failed: "bg-red-50 text-red-700", stopped: "bg-stone-100 text-stone-500" };

export function PeopleTable({ people }: { people: { id: string; status: string; step_index: number; next_run_at: string; last_error: string | null; leads: { name: string; email: string | null } | null }[] }) {
  const [pending, start] = useTransition();
  if (!people.length) return <p className="rounded-xl border border-dashed border-line p-6 text-center text-[14px] text-stone-500">No leads in this campaign yet.</p>;
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-line">
        {people.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">{p.leads?.name} <span className="font-normal text-stone-500">· {p.leads?.email}</span></div>
              <div className="text-[12px] text-stone-500">
                {p.status === "active" ? `Next: email ${p.step_index + 1} · ${fmtDate(p.next_run_at)}` : `Emails sent: ${p.step_index}`}
                {p.last_error && <span className="text-amber-700"> · {p.last_error}</span>}
              </div>
            </div>
            <span className={`w-fit rounded-full px-2.5 py-0.5 text-[12px] font-medium capitalize ${PSTATUS[p.status] ?? ""}`}>{p.status}</span>
            {p.status === "active" && <button disabled={pending} onClick={() => start(() => stopEnrollmentAction(p.id))} className="inline-flex items-center gap-1 text-[12px] text-stone-500 hover:text-red-600"><StopCircle className="h-3.5 w-3.5" /> Stop</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingsForm({ seq, mailboxes }: { seq: Sequence; mailboxes: { id: string; from_name: string; from_email: string }[] }) {
  const [state, action] = useFormState(updateSequenceAction, undefined);
  return (
    <form action={action} className="card grid max-w-3xl gap-5 p-5 sm:p-6">
      <input type="hidden" name="id" value={seq.id} />
      <Field label="Campaign name"><input name="name" defaultValue={seq.name} className={inputCls} maxLength={100} /></Field>
      <Field label="Send from">
        <select name="mailbox_id" defaultValue={seq.mailbox_id ?? ""} className={inputCls}>
          <option value="">— Choose a mailbox —</option>
          {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.from_name} &lt;{m.from_email}&gt;</option>)}
        </select>
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium">Sending days</legend>
        <div className="mt-2 flex flex-wrap gap-3 text-[14px]">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1.5"><input type="checkbox" name="send_days" value={i} defaultChecked={seq.send_days.includes(i)} /> {d}</label>)}</div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="From hour"><input name="send_start" type="number" min={0} max={23} defaultValue={seq.send_start} className={inputCls} /></Field>
        <Field label="Until hour"><input name="send_end" type="number" min={1} max={24} defaultValue={seq.send_end} className={inputCls} /></Field>
        <Field label="Time zone"><select name="timezone" defaultValue={seq.timezone} className={inputCls}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></Field>
      </div>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="stop_on_reply" defaultChecked={seq.stop_on_reply} /> Stop emailing someone as soon as they reply (recommended)</label>
      <Notice state={state} />
      <div><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">Save settings</Submit></div>
    </form>
  );
}
