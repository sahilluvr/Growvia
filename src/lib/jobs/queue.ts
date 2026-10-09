import "server-only";
import { waitUntil } from "@vercel/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../server/admin";
import { headers } from "next/headers";
import { CRON_SECRET, SITE_URL } from "../config";

/*
 * Background jobs: slow AI work (audits, AI plans, expert panels, AI-visibility checks, ads, voice-overs) runs in its
 * own serverless invocation, so the screen never freezes and you can keep using the app. The browser polls
 * /api/jobs and shows a pop-up when a job is ready. The scheduler (/api/cron/tick) picks up anything that was missed.
 */

export type JobKind = "seo_audit" | "seo_speed" | "seo_ai" | "seo_experts" | "geo_run" | "ad_text" | "ad_script" | "ad_voice";
export type Job = { id: string; owner_id: string; business_id: string | null; user_id: string | null; kind: JobKind; params: Record<string, any>; title: string; link: string | null; status: string; attempts: number }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient;

let origin = "";
/** Remember our own address so we can call the job runner (set from the incoming request). */
export const setOrigin = (o: string) => { if (o) origin = o.replace(/\/$/, ""); };

/** Starts a job right away in a separate invocation (falls back to running it inside this one). */
function kick(id: string) {
  if (!origin) origin = SITE_URL;
  if (!origin) { try { const h = headers(); const host = h.get("x-forwarded-host") || h.get("host"); if (host) origin = `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`; } catch { /* not in a request */ } }
  const run = async () => {
    if (origin && CRON_SECRET) {
      const r = await fetch(`${origin}/api/jobs/run`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` }, body: JSON.stringify({ id }), cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (r && r.status < 300) return; // accepted — the runner does the work
    }
    const { runJob } = await import("./run");
    await runJob(id);
  };
  waitUntil(run().catch(() => {}));
}

export async function enqueue(j: { ownerId: string; businessId: string | null; userId: string | null; kind: JobKind; params: Record<string, unknown>; title: string; link?: string }): Promise<{ id?: string; error?: string }> {
  const db = adminClient();
  if (!db) return { error: "Background jobs need SUPABASE_SERVICE_ROLE_KEY in Vercel." };
  // Same job already waiting or running? Reuse it instead of starting a second one.
  const { data: same } = await db.from("jobs").select("id").eq("kind", j.kind).eq("owner_id", j.ownerId).in("status", ["queued", "running"]).eq("params", JSON.stringify(j.params)).gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString()).limit(1).maybeSingle();
  if (same) return { id: same.id };
  const { data, error } = await db.from("jobs").insert({ owner_id: j.ownerId, business_id: j.businessId, user_id: j.userId, kind: j.kind, params: j.params, title: j.title, link: j.link ?? null }).select("id").single();
  if (error || !data) return { error: "Couldn't start that — please try again." };
  kick(data.id);
  return { id: data.id };
}

/** Called by the scheduler: re-run jobs whose kick was lost, and close jobs that died mid-way. */
export async function sweepJobs(db: Db, deadline: number) {
  const out = { restarted: 0, failed: 0 };
  const stale = new Date(Date.now() - 4 * 60_000).toISOString();
  const { data: dead } = await db.from("jobs").select("id, attempts").eq("status", "running").lt("started_at", stale).limit(20);
  for (const d of dead ?? []) {
    if (d.attempts >= 2) { await db.from("jobs").update({ status: "failed", message: "This took too long and was stopped. Please try again.", finished_at: new Date().toISOString() }).eq("id", d.id); out.failed++; }
    else { await db.from("jobs").update({ status: "queued" }).eq("id", d.id); }
  }
  const { data: waiting } = await db.from("jobs").select("id").eq("status", "queued").lt("created_at", new Date(Date.now() - 20_000).toISOString()).order("created_at").limit(3);
  const { runJob } = await import("./run");
  for (const w of waiting ?? []) { if (Date.now() > deadline - 20_000) break; await runJob(w.id); out.restarted++; }
  return out;
}
