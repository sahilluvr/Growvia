import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/server/admin";
import { supabaseServer } from "@/lib/data/supabase";
import { COMP_EMAILS, LIMITS, LIMIT_LABEL, PLAN_INFO, PRICES, isPaidPlan, nextPlan, type LimitKey, type Limits, type PlanId } from "./config";

export type SubRow = {
  owner_id: string; plan: PlanId; status: string; billing_interval: "month" | "year" | null; currency: string | null; amount: number | null;
  rzp_subscription_id: string | null; payment_method: string | null; short_url: string | null; current_start: string | null; current_end: string | null;
  cancel_at_period_end: boolean; cancelled_at: string | null; trial_end: string | null; replaces: string | null; updated_at: string; provider?: string | null;
  scheduled_change: { interval: "month" | "year"; at: string; amount?: number; currency?: string; plan?: PlanId } | null;
  comp_until?: string | null; admin_note?: string | null;
};
export type PlanState = {
  plan: PlanId; pro: boolean; label: string; source: "paid" | "trial" | "comp" | "agency" | "free";
  limits: Limits; sub: SubRow | null; trialEnd: string | null; trialDaysLeft: number;
  renewsAt: string | null; endsAt: string | null; paymentIssue: boolean;
};

const PAID_OK = ["active", "authenticated", "pending"];

/** Works out the plan from the subscription row. Pure (no I/O) so it's easy to test and fast. */
export function resolvePlan(sub: SubRow | null, ownerEmail: string | null, now = Date.now()): PlanState {
  const t = (s: string | null) => (s ? Date.parse(s) : 0);
  const trialLeftMs = sub?.trial_end ? t(sub.trial_end) - now : 0;
  const base = { sub, trialEnd: sub?.trial_end ?? null, trialDaysLeft: Math.max(0, Math.ceil(trialLeftMs / 86400_000)), renewsAt: null, endsAt: null, paymentIssue: false };
  if (ownerEmail && COMP_EMAILS.includes(ownerEmail.toLowerCase())) return { ...base, plan: "pro", pro: true, label: "Pro (complimentary)", source: "comp", limits: LIMITS.pro };
  // Pro given by the admin (no payment), optionally until a date.
  if (sub?.status === "comp" && isPaidPlan(sub.plan) && (!sub.comp_until || t(sub.comp_until) > now)) {
    return { ...base, plan: sub.plan, pro: true, label: `${PLAN_INFO[sub.plan].name} (complimentary)`, source: "comp", limits: LIMITS[sub.plan], endsAt: sub.comp_until ?? null };
  }
  // A custom Agency deal set up by hand (no Razorpay subscription).
  if (sub?.plan === "agency" && !sub.rzp_subscription_id && sub.status !== "cancelled" && sub.status !== "comp") return { ...base, plan: "agency", pro: true, label: "Agency", source: "agency", limits: LIMITS.agency };
  if (sub && isPaidPlan(sub.plan) && sub.rzp_subscription_id) {
    const end = t(sub.current_end);
    const live = PAID_OK.includes(sub.status) || (["cancelled", "completed", "halted", "paused", "prepaid"].includes(sub.status) && end > now);
    if (live) {
      // A scheduled move to a cheaper plan whose date has passed (in case the webhook hasn't arrived yet).
      const sc = sub.scheduled_change;
      const tier = sc?.plan && isPaidPlan(sc.plan) && t(sc.at) <= now && !sub.cancel_at_period_end && sub.status !== "cancelled" ? sc.plan : sub.plan;
      const ending = sub.cancel_at_period_end || sub.status !== "active" && sub.status !== "authenticated" && sub.status !== "pending";
      return {
        ...base, plan: tier, pro: true, label: PLAN_INFO[tier].name, source: "paid", limits: LIMITS[tier],
        renewsAt: !ending ? sub.current_end ?? (sub.status === "authenticated" ? sub.trial_end : null) : null,
        endsAt: ending ? sub.current_end : null, paymentIssue: sub.status === "pending" || sub.status === "halted",
      };
    }
  }
  if (trialLeftMs > 0) return { ...base, plan: "pro", pro: true, label: "Pro trial", source: "trial", limits: LIMITS.pro };
  return { ...base, plan: "free", pro: false, label: "Free", source: "free", limits: LIMITS.free };
}

