"use client";
import { safe } from "@/lib/client/safe-action";
import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Mail, Trash2, UserPlus } from "lucide-react";
import { inviteMemberAction, removeMemberAction, resendInviteAction, updateMemberAction } from "@/app/team-actions";
import { saveNotifyPrefsAction } from "@/app/settings-actions";
import { Field, Notice, Submit, textareaCls } from "@/components/ui/Form";
import { CopyButton } from "@/components/app/bits";

type Member = { id: string; email: string; role: string; status: string; workspace_ids: string[] | null; user_id: string | null; invite_url: string | null };
type Ws = { id: string; name: string };

export function TeamManager({ owner, me, role, canManage, members, workspaces, roles }: { owner: { name: string; email: string }; me: string; role: string; canManage: boolean; members: Member[]; workspaces: Ws[]; roles: { id: string; label: string; desc: string }[] }) {
  const [state, action] = useFormState(safe(inviteMemberAction), undefined);
  const [scope, setScope] = useState<"all" | "some">("all");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<{ error?: string; message?: string } | undefined>) => start(async () => { const r = await fn(); setMsg(r?.error ?? r?.message ?? ""); router.refresh(); });
  const wsNames = (ids: string[] | null) => (ids ? ids.map((i) => workspaces.find((w) => w.id === i)?.name ?? "—").join(", ") : "All workspaces");
  return (
    <div className="grid gap-5">
      <ul className="divide-y divide-line rounded-xl border border-line">
        <li className="flex flex-wrap items-center gap-3 p-3 text-[14px]"><span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[13px] font-semibold text-lime">{owner.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="font-medium">{owner.name}</b><span className="block truncate text-[12px] text-stone-500">{owner.email}</span></span><span className="rounded-full bg-ink px-2.5 py-0.5 text-[12px] text-white">Owner</span></li>
        {members.map((m) => (
          <li key={m.id} className="grid gap-2 p-3 text-[14px] sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mist text-[13px] font-semibold">{m.email.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><b className="block truncate font-medium">{m.email}</b><span className="block text-[12px] text-stone-500">{m.status === "invited" ? "Invitation pending" : "Active"} · {wsNames(m.workspace_ids)}</span></span></div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && m.user_id !== me ? (
                <select disabled={pending} value={m.role} onChange={(e) => run(() => updateMemberAction(m.id, { role: e.target.value }))} className="h-9 rounded-lg border border-line bg-white px-2 text-[13px]" aria-label={`Role for ${m.email}`}>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
              ) : <span className="rounded-full bg-mist px-2.5 py-0.5 text-[12px] capitalize">{m.role}</span>}
              {canManage && m.status === "invited" && m.invite_url && <CopyButton text={m.invite_url} label="Copy invite link" />}
              {canManage && m.status === "invited" && <button disabled={pending} onClick={() => run(() => resendInviteAction(m.id))} className="btn-ghost h-9 px-3 text-[12px]"><Mail className="h-3.5 w-3.5" /> Resend</button>}
              {(canManage || m.user_id === me) && <button disabled={pending} onClick={() => { if (confirm(m.user_id === me ? "Leave this team?" : `Remove ${m.email}?`)) run(() => removeMemberAction(m.id)); }} className="grid h-9 w-9 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${m.email}`}><Trash2 className="h-4 w-4" /></button>}
            </div>
          </li>
        ))}
      </ul>
      {msg && <p className="text-[13px] text-stone-600">{msg}</p>}
      {canManage ? (
        <form action={action} className="grid gap-4 rounded-xl bg-paper p-4">
          <p className="flex items-center gap-2 text-[14px] font-medium"><UserPlus className="h-4 w-4" /> Invite people</p>
          <Field label="Emails" hint="comma or new line"><textarea name="emails" rows={2} required className={textareaCls} placeholder="colleague@company.com, client@example.com" /></Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Role</p>
            <div className="grid gap-2 sm:grid-cols-3">{roles.filter((r) => role === "owner" || r.id !== "admin").map((r) => <label key={r.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-line bg-white p-3 text-[13px]"><input type="radio" name="role" value={r.id} defaultChecked={r.id === "member"} className="mt-0.5" /><span><b className="font-medium">{r.label}</b><span className="block text-stone-500">{r.desc}</span></span></label>)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Access</p>
            <div className="flex flex-wrap gap-3 text-[13px]">
              <label className="flex items-center gap-1.5"><input type="radio" name="scope" value="all" checked={scope === "all"} onChange={() => setScope("all")} /> All workspaces (incl. shared inbox, email & channels)</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="scope" value="some" checked={scope === "some"} onChange={() => setScope("some")} /> Only some workspaces (e.g. a client)</label>
            </div>
            {scope === "some" && <div className="mt-2 flex flex-wrap gap-3 text-[13px]">{workspaces.map((w) => <label key={w.id} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5"><input type="checkbox" name="workspaces" value={w.id} /> {w.name}</label>)}</div>}
          </div>
          <Notice state={state} />
          <div><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Inviting…">Send invitations</Submit></div>
        </form>
      ) : <p className="text-[13px] text-stone-500">Only the owner or an admin can invite people.</p>}
    </div>
  );
}

export function NotifyForm({ types, prefs }: { types: { id: string; label: string; desc: string }[]; prefs: Record<string, boolean> }) {
  const [state, action] = useFormState(safe(saveNotifyPrefsAction), undefined);
  return (
    <form action={action} className="grid gap-3">
      {types.map((t) => (
        <label key={t.id} className="flex items-start justify-between gap-4 rounded-xl border border-line p-3">
          <span><b className="text-[14px] font-medium">{t.label}</b><span className="block text-[13px] text-stone-500">{t.desc}</span></span>
          <input type="checkbox" name={t.id} defaultChecked={prefs[t.id] !== false} className="mt-1 h-4 w-4" aria-label={t.label} />
        </label>
      ))}
      <div className="flex items-center gap-3"><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">Save</Submit><Notice state={state} /></div>
    </form>
  );
}
