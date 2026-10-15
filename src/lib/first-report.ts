import "server-only";
import { adminClient } from "./server/admin";
import { enqueue } from "./jobs/queue";
import { suggestPrompts } from "./seo/geo";

type Biz = { id: string; owner_id: string; name: string; segment: string; city: string | null; website: string | null };

/**
 * Right after onboarding: check the website (audit → speed → AI plan) and ask AI assistants three starter
 * questions, so the Growth Report fills itself in while the user watches. Runs once per project.
 */
export async function startFirstReport(b: Biz, userId: string): Promise<boolean> {
  const db = adminClient();
  if (!db || !b.website) return false;
  const [{ count: audits }, { count: running }] = await Promise.all([
    db.from("seo_audits").select("id", { count: "exact", head: true }).eq("business_id", b.id),
    db.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", b.id).eq("kind", "seo_audit"),
  ]);
  if ((audits ?? 0) > 0 || (running ?? 0) > 0) return false; // already done for this project
  await enqueue({ ownerId: b.owner_id, businessId: b.id, userId, kind: "seo_audit", params: {}, title: "Website report", link: "/app/report" });
  const { count: prompts } = await db.from("geo_prompts").select("id", { count: "exact", head: true }).eq("business_id", b.id);
  if (!prompts) {
    const starter = (await suggestPrompts(b as never, [], { offline: true })).slice(0, 3);
    if (starter.length) await db.from("geo_prompts").upsert(starter.map((prompt) => ({ owner_id: b.owner_id, business_id: b.id, prompt })), { onConflict: "business_id,prompt", ignoreDuplicates: true });
  }
  await enqueue({ ownerId: b.owner_id, businessId: b.id, userId, kind: "geo_run", params: {}, title: "AI visibility check", link: "/app/report" });
  return true;
}
