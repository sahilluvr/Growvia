import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { LIMITS, LIMIT_LABEL, PLAN_INFO, PRICES, PAID_PLANS, PLAN_RANK, type LimitKey, type PaidPlan, type PlanId } from "@/lib/billing/catalog";

type PlanLike = { plan: PlanId; label: string; limits: Record<string, number | boolean> };

/** The cheapest plan above `p` that raises this limit. */
function betterPlan(p: PlanId, key: LimitKey): PaidPlan | null {
  const cur = LIMITS[p][key] as number;
  return PAID_PLANS.find((t) => PLAN_RANK[t] > PLAN_RANK[p] && (LIMITS[t][key] as number) > cur) ?? null;
}

/**
 * Usage warning shown on the dashboard and billing page:
 * 80%+ of a limit → a gentle heads-up; 100% → an upgrade card naming the next plan (or "talk to us" at the top).
 */
export function UsageNudge({ plan, usage, here = false }: { plan: PlanLike; usage: Partial<Record<LimitKey, number>>; here?: boolean }) {
  const rows = (Object.keys(LIMIT_LABEL) as LimitKey[])
    .map((k) => ({ k, used: usage[k] ?? 0, lim: plan.limits[k] as number }))
    // On the dashboard, skip "1 of 1" allowances (Free's single project/mailbox/form): that's normal use, not a warning —
    // the upgrade message appears when someone actually tries to add another.
    .filter((r) => Number.isFinite(r.lim) && r.lim > 0 && r.used / r.lim >= 0.8 && (here || r.lim > 1))
    .sort((a, b) => b.used / b.lim - a.used / a.lim);
  if (!rows.length) return null;
  const top = rows[0];
  const full = top.used >= top.lim;
  const L = LIMIT_LABEL[top.k];
  const next = betterPlan(plan.plan, top.k);
  const what = `${top.used.toLocaleString()} of ${top.lim.toLocaleString()} ${L.unit}${L.per === "month" ? " this month" : ""}`;
  const others = rows.slice(1).map((r) => LIMIT_LABEL[r.k].name.toLowerCase());
  const href = next ? (here ? `?plan=${next}#upgrade` : `/app/billing?plan=${next}#upgrade`) : "/contact";
  const cta = next ? `Upgrade to ${PLAN_INFO[next].name} — $${PRICES[next].month}/mo` : "Talk to us about custom limits";
  const gain = next ? `${PLAN_INFO[next].name} gives you ${(LIMITS[next][top.k] as number).toLocaleString()} ${L.unit}${L.per === "month" ? " a month" : ""} and starts instantly.` : "You're on our biggest plan — we can set up custom limits for you.";
  return full ? (
    <div role="alert" data-testid="usage-full" className="grid gap-2 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-[14px] text-red-900">
      <p className="flex items-start gap-2 font-medium"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> You&apos;ve reached your {plan.label} limit: {what}.</p>
      <p className="text-[13px] text-red-900/80">{gain}{others.length ? ` Also close to the limit: ${others.join(", ")}.` : ""} Nothing is deleted — you just can&apos;t add more until you upgrade{L.per === "month" ? " or the month resets" : ""}.</p>
      <Link href={href} className="btn-primary h-10 w-fit px-4 text-[14px]">{cta} <ArrowUpRight className="h-4 w-4" /></Link>
    </div>
  ) : (
    <div role="status" data-testid="usage-warn" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">Heads up: you&apos;ve used {what} ({Math.round((top.used / top.lim) * 100)}%).{others.length ? ` Also close: ${others.join(", ")}.` : ""}</span>
      <Link href={href} className="font-medium underline underline-offset-4">{next ? `See ${PLAN_INFO[next].name}` : "Talk to us"}</Link>
    </div>
  );
}
