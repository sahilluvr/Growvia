"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { downgradeAction, extendTrialAction, grantPlanAction, resendConfirmAction, setUserActiveAction } from "@/app/admin-actions";

export function UserActions({ id, banned, confirmed, source, paying }: { id: string; banned: boolean; confirmed: boolean; source: string; paying: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [until, setUntil] = useState("");
  const [plan, setPlan] = useState<"pro" | "growth" | "agency">("pro");
  const [note, setNote] = useState("");
  const [cancelPaid, setCancelPaid] = useState(false);
  const [days, setDays] = useState(14);
  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string } | undefined>) => start(async () => { const r = await fn(); setMsg(r?.error ? { ok: false, text: r.error } : { ok: true, text: r?.message ?? "Done." }); router.refresh(); });
  const box = "card grid gap-3 p-5";
  return (
    <div className="grid gap-4" data-testid="admin-user-actions">
      {msg && <p role={msg.ok ? "status" : "alert"} data-testid="admin-msg" className={`rounded-xl border px-3.5 py-2.5 text-[13px] ${msg.ok ? "border-lime-500/40 bg-lime/15 text-lime-900" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <section className={box}>
        <h2 className="text-[15px] font-semibold">Upgrade (no payment)</h2>
        <div className="flex gap-2">
          {(["pro", "growth", "agency"] as const).map((p) => <button key={p} type="button" onClick={() => setPlan(p)} aria-pressed={plan === p} className={`rounded-full border px-3 py-1 text-[13px] ${plan === p ? "border-ink bg-ink text-white" : "border-line"}`}>{p === "pro" ? "Pro" : p === "growth" ? "Growth" : "Agency"}</button>)}
        </div>
        <label className="grid gap-1 text-[13px]">Until (leave empty = no end date)<input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-10 rounded-xl border border-line px-3" /></label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. client of RedBlink)" className="h-10 rounded-xl border border-line px-3 text-[13px]" />
        <button disabled={pending} onClick={() => run(() => grantPlanAction(id, plan, until || null, note))} className="btn-primary h-10 text-[14px]">Give {plan === "pro" ? "Pro" : plan === "growth" ? "Growth" : "Agency"}</button>
      </section>
      <section className={box}>
        <h2 className="text-[15px] font-semibold">Downgrade to Free</h2>
        <p className="text-[12px] text-stone-500">Ends any trial or complimentary plan. Nothing is deleted.</p>
        {paying && <label className="flex items-start gap-2 text-[13px] text-amber-900"><input type="checkbox" checked={cancelPaid} onChange={(e) => setCancelPaid(e.target.checked)} className="mt-0.5" /> Also cancel their Razorpay subscription now (they&apos;re paying — refund separately in Razorpay)</label>}
        <button disabled={pending || source === "free"} onClick={() => { if (confirm("Downgrade this user to Free?")) run(() => downgradeAction(id, cancelPaid)); }} className="h-10 rounded-xl border border-red-200 text-[14px] text-red-700 hover:bg-red-50 disabled:opacity-40">Downgrade to Free</button>
      </section>
      <section className={box}>
        <h2 className="text-[15px] font-semibold">Trial</h2>
        <div className="flex gap-2"><input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 w-24 rounded-xl border border-line px-3 text-[14px]" aria-label="Days" /><button disabled={pending} onClick={() => run(() => extendTrialAction(id, days))} className="btn-ghost h-10 flex-1 text-[14px]">Extend trial by {days} days</button></div>
      </section>
      <section className={box}>
        <h2 className="text-[15px] font-semibold">Access</h2>
        {!confirmed && <button disabled={pending} onClick={() => run(() => resendConfirmAction(id))} className="btn-ghost h-10 text-[14px]">Mark email as confirmed</button>}
        {banned
          ? <button disabled={pending} onClick={() => run(() => setUserActiveAction(id, true))} className="btn-primary h-10 text-[14px]">Activate user</button>
          : <button disabled={pending} onClick={() => { if (confirm("Deactivate this user? They won't be able to sign in.")) run(() => setUserActiveAction(id, false)); }} className="h-10 rounded-xl bg-red-600 text-[14px] font-medium text-white hover:bg-red-700">Deactivate user</button>}
      </section>
    </div>
  );
}
