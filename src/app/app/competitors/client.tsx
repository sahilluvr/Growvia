"use client";
import { safe } from "@/lib/client/safe-action";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addCompetitorAction, addCompetitorFormAction, refreshCompetitorsAction, removeCompetitorAction, updateCompetitorAction } from "@/app/competitor-actions";
import { Run } from "../seo/client2";
import { Notice, Submit, inputCls } from "@/components/ui/Form";

export const RefreshCompetitors = () => <Run run={refreshCompetitorsAction} label="Refresh ratings & reviews" busy="Checking Google Maps…" />;

export function AddCompetitor() {
  const [state, action] = useFormState(safe(addCompetitorFormAction), undefined);
  return (
    <form action={action} className="grid gap-2" data-testid="add-competitor">
      <input name="name" required maxLength={80} className={inputCls} placeholder="Business name, e.g. Pizza Palace" aria-label="Competitor name" />
      <input name="website" maxLength={200} className={inputCls} placeholder="Website (optional)" aria-label="Competitor website" />
      <Submit className="btn-primary h-11 px-4 text-[14px]" pendingText="Adding…"><Plus className="h-4 w-4 text-lime" /> Add</Submit>
      <Notice state={state} />
    </form>
  );
}

export function AddSuggestion({ name, website, placeId, source }: { name: string; website: string | null; placeId: string | null; source: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button disabled={pending} onClick={() => start(async () => { const r = await addCompetitorAction({ name, website, placeId, source }); setMsg(r?.error ?? ""); router.refresh(); })} className="btn-ghost h-8 px-3 text-[12px]" aria-label={`Track ${name}`}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Track
      </button>
      {msg && <span className="text-[12px] text-red-600">{msg}</span>}
    </span>
  );
}

export function EditCompetitor({ id, name, website }: { id: string; name: string; website: string | null }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [w, setW] = useState(website ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  return (
    <div className="grid gap-2">
      <input value={n} onChange={(e) => setN(e.target.value)} className={inputCls} aria-label="Name" maxLength={80} />
      <input value={w} onChange={(e) => setW(e.target.value)} className={inputCls} aria-label="Website" placeholder="Website (to compare Google positions)" maxLength={200} />
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={() => start(async () => { const r = await updateCompetitorAction(id, { name: n, website: w }); setMsg(r?.error ? { t: r.error, bad: true } : { t: "Saved." }); router.refresh(); })} className="btn-primary h-9 px-4 text-[13px]">Save</button>
        <button disabled={pending} onClick={() => { if (confirm(`Stop tracking ${name}?`)) start(async () => { await removeCompetitorAction(id); router.push("/app/competitors"); }); }} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] text-stone-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
        {msg && <span className={`text-[12px] ${msg.bad ? "text-red-600" : "text-lime-800"}`}>{msg.t}</span>}
      </div>
    </div>
  );
}
