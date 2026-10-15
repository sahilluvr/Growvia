import Link from "next/link";
import { loadFinance, loadUsers, inrFmt } from "@/lib/admin/data";
import { Bars, PlanBadge, Stat, ago, fmtDate } from "./ui";
import { db } from "@/lib/admin/data";
import { indexNowStatus } from "@/lib/seo/indexnow";
import { SendIndexNow } from "./SearchEngines";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const [users, fin, inx] = await Promise.all([loadUsers(), loadFinance(), indexNowStatus(db()).catch(() => null)]);
  const day = 86400_000, now = Date.now();
  const within = (s: string | null, ms: number) => Boolean(s && now - Date.parse(s) <= ms);
  const by = (src: string) => users.filter((u) => u.plan.source === src).length;
  const paying = by("paid");
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * day); const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: users.filter((u) => u.createdAt.slice(0, 10) === key).length };
  });
  return (
    <div className="grid gap-6">
      <h1 className="text-[28px] font-semibold tracking-tight">Overview</h1>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6" data-testid="admin-kpis">
        <Stat label="Total users" value={users.length} sub={`${users.filter((u) => within(u.createdAt, 7 * day)).length} new this week`} />
        <Stat label="New (30 days)" value={users.filter((u) => within(u.createdAt, 30 * day)).length} />
        <Stat label="Active (signed in 7d)" value={users.filter((u) => within(u.lastSignIn, 7 * day)).length} />
        <Stat label="Paying (all plans)" value={paying} sub={users.length ? `${((paying / users.length) * 100).toFixed(1)}% of users` : undefined} tone="good" />
        <Stat label="On trial" value={by("trial")} />
        <Stat label="Free" value={by("free")} />
        <Stat label="MRR" value={inrFmt(fin.mrr)} sub={`ARR ${inrFmt(fin.arr)}`} tone="good" />
        <Stat label="Revenue (30 days)" value={inrFmt(fin.revenue30)} sub={`7 days: ${inrFmt(fin.revenue7)}`} />
        <Stat label="Revenue (all time)" value={inrFmt(fin.revenueTotal)} sub={`${fin.paymentsCount} payments`} />
        <Stat label="Complimentary / custom Agency" value={by("comp") + by("agency")} />
        <Stat label="Payment problems" value={fin.troubleSubs.length} tone={fin.troubleSubs.length ? "warn" : undefined} />
        <Stat label="Deactivated · unconfirmed" value={`${users.filter((u) => u.banned).length} · ${users.filter((u) => !u.confirmed).length}`} />
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5" data-testid="admin-search">
        <div>
          <h2 className="text-[16px] font-semibold">Search engines</h2>
          <p className="mt-1 text-[13px] text-stone-500">New and changed pages go to Bing, Yandex and other IndexNow engines automatically within an hour of each deploy. Google reads the sitemap (Search Console).{inx ? ` Last check ${ago(new Date(inx.checkedAt).toISOString())} · ${inx.pages} pages tracked.` : " Not sent yet — happens after the next deploy."}</p>
        </div>
        <SendIndexNow />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-[16px] font-semibold">Sign-ups, last 30 days</h2>
        <Bars data={days} format={(n) => `${n} sign-up${n === 1 ? "" : "s"}`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Newest users</h2><Link href="/admin/users" className="text-[13px] underline">All users</Link></div>
          <ul className="divide-y divide-line text-[14px]">
            {users.slice(0, 10).map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 truncate hover:underline"><b className="font-medium">{u.name}</b> <span className="text-stone-500">· {u.email}</span></Link>
                <PlanBadge label={u.plan.label} source={u.plan.source} />
                <span className="w-24 shrink-0 text-right text-[12px] text-stone-500">{ago(u.createdAt)}</span>
              </li>
            ))}
            {!users.length && <li className="py-4 text-stone-500">No users yet.</li>}
          </ul>
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Latest payments</h2><Link href="/admin/finance" className="text-[13px] underline">Finance</Link></div>
          <ul className="divide-y divide-line text-[14px]">
            {fin.payments.slice(0, 10).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">{p.who?.email ?? p.owner_id}</span>
                <span className="tabular-nums">{new Intl.NumberFormat(p.currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency: p.currency }).format(p.amount / 100)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[12px] ${p.status === "paid" ? "bg-lime/25 text-lime-800" : "bg-red-50 text-red-700"}`}>{p.status}</span>
                <span className="w-24 shrink-0 text-right text-[12px] text-stone-500">{fmtDate(p.paid_at)}</span>
              </li>
            ))}
            {!fin.payments.length && <li className="py-4 text-stone-500">No payments yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
