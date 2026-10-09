"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { createWorkspaceAction, deleteProjectAction, deleteWorkspaceAction, moveProjectAction, renameWorkspaceAction, switchProjectAction } from "@/app/project-actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";

export function SwitchButton({ id, to = "/app", label = "Open", ghost = false }: { id: string; to?: string; label?: string; ghost?: boolean }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(() => switchProjectAction(id, to))} className={`${ghost ? "btn-ghost" : "btn-primary"} h-8 px-3 text-[12px]`}>{pending ? "Opening…" : label}</button>;
}

export function WorkspaceTitle({ id, name, canDelete }: { id: string; name: string; canDelete: boolean }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mb-3 flex items-center gap-2">
      {edit ? (
        <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await renameWorkspaceAction(id, v); if (r?.error) setErr(r.error); else setEdit(false); }); }} className="flex gap-2">
          <input value={v} onChange={(e) => setV(e.target.value)} autoFocus className={`${inputCls} h-9 w-60`} aria-label="Workspace name" />
          <button disabled={pending} className="btn-primary h-9 px-3 text-[13px]">Save</button>
        </form>
      ) : (
        <h2 className="text-[16px] font-semibold tracking-tight">{name}</h2>
      )}
      {!edit && <button onClick={() => setEdit(true)} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-mist hover:text-ink" aria-label={`Rename ${name}`}><Pencil className="h-3.5 w-3.5" /></button>}
      {canDelete && !edit && <button disabled={pending} onClick={() => { if (confirm(`Delete workspace ${name}?`)) start(async () => { const r = await deleteWorkspaceAction(id); if (r?.error) setErr(r.error); }); }} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${name}`}><Trash2 className="h-3.5 w-3.5" /></button>}
      {err && <span className="text-[13px] text-red-600">{err}</span>}
    </div>
  );
}

export function ProjectMenu({ id, name, workspaceId, workspaces }: { id: string; name: string; workspaceId: string; workspaces: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-mist hover:text-ink" aria-label={`${name} options`}><MoreHorizontal className="h-4 w-4" /></button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-line bg-white p-1.5 text-[13px] shadow-frame">
          {workspaces.length > 1 && (
            <label className="block px-2.5 py-1.5">
              <span className="text-[11px] text-stone-500">Move to workspace</span>
              <select defaultValue={workspaceId} disabled={pending} onChange={(e) => { const w = e.target.value; start(async () => { await moveProjectAction(id, w); setOpen(false); }); }} className="mt-1 h-8 w-full rounded-lg border border-line px-2">
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          )}
          <button disabled={pending} onClick={() => { const typed = prompt(`This deletes ${name} and all its leads, campaigns and SEO audits. Type the project name to confirm:`); if (typed != null) start(async () => { const r = await deleteProjectAction(id, typed); setMsg(r?.error ?? ""); if (!r?.error) setOpen(false); }); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete project</button>
          {msg && <p className="px-2.5 pb-1 text-[12px] text-red-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}

export function NewWorkspace() {
  const [state, action] = useFormState(safe(createWorkspaceAction), undefined);
  return (
    <form action={action} className="card grid gap-3 p-5 sm:max-w-xl">
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight">New workspace</h2>
        <p className="text-[13px] text-stone-500">One per client or brand — e.g. “RedBlink”, “Bella&apos;s Trattoria”.</p>
      </div>
      <Field label="Workspace name"><input name="name" required maxLength={80} className={inputCls} placeholder="Client or company name" /></Field>
      <input type="hidden" name="then" value="project" />
      <Notice state={state} />
      <div><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Creating…">Create & add first project</Submit></div>
    </form>
  );
}
