import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { supabaseRepo } from "./supabase";
import { isSupabase, setupMissing, SITE_URL } from "../config";
import type { Repo } from "./types";

export { isSupabase, setupMissing };

export const SETUP_ERROR = "Growvia isn't connected to its database yet. The site owner needs to add the Supabase keys in Vercel (see /setup).";

/** One data client per request (deduped across layout, page and components). */
export const repo = cache((): Repo => supabaseRepo());

/** For pages inside the app: returns user + business or redirects appropriately. */
export async function requireUser() {
  cookies(); // always render per-request (never bake a redirect in at build time)
  if (setupMissing) redirect("/setup");
  const r = repo();
  const user = await r.getUser();
  if (!user) redirect("/auth/signout");
  return { r, user };
}

export async function requireBusiness() {
  cookies();
  if (setupMissing) redirect("/setup");
  const r = repo();
  // Both lookups at once: row-level security scopes the business query to the signed-in user.
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/auth/signout");
  if (!business || !business.plan) redirect("/onboarding");
  return { r, user, business };
}

export function siteOrigin() {
  if (SITE_URL) return SITE_URL;
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Start a query now (alongside the auth check) and await it later. */
export function early<T>(p: Promise<T>): Promise<T> {
  p.catch(() => {});
  return p;
}
