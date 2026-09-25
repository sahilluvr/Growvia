"use client";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Pencil, X, Plus } from "lucide-react";
import { composeAction, setLeadTagsAction } from "@/app/email-actions";
import { startWhatsAppAction } from "@/app/channel-actions";
import { TemplateFields } from "@/app/app/inbox/client";
import type { WaTemplate } from "@/lib/meta/graph";
import { setLeadStageAction } from "@/app/actions";
import { Notice, Submit, inputCls } from "@/components/ui/Form";
import { EmailEditor } from "@/components/app/EmailEditor";
import { LeadDialog } from "../LeadsBoard";
import { STAGE_META } from "@/lib/format";
import type { Lead, Stage } from "@/lib/data/types";

export function LeadHeaderActions({ lead }: { lead: Lead }) {
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState<Stage>(lead.stage);
  const [, start] = useTransition();
  useEffect(() => setStage(lead.stage), [lead.stage]);
  return (
    <div className="flex flex-wrap gap-2">
      <select value={stage} aria-label="Stage" onChange={(e) => { const s = e.target.value as Stage; setStage(s); start(() => setLeadStageAction(lead.id, s, lead.name)); }} className="h-9 rounded-full border border-line bg-white px-3 text-[13px]">
        {(Object.keys(STAGE_META) as Stage[]).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
      </select>
      <button onClick={() => setEditing(true)} className="btn-ghost h-9 px-3 text-[13px]"><Pencil className="h-3.5 w-3.5" /> Edit</button>
      {editing && <LeadDialog lead={lead} onClose={() => setEditing(false)} />}
    </div>
  );
}

export function TagEditor({ id, tags }: { id: string; tags: string[] }) {
  const [list, setList] = useState(tags);
  const [draft, setDraft] = useState("");
  const [, start] = useTransition();
  const save = (next: string[]) => { setList(next); start(() => setLeadTagsAction(id, next)); };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {list.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[12px] text-stone-700">{t}
          <button onClick={() => save(list.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="text-stone-400 hover:text-ink"><X className="h-3 w-3" /></button></span>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); const t = draft.trim(); if (t && !list.includes(t)) save([...list, t]); setDraft(""); }} className="inline-flex items-center">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add tag" maxLength={40} className="h-7 w-24 rounded-full border border-dashed border-line bg-white px-2.5 text-[12px] outline-none focus:border-ink" aria-label="Add tag" />
        <button className="ml-1 grid h-7 w-7 place-items-center rounded-full text-stone-500 hover:bg-mist" aria-label="Add"><Plus className="h-3.5 w-3.5" /></button>
      </form>
    </div>
  );
}

export function Composer({ leadId, templates, disabled, reason, businessName }: { leadId: string; templates: { id: string; name: string; subject: string; body: string }[]; disabled: boolean; reason: string; businessName: string }) {
  const [state, action] = useFormState(composeAction, undefined);
  const [tpl, setTpl] = useState<{ subject: string; body: string; key: number }>({ subject: "", body: "Hi {{first_name}},\n\n\n\n{{sender_name}}", key: 0 });
  const [schedule, setSchedule] = useState(false);
  const [at, setAt] = useState("");
  useEffect(() => { if (state?.ok) setTpl((t) => ({ subject: "", body: "Hi {{first_name}},\n\n\n\n{{sender_name}}", key: t.key + 1 })); }, [state]);
  if (disabled) return <p className="rounded-xl bg-mist px-4 py-3 text-[14px] text-stone-600">{reason}</p>;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="lead_id" value={leadId} />
      {templates.length > 0 && (
        <select aria-label="Start from template" value="" className={`${inputCls} h-10 max-w-xs text-[13px]`} onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setTpl((p) => ({ subject: t.subject, body: t.body, key: p.key + 1 })); }}>
          <option value="">Start from a template…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <EmailEditor key={tpl.key} subject={tpl.subject} body={tpl.body} businessName={businessName} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn-primary h-10 px-5 text-[14px]" pendingText={schedule ? "Scheduling…" : "Sending…"}>{schedule ? "Schedule email" : "Send now"}</Submit>
        <label className="flex items-center gap-2 text-[13px] text-stone-600"><input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} /> Schedule for later</label>
        {schedule && (
          <>
            {/* Browser-local time → ISO, so the server (in UTC) schedules the right moment. */}
            <input type="datetime-local" required className={`${inputCls} h-10 w-auto text-[13px]`} aria-label="Send at" onChange={(e) => setAt(e.target.value ? new Date(e.target.value).toISOString() : "")} />
            <input type="hidden" name="schedule_at" value={at} />
          </>
        )}
      </div>
      <Notice state={state} />
    </form>
  );
}

export function StartWhatsApp({ leadId, hasPhone, optedIn, accounts }: { leadId: string; hasPhone: boolean; optedIn: boolean; accounts: { id: string; name: string; phone: string | null; templates: WaTemplate[] }[] }) {
  const [state, action] = useFormState(startWhatsAppAction, undefined);
  const [acc, setAcc] = useState(accounts[0].id);
  const [tpl, setTpl] = useState("");
  const current = accounts.find((a) => a.id === acc)!;
  if (!hasPhone) return <p className="rounded-xl bg-mist px-4 py-3 text-[14px] text-stone-600">Add a phone number to this lead to message them on WhatsApp.</p>;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="lead_id" value={leadId} />
      {accounts.length > 1 && (
        <select name="account_id" value={acc} onChange={(e) => { setAcc(e.target.value); setTpl(""); }} className={`${inputCls} h-10 text-[13px]`} aria-label="From number">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ""}</option>)}
        </select>
      )}
      {accounts.length === 1 && <input type="hidden" name="account_id" value={acc} />}
      {current.templates.length ? <TemplateFields templates={current.templates} value={tpl} onChange={setTpl} /> : <p className="text-[13px] text-stone-500">No approved templates on this number yet.</p>}
      <label className="flex items-start gap-2 text-[13px] text-stone-600"><input type="checkbox" name="opt_in" defaultChecked={optedIn} className="mt-0.5" /> They agreed to get WhatsApp messages from us</label>
      <div className="flex items-center gap-3">
        <Submit className="btn h-10 bg-emerald-600 px-5 text-[14px] text-white hover:bg-emerald-700" pendingText="Sending…">Send on WhatsApp</Submit>
        <span className="text-[12px] text-stone-400">Only message people who agreed to hear from you.</span>
      </div>
      <Notice state={state} />
    </form>
  );
}
