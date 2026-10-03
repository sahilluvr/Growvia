import { planFor } from "@/lib/billing/plan";
import "server-only";
import { adminClient } from "../server/admin";
import { AiError } from "../ai/gemini";
import { BIZ_COLS, performAi, performAudit, performExperts, performSpeed, type SeoBiz } from "../seo/run";
import { ENGINES, runGeo, type EngineId } from "../seo/geo";
import type { SeoPrefs } from "../seo/types";
import { scriptOp, textAdsOp, voiceOp } from "../ads/ops";
import { enqueue, type Job } from "./queue";

/* Executes one background job. Never throws: every outcome is written to the job row for the pop-up. */

const friendly = (e: unknown) => {
  if (e instanceof AiError) return e.message;
  const m = e instanceof Error ? e.message : "";
  return m && m.length < 200 && !/fetch failed|ECONN|undefined|null/.test(m) ? m : "Something went wrong — please try again.";
};

export async function runJob(id: string) {
  const db = adminClient();
  if (!db) return;
  // Claim it (only one runner wins).
  const { data: rows } = await db.from("jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", id).eq("status", "queued").select("*");
  const job = rows?.[0] as Job | undefined;
  if (!job) return;
  await db.from("jobs").update({ attempts: job.attempts + 1 }).eq("id", id);
  const finish = (ok: boolean, message: string, result?: unknown) =>
    db.from("jobs").update({ status: ok ? "done" : "failed", message: message.slice(0, 400), result: result ?? null, finished_at: new Date().toISOString() }).eq("id", id);
  try {
    const biz = async () => {
      const { data } = await db.from("businesses").select(BIZ_COLS).eq("id", job.business_id!).single();
      if (!data) throw new Error("This project no longer exists.");
      return data as SeoBiz;
    };
    const p = job.params ?? {};
    switch (job.kind) {
      case "seo_audit": {
        const b = await biz();
        const r = await performAudit(db, b, { budgetMs: 38000 });
        if (!r.ok || !r.id) return void (await finish(false, r.error ?? "The audit failed — try again."));
        await finish(true, `Your website check is done — SEO score ${r.score}/100. Speed test and AI plan are on the way.`, { auditId: r.id, score: r.score });
        // Follow-ups run as their own jobs (each gets its own time budget).
        await enqueue({ ownerId: job.owner_id, businessId: job.business_id, userId: job.user_id, kind: "seo_speed", params: { auditId: r.id }, title: "Speed test", link: "/app/seo?tab=speed" });
        await enqueue({ ownerId: job.owner_id, businessId: job.business_id, userId: job.user_id, kind: "seo_ai", params: { auditId: r.id }, title: "AI SEO plan", link: "/app/seo?tab=plan" });
        return;
      }
      case "seo_speed": {
        const r = await performSpeed(db, String(p.auditId));
        return void (await finish(r.ok, r.ok ? "Speed test finished for mobile and desktop." : r.error ?? "The speed test didn't finish."));
      }
      case "seo_ai": {
        const r = await performAi(db, await biz(), String(p.auditId));
        return void (await finish(r.ok, r.ok ? (r.message ? `Plan ready (rule-based): ${r.message}` : "Your AI SEO plan is ready: fixes, keywords, content ideas and files.") : r.error ?? "Couldn't write the plan."));
      }
      case "seo_experts": {
        const r = await performExperts(db, await biz(), String(p.auditId));
        return void (await finish(r.ok, r.ok ? (r.message ? `Expert review ready (basic): ${r.message}` : "The expert panel has reviewed your site.") : r.error ?? "The expert panel couldn't finish."));
      }
      case "geo_run": {
        const b = await biz();
        const prefs = (b.seo_prefs ?? {}) as SeoPrefs;
        const engines = (prefs.engines?.length ? prefs.engines : ENGINES.map((e) => e.id)) as EngineId[];
        const plan = await planFor(b.owner_id, db);
        const r = await runGeo(db, b, { engines, promptIds: p.promptIds, deadline: Date.now() + 50000, limit: plan.limits.geoPrompts });
        if (!r.ok) return void (await finish(false, r.error));
        return void (await finish(true, `AI assistants asked ${r.checks} times — you were mentioned ${r.mentioned} time${r.mentioned === 1 ? "" : "s"}.${r.partial ? " Some questions ran out of time; run again to finish." : ""}`));
      }
      case "ad_text": {
        const r = await textAdsOp(db, String(p.adId), p.platforms ?? [], p.tone);
        return void (await finish(true, "Your ad copy is ready.", r));
      }
      case "ad_script": {
        const r = await scriptOp(db, String(p.adId), p.settings ?? {}, p.direction);
        return void (await finish(true, "Your video story is ready.", r));
      }
      case "ad_voice": {
        const r = await voiceOp(db, String(p.adId), job.user_id ?? job.owner_id);
        return void (await finish(true, `Voice-over recorded (${Math.round(r.seconds)}s).`, r));
      }
      default:
        return void (await finish(false, "Unknown task."));
    }
  } catch (e) {
    await finish(false, friendly(e));
  }
}
