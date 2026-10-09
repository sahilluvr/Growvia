import Link from "next/link";
import { loadSystem } from "@/lib/admin/data";
import { Stat, fmtDate } from "../ui";

export const metadata = { title: "System" };

export default async function AdminSystem() {
  const s = await loadSystem();
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">System</h1>
        <a href="/api/health" target="_blank" rel="noopener" className="btn-ghost h-9 px-3 text-[13px]">Open health check</a>
      </div>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Background tasks running" value={s.jobsRunning} />
        <Stat label="Failed tasks (24h)" value={s.jobsFailed.length} tone={s.jobsFailed.length ? "warn" : undefined} />
        <Stat label="System emails sent (24h)" value={s.emailsSent} />
        <Stat label="System emails failed (24h)" value={s.emailsFailed.length} tone={s.emailsFailed.length ? "bad" : undefined} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-[16px] font-semibold">Failed background tasks</h2>
          <ul className="divide-y divide-line text-[13px]">{s.jobsFailed.map((j) => <li key={j.id} className="py-2"><b className="font-medium">{j.title}</b> <span className="text-stone-500">· {fmtDate(j.finished_at, true)}</span><span className="block text-stone-600">{j.message}</span><Link href={`/admin/users/${j.owner_id}`} className="text-[12px] underline">user</Link></li>)}{!s.jobsFailed.length && <li className="py-2 text-stone-500">None in the last 24 hours.</li>}</ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-[16px] font-semibold">Failed system emails</h2>
          <ul className="divide-y divide-line text-[13px]">{s.emailsFailed.map((e) => <li key={e.id} className="py-2"><b className="font-medium">{e.type}</b> → {(e.recipients ?? []).join(", ")} <span className="text-stone-500">· {fmtDate(e.created_at, true)}</span><span className="block text-red-700">{e.error}</span></li>)}{!s.emailsFailed.length && <li className="py-2 text-stone-500">None in the last 24 hours.</li>}</ul>
        </section>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 text-[16px] font-semibold">Admin activity</h2>
        <ul className="divide-y divide-line text-[13px]">{s.recentAdmin.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-3 py-2"><span><b className="font-medium">{e.action}</b>{e.target_email ? ` · ${e.target_email}` : ""}</span><span className="text-stone-500">{fmtDate(e.created_at, true)}</span></li>)}{!s.recentAdmin.length && <li className="py-2 text-stone-500">Nothing yet.</li>}</ul>
      </section>
    </div>
  );
}
