import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiError, aiReady, geminiGrounded, geminiJson } from "../ai/gemini";
import { SEGMENTS } from "../plans";
import { geoAlert } from "./alerts";

/*
 * AI visibility (GEO): ask AI assistants the questions your customers ask, and record whether they
 * recommend you, cite your website, who else they name, and how they talk about you.
 */

type Db = SupabaseClient;
const PPLX_KEY = process.env.PERPLEXITY_API_KEY?.trim() || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || "";
const PPLX_BASE = (process.env.PERPLEXITY_BASE?.trim() || "https://api.perplexity.ai").replace(/\/$/, "");
const OPENAI_BASE = (process.env.OPENAI_BASE?.trim() || "https://api.openai.com").replace(/\/$/, "");

export const ENGINES = [
  { id: "gemini", label: "Google Gemini", note: "same engine as Google AI Overviews / AI Mode", ready: aiReady, key: "GEMINI_API_KEY" },
  { id: "perplexity", label: "Perplexity", note: "answer engine with live web sources", ready: Boolean(PPLX_KEY), key: "PERPLEXITY_API_KEY" },
  { id: "openai", label: "ChatGPT (OpenAI)", note: "ChatGPT search with web results", ready: Boolean(OPENAI_KEY), key: "OPENAI_API_KEY" },
] as const;
export type EngineId = (typeof ENGINES)[number]["id"];

type Answer = { text: string; sources: string[] };

