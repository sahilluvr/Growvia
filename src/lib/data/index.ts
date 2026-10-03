import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { supabaseRepo, PROJECT_COOKIE } from "./supabase";
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
  // Pages read the project id straight from its cookie (so their queries start without waiting).
  // If the cookie is missing or points at a project that's gone, set it once and come back.
  const remembered = cookies().get(PROJECT_COOKIE)?.value;
  if (remembered !== business.id && !cookies().get("gv_pfix")) {
    const path = headers().get("x-gv-path") || "/app";
    redirect(`/api/project/fix?to=${business.id}&next=${encodeURIComponent(path)}`);
  }
  return { r, user, business };
}

export function siteOrigin() {
  if (SITE_URL) return SITE_URL;
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The current project's id from its cookie, for starting page queries before the auth check finishes. RLS still applies. */
export function projectIdNow(): string | null {
  const c = cookies().get(PROJECT_COOKIE)?.value;
  return c && /^[0-9a-f-]{36}$/i.test(c) ? c : null;
}

/**
 * requireBusiness + the page's own queries in the SAME round trip: the queries start right away with the project id
 * from its cookie (requireBusiness guarantees that cookie matches the project, or redirects).
 */
export async function withProject<T>(load: (projectId: string) => Promise<T>) {
  const pid = projectIdNow();
  const early_ = pid ? early(load(pid)) : null;
  const ctx = await requireBusiness();
  return { ...ctx, data: await (early_ ?? load(ctx.business.id)) };
}

/** Start a query now (alongside the auth check) and await it later. */
export function early<T>(p: Promise<T>): Promise<T> {
  p.catch(() => {});
  return p;
}
