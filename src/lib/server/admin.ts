import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "../config";

let admin: SupabaseClient | null = null;

/** Service-role client for background jobs and public endpoints. Bypasses RLS — always filter by owner_id. */
export function adminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  // cache: "no-store" — Next.js would otherwise cache these GET requests between page loads (stale admin data).
  admin ??= createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  return admin;
}
