"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useFormState } from "react-dom";
import { createBroadcastAction, createWaTemplateAction, deleteWaTemplateAction, syncTemplatesAction } from "@/app/channel-actions";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import { TemplateFields } from "@/app/app/inbox/client";
import type { WaTemplate } from "@/lib/meta/graph";

type Acc = { id: string; name: string; phone: string | null; templates: WaTemplate[]; waiting?: number };

export function BroadcastForm({ accounts, tags, reachable, optedIn }: { accounts: Acc[]; tags: string[]; reachable: number; optedIn: number }) {
  const [state, action] = useFormState(createBroadcastAction, undefined);
  const [acc, setAcc] = useState(accounts[0].id);
  const [tpl, setTpl] = useState("");
  const [mode, setMode] = useState<"all" | "tag" | "stage">("all");
  const [at, setAt] = useState("");
  const current = accounts.find((a) => a.id === acc)!;
  return (
    <form action={action} className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="schedule_at" value={at} />
      <div className="grid content-start gap-4">
        <h2 className="text-[16px] font-semibold tracking-tight">New broadcast</h2>
        <Field label="Broadcast name"><input name="name" className={inputCls} placeholder="e.g. Diwali offer" maxLength={100} /></Field>
        <Field label="Send from">
          <select name="account_id" value={acc} onChange={(e) => { setAcc(e.target.value); setTpl(""); }} className={inputCls}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ""}</option>)}
          </select>
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Message template</p>
          {current.templates.length ? <TemplateFields templates={current.templates} value={tpl} onChange={setTpl} />
            : <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{current.waiting ? `${current.waiting} template${current.waiting > 1 ? "s are" : " is"} waiting for Meta's approval — usually a few minutes. This updates by itself.` : "No approved templates yet. Create one under “Message templates” below — Growvia sends it to Meta for approval."}</p>}
          <p className="mt-1.5 text-[12px] text-stone-400">WhatsApp requires Meta-approved templates for messages you start. Replies within 24 hours can be free text (in Inbox).</p>
        </div>
      </div>
      <div className="grid content-start gap-4">
        <div>
          <p className="text-[13px] font-medium">Who gets it</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {([["all", `Everyone with a phone (${reachable})`], ["tag", "By tag"], ["stage", "By stage"]] as const).map(([k, l]) => (
              <button type="button" key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-full border px-3 py-1.5 text-[13px] ${mode === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{l}</button>
            ))}
          </div>
          {mode === "tag" && <select name="tag" className={`${inputCls} mt-3`}>{tags.map((t) => <option key={t}>{t}</option>)}</select>}
          {mode === "stage" && <div className="mt-3 flex flex-wrap gap-3 text-[14px]">{["new", "contacted", "qualified", "won", "lost"].map((s) => <label key={s} className="flex items-center gap-1.5 capitalize"><input type="checkbox" name="stages" value={s} defaultChecked={s === "won"} /> {s}</label>)}</div>}
          <label className="mt-3 flex items-start gap-2 text-[13px] text-stone-600"><input type="checkbox" name="opted_in_only" defaultChecked className="mt-0.5" /> Only people who agreed to hear from you on WhatsApp ({optedIn}) — protects your number from being blocked or banned.</label>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Submit className="btn h-11 bg-emerald-600 px-5 text-[14px] text-white hover:bg-emerald-700" pendingText="Sending…">{at ? "Schedule broadcast" : "Send now"}</Submit>
          <input type="datetime-local" onChange={(e) => setAt(e.target.value ? new Date(e.target.value).toISOString() : "")} className={`${inputCls} h-11 w-auto text-[13px]`} aria-label="Schedule for later" />
          <input type="hidden" name="intent" value={at ? "schedule" : "now"} />
        </div>
        <Notice state={state} />
      </div>
    </form>
  );
}

/* ───────── Message templates: create, track approval, delete ───────── */

type TplAcc = { id: string; name: string; phone: string | null; templates: WaTemplate[] };

const STATUS: Record<string, [string, string]> = {
  APPROVED: ["Approved", "bg-lime/25 text-lime-800"],
  PENDING: ["Waiting for Meta", "bg-amber-50 text-amber-800"],
  IN_APPEAL: ["In appeal", "bg-amber-50 text-amber-800"],
  REJECTED: ["Rejected", "bg-red-50 text-red-700"],
  PAUSED: ["Paused by Meta", "bg-red-50 text-red-700"],
  DISABLED: ["Disabled", "bg-red-50 text-red-700"],
};

