import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectedAcc, LinkedPost } from "./autopost";

/** Connected accounts (this project's Business Profile only) + the auto-post behind each content card. */
export async function postingContext(db: SupabaseClient, businessId: string, contentIds?: string[]) {
  const [{ data: accs }, { data: posts }] = await Promise.all([
    db.from("channel_accounts").select("id, provider, name, username, status, meta").in("provider", ["facebook", "instagram", "youtube", "gbp"]),
    // Without ids (so it can run in parallel with loading the content), take the latest posts linked to any content card.
    !contentIds ? db.from("social_posts").select("id, content_item_id, status, scheduled_at, targets, results, created_at").not("content_item_id", "is", null).order("created_at", { ascending: false }).limit(1000)
      : contentIds.length ? db.from("social_posts").select("id, content_item_id, status, scheduled_at, targets, results, created_at").in("content_item_id", contentIds.slice(0, 500)).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const accounts = (accs ?? []).filter((a) => a.provider !== "gbp" || a.meta?.business_id === businessId).map((a) => ({ id: a.id, provider: a.provider, name: a.name, username: a.username, status: a.status })) as (ConnectedAcc & { status: string })[];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const linked: Record<string, LinkedPost> = {};
  for (const p of (posts ?? []) as { id: string; content_item_id: string; status: string; scheduled_at: string | null; targets: string[]; results: { ok: boolean; name: string; error?: string }[] }[]) {
    if (linked[p.content_item_id]) continue; // newest first
    linked[p.content_item_id] = {
      id: p.id, status: p.status, scheduled_at: p.scheduled_at,
      names: p.targets.map((t) => { const a = byId.get(t); return a ? (a.username ? `@${a.username}` : a.name) : "a removed account"; }),
      error: (p.results ?? []).find((r) => !r.ok)?.error ?? null,
    };
  }
  return { accounts, linked };
}
