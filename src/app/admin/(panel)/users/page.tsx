import Link from "next/link";
import { loadUsers, inrFmt } from "@/lib/admin/data";
import { PlanBadge, ago, fmtDate } from "../ui";

export const metadata = { title: "Users" };

const FILTERS = [["all", "All"], ["paid", "Paying"], ["trial", "Trial"], ["free", "Free"], ["comp", "Complimentary"], ["banned", "Deactivated"], ["unconfirmed", "Unconfirmed"], ["inactive", "Inactive 30d+"]] as const;

export default async function AdminUsers({ searchParams }: { searchParams: { q?: string; f?: string; sort?: string } }) {
  const all = await loadUsers();
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const f = searchParams.f ?? "all";
  const now = Date.now();
  let list = all.filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q));
  list = list.filter((u) =>
    f === "all" ? true : f === "banned" ? u.banned : f === "unconfirmed" ? !u.confirmed : f === "inactive" ? !u.lastSignIn || now - Date.parse(u.lastSignIn) > 30 * 86400_000 : f === "comp" ? u.plan.source === "comp" || u.plan.source === "agency" : u.plan.source === f);
  if (searchParams.sort === "active") list.sort((a, b) => String(b.lastSignIn ?? "").localeCompare(String(a.lastSignIn ?? "")));
  if (searchParams.sort === "paid") list.sort((a, b) => b.paid - a.paid);
  if (searchParams.sort === "leads") list.sort((a, b) => b.leads - a.leads);
  const link = (patch: Record<string, string>) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), f, ...(searchParams.sort ? { sort: searchParams.sort } : {}), ...patch })}`;
  const csv = `data:text/csv;charset=utf-8,${encodeURIComponent(["name,email,signed_up,last_sign_in,plan,projects,leads,team,paid_inr,status", ...list.map((u) => [u.name, u.email, u.createdAt, u.lastSignIn ?? "", u.plan.label, u.projects, u.leads, u.team, (u.paid / 100).toFixed(0), u.banned ? "deactivated" : "active"].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"))}`;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">Users <span className="text-stone-400">({list.length})</span></h1>
        <a href={csv} download="growvia-users.csv" className="btn-ghost h-9 px-3 text-[13px]">Export CSV</a>
      </div>
      <form className="flex flex-wrap gap-2" action="/admin/users">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="h-10 w-full max-w-sm rounded-xl border border-line bg-white px-3 text-[14px]" aria-label="Search users" />
        <input type="hidden" name="f" value={f} />
        <button className="btn-primary h-10 px-4 text-[14px]">Search</button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, l]) => <Link key={k} href={link({ f: k })} className={`rounded-full border px-3 py-1 text-[13px] ${f === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{l}</Link>)}
        <span className="mx-1 self-center text-stone-300">|</span>
        {[["", "Newest"], ["active", "Last active"], ["paid", "Most paid"], ["leads", "Most leads"]].map(([k, l]) => <Link key={k} href={link({ sort: k })} className={`rounded-full px-3 py-1 text-[13px] ${(searchParams.sort ?? "") === k ? "bg-mist font-medium" : "text-stone-500"}`}>{l}</Link>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[13px]" data-testid="admin-users">
          <thead className="border-b border-line bg-mist/60 text-[12px] text-stone-500"><tr>
            <th className="px-4 py-2.5 font-medium">User</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Plan</th>
            <th className="px-3 py-2.5 font-medium">Signed up</th><th className="px-3 py-2.5 font-medium">Last sign-in</th>
            <th className="px-3 py-2.5 text-right font-medium">Projects</th><th className="px-3 py-2.5 text-right font-medium">Leads</th><th className="px-3 py-2.5 text-right font-medium">Team</th><th className="px-3 py-2.5 text-right font-medium">Paid</th>
          </tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-b border-line/70 last:border-0 hover:bg-mist/40">
                <td className="px-4 py-2.5"><Link href={`/admin/users/${u.id}`} className="block hover:underline"><b className="font-medium">{u.name}</b><span className="block text-stone-500">{u.email}</span></Link></td>
                <td className="px-3 py-2.5">{u.banned ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">Deactivated</span> : !u.confirmed ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Unconfirmed</span> : <span className="rounded-full bg-lime/20 px-2 py-0.5 text-lime-800">Active</span>}</td>
                <td className="px-3 py-2.5"><PlanBadge label={u.plan.label} source={u.plan.source} />{u.plan.source === "trial" && <span className="block text-[11px] text-stone-400">{u.plan.trialDaysLeft}d left</span>}</td>
                <td className="px-3 py-2.5 text-stone-600">{fmtDate(u.createdAt)}</td>
                <td className="px-3 py-2.5 text-stone-600">{ago(u.lastSignIn)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{u.projects}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{u.leads}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{u.team}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{u.paid ? inrFmt(u.paid) : "—"}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-500">No users match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
