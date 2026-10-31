import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db, loadUrls, loadUsers } from "@/lib/admin/data";
import { UrlTable } from "../../websites/UrlTable";
import { usageFor } from "@/lib/billing/plan";
import { LIMIT_LABEL, type LimitKey } from "@/lib/billing/catalog";
import { ago, fmtDate } from "../../ui";
import { UserActions } from "./actions";

export const metadata = { title: "User" };

export default async function AdminUser({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const d = db();
  const [users, projects, memberships, usage, events, urls, blocks] = await Promise.all([
    loadUsers(),
    d.from("businesses").select("id, name, website, segment, city, created_at").eq("owner_id", params.id).order("created_at").then((r) => r.data ?? []),
    d.from("team_members").select("owner_id, role, status").eq("user_id", params.id).then((r) => r.data ?? []),
    usageFor(params.id, undefined, d),
    d.from("admin_events").select("*").eq("target_id", params.id).order("created_at", { ascending: false }).limit(20).then((r) => r.data ?? []),
    loadUrls(params.id, 300),
    d.from("email_blocks").select("email").eq("user_id", params.id).then((r) => (r.data ?? []) as { email: string }[], () => [] as { email: string }[]),
  ]);
  const u = users.find((x) => x.id === params.id);
  if (!u) notFound();
  const ownerEmail = (id: string) => users.find((x) => x.id === id)?.email ?? id;
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 border-b border-line/70 py-2 text-[14px] last:border-0"><span className="text-stone-500">{k}</span><span className="text-right">{v}</span></div>;
  return (
    <div className="grid gap-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Users</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">{u.name}</h1>
        {u.banned && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[12px] text-red-700">Deactivated</span>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-6">
          <section className="card p-5">
            <h2 className="mb-2 text-[16px] font-semibold">Account</h2>
            {row("Email", u.email)}
            {row("User ID", <code className="text-[12px]">{u.id}</code>)}
            {row("Signed up", fmtDate(u.createdAt, true))}
            {row("Last sign-in", `${fmtDate(u.lastSignIn, true)} (${ago(u.lastSignIn)})`)}
            {row("Last activity in app", u.lastActivity ? ago(u.lastActivity) : "—")}
            {row("Email confirmed", u.confirmed ? "Yes" : "No")}
            {row("Sign-in method", u.provider)}
            {row("Status", u.banned ? `Deactivated (until ${fmtDate(u.bannedUntil)})` : "Active")}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 text-[16px] font-semibold">Usage</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(LIMIT_LABEL) as LimitKey[]).map((k) => {
                return <div key={k} className="flex justify-between rounded-lg bg-mist/60 px-3 py-2 text-[13px]"><span>{LIMIT_LABEL[k].name}{LIMIT_LABEL[k].per === "month" ? " (month)" : ""}</span><span className="tabular-nums">{usage[k] ?? 0}</span></div>;
              })}
              <div className="flex justify-between rounded-lg bg-mist/60 px-3 py-2 text-[13px]"><span>Leads (all)</span><span className="tabular-nums">{u.leads}</span></div>
              <div className="flex justify-between rounded-lg bg-mist/60 px-3 py-2 text-[13px]"><span>Team members</span><span className="tabular-nums">{u.team}</span></div>
            </div>
          </section>
          <section className="card p-5">
            <h2 className="mb-2 text-[16px] font-semibold">Projects ({projects.length})</h2>
            <ul className="divide-y divide-line text-[14px]">{projects.map((p) => <li key={p.id} className="flex justify-between gap-3 py-2"><span><b className="font-medium">{p.name}</b> <span className="text-stone-500">· {p.segment}{p.city ? ` · ${p.city}` : ""}</span></span><span className="truncate text-stone-500">{p.website ?? ""}</span></li>)}{!projects.length && <li className="py-2 text-stone-500">No projects (didn&apos;t finish onboarding).</li>}</ul>
            {memberships.length > 0 && <p className="mt-3 text-[13px] text-stone-600">Also a teammate in: {memberships.map((m) => `${ownerEmail(m.owner_id)} (${m.role}, ${m.status})`).join(", ")}</p>}
          </section>
          <section className="grid gap-2" data-testid="user-websites">
            <h2 className="text-[16px] font-semibold">Websites added &amp; evaluated ({urls.length})</h2>
            <UrlTable rows={urls} showUser={false} />
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <UserActions id={u.id} banned={u.banned} confirmed={u.confirmed} emailsOff={blocks.map((b) => b.email)} accountEmail={u.email ?? ""} />
          <section className="card p-5">
            <h2 className="mb-2 text-[15px] font-semibold">Admin history</h2>
            <ul className="grid gap-1.5 text-[12px] text-stone-600">{events.filter((e) => !/^(plan|trial|billing|payment|sub)/.test(String(e.action))).map((e) => <li key={e.id}><b className="font-medium text-ink">{e.action}</b> · {fmtDate(e.created_at, true)}</li>)}{!events.length && <li>No admin changes yet.</li>}</ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
