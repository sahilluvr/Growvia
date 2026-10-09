import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey, esc, notify, p, rows } from "../notify";
import { SITE_URL } from "../config";
import type { Issue } from "./types";

type Db = SupabaseClient;
const link = (path: string) => `${(SITE_URL || "").replace(/\/$/, "")}${path}`;
const li = (items: string[]) => `<ul style="margin:0 0 12px;padding-left:18px;font-size:14px;color:#1D211F">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

/** After an audit: “check finished” summary, or an alert when the score drops / new critical issues appear. */
export async function auditAlert(db: Db, b: { id: string; owner_id: string; name: string }, auditId: string, trigger: string) {
  const { data: two } = await db.from("seo_audits").select("id, score, issues").eq("business_id", b.id).eq("status", "done").order("created_at", { ascending: false }).limit(2);
  const [cur, prev] = two ?? [];
  if (!cur || cur.id !== auditId) return;
  const prevIds = new Set(((prev?.issues ?? []) as Issue[]).map((i) => i.id));
  const newCrit = ((cur.issues ?? []) as Issue[]).filter((i) => i.severity === "critical" && !prevIds.has(i.id));
  const fixed = ((prev?.issues ?? []) as Issue[]).filter((i) => !((cur.issues ?? []) as Issue[]).some((x) => x.id === i.id));
  const drop = prev?.score != null && cur.score != null ? prev.score - cur.score : 0;
  const url = link(`/app/seo?audit=${auditId}`);
  if (prev && (drop >= 5 || newCrit.length)) {
    await notify({ ownerId: b.owner_id, businessId: b.id, type: "seo_alert", dedupe: auditId, subject: `⚠ ${b.name}: SEO ${drop >= 5 ? `score dropped ${drop} points` : `${newCrit.length} new critical issue${newCrit.length > 1 ? "s" : ""}`}`, title: "Something needs your attention",
      body: rows([["SEO score", `${cur.score} (was ${prev.score})`]]) + (newCrit.length ? p("<b>New critical issues</b>") + li(newCrit.map((i) => i.title)) : ""), cta: { label: "See what changed", url } });
  } else if (trigger === "schedule") {
    await notify({ ownerId: b.owner_id, businessId: b.id, type: "seo_audit", dedupe: auditId, subject: `${b.name}: SEO check done — ${cur.score}/100`, title: "Your website check is done",
      body: rows([["SEO score", `${cur.score}${prev?.score != null ? ` (was ${prev.score})` : ""}`], ["Issues", String((cur.issues ?? []).length)]]) + (fixed.length ? p(`<b>Fixed since last time</b>`) + li(fixed.slice(0, 6).map((i) => i.title)) : ""), cta: { label: "Open the report", url } });
  }
}

/** After a Search Console sync: keywords that entered or left the top 10 this week. */
export async function rankAlert(db: Db, b: { id: string; owner_id: string; name: string }) {
  const since = new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10);
  const [{ data: kws }, { data: ranks }] = await Promise.all([
    db.from("seo_keywords").select("id, keyword").eq("business_id", b.id),
    db.from("seo_rankings").select("keyword_id, day, position").eq("business_id", b.id).eq("source", "gsc").gte("day", since).order("day"),
  ]);
  const up: string[] = [], down: string[] = [];
  for (const k of kws ?? []) {
    const r = (ranks ?? []).filter((x) => x.keyword_id === k.id && x.position != null);
    if (r.length < 2) continue;
    const now = Number(r.at(-1)!.position), then = Number(r[0].position);
    if (now <= 10 && then > 10) up.push(`${k.keyword}: ${then.toFixed(1)} → ${now.toFixed(1)}`);
    if (now > 10 && then <= 10) down.push(`${k.keyword}: ${then.toFixed(1)} → ${now.toFixed(1)}`);
  }
  if (!up.length && !down.length) return;
  await notify({ ownerId: b.owner_id, businessId: b.id, type: "rank_alert", dedupe: `${b.id}:${dayKey()}`, subject: `${b.name}: ${up.length ? `${up.length} keyword${up.length > 1 ? "s" : ""} reached Google's top 10` : `${down.length} keyword${down.length > 1 ? "s" : ""} dropped out of the top 10`}`, title: "Keyword ranking changes",
    body: (up.length ? p("<b>🎉 Now in the top 10</b>") + li(up) : "") + (down.length ? p("<b>Dropped out of the top 10</b>") + li(down) : ""), cta: { label: "Open keywords", url: link("/app/seo?tab=keywords") } });
}

/** After an AI-visibility run: alert when mentions move by 10+ points vs the previous run. */
export async function geoAlert(db: Db, b: { id: string; owner_id: string; name: string }, runId: string) {
  const { data } = await db.from("geo_checks").select("run_id, mentioned, created_at").eq("business_id", b.id).is("error", null).order("created_at", { ascending: false }).limit(600);
  const runs = [...new Set((data ?? []).map((c) => c.run_id))];
  if (runs[0] !== runId || runs.length < 2) return;
  const rate = (id: string) => { const l = (data ?? []).filter((c) => c.run_id === id); return l.length ? Math.round((l.filter((c) => c.mentioned).length / l.length) * 100) : 0; };
  const now = rate(runs[0]), before = rate(runs[1]);
  if (Math.abs(now - before) < 10) return;
  await notify({ ownerId: b.owner_id, businessId: b.id, type: "geo_alert", dedupe: runId, subject: `${b.name}: AI assistants mention you ${now > before ? "more" : "less"} (${before}% → ${now}%)`, title: now > before ? "AI assistants recommend you more" : "AI assistants mention you less",
    body: rows([["Now", `${now}% of answers`], ["Before", `${before}%`]]) + p(now > before ? "Keep going — the content and listings you added are working." : "Check which questions you lost and who AI recommends instead."), cta: { label: "Open AI visibility", url: link("/app/seo?tab=geo") } });
}

/** Monday summary of the past 7 days for one project. */
export async function weeklyDigest(db: Db, b: { id: string; owner_id: string; name: string }) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ count: leads }, { count: replies }, { count: sent }, { data: audit }, { data: geo }, { data: daily }] = await Promise.all([
    db.from("leads").select("id", { count: "exact", head: true }).eq("business_id", b.id).gt("created_at", since),
    db.from("messages").select("id", { count: "exact", head: true }).eq("owner_id", b.owner_id).eq("direction", "in").gt("created_at", since),
    db.from("messages").select("id", { count: "exact", head: true }).eq("owner_id", b.owner_id).eq("direction", "out").eq("status", "sent").gt("created_at", since),
    db.from("seo_audits").select("score").eq("business_id", b.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("geo_checks").select("mentioned").eq("business_id", b.id).is("error", null).gt("created_at", since),
    db.from("seo_daily").select("clicks").eq("business_id", b.id).gt("day", since.slice(0, 10)),
  ]);
  const vis = geo?.length ? `${Math.round((geo.filter((g) => g.mentioned).length / geo.length) * 100)}%` : "—";
  const week = `${new Date().getUTCFullYear()}-${Math.ceil((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / (7 * 86400000))}`;
  return notify({ ownerId: b.owner_id, businessId: b.id, type: "digest", dedupe: `${b.id}:${week}`, subject: `${b.name}: your week — ${leads ?? 0} new leads, ${replies ?? 0} replies`, title: `Your week at ${b.name}`,
    body: rows([["New leads", String(leads ?? 0)], ["Replies received", String(replies ?? 0)], ["Emails & messages sent", String(sent ?? 0)], ["SEO score", audit?.score != null ? `${audit.score}/100` : "—"], ["AI visibility", vis], ["Google clicks", String((daily ?? []).reduce((n, d) => n + d.clicks, 0))]]), cta: { label: "Open Growvia", url: link("/app") } });
}