async function ask(engine: EngineId, prompt: string): Promise<Answer> {
  if (engine === "gemini") {
    const r = await geminiGrounded(prompt);
    return { text: r.text, sources: r.sources.map((s) => s.title && !/^https?:/.test(s.title) && /\./.test(s.title) ? `https://${s.title}` : s.url) };
  }
  if (engine === "perplexity") {
    const r = await fetch(`${PPLX_BASE}/chat/completions`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(45000), headers: { Authorization: `Bearer ${PPLX_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.PERPLEXITY_MODEL?.trim() || "sonar", messages: [{ role: "user", content: prompt }] }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new AiError(d?.error?.message ?? `Perplexity error ${r.status}`);
    return { text: d?.choices?.[0]?.message?.content ?? "", sources: [...(d?.citations ?? []), ...((d?.search_results ?? []) as { url: string }[]).map((x) => x.url)].filter(Boolean) };
  }
  const r = await fetch(`${OPENAI_BASE}/v1/responses`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(50000), headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini", tools: [{ type: "web_search" }], input: prompt }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiError(d?.error?.message ?? `OpenAI error ${r.status}`);
  let text = "";
  const sources: string[] = [];
  for (const o of d?.output ?? []) for (const c of o?.content ?? []) if (c?.type === "output_text") { text += c.text ?? ""; for (const a of c.annotations ?? []) if (a?.url) sources.push(a.url); }
  return { text: text || d?.output_text || "", sources };
}

const hostOf = (u: string) => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
/** Brand matching that survives "Bella's" vs "Bellas" vs "Bella’s Trattoria". */
export function mentions(text: string, brand: string, domain: string) {
  const t = ` ${norm(text)} `;
  const b = norm(brand);
  const core = norm(brand.replace(/\b(the|pvt|ltd|llc|inc|private|limited|co)\b\.?/gi, ""));
  return (b && t.includes(` ${b} `)) || (core.length >= 4 && t.includes(` ${core} `)) || (domain && ` ${text.toLowerCase()} `.includes(domain));
}

type Extract = { results: { id: string; businesses: string[]; sentiment: "positive" | "neutral" | "negative" | "not mentioned" }[] };

/** One cheap AI call reads all answers of a run and lists the businesses each one names, in order. */
async function extractBusinesses(items: { id: string; text: string }[], brand: string): Promise<Map<string, Extract["results"][number]>> {
  const out = new Map<string, Extract["results"][number]>();
  if (!aiReady || !items.length) return out;
  try {
    const { data } = await geminiJson<Extract>(`For each AI answer below, list the names of the businesses/brands it recommends or mentions, in the order they appear (max 10, no generic words). Then give the sentiment toward "${brand}" (positive, neutral, negative, or "not mentioned").
ANSWERS: ${JSON.stringify(items.map((i) => ({ id: i.id, answer: i.text.slice(0, 3500) })))}
Return JSON: {"results":[{"id":"…","businesses":["…"],"sentiment":"positive|neutral|negative|not mentioned"}]}`, { temperature: 0, timeout: 40000, lite: true });
    for (const r of data.results ?? []) if (r?.id) out.set(r.id, { id: r.id, businesses: Array.isArray(r.businesses) ? r.businesses.slice(0, 10) : [], sentiment: r.sentiment });
  } catch { /* extraction is a bonus; mention/citation still work */ }
  return out;
}

export type GeoBiz = { id: string; owner_id: string; name: string; website: string | null; segment: string; city: string | null; offer?: string | null; seo_state?: Record<string, unknown> | null };

/** Runs every prompt on every ready engine (or a subset), within a time budget. */
export async function runGeo(db: Db, b: GeoBiz, { engines, promptIds, deadline = Date.now() + 50000, limit = 30 }: { engines?: EngineId[]; promptIds?: string[]; deadline?: number; limit?: number } = {}) {
  let q = db.from("geo_prompts").select("id, prompt").eq("business_id", b.id).order("created_at").limit(Math.max(1, Math.min(30, limit)));
  if (promptIds?.length) q = q.in("id", promptIds);
  const { data: prompts } = await q;
  const use = ENGINES.filter((e) => e.ready && (!engines || engines.includes(e.id))).map((e) => e.id);
  if (!use.length) return { ok: false as const, error: "No AI engine is switched on — add GEMINI_API_KEY (free) in Vercel." };
  if (!prompts?.length) return { ok: false as const, error: "Add a few questions first (or let Growvia suggest them)." };
  const runId = randomUUID();
  const domain = hostOf(b.website ?? "");
  const jobs = prompts.flatMap((p) => use.map((engine) => ({ p, engine })));
  const done: { id: string; p: { id: string; prompt: string }; engine: EngineId; a?: Answer; error?: string }[] = [];
  for (let i = 0; i < jobs.length && Date.now() < deadline - 12000; i += 4) {
    const batch = await Promise.all(jobs.slice(i, i + 4).map(async ({ p, engine }) => {
      try { return { id: randomUUID(), p, engine, a: await ask(engine, p.prompt) }; } catch (e) { return { id: randomUUID(), p, engine, error: e instanceof Error ? e.message.slice(0, 200) : "failed" }; }
    }));
    done.push(...batch);
  }
  const ex = await extractBusinesses(done.filter((d) => d.a?.text).map((d) => ({ id: d.id, text: d.a!.text })), b.name);
  const rows = done.map((d) => {
    const text = d.a?.text ?? "";
    const sources = [...new Set((d.a?.sources ?? []).filter(Boolean))].slice(0, 20);
    const named = ex.get(d.id)?.businesses ?? [];
    const mentioned = Boolean(text) && mentions(text, b.name, domain);
    const idx = named.findIndex((n) => mentions(n, b.name, domain));
    return {
      owner_id: b.owner_id, business_id: b.id, prompt_id: d.p.id, run_id: runId, engine: d.engine,
      mentioned, rank: mentioned ? (idx >= 0 ? idx + 1 : null) : null,
      cited: Boolean(domain) && sources.some((s) => hostOf(s) === domain || hostOf(s).endsWith(`.${domain}`) || s.toLowerCase().includes(domain)),
      sources, competitors: named.filter((n) => !mentions(n, b.name, domain)).slice(0, 8),
      sentiment: mentioned ? (ex.get(d.id)?.sentiment ?? null) : "not mentioned",
      answer: text.slice(0, 6000) || null, error: d.error ?? null,
    };
  });
  if (rows.length) await db.from("geo_checks").insert(rows);
  await db.from("businesses").update({ seo_state: { ...(b.seo_state ?? {}), geo_run_at: new Date().toISOString() } }).eq("id", b.id);
  await geoAlert(db, b, runId).catch(() => null);
  return { ok: true as const, runId, checks: rows.length, mentioned: rows.filter((r) => r.mentioned).length, partial: rows.length < jobs.length };
}

/** Questions real customers would type into ChatGPT / Gemini / Perplexity for this business. */
export async function suggestPrompts(b: GeoBiz, keywords: string[], opts: { offline?: boolean } = {}): Promise<string[]> {
  const seg = SEGMENTS.find((s) => s.id === b.segment)?.label ?? b.segment;
  const city = b.city ?? "";
  const base = [
    `What is the best ${seg.toLowerCase()}${city ? ` in ${city}` : ""}?`,
    `Recommend a good ${seg.toLowerCase()}${city ? ` near ${city}` : ""} and explain why`,
    `Top 5 ${seg.toLowerCase()}s${city ? ` in ${city}` : ""} with good reviews`,
    `Is ${b.name}${city ? ` in ${city}` : ""} any good?`,
  ];
  if (!aiReady || opts.offline) return base;
  try {
    const { data } = await geminiJson<{ prompts: string[] }>(`You help a business measure how often AI assistants (ChatGPT, Gemini, Perplexity) recommend it. Write 10 realistic questions its potential customers would type into an AI assistant — mostly unbranded discovery questions (best/near me/which/compare/how much/what should I look for), 2 comparison questions, 1 brand question. Include the city when natural.
BUSINESS: ${JSON.stringify({ name: b.name, type: seg, city, offer: b.offer, website: b.website })}
KEYWORDS THEY TARGET: ${JSON.stringify(keywords.slice(0, 20))}
Return JSON: {"prompts":["…"]}`, { temperature: 0.6, timeout: 12000, lite: true });
    const list = (data.prompts ?? []).filter((x) => typeof x === "string" && x.length > 8).map((x) => x.trim().slice(0, 300));
    return list.length ? list.slice(0, 12) : base;
  } catch {
    return base;
  }
}
