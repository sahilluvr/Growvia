import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * One picture of how a project is doing: a combined Growth Score, what's set up, the next best actions and
 * the live status of the first-run analysis. Used by Home, the Growth Report and the sidebar setup badge.
 */

type Biz = { id: string; owner_id: string; name: string; website: string | null; city?: string | null; local_state?: Record<string, unknown> | null };

export type SetupStep = { id: string; label: string; done: boolean; href: string; cta: string; hint: string };
export type NextAction = { id: string; title: string; why: string; href: string; cta: string; tone: "urgent" | "win" | "setup" };
export type JobState = { kind: string; status: "none" | "queued" | "running" | "done" | "failed"; message: string | null };
export type GeoAnswer = { prompt: string; mentioned: boolean };

export type Snapshot = {
  score: number | null;
  parts: { seo: number | null; ai: number | null; speed: number | null; local: number | null };
  setup: SetupStep[];
  setupDone: number;
  actions: NextAction[];
  wins: { title: string; fix: string }[];
  geo: GeoAnswer[];
  rivals: string[];
  jobs: Record<"audit" | "speed" | "plan" | "geo", JobState>;
  analysing: boolean;
  auditAt: string | null;
  hasWebsite: boolean;
  newLeads: number;
  facts: { pages: number | null; https: boolean | null; critical: number; warnings: number };
};

const SEVERITY: Record<string, number> = { critical: 3, warning: 2, notice: 1 };

