"use server";
import { guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { normalizeUrl } from "@/lib/seo/crawl";
import { BIZ_COLS, gscSnapshot, keywordPositions, performAi, performAudit, performExperts, performSpeed, type SeoBiz } from "@/lib/seo/run";
import { autocomplete, serpPosition, serpReady, syncSearchConsole } from "@/lib/seo/rankings";
import { ENGINES, runGeo, suggestPrompts, type EngineId } from "@/lib/seo/geo";
import { aiReady, geminiJson } from "@/lib/ai/gemini";
import { sendSeoReport } from "@/lib/seo/report";
import { enqueue } from "@/lib/jobs/queue";
import type { SeoPrefs } from "@/lib/seo/types";
import { checkLimit, planFor } from "@/lib/billing/plan";
import { LIMITS, PRICES } from "@/lib/billing/catalog";
import { cached } from "@/lib/ai/cache";

type FormState = { ok?: boolean; error?: string; message?: string; id?: string } | undefined;

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  const db = supabaseServer();
  const { data: full } = await db.from("businesses").select(BIZ_COLS).eq("id", business.id).single();
  return { r, user, business: full as SeoBiz, db };
}
const done = () => revalidatePath("/app/seo");
const errOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export async function saveWebsiteAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => saveWebsiteActionImpl(s, f));
}
async function saveWebsiteActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, business } = await me();
  let url: URL;
  try { url = normalizeUrl(String(f.get("website") ?? "")); } catch (e) { return { error: (e as Error).message }; }
  const website = `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  await db.from("businesses").update({ website, updated_at: new Date().toISOString() }).eq("id", business.id);
  revalidatePath("/app", "layout");
  return { ok: true, message: `Saved ${url.host}.` };
}

/* ───────── Audit steps ───────── */

/* Slow steps run as background jobs: the button returns at once and a pop-up says when it's ready. */
async function bg(kind: "seo_audit" | "seo_speed" | "seo_ai" | "seo_experts" | "geo_run", params: Record<string, unknown>, title: string, link: string, message: string): Promise<FormState> {
  const { user, business } = await me();
  const r = await enqueue({ ownerId: business.owner_id, businessId: business.id, userId: user.id, kind, params, title, link });
  return r.id ? { ok: true, id: r.id, message } : { error: r.error };
}
export async function runAuditAction(): Promise<FormState> {
  return bg("seo_audit", {}, "Website audit", "/app/seo", "Checking your website in the background — you can keep working. We'll let you know when it's ready.");
}
export async function runSpeedAction(auditId: string): Promise<FormState> {
  return bg("seo_speed", { auditId }, "Speed test", "/app/seo?tab=speed", "Speed test running in the background (up to a minute).");
}
export async function runAiAction(auditId: string): Promise<FormState> {
  return bg("seo_ai", { auditId }, "AI SEO plan", "/app/seo?tab=plan", "Writing your AI plan in the background — you can keep working.");
}
export async function runExpertsAction(auditId: string): Promise<FormState> {
  return bg("seo_experts", { auditId }, "Expert review", "/app/seo?tab=experts", "The expert panel is reviewing your site in the background.");
}
export async function deleteAuditAction(id: string): Promise<FormState> {
  const { db } = await me();
  await db.from("seo_audits").delete().eq("id", id);
  done();
  return { ok: true };
}

/* ───────── Search Console ───────── */

export async function refreshGscAction(auditId: string): Promise<FormState> {
  const { db, business } = await me();
  const g = await gscSnapshot(business);
  if (!g.data) return { error: g.error ?? "Connect Search Console first." };
  await db.from("seo_audits").update({ gsc: g.data }).eq("id", auditId);
  try { await syncSearchConsole(db, business); } catch { /* history sync is best-effort here */ }
  done();
  return { ok: true, message: "Search Console data refreshed." };
}
export async function pickGscSiteAction(site: string): Promise<FormState> {
  const { db, business } = await me();
  const { data: b } = await db.from("businesses").select("gsc_sites").eq("id", business.id).maybeSingle();
  if (!(b?.gsc_sites ?? []).includes(site)) return { error: "Pick one of your Search Console properties." };
  await db.from("businesses").update({ gsc_site: site, seo_state: { ...(business.seo_state ?? {}), gsc_synced_at: null } }).eq("id", business.id);
  done();
  return { ok: true };
}
export async function disconnectGscAction(): Promise<FormState> {
  const { db, business } = await me();
  await db.from("businesses").update({ gsc_refresh_enc: null, gsc_site: null, gsc_sites: [], gsc_email: null }).eq("id", business.id);
  done();
  return { ok: true };
}

/* ───────── Keywords & rankings ───────── */

export async function addKeywordsAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => addKeywordsActionImpl(s, f));
}
async function addKeywordsActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, business } = await me();
  const list = [...new Set(String(f.get("keywords") ?? "").split(/[\n,]+/).map((k) => k.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)).filter((k) => k.length >= 2))];
  if (!list.length) return { error: "Type at least one keyword (one per line)." };
  const { data: already } = await db.from("seo_keywords").select("keyword").eq("business_id", business.id).in("keyword", list);
  const fresh = list.length - (already?.length ?? 0);
  if (fresh > 0) {
    const gate = await checkLimit(business.owner_id, "keywords", fresh, db);
    if (!gate.ok) return { error: gate.error };
  }
  const source = String(f.get("source") ?? "manual").slice(0, 20);
  await db.from("seo_keywords").upsert(list.map((keyword) => ({ owner_id: business.owner_id, business_id: business.id, keyword, source })), { onConflict: "business_id,keyword", ignoreDuplicates: true });
  let note = "";
  if (business.gsc_site) { try { await syncSearchConsole(db, business, { full: true }); note = " Positions loaded from Search Console."; } catch (e) { note = ` (${errOf(e)})`; } }
  done();
  return { ok: true, message: `Tracking ${list.length} keyword${list.length > 1 ? "s" : ""}.${note}` };
}
export async function trackKeywordAction(keyword: string, source = "suggest"): Promise<FormState> {
  const f = new FormData(); f.set("keywords", keyword); f.set("source", source);
  return addKeywordsAction(undefined, f);
}
export async function removeKeywordAction(id: string): Promise<FormState> {
  const { db } = await me();
  await db.from("seo_keywords").delete().eq("id", id);
  done();
  return { ok: true };
}
export async function syncRankingsAction(): Promise<FormState> {
  const { db, business } = await me();
  try {
    const r = await syncSearchConsole(db, business, { full: true });
    done();
    return r.ok ? { ok: true, message: `Updated ${r.keywords} keywords · ${r.days} days of Google data.` } : { error: r.error };
  } catch (e) { return { error: errOf(e) }; }
}
/** Exact live Google position via SerpApi / DataForSEO (optional paid key). */
export async function checkSerpAction(): Promise<FormState> {
  const { db, business } = await me();
  if (!serpReady) return { error: "Add a SERPAPI_KEY (or DATAFORSEO_LOGIN/PASSWORD) in Vercel for exact live positions." };
  if (!business.website) return { error: "Add your website first." };
  const { data: kws } = await db.from("seo_keywords").select("id, keyword").eq("business_id", business.id).limit(50);
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  const location = (business.seo_prefs as SeoPrefs | null)?.location || business.city || undefined;
  for (const k of kws ?? []) {
    try {
      const r = await serpPosition(k.keyword, business.website, location);
      await db.from("seo_rankings").upsert({ owner_id: business.owner_id, business_id: business.id, keyword_id: k.id, day: today, source: "serp", position: r.position, url: r.url, top: r.top }, { onConflict: "keyword_id,day,source" });
      n++;
    } catch (e) { return { error: `Stopped after ${n}: ${errOf(e)}` }; }
  }
  done();
  return { ok: true, message: `Checked ${n} keywords on Google.` };
}

export type KeywordIdea = { keyword: string; source: "search console" | "google autocomplete" | "ai"; note?: string; impressions?: number; position?: number };

/**
 * Keyword ideas. `quick` answers in well under a second (cached ideas, or Search Console + Google autocomplete);
 * the full call adds AI ideas and is cached for 12 hours, so the next time is instant too.
 */
export async function suggestKeywordsAction(opts: { quick?: boolean; fresh?: boolean } = {}): Promise<{ ideas?: KeywordIdea[]; error?: string; more?: boolean }> {
  const { db, business } = await me();
  const key = `kw:${business.id}`;
  const [{ data: tracked }, { data: audit }, hit] = await Promise.all([
    db.from("seo_keywords").select("keyword").eq("business_id", business.id),
    db.from("seo_audits").select("gsc, pages").eq("business_id", business.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    opts.fresh ? null : db.from("ai_cache").select("value, expires_at").eq("key", key).maybeSingle().then((r) => (r.data && Date.parse(r.data.expires_at) > Date.now() ? (r.data.value as KeywordIdea[]) : null), () => null),
  ]);
  const have = new Set((tracked ?? []).map((t) => t.keyword.toLowerCase()));
  const fresh = (list: KeywordIdea[]) => list.filter((i) => !have.has(i.keyword)).slice(0, 40);
  if (hit) return { ideas: fresh(hit) };

  const ideas: KeywordIdea[] = [];
  const add = (i: KeywordIdea) => { const k = i.keyword.toLowerCase().trim(); if (k && !ideas.some((x) => x.keyword === k)) ideas.push({ ...i, keyword: k }); };
  const { SEGMENTS } = await import("@/lib/plans");
  const seg = SEGMENTS.find((s) => s.id === business.segment)?.label.toLowerCase() ?? business.segment;
  const seeds = [`${seg} ${business.city ?? ""}`.trim(), `best ${seg}${business.city ? ` in ${business.city}` : ""}`, `${seg} near`, ...[...have].slice(0, 3)];
  // Everything at once: Search Console, Google autocomplete and (unless quick) AI.
  const [gsc, auto, ai] = await Promise.all([
    // 1) Real searches you already appear for — best first: page-2 positions with many impressions.
    audit?.gsc ? Promise.resolve(audit.gsc) : business.gsc_site && !opts.quick ? gscSnapshot(business).then((r) => r.data, () => null) : Promise.resolve(null),
    // 2) What people type into Google (free autocomplete).
    Promise.all(seeds.map((s) => autocomplete(s).catch(() => [] as string[]))).then((x) => x.flat()),
    // 3) AI ideas with intent.
    !opts.quick && aiReady ? geminiJson<{ keywords: { keyword: string; intent: string; why: string }[] }>(`Suggest 12 keywords this business should target to win customers from Google and AI assistants. Mix: local/"near me", service + city, problem/question keywords, comparison, and 2 long-tail informational. Realistic for a small business; lowercase.
