import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import sitemap from "@/app/sitemap";
import { SITE } from "@/lib/site/features";

/**
 * IndexNow: tells Bing (and through it ChatGPT search, DuckDuckGo, Yahoo), Yandex, Seznam and Naver
 * about new or changed pages the moment they're live — no Webmaster Tools clicking.
 * The key isn't a secret: the protocol proves site ownership with the file public/<KEY>.txt.
 * Google doesn't use IndexNow; it reads the sitemap.
 */
export const INDEXNOW_KEY = "44c5a1c966bde96736dabed44e554b94";
const ENDPOINT = (process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow").trim();
const STATE_KEY = "indexnow-state"; // stored in billing_plans (key → text), like "usd-off"
const EVERY_MS = 60 * 60_000; // check at most hourly

type State = { checkedAt: number; deploy: string; pages: Record<string, string> };

/** Every public URL with a stable "version": its lastmod, or the deploy id for pages that change with each release. */
export function currentPages(deploy: string) {
  const now = Date.now();
  const out: Record<string, string> = {};
  for (const e of sitemap()) {
    const t = e.lastModified ? new Date(e.lastModified).getTime() : now;
    // Pages whose lastmod is "now" (home, features, indexes) are re-sent once per deploy.
    out[e.url] = Math.abs(now - t) < 5 * 60_000 ? `deploy:${deploy}` : new Date(t).toISOString().slice(0, 10);
  }
  return out;
}

export async function submitIndexNow(urls: string[]) {
  if (!urls.length) return { status: 0, sent: 0 };
  const host = new URL(SITE).host;
  let sent = 0, status = 0;
  for (let i = 0; i < urls.length; i += 10_000) {
    const urlList = urls.slice(i, i + 10_000);
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(15_000),
    });
    status = r.status;
    // 200 = accepted, 202 = accepted (key check pending). 4xx = something is wrong with the key or URLs.
    if (r.status !== 200 && r.status !== 202) throw new Error(`IndexNow ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
    sent += urlList.length;
  }
  return { status, sent };
}

/**
 * Called from the scheduler. Sends only what's new or changed since the last successful send
 * (all pages the first time), so a deploy with new guides is announced within the hour.
 */
export async function runIndexNow(db: SupabaseClient, opts: { force?: boolean } = {}) {
  if (!process.env.VERCEL && !opts.force && !process.env.INDEXNOW_ENDPOINT) return { skipped: "not production" };
  if (!process.env.INDEXNOW_ENDPOINT && (!/^https:\/\//.test(SITE) || /localhost|vercel\.app/.test(SITE))) return { skipped: "SITE_URL is not the live domain" };
  const { data } = await db.from("billing_plans").select("rzp_plan_id").eq("key", STATE_KEY).maybeSingle();
  let prev: State | null = null;
  try { prev = data?.rzp_plan_id ? (JSON.parse(data.rzp_plan_id) as State) : null; } catch { prev = null; }
  const deploy = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local").slice(0, 12);
  // A new deploy is checked straight away; otherwise at most hourly (new posts go live by date).
  if (!opts.force && prev && prev.deploy === deploy && Date.now() - prev.checkedAt < EVERY_MS) return { skipped: "checked recently" };
  const pages = currentPages(deploy);
  const changed = Object.keys(pages).filter((u) => opts.force || prev?.pages[u] !== pages[u]);
  const save = (s: State) => db.from("billing_plans").upsert({ key: STATE_KEY, rzp_plan_id: JSON.stringify(s) }, { onConflict: "key" });
  if (!changed.length) { await save({ ...(prev ?? { deploy, pages }), checkedAt: Date.now() }); return { sent: 0 }; }
  let r;
  try { r = await submitIndexNow(changed); }
  catch (e) { await save({ ...(prev ?? { deploy: "", pages: {} }), checkedAt: Date.now() }); throw e; } // retry next hour, not every minute
  await save({ checkedAt: Date.now(), deploy, pages });
  return { sent: r.sent, status: r.status, sample: changed.slice(0, 3) };
}

/** For the admin page: when pages were last announced and how many. */
export async function indexNowStatus(db: SupabaseClient) {
  const { data } = await db.from("billing_plans").select("rzp_plan_id").eq("key", STATE_KEY).maybeSingle();
  try { const st = JSON.parse(data?.rzp_plan_id ?? "null") as State | null; return st ? { checkedAt: st.checkedAt, pages: Object.keys(st.pages).length } : null; } catch { return null; }
}
