import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/* Keeps slow AI results (suggestions) for a while so they show instantly next time. Memory first, then the database. */

const mem = new Map<string, { at: number; ttl: number; v: unknown }>();

export async function cached<T>(db: SupabaseClient, ownerId: string, key: string, ttlMs: number, make: () => Promise<T>, opts: { fresh?: boolean; keep?: (v: T) => boolean } = {}): Promise<T> {
  const m = mem.get(key);
  if (!opts.fresh && m && Date.now() - m.at < m.ttl) return m.v as T;
  if (!opts.fresh) {
    const { data } = await db.from("ai_cache").select("value, expires_at").eq("key", key).maybeSingle().then((r) => r, () => ({ data: null }));
    if (data && Date.parse(data.expires_at) > Date.now()) {
      mem.set(key, { at: Date.now(), ttl: Math.min(ttlMs, Date.parse(data.expires_at) - Date.now()), v: data.value });
      return data.value as T;
    }
  }
  const v = await make();
  if (!opts.keep || opts.keep(v)) {
    mem.set(key, { at: Date.now(), ttl: ttlMs, v });
    if (mem.size > 2000) mem.clear();
    await db.from("ai_cache").upsert({ key, owner_id: ownerId, value: v as object, expires_at: new Date(Date.now() + ttlMs).toISOString() }, { onConflict: "key" }).then(() => {}, () => {});
  }
  return v;
}

export async function uncache(db: SupabaseClient, key: string) {
  mem.delete(key);
  await db.from("ai_cache").delete().eq("key", key).then(() => {}, () => {});
}
