import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, CheckCircle2, CircleDashed, Sparkles, Users, Trophy, Wallet, Send, Zap } from "lucide-react";
import { supabaseServer } from "@/lib/data/supabase";
import { growthSnapshot } from "@/lib/growth";
import { ScoreParts, ScoreRing } from "@/components/app/GrowthUI";
import { early, repo, requireBusiness, siteOrigin } from "@/lib/data";
import { CopyButton } from "@/components/app/bits";
import { currencyForCity, money, timeAgo } from "@/lib/format";
import { Priorities } from "./Priorities";
import { Suspense } from "react";
import { UsageNudgeFor } from "@/components/app/UsageNudgeFor";

export const metadata: Metadata = { title: "Home" };

const DAY = 86400000;

export default async function Dashboard({ searchParams }: { searchParams: { welcome?: string; toast?: string } }) {
  const r0 = repo();
  const data = early(Promise.all([r0.listLeads(), r0.listContent(), r0.listCampaigns(), r0.listActivity(12)]));
  const { user, business } = await requireBusiness();
  const [[leads, content, campaigns, activity], snap] = await Promise.all([data, growthSnapshot(supabaseServer(), business as never)]);
  const plan = business.plan!;
  const cur = currencyForCity(business.city);
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
    { label: "Customers won", value: String(won.length), sub: won.length ? `${money(won.reduce((s, l) => s + l.value, 0), cur)} revenue` : "Move leads to Won", icon: Trophy },
    { label: "Open pipeline", value: money(pipeline, cur), sub: `${leads.filter((l) => !["won", "lost"].includes(l.stage)).length} open leads`, icon: Wallet },
    { label: "Content live", value: String(posted), sub: `${scheduled} scheduled · ${toReview} to review`, icon: Send },
  ];

  const hasNumbers = leads.length > 0 || posted > 0 || scheduled > 0;
  const nextSetup = snap.setup.filter((x) => !x.done);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      {searchParams.toast === "password" && <p className="mb-6 rounded-xl border border-lime-500/40 bg-lime/15 px-4 py-3 text-[14px] text-lime-800">Your password was updated.</p>}
      <Suspense fallback={null}><UsageNudgeFor ownerId={business.owner_id} /></Suspense>

      {/* Growth Score hero */}
      <section className="gv-aurora rounded-3xl border border-line p-5 sm:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
          <div className="mx-auto"><ScoreRing score={snap.score} size={164} pending={snap.analysing} /></div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500"><Sparkles className="h-3.5 w-3.5 text-lime-700" /> {business.name}</p>
            <h1 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">{hello}, {user.name.split(" ")[0]}.{" "}
              <span className="text-stone-500">{snap.score == null ? (snap.analysing ? "Growvia AI is analysing your business…" : snap.hasWebsite ? "Run your first report to get your Growth Score." : "Add your website to get your Growth Score.") : snap.score >= 75 ? "You're ahead — keep the momentum." : snap.score >= 50 ? "Good progress — a few fixes will lift you." : "Let's fix the basics first."}</span>
            </h1>
            <div className="mt-4"><ScoreParts parts={snap.parts} analysing={snap.analysing} /></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/app/report" className="btn-primary h-10 px-4 text-[14px]">{snap.analysing ? <><span className="relative mr-1 flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-lime" /></span> Watch live analysis</> : <>Open Growth Report <ArrowRight className="h-4 w-4 text-lime" /></>}</Link>
              <Link href="/app/plan" className="btn-ghost h-10 px-4 text-[14px]">Growth plan</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* Next best actions */}
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"><Zap className="h-4 w-4 text-lime-700" /> Your next best actions</h2>
          <ol className="mt-4 grid gap-2.5">
            {snap.actions.map((x, i) => (
              <li key={x.id} className="group flex items-start gap-3 rounded-xl border border-line p-3.5 transition hover:border-ink">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${x.tone === "urgent" ? "bg-red-50 text-red-700" : x.tone === "win" ? "bg-lime text-ink" : "bg-mist text-stone-600"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug">{x.title}</p>
                  <p className="mt-0.5 text-[13px] text-stone-600">{x.why}</p>
                </div>
                <Link href={x.href} className="btn-ghost h-8 shrink-0 px-3 text-[12px]">{x.cta}</Link>
              </li>
            ))}
            {!snap.actions.length && <li className="text-[14px] text-stone-500">You&apos;re all caught up. New ideas appear here as your data grows.</li>}
          </ol>
        </section>

        {/* Setup progress */}
        <section className="card p-5 sm:p-6" id="setup">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight">Set up Growvia</h2>
            <span className="text-[13px] tabular-nums text-stone-500">{snap.setupDone} of {snap.setup.length}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-gradient-to-r from-lime-500 via-sky-400 to-violet-400 transition-all" style={{ width: `${(snap.setupDone / snap.setup.length) * 100}%` }} /></div>
          <ul className="mt-4 grid gap-1.5">
            {nextSetup.slice(0, 4).map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                <CircleDashed className="h-4 w-4 shrink-0 text-stone-400" />
                <span className="min-w-0 flex-1"><span className="block text-[14px]">{x.label}</span><span className="block text-[12px] text-stone-500">{x.hint}</span></span>
                <Link href={x.href} className="shrink-0 text-[13px] font-medium text-ink hover:underline">{x.cta}</Link>
              </li>
            ))}
            {snap.setup.filter((x) => x.done).length > 0 && <li className="flex items-center gap-2 px-1 pt-1 text-[12px] text-stone-500"><CheckCircle2 className="h-3.5 w-3.5 text-lime-700" /> Done: {snap.setup.filter((x) => x.done).map((x) => x.label.replace(/^(Add|Get|Connect|Put|Track) (your |a |the )?/i, "")).join(" · ")}</li>}
            {!nextSetup.length && <li className="text-[14px] text-lime-800">Everything is connected — nice work.</li>}
          </ul>
          {nextSetup.length > 0 && <Link href="/app/integrations" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">Open Connect tools <ArrowRight className="h-3.5 w-3.5" /></Link>}
        </section>
      </div>

      {hasNumbers && (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: I }) => (
            <div key={label} className="card p-4 sm:p-5">
              <div className="flex items-center justify-between text-[12px] text-stone-500 sm:text-[13px]"><span>{label}</span><I className="h-4 w-4 text-stone-400" /></div>
              <div className="mt-2 text-[26px] font-semibold tracking-tight tabular-nums sm:text-[30px]">{value}</div>
              <div className="mt-0.5 text-[12px] text-stone-500">{sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight">Leads, last 14 days</h2>
            <Link href="/app/leads" className="inline-flex items-center gap-1 text-[13px] text-stone-500 hover:text-ink">All leads <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
          {leads.length > 0 ? (
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
          ) : <p className="mt-3 text-[14px] text-stone-600">No leads yet. Share your lead form or put it on your website — every enquiry will show up here.</p>}
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
