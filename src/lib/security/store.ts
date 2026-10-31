import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notify";
import { planFor } from "@/lib/billing/plan";
import { scanSite, type SecReport, type Deps, LIVE } from "./scan";

type Db = SupabaseClient;
export type ScanRow = { id: string; score: number; grade: string; report: SecReport; created_at: string; url: string };

export async function latestScans(db: Db, businessId: string, n = 8): Promise<ScanRow[]> {
  const { data } = await db.from("site_security").select("id, score, grade, report, created_at, url").eq("business_id", businessId).order("created_at", { ascending: false }).limit(n);
  return (data ?? []) as ScanRow[];
}

/** Scan, save, keep the last 20, and alert on what matters. */
export async function scanAndSave(db: Db, b: { id: string; owner_id: string; website: string | null; name?: string }, deps: Deps = LIVE) {
  if (!b.website) throw new Error("Add your website address in Settings first.");
  const prev = (await latestScans(db, b.id, 1))[0] ?? null;
  const report = await scanSite(b.website, deps);
  await db.from("site_security").insert({ owner_id: b.owner_id, business_id: b.id, url: report.url, score: report.score, grade: report.grade, report });
  const { data: old } = await db.from("site_security").select("id").eq("business_id", b.id).order("created_at", { ascending: false }).range(20, 200);
  if (old?.length) await db.from("site_security").delete().in("id", old.map((r: { id: string }) => r.id));
  const alerts = alertsFor(report, prev?.report ?? null);
  if (alerts.length) {
    await notify({
      ownerId: b.owner_id, businessId: b.id, type: "security",
      subject: `Website security: ${alerts[0]}`, title: `${report.host}: ${alerts.length === 1 ? "one thing needs attention" : `${alerts.length} things need attention`}`,
      body: alerts.map((a) => `• ${a}`).join("\n"),
      cta: { label: "Open Security health", url: "/app/security" },
      dedupe: `sec:${b.id}:${alerts.join("|").slice(0, 80)}:${report.at.slice(0, 10)}`,
    }).catch(() => null);
  }
  return { report, prev: prev?.report ?? null, alerts };
}

/** Plain-English alerts worth an email: expiring certificate or domain, newly exposed files, unsafe flag, a real score drop. */
export function alertsFor(r: SecReport, prev: SecReport | null): string[] {
  const out: string[] = [];
  const by = (id: string, rep: SecReport | null) => rep?.checks.find((c) => c.id === id);
  const cert = by("cert", r);
  if (cert && cert.status === "fail") out.push(cert.title);
  const dom = by("domain_expiry", r);
  if (dom && dom.status === "fail") out.push(dom.title);
  const ex = by("exposed", r);
  if (ex && ex.status !== "pass" && by("exposed", prev)?.status !== ex.status) out.push(ex.title);
  const sb = by("safebrowsing", r);
  if (sb && sb.status === "fail") out.push(sb.title);
  if (prev && prev.score - r.score >= 10) out.push(`Security score dropped from ${prev.score} to ${r.score}`);
  return out;
}

/** Free: 1 scan a month. Paid plans: on demand (at most every 10 minutes) and weekly automatic scans. */
export async function canScan(db: Db, ownerId: string, businessId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await planFor(ownerId);
  const last = (await latestScans(db, businessId, 1))[0];
  const age = last ? Date.now() - Date.parse(last.created_at) : Infinity;
  if (plan.pro) return age < 10 * 60_000 ? { ok: false, error: "You just scanned — try again in a few minutes." } : { ok: true };
  return age < 30 * 86_400_000 ? { ok: false, error: `The free plan includes one security scan a month. Your next free scan is on ${new Date(Date.parse(last!.created_at) + 30 * 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric" })} — or upgrade for weekly automatic scans.` } : { ok: true };
}

/** Cron: weekly automatic scans for paid projects with a website. */
export async function runSecurityJobs(db: Db, deadline: number) {
  const out = { scanned: 0, alerts: 0 };
  const { data: biz } = await db.from("businesses").select("id, owner_id, website, name").not("website", "is", null).limit(500);
  for (const b of (biz ?? []) as { id: string; owner_id: string; website: string | null; name: string }[]) {
    if (Date.now() > deadline - 20_000) break;
    if (!b.website) continue;
    const last = (await latestScans(db, b.id, 1))[0];
    if (last && Date.now() - Date.parse(last.created_at) < 7 * 86_400_000) continue;
    const plan = await planFor(b.owner_id).catch(() => null);
    if (!plan?.pro) continue;
    const r = await scanAndSave(db, b).catch(() => null);
    if (r) { out.scanned++; out.alerts += r.alerts.length; }
    if (out.scanned >= 1) break; // one scan per tick keeps the tick inside its time budget
  }
  return out;
}
