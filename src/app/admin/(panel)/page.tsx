import Link from "next/link";
import { loadUsers } from "@/lib/admin/data";
import { Bars, Stat, ago } from "./ui";
import { db } from "@/lib/admin/data";
import { indexNowStatus } from "@/lib/seo/indexnow";
import { SendIndexNow } from "./SearchEngines";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const [users, inx] = await Promise.all([loadUsers(), indexNowStatus(db()).catch(() => null)]);
  const day = 86400_000, now = Date.now();
  const within = (s: string | null, ms: number) => Boolean(s && now - Date.parse(s) <= ms);
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
        <Stat label="Projects created" value={users.reduce((n, u) => n + u.projects, 0)} />
        <Stat label="Leads in Growvia" value={users.reduce((n, u) => n + u.leads, 0)} />
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
                <span className="w-24 shrink-0 text-right text-[12px] text-stone-500">{ago(u.createdAt)}</span>
              </li>
            ))}
            {!users.length && <li className="py-4 text-stone-500">No users yet.</li>}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-[16px] font-semibold">Most active (last sign-in)</h2>
          <ul className="divide-y divide-line text-[14px]">
            {[...users].filter((u) => u.lastSignIn).sort((a, b) => String(b.lastSignIn).localeCompare(String(a.lastSignIn))).slice(0, 10).map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 truncate hover:underline"><b className="font-medium">{u.name}</b> <span className="text-stone-500">· {u.projects} project{u.projects === 1 ? "" : "s"}</span></Link>
                <span className="w-24 shrink-0 text-right text-[12px] text-stone-500">{ago(u.lastSignIn)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