/** Clears cached plan state after a change (checkout, cancel, webhook). */
export const bustPlan = (ownerId: string) => { emailMemo.delete(ownerId); };

// One lookup per request (React cache), never stale across requests — a payment shows up on the very next page.
async function readPlan(ownerId: string): Promise<PlanState> {
  const db = adminClient() ?? supabaseServer();
  const [s, p] = await Promise.all([
    db.from("subscriptions").select("*").eq("owner_id", ownerId).maybeSingle(),
    COMP_EMAILS.length ? db.from("profiles").select("email").eq("id", ownerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const v = resolvePlan((s.data as SubRow | null) ?? null, (p.data as { email?: string } | null)?.email ?? null);
  // Database not updated yet (no subscriptions table): don't lock anyone out — treat as Pro until it is.
  if (s.error && /subscriptions/.test(s.error.message)) return { ...v, plan: "pro", pro: true, label: "Pro", source: "comp", limits: LIMITS.pro };
  return v;
}
const loadPlan = cache(readPlan);
/** Always reads the database (billing actions that change the plan). */
export const freshPlan = (ownerId: string) => readPlan(ownerId);

/** The plan of the project's owner in a single call (no need to know the owner first). null if the database function isn't there yet. */
export const planForProject = cache(async (projectId: string): Promise<PlanState | null> => {
  const { data, error } = await supabaseServer().rpc("project_plan", { pid: projectId });
  if (error || !data) return null;
  const d = data as { sub: SubRow | null; email: string | null };
  return resolvePlan(d.sub ?? null, d.email ?? null);
});

/** The account's plan: one indexed lookup. */
export async function planFor(ownerId: string, _db?: SupabaseClient): Promise<PlanState> { // eslint-disable-line @typescript-eslint/no-unused-vars
  return loadPlan(ownerId);
}

export const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
const nextMonth = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); };

/** How much of each metered thing the account has used (totals, or this calendar month). */
export async function usageFor(ownerId: string, keys: LimitKey[] = ["projects", "mailboxes", "keywords", "geoPrompts", "videos", "emails", "forms", "posts"], dbIn?: SupabaseClient): Promise<Partial<Record<LimitKey, number>>> {
  const db = adminClient() ?? dbIn ?? supabaseServer();
  const m = monthStart();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const q: Record<LimitKey, () => Promise<number>> = {
    projects: () => count(db.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", ownerId)),
    mailboxes: () => count(db.from("mailboxes").select("id", { count: "exact", head: true }).eq("owner_id", ownerId)),
    keywords: () => count(db.from("seo_keywords").select("id", { count: "exact", head: true }).eq("owner_id", ownerId)),
    geoPrompts: () => count(db.from("geo_prompts").select("id", { count: "exact", head: true }).eq("owner_id", ownerId)),
    videos: () => count(db.from("usage_events").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("kind", "video").gte("created_at", m)),
    emails: () => count(db.from("messages").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("direction", "out").neq("status", "failed").gte("created_at", m)),
    forms: () => count(db.from("lead_forms").select("id", { count: "exact", head: true }).eq("owner_id", ownerId)),
    posts: () => count(db.from("social_posts").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).not("scheduled_at", "is", null).in("status", ["scheduled", "publishing", "published", "partial"]).gte("created_at", m)),
  };
  const vals = await Promise.all(keys.map((k) => q[k]().catch(() => 0)));
  return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
}

const n = (x: number) => (Number.isFinite(x) ? x.toLocaleString("en-US") : "unlimited");

/** The upgrade message for a limit (used everywhere so the wording is consistent). */
export function limitMessage(key: LimitKey, plan: PlanState, used: number) {
  const L = LIMIT_LABEL[key], lim = plan.limits[key];
  const when = L.per === "month" ? ` this month (resets ${nextMonth().toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : "";
  const unit = lim === 1 ? L.unit.replace(/s$/, "") : L.unit;
  const head = plan.plan === "free"
    ? `Your Free plan includes ${n(lim)} ${unit}${L.per === "month" ? " a month" : ""} — you've used ${n(used)}${when}.`
    : `You've used all ${n(lim)} ${L.unit} in ${PLAN_INFO[plan.plan].name}${when}.`;
  return `${head} ${upgradeHint(plan.plan, key)}`;
}

/** "Growth gives you 25 projects for $45/month — it starts instantly." (or how to get more at the top). */
export function upgradeHint(current: PlanId, key: LimitKey | "competitors") {
  // Skip plans that don't raise this limit.
  let next = nextPlan(current);
  while (next && LIMITS[next][key] <= LIMITS[current][key]) next = nextPlan(next);
  if (!next) return "Need more? Contact us for custom limits.";
  const v = LIMITS[next][key], label = key === "competitors" ? "competitors per project" : LIMIT_LABEL[key].unit;
  return `Upgrade to ${PLAN_INFO[next].name} for ${Number.isFinite(v) ? n(v) : "unlimited"} ${label}${key !== "competitors" && LIMIT_LABEL[key].per === "month" ? " a month" : ""} — $${PRICES[next].month}/month, starts instantly.`;
}

export type Gate = { ok: true; plan: PlanState; used: number; left: number } | { ok: false; plan: PlanState; used: number; error: string };

/** Checks one metered limit before adding `adding` more. */
export async function checkLimit(ownerId: string, key: LimitKey, adding = 1, db?: SupabaseClient): Promise<Gate> {
  const plan = await planFor(ownerId, db);
  const lim = plan.limits[key];
  if (!Number.isFinite(lim)) return { ok: true, plan, used: 0, left: Infinity };
  const used = (await usageFor(ownerId, [key], db))[key] ?? 0;
  if (used + adding > lim) return { ok: false, plan, used, error: limitMessage(key, plan, used) };
  return { ok: true, plan, used, left: lim - used };
}

/** Records a metered action that has no row of its own (video exports). */
export async function recordUsage(ownerId: string, kind: "video", ref?: string, dbIn?: SupabaseClient) {
  const db = adminClient() ?? dbIn ?? supabaseServer();
  await db.from("usage_events").insert({ owner_id: ownerId, kind, ref: ref ?? null });
}

/* Monthly email allowance — counted once, then kept in memory for a minute while a batch sends. */
const emailMemo = new Map<string, { at: number; used: number; limit: number; plan: PlanState }>();
export async function emailAllowance(ownerId: string, db?: SupabaseClient) {
  const m = emailMemo.get(ownerId);
  if (m && Date.now() - m.at < 60_000) return { left: m.limit - m.used, ...m };
  const plan = await planFor(ownerId, db);
  const used = Number.isFinite(plan.limits.emails) ? (await usageFor(ownerId, ["emails"], db)).emails ?? 0 : 0;
  const v = { at: Date.now(), used, limit: plan.limits.emails, plan };
  emailMemo.set(ownerId, v);
  return { left: v.limit - used, ...v };
}
/** Counts one email against the allowance. Returns an error message when the month's allowance is used up. */
export async function takeEmail(ownerId: string, db?: SupabaseClient): Promise<string | null> {
  const a = await emailAllowance(ownerId, db);
  if (a.left <= 0) return limitMessage("emails", a.plan, a.used);
  const m = emailMemo.get(ownerId);
  if (m) m.used++;
  return null;
}
export const nextMonthStart = () => nextMonth().toISOString();
