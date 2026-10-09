import "server-only";
import { AiError, aiReady, geminiJson } from "../ai/gemini";
import { SEGMENTS } from "../plans";
import type { Expert, ExpertPanel, Issue, PageResult, Scores, SiteInfo, SpeedResult, GscData } from "./types";

type Biz = { name: string; segment: string; city: string | null; goal: string | null; offer: string | null; website: string | null };
const grade = (n?: number): Expert["grade"] => (n == null ? "C" : n >= 90 ? "A" : n >= 75 ? "B" : n >= 60 ? "C" : n >= 40 ? "D" : "F");

export type GeoSummary = { prompts: number; checks: number; mentionRate: number; citedRate: number; topCompetitors: { name: string; count: number }[] } | null;

const ROLES = (local: boolean) => [
  { id: "technical", role: "Technical SEO specialist", focus: "crawling, indexing, speed, site health" },
  { id: "content", role: "Content strategist", focus: "topics, depth, keywords, internal links" },
  { id: "geo", role: "AI search (GEO) specialist", focus: "being recommended and cited by ChatGPT, Gemini, Perplexity & AI Overviews" },
  local ? { id: "local", role: "Local SEO expert", focus: "Google Business Profile, Maps, reviews, local citations" } : { id: "authority", role: "Authority & links expert", focus: "backlinks, digital PR, brand mentions" },
  { id: "cro", role: "Conversion (CRO) expert", focus: "turning visitors into calls, bookings and leads" },
];

function rules(b: Biz, scores: Scores, issues: Issue[], pages: PageResult[], geo: GeoSummary): ExpertPanel {
  const local = SEGMENTS.find((s) => s.id === b.segment)?.group === "Local business";
  const byCat = (cats: string[]) => issues.filter((i) => cats.includes(i.category));
  const recs = (list: Issue[]) => list.slice(0, 4).map((i) => ({ title: i.title, detail: i.fix, when: (i.severity === "critical" ? "now" : i.severity === "warning" ? "this month" : "later") as ExpertRec["when"], effort: "low" as const, impact: (i.severity === "critical" ? "high" : i.severity === "warning" ? "medium" : "low") as ExpertRec["impact"] }));
  type ExpertRec = Expert["recommendations"][number];
  const experts: Expert[] = ROLES(local).map((r) => {
    const base = { id: r.id, role: r.role, focus: r.focus };
    if (r.id === "technical") return { ...base, grade: grade(scores.technical), verdict: `Technical health ${scores.technical ?? "—"}/100.`, recommendations: recs(byCat(["technical"])) };
    if (r.id === "content") return { ...base, grade: grade(((scores.content ?? 70) + (scores.onpage ?? 70)) / 2), verdict: `${pages.filter((p) => p.words < 250).length} of ${pages.length} pages are thin.`, recommendations: [...recs(byCat(["content", "onpage"])), { title: "Publish one in-depth guide every two weeks", detail: "Answer the questions your customers ask before buying; link it to your service pages.", when: "this month", effort: "medium", impact: "high" }] };
    if (r.id === "geo") return { ...base, grade: grade(scores.ai), verdict: geo ? `AI assistants mention you in ${Math.round(geo.mentionRate * 100)}% of ${geo.checks} answers.` : "Not measured yet — add questions under AI visibility.", recommendations: [...recs(byCat(["ai"])), { title: "Be the source AI quotes", detail: "Add a clear FAQ, specific facts (prices, areas, years), and get listed on sites AI already cites for your topic.", when: "this month", effort: "medium", impact: "high" }] };
    if (r.id === "local") return { ...base, grade: "C", verdict: "Local signals can't be fully measured from the website alone.", recommendations: [
      { title: "Complete your Google Business Profile", detail: "Categories, services, hours, photos weekly, and posts — it drives Maps and 'near me' searches.", when: "now", effort: "low", impact: "high" },
      { title: "Get 5 new Google reviews a month", detail: "Ask happy customers by WhatsApp with a direct review link; reply to every review.", when: "now", effort: "low", impact: "high" },
      { title: `Consistent name, address, phone everywhere${b.city ? ` in ${b.city}` : ""}`, detail: "Match your website, Google, Justdial/Yelp and social profiles exactly.", when: "this month", effort: "low", impact: "medium" },
    ] };
    if (r.id === "authority") return { ...base, grade: "C", verdict: "Backlinks aren't measured yet.", recommendations: [{ title: "Earn 3 quality links a month", detail: "Guest articles, partner pages, local press, industry directories.", when: "this month", effort: "medium", impact: "high" }] };
    return { ...base, grade: "C", verdict: "Make it effortless to contact you from every page.", recommendations: [
      { title: "Clear call-to-action above the fold", detail: "One main action (Call / Book / WhatsApp) visible on mobile without scrolling.", when: "now", effort: "low", impact: "high" },
      { title: "Add your Growvia lead form", detail: "Every enquiry lands in Leads automatically with follow-ups.", when: "now", effort: "low", impact: "medium" },
      { title: "Show proof", detail: "Reviews, photos, numbers served — near every call-to-action.", when: "this month", effort: "low", impact: "medium" },
    ] };
  });
  return { source: "rules", at: new Date().toISOString(), experts };
}

