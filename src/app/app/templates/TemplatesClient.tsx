"use client";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteTemplateAction, duplicateTemplateAction, saveTemplateAction } from "@/app/email-actions";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";
import { EmailEditor, fill } from "@/components/app/EmailEditor";
import type { Template } from "@/lib/email/types";

const CATEGORIES = ["Welcome", "Follow-up", "Outreach", "Promotion", "Meetings", "Win-back", "Reputation", "Retention", "Recovery", "Activation", "Clients", "General"];

export function TemplatesClient({ templates, businessName }: { templates: Template[]; businessName: string }) {
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [cat, setCat] = useState("All");
  const [, start] = useTransition();
  const cats = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];
  const shown = cat === "All" ? templates : templates.filter((t) => t.category === cat);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1.5 text-[13px] ${cat === c ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{c}</button>)}
        <button onClick={() => setEditing("new")} className="btn-primary ml-auto h-10 px-4 text-[14px]"><Plus className="h-4 w-4" /> New template</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => (
          <article key={t.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><h3 className="truncate text-[15px] font-semibold tracking-tight">{t.name}</h3><p className="text-[12px] text-stone-500">{t.category}</p></div>
            </div>
            <p className="mt-3 truncate text-[13px] font-medium">{fill(t.subject, { business_name: businessName })}</p>
            <p className="mt-1 line-clamp-4 whitespace-pre-line text-[13px] leading-relaxed text-stone-500">{fill(t.body, { business_name: businessName })}</p>
            <div className="mt-auto flex gap-2 pt-4">
              <button onClick={() => setEditing(t)} className="btn-ghost h-9 px-3 text-[13px]"><Pencil className="h-3.5 w-3.5" /> Edit</button>
              <button onClick={() => start(() => duplicateTemplateAction(t.id))} className="btn-ghost h-9 px-3 text-[13px]"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
              <button onClick={() => { if (confirm(`Delete “${t.name}”?`)) start(() => deleteTemplateAction(t.id)); }} className="ml-auto grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete template"><Trash2 className="h-4 w-4" /></button>
            </div>
          </article>
        ))}
      </div>
      {editing && <TemplateDialog t={editing === "new" ? null : editing} onClose={() => setEditing(null)} businessName={businessName} />}
    </>
  );
}

function TemplateDialog({ t, onClose, businessName }: { t: Template | null; onClose: () => void; businessName: string }) {
  const [state, action] = useFormState(saveTemplateAction, undefined);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  return (
    <Dialog title={t ? "Edit template" : "New template"} onClose={onClose} wide>
      <form action={action} className="grid gap-4">
        {t && <input type="hidden" name="id" value={t.id} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Template name"><input name="name" defaultValue={t?.name} required maxLength={100} className={inputCls} placeholder="e.g. Spring offer" /></Field>
          <Field label="Category">
            <select name="category" defaultValue={t?.category ?? "General"} className={inputCls}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
        <EmailEditor subject={t?.subject ?? ""} body={t?.body ?? "Hi {{first_name}},\n\n\n\n{{sender_name}}"} businessName={businessName} />
        <Notice state={state?.error ? state : undefined} />
        <div className="flex gap-2"><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">Save template</Submit><button type="button" onClick={onClose} className="btn-ghost h-10 px-4 text-[14px]">Cancel</button></div>
      </form>
    </Dialog>
  );
}
