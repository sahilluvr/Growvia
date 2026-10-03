import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BIZ_COLS, performAi, performAudit, performExperts, performSpeed, type SeoBiz } from "./run";
import { syncSearchConsole } from "./rankings";
import { ENGINES, runGeo, type EngineId } from "./geo";
import { presetRange, sendSeoReport } from "./report";
import { weeklyDigest } from "./alerts";
import type { SeoPrefs } from "./types";
import { planFor } from "@/lib/billing/plan";

type Db = SupabaseClient;
const H = 3600_000;
const every = { daily: 22 * H, weekly: 7 * 24 * H - 2 * H, monthly: 30 * 24 * H - 2 * H } as const;
const older = (iso: unknown, ms: number) => !iso || Date.now() - new Date(String(iso)).getTime() > ms;

/**
 * Background SEO work, one small step per project per tick so nothing exceeds the time limit:
 * Search Console sync (daily) → scheduled audit → its speed test → AI plan → expert panel → AI visibility → report email.
 */
export async function runSeoJobs(db: Db, deadline: number, origin: string) {
  const out = { synced: 0, audits: 0, followups: 0, geo: 0, reports: 0, errors: [] as string[] };
  const { data } = await db.from("businesses").select(BIZ_COLS).not("website", "is", null).limit(500);
  const list = ((data ?? []) as SeoBiz[]).sort((a, b) => String(a.seo_state?.job_at ?? "").localeCompare(String(b.seo_state?.job_at ?? "")));
  for (const b of list) {
    const left = deadline - Date.now();
    if (left < 8000) break;
    const prefs = (b.seo_prefs ?? {}) as SeoPrefs;
    const st = b.seo_state ?? {};
    const touch = (patch: Record<string, unknown>) => db.from("businesses").update({ seo_state: { ...st, ...patch, job_at: new Date().toISOString() } }).eq("id", b.id);
    try {
      // 1) Search Console: refresh daily.
      if (b.gsc_site && b.gsc_refresh_enc && older(st.gsc_synced_at, every.daily) && left > 15000) {
        await syncSearchConsole(db, b); out.synced++; continue;
      }
      // 2) Follow-ups for the latest scheduled audit (speed → AI plan → experts).
      const { data: last } = await db.from("seo_audits").select("id, created_at, status, speed, ai, experts, trigger").eq("business_id", b.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last?.status === "done" && last.trigger === "schedule" && Date.now() - new Date(last.created_at).getTime() < 24 * H) {
        if (!last.speed?.mobile && left > 50000) { await performSpeed(db, last.id); out.followups++; await touch({}); continue; }
        if (!last.ai?.at && left > 40000) { await performAi(db, b, last.id); out.followups++; await touch({}); continue; }
        if (!last.experts && left > 40000) { await performExperts(db, b, last.id); out.followups++; await touch({}); continue; }
      }
      // 3) Scheduled audit.
      const freq = prefs.audit ?? "weekly";
      if (freq !== "off" && older(last?.created_at, every[freq]) && left > 45000) {
        const r = await performAudit(db, b, { trigger: "schedule", budgetMs: Math.min(35000, left - 8000) });
        if (!r.ok && r.error) out.errors.push(`${b.name}: ${r.error}`);
        out.audits++; await touch({}); continue;
      }
      // 4) AI visibility checks.
      const geoFreq = prefs.geo ?? "weekly";
      // Free plan: checked monthly; Pro: up to weekly (or daily if chosen and the plan allows).
      const plan = geoFreq !== "off" ? await planFor(b.owner_id, db) : null;
      const geoEvery = Math.max(every[geoFreq === "off" ? "weekly" : geoFreq], (plan?.limits.geoEveryDays ?? 7) * 24 * H - 2 * H);
      if (plan && older(st.geo_run_at, geoEvery) && left > 30000) {
        const { count } = await db.from("geo_prompts").select("id", { count: "exact", head: true }).eq("business_id", b.id);
        if (count) {
          const engines = (prefs.engines?.length ? prefs.engines : ENGINES.map((e) => e.id)) as EngineId[];
          await runGeo(db, b, { engines, deadline: Math.min(deadline, Date.now() + 40000), limit: plan.limits.geoPrompts });
          out.geo++; continue;
        }
      }
      // 5) Monday summary email (once per ISO week, after 06:00 UTC).
      const now = new Date();
      if (now.getUTCDay() === 1 && now.getUTCHours() >= 6 && older(st.digest_at, 6 * 24 * H)) {
        await weeklyDigest(db, b);
        await touch({ digest_at: now.toISOString() });
        continue;
      }
      // 6) Report email.
      const rep = prefs.report;
      if (rep && rep.freq !== "off" && rep.to?.length && older(st.report_sent_at, every[rep.freq])) {
        const r = await sendSeoReport(db, b, presetRange(rep.freq === "weekly" ? "7d" : "30d"), rep.to, origin);
        if (!r.ok) out.errors.push(`${b.name}: ${r.error}`);
        await touch({ report_sent_at: new Date().toISOString(), report_error: r.ok ? null : r.error });
        out.reports++; continue;
      }
    } catch (e) {
      out.errors.push(`${b.name}: ${e instanceof Error ? e.message : "failed"}`);
      await touch({ job_error: e instanceof Error ? e.message : "failed" });
    }
  }
  return out;
}