/** A panel of specialist AI reviewers, each giving its own verdict and prioritised recommendations. */
export async function expertPanel(b: Biz, site: SiteInfo, pages: PageResult[], issues: Issue[], scores: Scores, speed: { mobile?: SpeedResult }, gsc: GscData | null, geo: GeoSummary, keywords: { keyword: string; position: number | null }[]): Promise<ExpertPanel> {
  const base = rules(b, scores, issues, pages, geo);
  if (!aiReady) return { ...base, error: "Add a free GEMINI_API_KEY for full expert reviews." };
  const local = SEGMENTS.find((s) => s.id === b.segment)?.group === "Local business";
  const data = {
    business: { name: b.name, type: SEGMENTS.find((s) => s.id === b.segment)?.label, city: b.city, goal: b.goal, offer: b.offer, website: site.origin },
    scores, speedMobile: speed.mobile?.performance, lcpMs: speed.mobile?.lab?.lcp,
    issues: issues.slice(0, 30).map((i) => `${i.severity}: ${i.title}`),
    pages: pages.slice(0, 15).map((p) => ({ url: p.url.replace(site.origin, "") || "/", title: p.title, words: p.words, schema: p.schema, questions: p.questions })),
    aiBotsBlocked: site.aiBots.filter((x) => !x.allowed).map((x) => x.name), llmsTxt: site.llms.found,
    aiVisibility: geo, trackedKeywords: keywords.slice(0, 25),
    searchConsole: gsc ? { totals: gsc.totals, topQueries: gsc.queries.slice(0, 15) } : null,
  };
  try {
    const { data: r, model } = await geminiJson<{ experts: Expert[] }>(`You are a panel of 5 senior specialists reviewing a website for a business owner. Each expert speaks from their specialty, is candid and specific to THIS site's data (quote real pages, numbers, keywords), and gives 3-5 prioritised recommendations with the concrete "how". Plain English. Don't invent facts that aren't in the data.
EXPERTS: ${JSON.stringify(ROLES(local))}
DATA: ${JSON.stringify(data)}
Return JSON: {"experts":[{"id":"technical|content|geo|${local ? "local" : "authority"}|cro","role":"…","focus":"…","grade":"A|B|C|D|F","verdict":"2 sentences","recommendations":[{"title":"…","detail":"how to do it, 1-3 sentences","when":"now|this month|later","effort":"low|medium|high","impact":"high|medium|low"}]}]}`, { temperature: 0.5, timeout: 50000 });
    const experts = (r.experts ?? []).filter((e) => e?.role && Array.isArray(e.recommendations)).map((e) => ({ ...e, grade: (["A", "B", "C", "D", "F"].includes(e.grade) ? e.grade : "C") as Expert["grade"], recommendations: e.recommendations.filter((x) => x?.title).slice(0, 6) }));
    return experts.length >= 3 ? { source: "gemini", model, at: new Date().toISOString(), experts } : base;
  } catch (e) {
    return { ...base, error: e instanceof AiError ? `${e.message} Showing rule-based advice.` : "Expert review failed — showing rule-based advice." };
  }
}