export async function growthSnapshot(db: SupabaseClient, b: Biz): Promise<Snapshot> {
  const [audit, prompts, checks, mailboxes, channels, forms, formLeads, rivals, newLeads, jobs] = await Promise.all([
    db.from("seo_audits").select("id, status, score, speed, issues, ai, created_at, crawled:site->crawled, https:site->https").eq("business_id", b.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("geo_prompts").select("id, prompt").eq("business_id", b.id),
    db.from("geo_checks").select("prompt_id, run_id, mentioned, competitors, error, created_at").eq("business_id", b.id).order("created_at", { ascending: false }).limit(200),
    db.from("mailboxes").select("id", { count: "exact", head: true }).or(`business_id.eq.${b.id},business_id.is.null`),
    db.from("channel_accounts").select("id", { count: "exact", head: true }),
    db.from("lead_forms").select("submissions").eq("business_id", b.id),
    db.from("leads").select("id", { count: "exact", head: true }).eq("business_id", b.id).eq("source", "Website form"),
    db.from("competitors").select("id", { count: "exact", head: true }).eq("business_id", b.id),
    db.from("leads").select("id", { count: "exact", head: true }).eq("business_id", b.id).eq("stage", "new"),
    db.from("jobs").select("kind, status, message, created_at").eq("business_id", b.id).in("kind", ["seo_audit", "seo_speed", "seo_ai", "geo_run"]).order("created_at", { ascending: false }).limit(20),
  ]);

  const af = audit.data as { crawled?: number | null; https?: boolean | null } | null;
  const a = audit.data as { status: string; score: number | null; speed: Record<string, { performance?: number; ok?: boolean }> | null; issues: { id: string; severity: string; title: string; fix: string }[] | null; ai: { quickWins?: string[] } | null; created_at: string } | null;
  const done = a?.status === "done";

  // Scores (0–100 each, missing parts are left out of the combined score).
  const seo = done && typeof a?.score === "number" ? a.score : null;
  const perf = ["mobile", "desktop"].map((k) => a?.speed?.[k]?.performance).filter((x): x is number => typeof x === "number");
  const speed = perf.length ? Math.round(perf.reduce((s, x) => s + x, 0) / perf.length) : null;
  const okChecks = (checks.data ?? []).filter((c) => !c.error);
  const lastRun = okChecks[0]?.run_id;
  const latest = okChecks.filter((c) => c.run_id === lastRun);
  const ai = latest.length ? Math.round((latest.filter((c) => c.mentioned).length / latest.length) * 100) : null;
  const ls = (b.local_state ?? {}) as { google?: unknown; location?: { title?: string } | null; profile?: { score?: number } | null };
  const local = ls.google && ls.location ? (typeof ls.profile?.score === "number" ? ls.profile.score : 70) : null;
  const parts = { seo, ai, speed, local };
  const weights = { seo: 0.4, ai: 0.3, speed: 0.2, local: 0.1 } as const;
  let wsum = 0, total = 0;
  for (const k of Object.keys(weights) as (keyof typeof weights)[]) { const v = parts[k]; if (v != null) { wsum += weights[k]; total += v * weights[k]; } }
  const score = wsum ? Math.round(total / wsum) : null;

  // Setup checklist.
  const formLive = (forms.data ?? []).some((f) => (f.submissions ?? 0) > 0) || (formLeads.count ?? 0) > 0;
  const setup: SetupStep[] = [
    { id: "website", label: "Add your website", done: Boolean(b.website), href: "/app/seo", cta: "Add website", hint: "So Growvia can check it for Google and AI search." },
    { id: "audit", label: "Get your first website report", done, href: "/app/report", cta: "See report", hint: "SEO, speed and AI-readiness in one view." },
    { id: "geo", label: "Track what customers ask AI", done: (prompts.data ?? []).length > 0, href: "/app/seo?tab=geo", cta: "Add questions", hint: "See if ChatGPT-style assistants recommend you." },
    { id: "google", label: "Connect Google Business Profile", done: Boolean(ls.google && ls.location), href: "/app/local", cta: "Connect", hint: "Reviews, calls and Maps rankings in one place." },
    { id: "email", label: "Connect your email", done: (mailboxes.count ?? 0) > 0, href: "/app/integrations", cta: "Connect", hint: "Send follow-ups and campaigns from your own address." },
    { id: "social", label: "Connect social accounts", done: (channels.count ?? 0) > 0, href: "/app/integrations", cta: "Connect", hint: "Publish and reply on Facebook, Instagram and more." },
    { id: "form", label: "Put a lead form on your website", done: formLive, href: "/app/forms", cta: "Get the form", hint: "Every enquiry lands in Leads automatically." },
    { id: "rivals", label: "Add your competitors", done: (rivals.count ?? 0) > 0, href: "/app/competitors", cta: "Add", hint: "Know where they're ahead and how to catch up." },
  ];
  const setupDone = setup.filter((s) => s.done).length;

  // Quick wins from the audit (most severe first).
  const issues = [...(a?.issues ?? [])].sort((x, y) => (SEVERITY[y.severity] ?? 0) - (SEVERITY[x.severity] ?? 0));
  const wins = issues.slice(0, 3).map((i) => ({ title: i.title, fix: i.fix }));
  if (!wins.length) for (const q of a?.ai?.quickWins ?? []) { const [t, f] = q.split(" — "); wins.push({ title: t, fix: f ?? "" }); if (wins.length >= 3) break; }

  // What AI assistants said, per question (latest successful answer for each).
  const promptText = new Map((prompts.data ?? []).map((p) => [p.id, p.prompt as string]));
  const seen = new Set<string>();
  const geo: GeoAnswer[] = [];
  for (const c of latest) { if (seen.has(c.prompt_id)) continue; seen.add(c.prompt_id); const t = promptText.get(c.prompt_id); if (t) geo.push({ prompt: t, mentioned: c.mentioned }); }
  const freq = new Map<string, number>();
  for (const c of latest) for (const n of (c.competitors ?? []) as string[]) if (n && n.toLowerCase() !== b.name.toLowerCase()) freq.set(n, (freq.get(n) ?? 0) + 1);
  const rivalNames = [...freq.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n).slice(0, 5);

  // Live analysis status (latest job of each kind).
  const pick = (kind: string): JobState => {
    const j = (jobs.data ?? []).find((x) => x.kind === kind);
    return j ? { kind, status: j.status as JobState["status"], message: j.message ?? null } : { kind, status: "none", message: null };
  };
  const js = { audit: pick("seo_audit"), speed: pick("seo_speed"), plan: pick("seo_ai"), geo: pick("geo_run") };
  const analysing = Object.values(js).some((j) => j.status === "queued" || j.status === "running");

  // Next best actions: always three, most valuable first.
  const actions: NextAction[] = [];
  const add = (x: NextAction) => { if (actions.length < 3 && !actions.some((y) => y.id === x.id)) actions.push(x); };
  const nl = newLeads.count ?? 0;
  if (!b.website) add({ id: "website", title: "Add your website", why: "Growvia can't check your Google and AI visibility without it.", href: "/app/seo", cta: "Add website", tone: "setup" });
  if (nl > 0) add({ id: "leads", title: `Reply to ${nl} new lead${nl === 1 ? "" : "s"}`, why: "People who get a reply within an hour are far more likely to buy.", href: "/app/leads", cta: "Open leads", tone: "urgent" });
  const crit = issues.find((i) => i.severity === "critical");
  if (crit) add({ id: "critical", title: crit.title, why: crit.fix, href: "/app/seo?tab=issues", cta: "Fix this", tone: "urgent" });
  if (ai != null && ai < 50 && geo.length) { const missed = geo.filter((g) => !g.mentioned).length; add({ id: "ai", title: `AI assistants skip you for ${missed} of ${geo.length} questions`, why: "Add clear answers (FAQ, services, prices, location) so assistants can recommend you.", href: "/app/seo?tab=geo", cta: "See how to fix", tone: "win" }); }
  if (speed != null && speed < 50) add({ id: "speed", title: "Your website is slow", why: `Speed score ${speed}/100 — slow pages lose visitors and rankings.`, href: "/app/seo?tab=speed", cta: "Speed it up", tone: "win" });
  const warn = issues.find((i) => i.severity === "warning");
  if (warn) add({ id: "warning", title: warn.title, why: warn.fix, href: "/app/seo?tab=issues", cta: "Fix this", tone: "win" });
  for (const s of setup) if (!s.done && s.id !== "website" && s.id !== "audit") add({ id: `setup-${s.id}`, title: s.label, why: s.hint, href: s.href, cta: s.cta, tone: "setup" });

  return { score, parts, setup, setupDone, actions, wins, geo, rivals: rivalNames, jobs: js, analysing, auditAt: a?.created_at ?? null, hasWebsite: Boolean(b.website), newLeads: nl,
    facts: { pages: done ? Number(af?.crawled ?? 0) || null : null, https: done ? (af?.https ?? null) : null, critical: issues.filter((i) => i.severity === "critical").length, warnings: issues.filter((i) => i.severity === "warning").length } };
}

/** Cheap version for the sidebar badge: head counts only (same 8 steps as the Home checklist). */
export async function setupProgress(db: SupabaseClient, b: Biz): Promise<{ done: number; total: number }> {
  try {
    const head = { count: "exact" as const, head: true };
    const [audit, prompts, mailboxes, channels, forms, formLeads, rivals] = await Promise.all([
      db.from("seo_audits").select("id", head).eq("business_id", b.id).eq("status", "done"),
      db.from("geo_prompts").select("id", head).eq("business_id", b.id),
      db.from("mailboxes").select("id", head).or(`business_id.eq.${b.id},business_id.is.null`),
      db.from("channel_accounts").select("id", head),
      db.from("lead_forms").select("id", head).eq("business_id", b.id).gt("submissions", 0),
      db.from("leads").select("id", head).eq("business_id", b.id).eq("source", "Website form"),
      db.from("competitors").select("id", head).eq("business_id", b.id),
    ]);
    const ls = (b.local_state ?? {}) as { google?: unknown; location?: unknown };
    const flags = [Boolean(b.website), (audit.count ?? 0) > 0, (prompts.count ?? 0) > 0, Boolean(ls.google && ls.location), (mailboxes.count ?? 0) > 0, (channels.count ?? 0) > 0, (forms.count ?? 0) + (formLeads.count ?? 0) > 0, (rivals.count ?? 0) > 0];
    return { done: flags.filter(Boolean).length, total: flags.length };
  } catch { return { done: 0, total: 8 }; }
}
