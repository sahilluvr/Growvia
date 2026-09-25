import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Sparkles, Users, Trophy, Wallet, Send } from "lucide-react";
import { early, repo, requireBusiness, siteOrigin } from "@/lib/data";
import { PageHeader } from "@/components/app/PageHeader";
import { CopyButton } from "@/components/app/bits";
import { money, timeAgo } from "@/lib/format";
import { Priorities } from "./Priorities";

export const metadata: Metadata = { title: "Overview" };

const DAY = 86400000;

export default async function Dashboard({ searchParams }: { searchParams: { welcome?: string; toast?: string } }) {
  const r0 = repo();
  const data = early(Promise.all([r0.listLeads(), r0.listContent(), r0.listCampaigns(), r0.listActivity(12)]));
  const { user, business } = await requireBusiness();
  const [leads, content, campaigns, activity] = await data;
  const plan = business.plan!;
  const now = Date.now();
  const thisWeek = leads.filter((l) => now - +new Date(l.created_at) < 7 * DAY).length;
  const lastWeek = leads.filter((l) => { const a = now - +new Date(l.created_at); return a >= 7 * DAY && a < 14 * DAY; }).length;
  const won = leads.filter((l) => l.stage === "won");
  const pipeline = leads.filter((l) => !["won", "lost"].includes(l.stage)).reduce((s, l) => s + l.value, 0);
  const posted = content.filter((c) => c.status === "published").length;
  const scheduled = content.filter((c) => c.status === "scheduled").length;
  const toReview = content.filter((c) => c.status === "draft").length;
  const formUrl = `${siteOrigin()}/f/${business.id}`;

  // Leads per day for the last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (13 - i));
    const end = +start + DAY;
    return { label: start.toLocaleDateString("en-US", { weekday: "narrow" }), n: leads.filter((l) => { const t = +new Date(l.created_at); return t >= +start && t < end; }).length };
  });
  const maxN = Math.max(1, ...days.map((d) => d.n));
  const delta = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  const kpis = [
    { label: "New leads · 7 days", value: String(thisWeek), sub: delta === null ? (thisWeek ? "First week" : "Share your lead form") : `${delta >= 0 ? "+" : ""}${delta}% vs last week`, icon: Users },
    { label: "Customers won", value: String(won.length), sub: won.length ? `${money(won.reduce((s, l) => s + l.value, 0))} revenue` : "Move leads to Won", icon: Trophy },
    { label: "Open pipeline", value: money(pipeline), sub: `${leads.filter((l) => !["won", "lost"].includes(l.stage)).length} open leads`, icon: Wallet },
    { label: "Content live", value: String(posted), sub: `${scheduled} scheduled · ${toReview} to review`, icon: Send },
  ];

  return (
    <>
      {searchParams.welcome && (
        <div className="mb-6 flex flex-col gap-4 overflow-hidden rounded-2xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-lime"><Sparkles className="h-3.5 w-3.5" /> Your growth engine is live</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">Welcome, {user.name.split(" ")[0]}. Your plan and first campaign are ready.</p>
            <p className="mt-1 text-[14px] text-white/60">Start by reviewing the content your Creator drafted — approve it, then schedule or post it.</p>
          </div>
          <Link href={campaigns[0] ? `/app/campaigns/${campaigns[0].id}` : "/app/campaigns"} className="btn-lime shrink-0">Review first campaign <ArrowRight className="h-4 w-4" /></Link>
        </div>
      )}
      {searchParams.toast === "password" && <p className="mb-6 rounded-xl border border-lime-500/40 bg-lime/15 px-4 py-3 text-[14px] text-lime-800">Your password was updated.</p>}

      <PageHeader title={`Good to see you, ${user.name.split(" ")[0]}`} sub={plan.summary}>
        <Link href="/app/plan" className="btn-ghost h-10 px-4 text-[14px]">View growth plan</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, sub, icon: I }) => (
          <div key={label} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between text-[12px] text-stone-500 sm:text-[13px]"><span>{label}</span><I className="h-4 w-4 text-stone-400" /></div>
            <div className="mt-2 text-[26px] font-semibold tracking-tight tabular-nums sm:text-[30px]">{value}</div>
            <div className="mt-0.5 text-[12px] text-stone-500">{sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight">Leads, last 14 days</h2>
            <Link href="/app/leads" className="inline-flex items-center gap-1 text-[13px] text-stone-500 hover:text-ink">All leads <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-6 flex h-40 items-end gap-1.5" role="img" aria-label={`Leads per day: ${days.map((d) => d.n).join(", ")}`}>
            {days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-[132px] w-full items-end">
                  <div className={`w-full rounded-t-md ${d.n ? (i === 13 ? "bg-lime-500" : "bg-ink") : "bg-mist"}`} style={{ height: d.n ? Math.max(10, Math.round((d.n / maxN) * 132)) : 4 }} title={`${d.n} lead${d.n === 1 ? "" : "s"}`} />
                </div>
                <span className="text-[10px] text-stone-400">{d.n ? <b className="block text-center font-medium text-ink">{d.n}</b> : null}{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[14px] font-medium">Your lead form</div>
              <div className="truncate font-mono text-[12px] text-stone-500">{formUrl}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              <CopyButton text={formUrl} label="Copy link" />
              <a href={`/f/${business.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-stone-600 hover:border-ink hover:text-ink">Open <ArrowUpRight className="h-3.5 w-3.5" /></a>
            </div>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-[16px] font-semibold tracking-tight">This week&apos;s priorities</h2>
          <Priorities items={plan.priorities} />
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight">Campaigns</h2>
            <Link href="/app/campaigns" className="text-[13px] text-stone-500 hover:text-ink">Manage</Link>
          </div>
          <ul className="grid gap-2">
            {campaigns.slice(0, 4).map((c) => {
              const total = Object.values(c.counts).reduce((a, b) => a + b, 0);
              const live = c.counts.published + c.counts.scheduled;
              return (
                <li key={c.id}>
                  <Link href={`/app/campaigns/${c.id}`} className="block rounded-xl border border-line p-3 transition-colors hover:border-ink">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-medium">{c.name}</span>
                      <span className="shrink-0 text-[12px] capitalize text-stone-500">{c.status}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-lime-500" style={{ width: `${total ? (live / total) * 100 : 0}%` }} /></div>
                    <div className="mt-1.5 text-[12px] text-stone-500">{live}/{total} pieces scheduled or posted</div>
                  </Link>
                </li>
              );
            })}
            {!campaigns.length && <li className="text-[14px] text-stone-500">No campaigns yet. <Link href="/app/plan" className="text-ink underline">Start one from your plan</Link>.</li>}
          </ul>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-[16px] font-semibold tracking-tight">AI team activity</h2>
          <ul className="grid gap-1">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-lg px-1 py-2">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-[11px] font-semibold text-lime">{a.agent.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug">{a.text}</p>
                  <p className="mt-0.5 text-[12px] text-stone-400">{a.agent} · {timeAgo(a.created_at)}</p>
                </div>
                {a.tag && <span className="shrink-0 rounded-full bg-mist px-2 py-0.5 text-[11px] capitalize text-stone-600">{a.tag}</span>}
              </li>
            ))}
            {!activity.length && <li className="text-[14px] text-stone-500">Nothing yet — your team will log its work here.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
