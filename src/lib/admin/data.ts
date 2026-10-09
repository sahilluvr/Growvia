import "server-only";
import type { User } from "@supabase/supabase-js";
import { adminClient } from "@/lib/server/admin";
import { resolvePlan, type SubRow, type PlanState } from "@/lib/billing/plan";
import { usdToInr } from "@/lib/billing/razorpay";

export type AdminUser = {
  id: string; email: string; name: string; createdAt: string; lastSignIn: string | null; confirmed: boolean; banned: boolean; bannedUntil: string | null;
  provider: string; plan: PlanState; sub: SubRow | null; projects: number; leads: number; team: number; emailsMonth: number; lastActivity: string | null;
  paid: number; // lifetime paid, in INR minor units (USD converted)
};

export function db() {
  const d = adminClient();
  if (!d) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing — the admin dashboard needs it.");
  return d;
}

async function allAuthUsers(): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function loadUsers(): Promise<AdminUser[]> {
  const d = db();
  const [users, subs, profiles, stats, pays, rate] = await Promise.all([
    allAuthUsers(),
    d.from("subscriptions").select("*").then((r) => (r.data ?? []) as SubRow[]),
    d.from("profiles").select("id, name").then((r) => r.data ?? []),
    d.rpc("admin_user_stats").then((r) => (r.data ?? []) as { owner_id: string; projects: number; leads: number; team: number; emails_month: number; last_activity: string | null }[]),
    d.from("payments").select("owner_id, amount, currency, status").then((r) => r.data ?? []),
    usdToInr(),
  ]);
  const subBy = new Map(subs.map((s) => [s.owner_id, s]));
  const nameBy = new Map(profiles.map((p) => [p.id as string, p.name as string]));
  const statBy = new Map(stats.map((s) => [s.owner_id, s]));
  const paidBy = new Map<string, number>();
  for (const p of pays) if (p.status === "paid") paidBy.set(p.owner_id, (paidBy.get(p.owner_id) ?? 0) + (p.currency === "USD" ? Math.round(p.amount * rate) : p.amount));
  return users.map((u) => {
    const sub = subBy.get(u.id) ?? null;
    const st = statBy.get(u.id);
    const bannedUntil = (u as User & { banned_until?: string | null }).banned_until ?? null;
    return {
      id: u.id, email: u.email ?? "", name: nameBy.get(u.id) || (u.user_metadata?.full_name as string) || (u.email ?? "").split("@")[0],
      createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null, confirmed: Boolean(u.email_confirmed_at || u.confirmed_at),
      banned: Boolean(bannedUntil && Date.parse(bannedUntil) > Date.now()), bannedUntil,
      provider: (u.app_metadata?.provider as string) || "email",
      plan: resolvePlan(sub, u.email ?? null), sub,
      projects: Number(st?.projects ?? 0), leads: Number(st?.leads ?? 0), team: Number(st?.team ?? 0), emailsMonth: Number(st?.emails_month ?? 0), lastActivity: st?.last_activity ?? null,
      paid: paidBy.get(u.id) ?? 0,
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type Finance = Awaited<ReturnType<typeof loadFinance>>;
export async function loadFinance() {
  const d = db();
  const [pays, subs, rate, users] = await Promise.all([
    d.from("payments").select("*").order("paid_at", { ascending: false }).limit(5000).then((r) => r.data ?? []),
    d.from("subscriptions").select("*").then((r) => (r.data ?? []) as SubRow[]),
    usdToInr(),
    d.from("profiles").select("id, email, name").then((r) => r.data ?? []),
  ]);
  const who = new Map(users.map((u) => [u.id as string, { email: u.email as string, name: u.name as string }]));
  const inr = (amount: number, cur: string) => (cur === "USD" ? Math.round(amount * rate) : amount);
  const now = Date.now(), day = 86400_000;
  const paid = pays.filter((p) => p.status === "paid");
  const refunds = pays.filter((p) => p.status === "refunded" && p.amount < 0);
  const sum = (list: typeof pays) => list.reduce((a, p) => a + inr(p.amount, p.currency), 0);
  const since = (ms: number) => paid.filter((p) => now - Date.parse(p.paid_at) <= ms);
  // Recurring revenue from live paid subscriptions (yearly counted monthly).
  const live = subs.filter((s) => s.rzp_subscription_id && ["pro", "growth", "agency"].includes(s.plan) && ["active", "authenticated", "pending"].includes(s.status) && !s.cancel_at_period_end);
  const mrr = live.reduce((a, s) => a + (s.amount ? inr(s.amount, s.currency ?? "INR") / (s.billing_interval === "year" ? 12 : 1) : 0), 0);
  // Last 12 months.
  const months: { key: string; label: string; total: number; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(); dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() - i);
    const key = dt.toISOString().slice(0, 7);
    const list = paid.filter((p) => String(p.paid_at).slice(0, 7) === key);
    months.push({ key, label: dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), total: sum(list), count: list.length });
  }
  const byCurrency = ["INR", "USD"].map((c) => ({ currency: c, total: paid.filter((p) => p.currency === c).reduce((a, p) => a + p.amount, 0), count: paid.filter((p) => p.currency === c).length }));
  return {
    rate, mrr: Math.round(mrr), arr: Math.round(mrr * 12),
    revenueTotal: sum(paid) + sum(refunds), revenue30: sum(since(30 * day)) + sum(refunds.filter((p) => now - Date.parse(p.paid_at) <= 30 * day)), revenue7: sum(since(7 * day)) + sum(refunds.filter((p) => now - Date.parse(p.paid_at) <= 7 * day)),
    paymentsCount: paid.length, failedCount: pays.filter((p) => p.status === "failed").length, refundedCount: pays.filter((p) => p.status === "refunded").length,
    months, byCurrency,
    activeSubs: live.length,
    monthlySubs: live.filter((s) => s.billing_interval === "month").length, yearlySubs: live.filter((s) => s.billing_interval === "year").length,
    endingSubs: subs.filter((s) => s.rzp_subscription_id && s.cancel_at_period_end && s.current_end && Date.parse(s.current_end) > now),
    troubleSubs: subs.filter((s) => s.status === "pending" || s.status === "halted"),
    renewals: live.filter((s) => s.current_end).sort((a, b) => String(a.current_end).localeCompare(String(b.current_end))).slice(0, 20),
    payments: pays.slice(0, 200).map((p) => ({ ...p, who: who.get(p.owner_id) })),
    who,
  };
}

export async function loadSystem() {
  const d = db();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const [jobsFailed, jobsRunning, emailsFailed, emailsSent, recentAdmin] = await Promise.all([
    d.from("jobs").select("id, kind, title, message, finished_at, owner_id").eq("status", "failed").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(20).then((r) => r.data ?? []),
    d.from("jobs").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]).then((r) => r.count ?? 0),
    d.from("email_log").select("id, type, subject, error, created_at, recipients").eq("status", "failed").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(20).then((r) => r.data ?? []),
    d.from("email_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", dayAgo).then((r) => r.count ?? 0),
    d.from("admin_events").select("*").order("created_at", { ascending: false }).limit(30).then((r) => r.data ?? []),
  ]);
  return { jobsFailed, jobsRunning, emailsFailed, emailsSent, recentAdmin };
}