const PRESETS = [
  { label: "Special offer", name: "special_offer", category: "MARKETING", header: "This week only", body: "Hi {{1}}, enjoy {{2}} at {{3}} this week. Reply YES and we'll save it for you!", examples: ["Priya", "20% off", "our store"], footer: "Reply STOP to opt out", quick: "YES, Not now" },
  { label: "Thanks for contacting", name: "thanks_for_contacting", category: "UTILITY", header: "", body: "Hi {{1}}, thanks for getting in touch with {{2}}. How can we help you today?", examples: ["Priya", "our team"], footer: "", quick: "" },
  { label: "Appointment reminder", name: "appointment_reminder", category: "UTILITY", header: "Reminder", body: "Hi {{1}}, this is a reminder of your appointment on {{2}}. Reply 1 to confirm or 2 to reschedule.", examples: ["Priya", "Friday at 5 pm"], footer: "", quick: "Confirm, Reschedule" },
  { label: "Follow-up", name: "follow_up", category: "MARKETING", header: "", body: "Hi {{1}}, just checking in — are you still interested in {{2}}? Happy to answer any questions.", examples: ["Priya", "the 2 BHK flat"], footer: "", quick: "Yes, call me, Not now" },
] as const;

export function TemplateManager({ accounts }: { accounts: TplAcc[] }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">Message templates</h2>
          <p className="text-[13px] text-stone-500">WhatsApp only lets businesses start a chat with a Meta-approved template. Write it here — Growvia sends it to Meta and tracks approval.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={pending} onClick={() => start(async () => { const r = await Promise.all(accounts.map((a) => syncTemplatesAction(a.id))); setMsg(r.map((x) => x?.error ?? x?.message).join(" ")); })} className="btn-ghost h-10 px-4 text-[14px]"><RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Check status</button>
          <button onClick={() => setOpen(true)} className="btn h-10 bg-emerald-600 px-4 text-[14px] text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> New template</button>
        </div>
      </div>
      {msg && <p className="mb-2 text-[13px] text-stone-500">{msg}</p>}
      <div className="card overflow-hidden">
        <ul className="divide-y divide-line">
          {accounts.flatMap((a) => a.templates.map((t) => <TemplateRow key={`${a.id}-${t.name}-${t.language}`} acc={a} t={t} multi={accounts.length > 1} />))}
          {!accounts.some((a) => a.templates.length) && <li className="p-6 text-center text-[14px] text-stone-500">No templates yet. Click <b>New template</b> — pick a ready-made one or write your own.</li>}
        </ul>
      </div>
      {open && <TemplateDialog accounts={accounts} onClose={() => setOpen(false)} />}
    </section>
  );
}

