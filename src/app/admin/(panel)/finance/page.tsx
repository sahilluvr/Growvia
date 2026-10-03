import Link from "next/link";
import { loadFinance, inrFmt } from "@/lib/admin/data";
import { Bars, Stat, fmtDate } from "../ui";

export const metadata = { title: "Finance" };

const money = (minor: number, cur: string) => new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", { style: "currency", currency: cur }).format(minor / 100);

export default async function AdminFinance() {
  const f = await loadFinance();
  const who = (id: string) => f.who.get(id)?.email ?? id;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">Finance</h1>
        <p className="text-[12px] text-stone-500">All amounts in ₹. USD converted at ₹{f.rate.toFixed(2)}/$. Source of truth: <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener" className="underline">Razorpay dashboard</a>.</p>
      </div>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-finance">
        <Stat label="MRR" value={inrFmt(f.mrr)} sub={`ARR ${inrFmt(f.arr)}`} tone="good" />
        <Stat label="Active subscriptions" value={f.activeSubs} sub={`${f.monthlySubs} monthly · ${f.yearlySubs} yearly`} />
        <Stat label="Revenue (30 days)" value={inrFmt(f.revenue30)} sub={`7 days: ${inrFmt(f.revenue7)}`} />
        <Stat label="Revenue (all time)" value={inrFmt(f.revenueTotal)} sub={`${f.paymentsCount} payments`} />
        <Stat label="Cancelling at period end" value={f.endingSubs.length} tone={f.endingSubs.length ? "warn" : undefined} />
        <Stat label="Payment problems" value={f.troubleSubs.length} tone={f.troubleSubs.length ? "bad" : undefined} />
        <Stat label="Failed payments" value={f.failedCount} />
        <Stat label="Refunded" value={f.refundedCount} />
      </section>
      <section className="card p-5">
        <h2 className="mb-4 text-[16px] font-semibold">Revenue by month</h2>
        <Bars data={f.months.map((m) => ({ label: m.label, value: m.total }))} format={(n) => inrFmt(n)} />
        <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-stone-600">{f.byCurrency.map((c) => <span key={c.currency}>{c.currency}: <b className="text-ink">{money(c.total, c.currency)}</b> ({c.count} payments)</span>)}</div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-[16px] font-semibold">Upcoming renewals</h2>
          <ul className="divide-y divide-line text-[14px]">{f.renewals.map((s) => <li key={s.owner_id} className="flex justify-between gap-3 py-2"><Link href={`/admin/users/${s.owner_id}`} className="truncate hover:underline">{who(s.owner_id)}</Link><span className="shrink-0 text-stone-500">{s.billing_interval} · {s.amount && s.currency ? money(s.amount, s.currency) : "—"} · {fmtDate(s.current_end)}</span></li>)}{!f.renewals.length && <li className="py-2 text-stone-500">None yet.</li>}</ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-[16px] font-semibold">Needs attention</h2>
          <ul className="divide-y divide-line text-[14px]">
            {f.troubleSubs.map((s) => <li key={s.owner_id} className="flex justify-between gap-3 py-2"><Link href={`/admin/users/${s.owner_id}`} className="truncate hover:underline">{who(s.owner_id)}</Link><span className="shrink-0 text-red-700">payment {s.status}</span></li>)}
            {f.endingSubs.map((s) => <li key={`e${s.owner_id}`} className="flex justify-between gap-3 py-2"><Link href={`/admin/users/${s.owner_id}`} className="truncate hover:underline">{who(s.owner_id)}</Link><span className="shrink-0 text-amber-700">cancels {fmtDate(s.current_end)}</span></li>)}
            {!f.troubleSubs.length && !f.endingSubs.length && <li className="py-2 text-stone-500">All good.</li>}
          </ul>
        </section>
      </div>
      <section className="card overflow-x-auto p-5">
        <h2 className="mb-3 text-[16px] font-semibold">Payments</h2>
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="text-[12px] text-stone-500"><tr><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Customer</th><th className="py-2 text-right font-medium">Amount</th><th className="py-2 font-medium">Status</th><th className="py-2 font-medium">Method</th><th className="py-2 font-medium" /></tr></thead>
          <tbody>{f.payments.map((p) => (
            <tr key={p.id} className="border-t border-line/70">
              <td className="py-2">{fmtDate(p.paid_at, true)}</td>
              <td className="py-2"><Link href={`/admin/users/${p.owner_id}`} className="hover:underline">{p.who?.email ?? p.owner_id}</Link></td>
              <td className="py-2 text-right tabular-nums">{money(p.amount, p.currency)}</td>
              <td className="py-2">{p.status}</td>
              <td className="py-2 text-stone-500">{p.method ?? "—"}</td>
              <td className="py-2 text-right">{p.invoice_url ? <a href={p.invoice_url} target="_blank" rel="noopener" className="underline">Invoice</a> : <a href={`https://dashboard.razorpay.com/app/payments/${p.id}`} target="_blank" rel="noopener" className="underline">Razorpay</a>}</td>
            </tr>
          ))}{!f.payments.length && <tr><td colSpan={6} className="py-6 text-center text-stone-500">No payments yet.</td></tr>}</tbody>
        </table>
      </section>
    </div>
  );
}