export async function logAdmin(action: string, target: { id?: string; email?: string } = {}, detail: Record<string, unknown> = {}) {
  await db().from("admin_events").insert({ action, target_id: target.id ?? null, target_email: target.email ?? null, detail }).then(() => {}, () => {});
}

export const inrFmt = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);

/* ───────── Websites: every URL people added or had Growvia evaluate ───────── */

export type UrlKind = "project" | "audit" | "competitor" | "ad" | "search_console";
export type AdminUrl = {
  kind: UrlKind; url: string; host: string; ownerId: string; project: string | null; at: string;
  status?: string | null; score?: number | null; issues?: number | null; detail?: string | null;
};

const hostOf = (u: string) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).host.replace(/^www\./, "").toLowerCase(); } catch { return u.toLowerCase(); } };

/** Project websites, SEO audits, competitor sites, Ad studio pages and Search Console properties — newest first. */
export async function loadUrls(ownerId?: string, limit = 2000): Promise<AdminUrl[]> {
  const d = db();
  const own = ownerId ?? null;
  const [biz, audits, comps, ads] = await Promise.all([
    (own ? d.from("businesses").select("id, owner_id, name, website, gsc_site, created_at").eq("owner_id", own) : d.from("businesses").select("id, owner_id, name, website, gsc_site, created_at")).order("created_at", { ascending: false }).limit(limit).then((r) => (r.data ?? []) as { id: string; owner_id: string; name: string; website: string | null; gsc_site: string | null; created_at: string }[]),
    (own ? d.from("seo_audits").select("id, owner_id, business_id, url, status, score, issues, error, created_at").eq("owner_id", own) : d.from("seo_audits").select("id, owner_id, business_id, url, status, score, issues, error, created_at")).order("created_at", { ascending: false }).limit(limit).then((r) => (r.data ?? []) as { owner_id: string; business_id: string; url: string; status: string; score: number | null; issues: unknown; error: string | null; created_at: string }[]),
    (own ? d.from("competitors").select("owner_id, business_id, name, website, source, created_at").eq("owner_id", own) : d.from("competitors").select("owner_id, business_id, name, website, source, created_at")).not("website", "is", null).order("created_at", { ascending: false }).limit(limit).then((r) => (r.data ?? []) as { owner_id: string; business_id: string; name: string; website: string | null; source: string; created_at: string }[]),
    (own ? d.from("ad_projects").select("owner_id, business_id, name, url, status, created_at").eq("owner_id", own) : d.from("ad_projects").select("owner_id, business_id, name, url, status, created_at")).not("url", "is", null).order("created_at", { ascending: false }).limit(limit).then((r) => (r.data ?? []) as { owner_id: string; business_id: string; name: string; url: string | null; status: string; created_at: string }[]),
  ]);
  const names = new Map(biz.map((b) => [b.id as string, b.name as string]));
  const out: AdminUrl[] = [];
  for (const b of biz) {
    if (b.website) out.push({ kind: "project", url: b.website, host: hostOf(b.website), ownerId: b.owner_id, project: b.name, at: b.created_at });
    if (b.gsc_site) out.push({ kind: "search_console", url: String(b.gsc_site).replace(/^sc-domain:/, ""), host: hostOf(String(b.gsc_site).replace(/^sc-domain:/, "")), ownerId: b.owner_id, project: b.name, at: b.created_at, detail: String(b.gsc_site) });
  }
  for (const a of audits) out.push({ kind: "audit", url: a.url, host: hostOf(a.url), ownerId: a.owner_id, project: names.get(a.business_id) ?? null, at: a.created_at, status: a.status, score: a.score, issues: Array.isArray(a.issues) ? a.issues.length : null, detail: a.error });
  for (const c of comps) out.push({ kind: "competitor", url: c.website!, host: hostOf(c.website!), ownerId: c.owner_id, project: names.get(c.business_id) ?? null, at: c.created_at, detail: `${c.name} · ${c.source}` });
  for (const a of ads) out.push({ kind: "ad", url: a.url!, host: hostOf(a.url!), ownerId: a.owner_id, project: names.get(a.business_id) ?? null, at: a.created_at, status: a.status, detail: a.name });
  return out.sort((x, y) => y.at.localeCompare(x.at));
}
