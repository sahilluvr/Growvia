import "server-only";

// Google Gemini (free tier from aistudio.google.com). GEMINI_MODEL is optional.
// Each model has its OWN free quota, so when one is used up we move on to the next free model.
const BASE = (process.env.GEMINI_BASE?.trim() || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
const KEY = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
const EXTRA = (process.env.GEMINI_FALLBACK_MODELS ?? "").split(",").map((s) => s.trim());
export const MODELS = [
  process.env.GEMINI_MODEL?.trim(),
  "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3-flash-preview",
  "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash",
  ...EXTRA,
].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);

export const aiReady = Boolean(KEY);

export class AiError extends Error {}

/* Remember which models are out of quota (per server instance) so we don't waste calls on them. */
const coolDown = new Map<string, number>();
const retired = new Set<string>();
let preferred: string | null = null;
const usable = (lite = false) => {
  const now = Date.now();
  const list = MODELS.filter((m) => !retired.has(m) && (coolDown.get(m) ?? 0) < now);
  // Bulk/background work (AI-visibility checks) starts with the "lite" models so the main models' quota stays free for you.
  if (lite) return [...list.filter((m) => m.includes("lite")), ...list.filter((m) => !m.includes("lite"))];
  return preferred && list.includes(preferred) ? [preferred, ...list.filter((m) => m !== preferred)] : list;
};

type Quota = { daily: boolean; retryMs: number };
function quotaInfo(body: Record<string, any>): Quota { // eslint-disable-line @typescript-eslint/no-explicit-any
  const msg = String(body?.error?.message ?? "");
  const details = (body?.error?.details ?? []) as { "@type"?: string; retryDelay?: string; violations?: { quotaId?: string; quotaMetric?: string }[] }[];
  const ids = details.flatMap((d) => d.violations ?? []).map((v) => `${v.quotaId ?? ""} ${v.quotaMetric ?? ""}`).join(" ") + " " + msg;
  const retry = details.find((d) => d.retryDelay)?.retryDelay ?? msg.match(/retry in ([\d.]+)s/i)?.[1];
  return { daily: /PerDay|per day|daily|limit: 0/i.test(ids), retryMs: retry ? Math.ceil(parseFloat(retry) * 1000) : 60_000 };
}

function friendlyQuota(all: { model: string; q: Quota }[]) {
  if (!all.length) return "Gemini is busy right now — please try again in a minute.";
  if (all.every((x) => x.q.daily)) return "Today's free Gemini limit is used up on every free model for this API key. It resets at midnight Pacific time (around 12:30–1:30 pm India time). To keep going now, enable billing on the key in Google AI Studio (pay-as-you-go is cheap) or add a second key as GEMINI_API_KEY.";
  const wait = Math.max(5, Math.round(Math.min(...all.filter((x) => !x.q.daily).map((x) => x.q.retryMs)) / 1000));
  return `Gemini's free per-minute limit was reached on all free models — try again in about ${wait} seconds.`;
}

type Call = { body: object; timeout: number; lite?: boolean };
/** POSTs to generateContent, walking the model list: 404 → retired, 429 → cool down and try the next model. */
async function callGemini(c: Call): Promise<{ json: Record<string, any>; model: string }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!KEY) throw new AiError("AI isn't switched on yet — add GEMINI_API_KEY in Vercel (free from aistudio.google.com).");
  const limited: { model: string; q: Quota }[] = [];
  let lastErr = "";
  // Models that recently hit a limit go last (not skipped) — quotas can come back sooner than we guess.
  const fresh = usable(c.lite);
  const resting = [...coolDown.entries()].filter(([m]) => !retired.has(m) && !fresh.includes(m) && MODELS.includes(m)).sort((a, b) => a[1] - b[1]).map(([m]) => m);
  const list = [...fresh, ...resting];
  for (const model of list) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(KEY)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.body), cache: "no-store", signal: AbortSignal.timeout(c.timeout),
        });
      } catch (e) {
        throw new AiError((e as Error).name === "TimeoutError" ? "The AI took too long to answer — try again." : "Couldn't reach Google Gemini.");
      }
      const json = await res.json().catch(() => ({}));
      if (res.ok) { coolDown.delete(model); if (!c.lite) preferred = model; return { json, model }; }
      const msg: string = json?.error?.message ?? `Gemini error ${res.status}`;
      if (res.status === 404 || (res.status === 400 && /not found|not supported|unsupported|is not available/i.test(msg))) { retired.add(model); lastErr = `${model} not available`; break; }
      if (res.status === 429 || json?.error?.status === "RESOURCE_EXHAUSTED") {
        const q = quotaInfo(json);
        // A short per-minute wait on the preferred model is worth one retry; otherwise move on.
        if (!q.daily && q.retryMs <= 6000 && attempt === 0) { await new Promise((r) => setTimeout(r, q.retryMs + 250)); continue; }
        coolDown.set(model, Date.now() + (q.daily ? 3 * 3600_000 : q.retryMs));
        limited.push({ model, q });
        break;
      }
      if (res.status === 400 && /API key/i.test(msg)) throw new AiError("The GEMINI_API_KEY in Vercel isn't valid — create a new one at aistudio.google.com.");
      if (res.status === 403) throw new AiError("This Gemini key isn't allowed to use the API — check it in aistudio.google.com.");
      if (res.status >= 500) { lastErr = `${model}: ${msg.slice(0, 80)}`; break; } // try another model
      throw new AiError(msg.slice(0, 200));
    }
  }
  if (limited.length) throw new AiError(friendlyQuota(limited));
  throw new AiError(`No Gemini model is available right now (${lastErr || "all busy"}). Set GEMINI_MODEL in Vercel to a current model name.`);
}

/** Asks Gemini for JSON. Falls back through model names if one is retired or out of quota. */
export async function geminiJson<T>(prompt: string, { temperature = 0.4, maxTokens = 8192, timeout = 50000, lite = false } = {}): Promise<{ data: T; model: string }> {
  const { json, model } = await callGemini({ timeout, lite, body: { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: "application/json" } } });
  const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new AiError(json?.promptFeedback?.blockReason ? "The AI declined to answer this request." : "The AI returned an empty answer — try again.");
  try {
    return { data: JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T, model };
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return { data: JSON.parse(m[0]) as T, model }; } catch { /* fallthrough */ } }
    throw new AiError("The AI's answer couldn't be read — try again.");
  }
}

/** Asks Gemini like a real user would, with live Google Search grounding. Returns the answer and cited web sources. */
export async function geminiGrounded(prompt: string, { timeout = 45000, lite = true } = {}): Promise<{ text: string; sources: { url: string; title: string }[]; queries: string[]; model: string }> {
  const { json, model } = await callGemini({ timeout, lite, body: { contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } } });
  const c = json?.candidates?.[0];
  const text: string = c?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const gm = c?.groundingMetadata ?? {};
  const sources = ((gm.groundingChunks ?? []) as { web?: { uri?: string; title?: string } }[]).map((g) => ({ url: g.web?.uri ?? "", title: g.web?.title ?? "" })).filter((s) => s.url);
  return { text, sources, queries: gm.webSearchQueries ?? [], model };
}

/** For the health/integrations page: which models answered, which are resting. */
export function geminiStatus() {
  const now = Date.now();
  return { preferred, cooling: [...coolDown.entries()].filter(([, t]) => t > now).map(([m, t]) => ({ model: m, untilMin: Math.round((t - now) / 60000) })), retired: [...retired] };
}
