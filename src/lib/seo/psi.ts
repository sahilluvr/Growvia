import "server-only";
import type { SpeedResult } from "./types";

const PSI_BASE = (process.env.PSI_BASE?.trim() || "https://www.googleapis.com").replace(/\/$/, "");
// A free Google API key raises the daily limit; without it PageSpeed still works but can be rate-limited.
const PSI_KEY = process.env.PAGESPEED_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";

type Audit = { id?: string; title?: string; numericValue?: number; details?: { type?: string; overallSavingsMs?: number }; metricSavings?: { LCP?: number; FCP?: number } };

/** Google PageSpeed Insights (Lighthouse + real-user Chrome data), same engine as pagespeed.web.dev. */
export async function pageSpeed(url: string, strategy: "mobile" | "desktop"): Promise<SpeedResult> {
  const q = new URLSearchParams({ url, strategy });
  ["performance", "seo", "accessibility", "best-practices"].forEach((c) => q.append("category", c));
  if (PSI_KEY) q.set("key", PSI_KEY);
  const at = new Date().toISOString();
  let res: Response;
  try {
    res = await fetch(`${PSI_BASE}/pagespeedonline/v5/runPagespeed?${q}`, { cache: "no-store", signal: AbortSignal.timeout(55000) });
  } catch (e) {
    return { strategy, ok: false, at, error: (e as Error).name === "TimeoutError" ? "Google's speed test took too long — try again." : "Couldn't reach Google PageSpeed." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = data?.error?.message ?? `PageSpeed error ${res.status}`;
    return { strategy, ok: false, at, error: res.status === 429 ? "Google's free speed-test limit was reached. Add a free PAGESPEED_API_KEY in Vercel for a much higher limit." : /FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST|NOT_HTML/i.test(msg) ? "Google couldn't load the page for testing (it may block bots or be down)." : msg.slice(0, 200) };
  }
  const lr = data.lighthouseResult ?? {};
  const cat = (k: string) => (lr.categories?.[k]?.score != null ? Math.round(lr.categories[k].score * 100) : undefined);
  const a = (lr.audits ?? {}) as Record<string, Audit>;
  const num = (k: string) => a[k]?.numericValue;
  const le = data.loadingExperience?.metrics as Record<string, { percentile: number; category: string }> | undefined;
  const opportunities = Object.values(a)
    .map((x) => ({ id: x.id ?? "", title: x.title ?? "", savingsMs: Math.round(x.details?.overallSavingsMs ?? x.metricSavings?.LCP ?? 0) }))
    .filter((x) => x.savingsMs >= 100)
    .sort((x, y) => y.savingsMs - x.savingsMs)
    .slice(0, 8);
  return {
    strategy,
    ok: true,
    at,
    performance: cat("performance"),
    seo: cat("seo"),
    accessibility: cat("accessibility"),
    bestPractices: cat("best-practices"),
    lab: { fcp: num("first-contentful-paint"), lcp: num("largest-contentful-paint"), tbt: num("total-blocking-time"), cls: num("cumulative-layout-shift"), si: num("speed-index") },
    field: le && Object.keys(le).length ? {
      lcp: le.LARGEST_CONTENTFUL_PAINT_MS ? { ms: le.LARGEST_CONTENTFUL_PAINT_MS.percentile, cat: le.LARGEST_CONTENTFUL_PAINT_MS.category } : undefined,
      inp: le.INTERACTION_TO_NEXT_PAINT ? { ms: le.INTERACTION_TO_NEXT_PAINT.percentile, cat: le.INTERACTION_TO_NEXT_PAINT.category } : undefined,
      cls: le.CUMULATIVE_LAYOUT_SHIFT_SCORE ? { value: le.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100, cat: le.CUMULATIVE_LAYOUT_SHIFT_SCORE.category } : undefined,
      overall: data.loadingExperience?.overall_category,
    } : null,
    opportunities,
  };
}
