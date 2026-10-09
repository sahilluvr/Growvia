import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "./server/admin";

export type InAppKind = "post_live" | "post_failed" | "post_scheduled" | "channel" | "milestone";
export type InApp = { kind: InAppKind; title: string; body?: string; url?: string | null; provider?: string | null; celebrate?: string | null };

/** Post counts that earn a celebration (shown once, with confetti). */
export const MILESTONES: Record<number, { key: string; title: string; body: string }> = {
  1: { key: "first-post", title: "Your first post is live!", body: "You just published from Growvia for the first time. Keep the streak going — schedule the next few posts and let Growvia send them for you." },
  10: { key: "posts-10", title: "10 posts published", body: "Double digits! Consistent posting is what grows a following. Your next milestone is 25." },
  25: { key: "posts-25", title: "25 posts published", body: "A quarter-century of posts. You're out-posting most small businesses in your area." },
  50: { key: "posts-50", title: "50 posts published", body: "Fifty posts — that's a real content engine. Check Insights to see what worked best." },
  100: { key: "posts-100", title: "100 posts published", body: "One hundred posts. That's the kind of consistency that builds a brand." },
};

/**
 * Adds a notification to the bell (and a toast if the app is open). Never throws: if the v044 table isn't there yet,
 * the rest of the app carries on exactly as before.
 */
export async function pushInApp(_db: SupabaseClient | null, ownerId: string, n: InApp) {
  const db = adminClient();
  if (!db) return;
  await db.from("app_notifications").insert({ owner_id: ownerId, kind: n.kind, title: n.title.slice(0, 160), body: n.body?.slice(0, 600) ?? null, url: n.url ?? null, provider: n.provider ?? null, celebrate: n.celebrate ?? null }).then(() => null, () => null);
}

/** After a successful publish: how many posts this account has published in total, and the milestone it hit (if any). */
export async function postMilestone(ownerId: string): Promise<{ count: number; milestone: (typeof MILESTONES)[number] | null }> {
  const db = adminClient();
  if (!db) return { count: 0, milestone: null };
  const { count } = await db.from("social_posts").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).in("status", ["published", "partial"]);
  const n = count ?? 0;
  return { count: n, milestone: MILESTONES[n] ?? null };
}
