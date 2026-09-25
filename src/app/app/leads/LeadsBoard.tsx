"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Plus, Search, Download, Trash2, X, LayoutGrid, List, Mail, Phone, Link2, Upload, Tag, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { bulkLeadsAction, enrollAction } from "@/app/email-actions";
import { ImportDialog } from "./ImportDialog";
import type { Lead, Stage } from "@/lib/data/types";
import { deleteLeadAction, saveLeadAction, setLeadStageAction } from "@/app/actions";
import { STAGE_META, money, timeAgo } from "@/lib/format";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import { CopyButton } from "@/components/app/bits";

const STAGES: Stage[] = ["new", "contacted", "qualified", "won", "lost"];

export function LeadsBoard({ leads: serverLeads, formUrl, sequences = [] }: { leads: Lead[]; formUrl: string; sequences?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkMsg, setBulkMsg] = useState<{ error?: string; message?: string } | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const toggle = (id: string) => setSel((s0) => { const s1 = new Set(s0); if (s1.has(id)) s1.delete(id); else s1.add(id); return s1; });
  const bulk = (fn: () => Promise<{ error?: string; message?: string } | undefined | void>) => startBulk(async () => { const r = await fn(); setBulkMsg(r || null); setSel(new Set()); });
  // Optimistic stage changes: the card moves instantly, the server catches up in the background.
  const [pendingStage, setPendingStage] = useState<Record<string, Stage>>({});
  const leads = useMemo(() => serverLeads.map((l) => (pendingStage[l.id] ? { ...l, stage: pendingStage[l.id] } : l)), [serverLeads, pendingStage]);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const [, start] = useTransition();

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? leads.filter((l) => [l.name, l.email, l.phone, l.company, l.notes, l.source, ...(l.tags ?? [])].some((v) => v?.toLowerCase().includes(s))) : leads;
  }, [leads, q]);

  const exportCsv = () => {
    const cols = ["name", "email", "phone", "company", "source", "stage", "value", "tags", "notes", "created_at"] as const;
    const esc = (v: unknown) => `"${String(Array.isArray(v) ? v.join(";") : v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...leads.map((l) => cols.map((c) => esc(l[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "growvia-leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const move = (l: Lead, stage: Stage) => {
    setPendingStage((m) => ({ ...m, [l.id]: stage }));
    start(async () => {
      await setLeadStageAction(l.id, stage, l.name);
      setPendingStage((m) => { const { [l.id]: _, ...rest } = m; return rest; });
    });
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads…" className={`${inputCls} pl-10`} aria-label="Search leads" />
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-xl border border-line bg-white p-1" role="group" aria-label="View">
            <button onClick={() => setView("board")} aria-pressed={view === "board"} className={`grid h-9 w-9 place-items-center rounded-lg ${view === "board" ? "bg-ink text-white" : "text-stone-500"}`} aria-label="Board view"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView("list")} aria-pressed={view === "list"} className={`grid h-9 w-9 place-items-center rounded-lg ${view === "list" ? "bg-ink text-white" : "text-stone-500"}`} aria-label="List view"><List className="h-4 w-4" /></button>
          </div>
          <button onClick={() => setImporting(true)} className="btn-ghost h-11 px-4 text-[14px]"><Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import</span></button>
          <button onClick={exportCsv} disabled={!leads.length} className="btn-ghost h-11 px-4 text-[14px] disabled:opacity-50"><Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span></button>
          <button onClick={() => setEditing("new")} className="btn-primary h-11 px-4 text-[14px]"><Plus className="h-4 w-4" /> Add lead</button>
        </div>
      </div>

      {!leads.length && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-dashed border-stone-400/60 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-medium"><Link2 className="h-4 w-4 text-lime-700" /> No leads yet — share your lead form</p>
            <p className="mt-1 text-[14px] text-stone-500">Put this link in your Instagram bio, Google profile and website. Every submission lands here.</p>
          </div>
          <CopyButton text={formUrl} label="Copy lead form link" className="shrink-0" />
        </div>
      )}

      {view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[980px] grid-cols-5 gap-3">
            {STAGES.map((s) => {
              const col = shown.filter((l) => l.stage === s);
              return (
                <section key={s} className="rounded-2xl border border-line bg-mist/60 p-2.5" aria-label={STAGE_META[s].label}>
                  <header className="flex items-center justify-between px-1.5 pb-2.5 pt-1">
                    <span className="flex items-center gap-2 text-[13px] font-medium"><span className={`h-2 w-2 rounded-full ${STAGE_META[s].dot}`} /> {STAGE_META[s].label}</span>
                    <span className="text-[12px] tabular-nums text-stone-500">{col.length}{col.length ? ` · ${money(col.reduce((a, l) => a + l.value, 0))}` : ""}</span>
                  </header>
                  <ul className="grid gap-2">
                    {col.map((l) => (
                      <li key={l.id} className="rounded-xl border border-line bg-white p-3 shadow-card">
                        <button onClick={() => router.push(`/app/leads/${l.id}`)} className="block w-full text-left">
                          <div className="truncate text-[14px] font-medium">{l.name}</div>
                          {l.last_replied_at && <div className="text-[11px] font-medium text-lime-700">Replied {timeAgo(l.last_replied_at)}</div>}
                          {l.company && <div className="truncate text-[12px] text-stone-500">{l.company}</div>}
                          <div className="mt-1.5 flex items-center justify-between text-[12px] text-stone-400">
                            <span className="truncate">{l.source} · {timeAgo(l.created_at)}</span>
                            {l.value > 0 && <span className="font-medium text-ink">{money(l.value)}</span>}
                          </div>
                        </button>
                        <select value={l.stage} onChange={(e) => move(l, e.target.value as Stage)} className="mt-2 h-8 w-full rounded-lg border border-line bg-paper px-2 text-[12px]" aria-label={`Stage for ${l.name}`}>
                          {STAGES.map((x) => <option key={x} value={x}>{STAGE_META[x].label}</option>)}
                        </select>
                      </li>
                    ))}
                    {!col.length && <li className="px-1.5 py-4 text-center text-[12px] text-stone-400">—</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-4 py-2.5 text-[13px]">
            <label className="flex items-center gap-2"><input type="checkbox" aria-label="Select all" checked={shown.length > 0 && shown.every((l) => sel.has(l.id))} onChange={(e) => setSel(e.target.checked ? new Set(shown.map((l) => l.id)) : new Set())} /> {sel.size ? `${sel.size} selected` : "Select"}</label>
            {sel.size > 0 && (
              <>
                <button disabled={bulkPending} onClick={() => { const t = prompt("Tag to add"); if (t) bulk(() => bulkLeadsAction([...sel], "tag", t)); }} className="btn-ghost h-8 px-3 text-[12px]"><Tag className="h-3.5 w-3.5" /> Tag</button>
                <button disabled={bulkPending} onClick={() => { if (confirm(`Mark ${sel.size} lead(s) as agreeing to WhatsApp messages? Only do this if they gave you permission.`)) bulk(() => bulkLeadsAction([...sel], "wa_opt_in")); }} className="btn-ghost h-8 px-3 text-[12px]">WhatsApp opt-in</button>
                <select disabled={bulkPending} value="" onChange={(e) => { const v = e.target.value; if (v) bulk(() => bulkLeadsAction([...sel], "stage", v)); }} className="h-8 rounded-full border border-line bg-white px-3 text-[12px]" aria-label="Set stage">
                  <option value="">Set stage…</option>{STAGES.map((x) => <option key={x} value={x}>{STAGE_META[x].label}</option>)}
                </select>
                {sequences.length > 0 && (
                  <select disabled={bulkPending} value="" aria-label="Add to email campaign" className="h-8 rounded-full border border-line bg-white px-3 text-[12px]"
                    onChange={(e) => { const id = e.target.value; if (!id) return; const f = new FormData(); f.set("sequence_id", id); f.set("mode", "ids"); f.set("ids", [...sel].join(",")); bulk(() => enrollAction(undefined, f)); }}>
                    <option value="">Add to email campaign…</option>{sequences.map((q2) => <option key={q2.id} value={q2.id}>{q2.name}</option>)}
                  </select>
                )}
                <button disabled={bulkPending} onClick={() => { if (confirm(`Delete ${sel.size} leads? This can't be undone.`)) bulk(() => bulkLeadsAction([...sel], "delete")); }} className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </>
            )}
            {bulkMsg && <span className={bulkMsg.error ? "text-red-600" : "text-lime-800"}>{bulkMsg.error ?? bulkMsg.message}</span>}
          </div>
          <ul className="divide-y divide-line">
            {shown.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <input type="checkbox" className="hidden sm:block" checked={sel.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.name}`} />
                <button onClick={() => router.push(`/app/leads/${l.id}`)} className="min-w-0 flex-1 text-left">
                  <div className="text-[15px] font-medium">{l.name} {l.company && <span className="font-normal text-stone-500">· {l.company}</span>}
                    {(l.tags ?? []).map((t) => <span key={t} className="ml-1.5 rounded-full bg-mist px-2 py-0.5 align-middle text-[11px] font-normal text-stone-600">{t}</span>)}
                    {l.unsubscribed && <span className="ml-1.5 rounded-full bg-stone-100 px-2 py-0.5 align-middle text-[11px] font-normal text-stone-500">unsubscribed</span>}
                    {l.email_status === "bounced" && <span className="ml-1.5 rounded-full bg-red-50 px-2 py-0.5 align-middle text-[11px] font-normal text-red-700">bounced</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-stone-500">
                    {l.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{l.email}</span>}
                    {l.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{l.phone}</span>}
                    <span>{l.source} · {timeAgo(l.created_at)}</span>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  {l.value > 0 && <span className="text-[14px] font-medium tabular-nums">{money(l.value)}</span>}
                  <select value={l.stage} onChange={(e) => move(l, e.target.value as Stage)} className="h-9 rounded-lg border border-line bg-paper px-2 text-[13px]" aria-label={`Stage for ${l.name}`}>
                    {STAGES.map((x) => <option key={x} value={x}>{STAGE_META[x].label}</option>)}
                  </select>
                </div>
              </li>
            ))}
            {!shown.length && <li className="p-6 text-center text-[14px] text-stone-500">{q ? "No leads match your search." : "No leads yet."}</li>}
          </ul>
        </div>
      )}

      {editing && <LeadDialog lead={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </>
  );
}

export function LeadDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useFormState(saveLeadAction, undefined);
  const [deleting, startDelete] = useTransition();
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-white p-0 shadow-frame backdrop:bg-ink/50 backdrop:backdrop-blur-sm">
      <form action={action} className="grid gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-tight">{lead ? "Edit lead" : "Add a lead"}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 hover:bg-mist" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {lead && <input type="hidden" name="id" value={lead.id} />}
        <Field label="Name"><input name="name" defaultValue={lead?.name} required className={inputCls} autoFocus maxLength={120} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><input name="email" type="email" defaultValue={lead?.email ?? ""} className={inputCls} maxLength={200} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={lead?.phone ?? ""} className={inputCls} maxLength={40} /></Field>
          <Field label="Company" hint="optional"><input name="company" defaultValue={lead?.company ?? ""} className={inputCls} maxLength={120} /></Field>
          <Field label="Deal value ($)"><input name="value" type="number" min={0} step="0.01" defaultValue={lead?.value || ""} className={inputCls} /></Field>
          <Field label="Stage">
            <select name="stage" defaultValue={lead?.stage ?? "new"} className={inputCls}>
              {STAGES.map((x) => <option key={x} value={x}>{STAGE_META[x].label}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select name="source" defaultValue={lead?.source ?? "manual"} className={inputCls}>
              {["manual", "lead form", "Instagram", "Facebook", "Google", "Referral", "Walk-in", "Phone call", "Email", "Other"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex items-start gap-2 text-[13px] text-stone-600"><input type="checkbox" name="wa_opt_in" defaultChecked={Boolean(lead?.wa_opt_in)} className="mt-0.5" /> They agreed to get WhatsApp messages from us (needed for broadcasts)</label>
        <Field label="Notes"><textarea name="notes" defaultValue={lead?.notes ?? ""} rows={3} className={textareaCls} maxLength={2000} /></Field>
        <Notice state={state?.error ? state : undefined} />
        <div className="flex items-center gap-2 pt-1">
          <Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">{lead ? "Save lead" : "Add lead"}</Submit>
          <button type="button" onClick={onClose} className="btn-ghost h-10 px-4 text-[14px]">Cancel</button>
          {lead && (
            <button type="button" disabled={deleting}
              onClick={() => { if (confirm(`Delete ${lead.name}?`)) startDelete(async () => { await deleteLeadAction(lead.id); onClose(); if (location.pathname.startsWith("/app/leads/")) location.assign("/app/leads"); }); }}
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
