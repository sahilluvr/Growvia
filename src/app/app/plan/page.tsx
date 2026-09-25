import type { Metadata } from "next";
import { RefreshCw, Users, Zap, CalendarDays, Radio, Plus } from "lucide-react";
import { early, repo, requireBusiness } from "@/lib/data";
import { PageHeader } from "@/components/app/PageHeader";
import { ActionButton } from "@/components/app/bits";
import { createCampaignAction, regeneratePlanAction } from "@/app/actions";

export const metadata: Metadata = { title: "Growth plan" };

export default async function PlanPage() {
  const campaignsP = early(repo().listCampaigns());
  const { business } = await requireBusiness();
  const plan = business.plan!;
  const campaigns = await campaignsP;
  const used = new Set(campaigns.map((c) => c.name));

  return (
    <>
      <PageHeader title="Growth plan" sub={`Built ${new Date(plan.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })} · updates as your business details change`}>
        <ActionButton action={regeneratePlanAction} className="btn-ghost h-10 px-4 text-[14px]"><RefreshCw className="h-4 w-4" /> Refresh plan</ActionButton>
      </PageHeader>

      <section className="rounded-2xl bg-ink p-6 text-white sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">Strategy in one sentence</p>
        <p className="mt-3 max-w-3xl text-[20px] leading-snug tracking-tight sm:text-[24px]">{plan.summary}</p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"><Users className="h-4 w-4 text-lime-700" /> Who we&apos;re reaching</h2>
          <ul className="mt-4 grid gap-2.5">
            {plan.customers.map((c) => (
              <li key={c} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-500" /> {c}</li>
            ))}
          </ul>
          <h2 className="mt-8 flex items-center gap-2 text-[16px] font-semibold tracking-tight"><Radio className="h-4 w-4 text-lime-700" /> Channels</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plan.channels.map((c) => <span key={c} className="rounded-full bg-mist px-3 py-1 text-[13px] text-stone-600">{c}</span>)}
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"><Zap className="h-4 w-4 text-lime-700" /> Growth opportunities</h2>
          <ol className="mt-4 grid gap-2">
            {plan.opportunities.map((o, i) => (
              <li key={o.id} className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <span className="font-mono text-[13px] text-lime-700">0{i + 1}</span>
                  <div>
                    <div className="text-[15px] font-medium">{o.title}</div>
                    <div className="text-[13px] text-stone-500">{o.why}</div>
                  </div>
                </div>
                {used.has(o.title) ? (
                  <span className="shrink-0 self-start rounded-full bg-lime/25 px-3 py-1 text-[12px] font-medium text-lime-800 sm:self-center">Campaign created</span>
                ) : (
                  <ActionButton action={createCampaignAction.bind(null, o.id)} className="btn-primary h-9 shrink-0 self-start px-3.5 text-[13px] sm:self-center"><Plus className="h-3.5 w-3.5" /> Create campaign</ActionButton>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card mt-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"><CalendarDays className="h-4 w-4 text-lime-700" /> Your first 30 days</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {plan.roadmap.map((m) => (
            <li key={m.day} className="rounded-xl border border-line bg-paper p-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-stone-400">Day {m.day}</div>
              <div className="mt-1 text-[15px]">{m.text}</div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