BUSINESS: ${JSON.stringify({ name: business.name, type: seg, city: business.city, offer: business.offer, audience: business.audience })}
PAGES: ${JSON.stringify(((audit?.pages ?? []) as { url: string; title: string | null }[]).slice(0, 12).map((p) => p.title))}
ALREADY TRACKED: ${JSON.stringify([...have].slice(0, 30))}
Return JSON: {"keywords":[{"keyword":"…","intent":"local|commercial|informational|comparison","why":"one short reason"}]}`, { temperature: 0.6, timeout: 12000, lite: true }).then((r) => r.data.keywords ?? [], () => null) : Promise.resolve(null),
  ]);
  (((gsc as { queries?: unknown } | null)?.queries ?? []) as { key: string; impressions: number; position: number; clicks: number }[])
    .filter((q) => q.impressions >= 10).sort((a, b) => (b.position >= 4 && b.position <= 20 ? 1 : 0) - (a.position >= 4 && a.position <= 20 ? 1 : 0) || b.impressions - a.impressions)
    .slice(0, 15).forEach((q) => add({ keyword: q.key, source: "search console", impressions: q.impressions, position: q.position, note: q.position >= 4 && q.position <= 20 ? "almost on page 1" : undefined }));
  auto.slice(0, 30).forEach((k) => add({ keyword: k, source: "google autocomplete" }));
  (ai ?? []).forEach((k) => k?.keyword && add({ keyword: k.keyword, source: "ai", note: `${k.intent} · ${k.why}` }));
  // Only a complete answer (with AI) is kept; quick answers tell the page to fetch the rest.
  if (!opts.quick && ai) await db.from("ai_cache").upsert({ key, owner_id: business.owner_id, value: ideas, expires_at: new Date(Date.now() + 12 * 3600_000).toISOString() }, { onConflict: "key" }).then(() => {}, () => {});
  return { ideas: fresh(ideas), more: Boolean(opts.quick && aiReady) };
}

/* ───────── AI visibility (GEO) ───────── */

export async function addPromptsAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => addPromptsActionImpl(s, f));
}
async function addPromptsActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, business } = await me();
  const list = [...new Set(String(f.get("prompts") ?? "").split(/\n+/).map((p) => p.trim().slice(0, 300)).filter((p) => p.length >= 8))];
  if (!list.length) return { error: "Write at least one question (one per line)." };
  const { data: already } = await db.from("geo_prompts").select("prompt").eq("business_id", business.id).in("prompt", list);
  const fresh = list.length - (already?.length ?? 0);
  if (fresh > 0) {
    const gate = await checkLimit(business.owner_id, "geoPrompts", fresh, db);
    if (!gate.ok) return { error: gate.error };
  }
  await db.from("geo_prompts").upsert(list.map((prompt) => ({ owner_id: business.owner_id, business_id: business.id, prompt })), { onConflict: "business_id,prompt", ignoreDuplicates: true });
  done();
  return { ok: true, message: `Added ${list.length} question${list.length > 1 ? "s" : ""}.` };
}
/** Questions customers ask AI. Cached 12h; `quick` returns the cached list or instant starter questions. */
export async function suggestPromptsAction(opts: { quick?: boolean; fresh?: boolean } = {}): Promise<{ prompts?: string[]; error?: string; more?: boolean }> {
  const { db, business } = await me();
  const [kws, { data: have }] = await Promise.all([keywordPositions(db, business.id), db.from("geo_prompts").select("prompt").eq("business_id", business.id)]);
  const got = new Set((have ?? []).map((p) => p.prompt.toLowerCase()));
  const keep = (l: string[]) => l.filter((p) => !got.has(p.toLowerCase()));
  const key = `geoq:${business.id}`;
  if (opts.quick && !opts.fresh) {
    const { data } = await db.from("ai_cache").select("value, expires_at").eq("key", key).maybeSingle().then((r) => r, () => ({ data: null }));
    if (data && Date.parse(data.expires_at) > Date.now()) return { prompts: keep(data.value as string[]) };
    return { prompts: keep(await suggestPrompts({ ...business }, [], { offline: true })), more: aiReady };
  }
  const list = await cached(db, business.owner_id, key, 12 * 3600_000, () => suggestPrompts(business, kws.map((k) => k.keyword)), { fresh: opts.fresh, keep: (l) => l.length > 4 });
  return { prompts: keep(list) };
}
export async function deletePromptAction(id: string): Promise<FormState> {
  const { db } = await me();
  await db.from("geo_prompts").delete().eq("id", id);
  done();
  return { ok: true };
}
export async function runGeoAction(promptIds?: string[]): Promise<FormState> {
  const { business } = await me();
  const plan = await planFor(business.owner_id);
  const last = (business.seo_state as { geo_run_at?: string } | null)?.geo_run_at;
  const gap = plan.limits.geoEveryDays * 86400_000 - 2 * 3600_000;
  if (!plan.pro && last && Date.now() - Date.parse(last) < gap) {
    const next = new Date(Date.parse(last) + gap).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { error: `On the Free plan AI visibility is checked once a month — next check ${next}. Upgrade to Pro for weekly checks of up to ${LIMITS.pro.geoPrompts} questions ($${PRICES.pro.month}/month, starts instantly).` };
  }
  return bg("geo_run", promptIds?.length ? { promptIds } : {}, "AI visibility check", "/app/seo?tab=geo", "Asking the AI assistants in the background — this takes about a minute.");
}

/* ───────── Settings & reports ───────── */

export async function saveSeoSettingsAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => saveSeoSettingsActionImpl(s, f));
}
async function saveSeoSettingsActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { db, business } = await me();
  const pick = <T extends string>(v: FormDataEntryValue | null, ok: readonly T[], d: T) => (ok.includes(String(v) as T) ? (String(v) as T) : d);
  const emails = String(f.get("report_to") ?? "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const bad = emails.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (bad) return { error: `“${bad}” isn't a valid email.` };
  // Competitors are managed on the Competitors page now; keep what's saved unless the old field is sent.
  const competitors = !f.has("competitors") ? ((business.seo_prefs as SeoPrefs | null)?.competitors ?? []) : String(f.get("competitors") ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 10).map((l) => {
    const [name, domain] = l.split(/\s*[|,]\s*/);
    return { name: name.slice(0, 80), ...(domain ? { domain: domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").slice(0, 120) } : {}) };
  });
  const prefs: SeoPrefs = {
    audit: pick(f.get("audit"), ["daily", "weekly", "monthly", "off"] as const, "weekly"),
    geo: pick(f.get("geo"), ["daily", "weekly", "off"] as const, "weekly"),
    engines: f.getAll("engines").map(String).filter((e) => ENGINES.some((x) => x.id === e)),
    report: { freq: pick(f.get("report_freq"), ["weekly", "monthly", "off"] as const, "off"), to: emails.slice(0, 10) },
    competitors,
    location: String(f.get("location") ?? "").trim().slice(0, 80) || undefined,
  };
  await db.from("businesses").update({ seo_prefs: prefs }).eq("id", business.id);
  done();
  return { ok: true, message: "Settings saved." };
}

export async function sendReportNowAction(from: string, to: string): Promise<FormState> {
  const { db, business, user } = await me();
  const prefs = (business.seo_prefs ?? {}) as SeoPrefs;
  const recipients = prefs.report?.to?.length ? prefs.report.to : [user.email];
  const r = await sendSeoReport(db, business, { from, to }, recipients, siteOrigin());
  return r.ok ? { ok: true, message: `Report emailed to ${recipients.join(", ")}.` } : { error: r.error };
}