function TemplateRow({ acc, t, multi }: { acc: TplAcc; t: WaTemplate; multi: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [label, cls] = STATUS[t.status] ?? [t.status.toLowerCase(), "bg-mist text-stone-600"];
  return (
    <li className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[14px] font-medium">{t.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${cls}`}>{label}</span>
          <span className="text-[12px] text-stone-500">{t.language} · {t.category.toLowerCase()}{multi ? ` · ${acc.phone ?? acc.name}` : ""}</span>
        </div>
        <p className="mt-1 whitespace-pre-line text-[13px] text-stone-600">{t.header ? <b className="block">{t.header}</b> : null}{t.body}</p>
        {t.buttons?.length ? <p className="mt-1 text-[12px] text-stone-500">Buttons: {t.buttons.join(" · ")}</p> : null}
        {t.status === "REJECTED" && <p className="mt-1 text-[12px] text-red-600">Meta's reason: {(t.reason ?? "not given").replace(/_/g, " ").toLowerCase()}. Edit the wording and submit it again under a new name.</p>}
        {err && <p className="mt-1 text-[12px] text-red-600">{err}</p>}
      </div>
      {t.name !== "hello_world" && (
        <button disabled={pending} onClick={() => { if (confirm(`Delete template ${t.name}?`)) start(async () => { const r = await deleteWaTemplateAction(acc.id, t.name); if (r?.error) setErr(r.error); }); }} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${t.name}`}><Trash2 className="h-4 w-4" /></button>
      )}
    </li>
  );
}

function TemplateDialog({ accounts, onClose }: { accounts: TplAcc[]; onClose: () => void }) {
  const [state, action] = useFormState(createWaTemplateAction, undefined);
  const [f, setF] = useState({ name: "", category: "MARKETING", header: "", body: "", footer: "", quick: "", examples: [] as string[] });
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (state?.ok) setTimeout(onClose, 1500); }, [state, onClose]);
  const nVars = new Set(f.body.match(/\{\{\d+\}\}/g) ?? []).size;
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const addVar = () => {
    const el = bodyRef.current; const tag = `{{${nVars + 1}}}`;
    const pos = el?.selectionStart ?? f.body.length;
    set("body", f.body.slice(0, pos) + tag + f.body.slice(pos));
  };
  const preview = f.body.replace(/\{\{(\d+)\}\}/g, (_, n) => f.examples[Number(n) - 1] || `{{${n}}}`);
  return (
    <Dialog title="New WhatsApp template" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="py-1 text-[13px] text-stone-500">Start from:</span>
        {PRESETS.map((p) => (
          <button type="button" key={p.name} onClick={() => setF({ name: p.name, category: p.category, header: p.header, body: p.body, footer: p.footer, quick: p.quick, examples: [...p.examples] })} className="rounded-full border border-line bg-white px-3 py-1 text-[13px] text-stone-700 hover:border-ink">{p.label}</button>
        ))}
      </div>
      <form action={action} className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="grid content-start gap-4">
          {accounts.length > 1 ? (
            <Field label="Number"><select name="account_id" className={inputCls}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.phone ? ` · ${a.phone}` : ""}</option>)}</select></Field>
          ) : <input type="hidden" name="account_id" value={accounts[0].id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template name" hint="lowercase, e.g. diwali_offer"><input name="name" value={f.name} onChange={(e) => set("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"))} required maxLength={60} className={inputCls} /></Field>
            <Field label="Language">
              <select name="language" defaultValue="en" className={inputCls}>
                {[["en", "English"], ["en_US", "English (US)"], ["en_GB", "English (UK)"], ["hi", "Hindi"], ["pa", "Punjabi"], ["ur", "Urdu"], ["gu", "Gujarati"], ["mr", "Marathi"], ["ta", "Tamil"], ["te", "Telugu"], ["bn", "Bengali"], ["kn", "Kannada"], ["ml", "Malayalam"], ["ar", "Arabic"], ["es", "Spanish"], ["fr", "French"], ["de", "German"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Type</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[["MARKETING", "Marketing", "Offers, news, invitations, follow-ups"], ["UTILITY", "Utility", "Reminders, confirmations, updates about something they asked for"]].map(([v, l, d]) => (
                <label key={v} className={`cursor-pointer rounded-xl border p-3 text-[13px] ${f.category === v ? "border-ink bg-paper" : "border-line"}`}>
                  <input type="radio" name="category" value={v} checked={f.category === v} onChange={() => set("category", v)} className="sr-only" />
                  <b className="block text-[14px]">{l}</b><span className="text-stone-500">{d}</span>
                </label>
              ))}
            </div>
          </div>
          <Field label="Heading" hint="optional"><input name="header" value={f.header} onChange={(e) => set("header", e.target.value)} maxLength={60} className={inputCls} /></Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-[13px] font-medium">Message</span><button type="button" onClick={addVar} className="text-[13px] font-medium text-emerald-700 hover:underline">+ Add variable</button></div>
            <textarea ref={bodyRef} name="body" value={f.body} onChange={(e) => set("body", e.target.value)} required rows={5} maxLength={1024} className={textareaCls} placeholder="Hi {{1}}, …" aria-label="Message" />
            <p className="mt-1 text-[12px] text-stone-400">Variables like {"{{1}}"} are filled when you send — e.g. with the customer&apos;s first name.</p>
          </div>
          {nVars > 0 && (
            <div className="grid gap-2">
              <p className="text-[13px] font-medium">Example for each variable <span className="font-normal text-stone-500">(Meta checks these)</span></p>
              {Array.from({ length: nVars }, (_, i) => (
                <input key={i} name="example" value={f.examples[i] ?? ""} onChange={(e) => setF((x) => { const ex = [...x.examples]; ex[i] = e.target.value; return { ...x, examples: ex }; })} required className={inputCls} placeholder={`{{${i + 1}}} e.g. ${i === 0 ? "Priya" : "…"}`} aria-label={`Example ${i + 1}`} />
              ))}
            </div>
          )}
          <Field label="Footer" hint="optional, small grey text"><input name="footer" value={f.footer} onChange={(e) => set("footer", e.target.value)} maxLength={60} className={inputCls} placeholder="Reply STOP to opt out" /></Field>
          <Field label="Quick-reply buttons" hint="optional, up to 3, comma separated"><input name="quick_replies" value={f.quick} onChange={(e) => set("quick", e.target.value)} className={inputCls} placeholder="Yes, Not now" /></Field>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field label="Link button" hint="optional"><input name="url_text" maxLength={25} className={inputCls} placeholder="View offer" /></Field>
            <Field label="Link"><input name="url" type="url" className={inputCls} placeholder="https://…" /></Field>
          </div>
          <Notice state={state} />
          <div className="flex gap-2"><Submit className="btn h-10 bg-emerald-600 px-5 text-[14px] text-white hover:bg-emerald-700" pendingText="Sending to Meta…">Submit for approval</Submit><button type="button" onClick={onClose} className="btn-ghost h-10 px-4 text-[14px]">Cancel</button></div>
        </div>
        <div className="hidden lg:block">
          <p className="mb-2 text-[13px] font-medium">Preview</p>
          <div className="rounded-2xl bg-[#e7ddd3] p-3">
            <div className="rounded-xl rounded-tl-none bg-white p-3 text-[13px] shadow-sm">
              {f.header && <p className="mb-1 font-semibold">{f.header}</p>}
              <p className="whitespace-pre-line">{preview || "Your message appears here."}</p>
              {f.footer && <p className="mt-1 text-[11px] text-stone-400">{f.footer}</p>}
            </div>
            {f.quick.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3).map((b) => <div key={b} className="mt-1 rounded-xl bg-white py-2 text-center text-[13px] font-medium text-sky-600 shadow-sm">{b}</div>)}
          </div>
          <p className="mt-3 text-[12px] text-stone-500">Tips for fast approval: say who you are, keep it clear, no ALL CAPS or misleading claims, and don&apos;t put a variable at the very start or end.</p>
        </div>
      </form>
    </Dialog>
  );
}
