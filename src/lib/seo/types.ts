export type Category = "technical" | "onpage" | "content" | "ai" | "speed" | "social";
export type Severity = "critical" | "warning" | "notice";

export const CATEGORY_LABEL: Record<Category, string> = {
  technical: "Technical",
  onpage: "On-page",
  content: "Content",
  ai: "AI search",
  speed: "Speed",
  social: "Social sharing",
};

/** How much each area counts towards the overall score. */
export const CATEGORY_WEIGHT: Record<Category, number> = { technical: 0.24, onpage: 0.2, content: 0.14, ai: 0.2, speed: 0.16, social: 0.06 };

export type PageResult = {
  url: string;
  status: number;
  redirectedTo?: string | null;
  ms: number;
  bytes: number;
  html: boolean;
  title: string | null;
  description: string | null;
  h1: string[];
  h2: string[];
  questions: number;          // headings phrased as questions (FAQ-style, good for AI answers)
  words: number;
  canonical: string | null;
  noindex: boolean;
  lang: string | null;
  viewport: boolean;
  images: number;
  imagesNoAlt: number;
  lazyImages: number;
  internalLinks: number;
  externalLinks: number;
  schema: string[];           // JSON-LD @types
  og: { title: boolean; description: boolean; image: string | null };
  twitterCard: boolean;
  hreflang: number;
  scripts: number;
  mixedContent: number;
  modified: string | null;    // dateModified / article:modified_time
  author: boolean;
  jsOnly: boolean;            // almost no text in the HTML but many scripts (AI crawlers see an empty page)
  lists?: number;             // bullet/numbered lists + tables (easy for AI to lift into answers)
  facts?: number;             // numbers, prices, percentages, years — concrete, quotable facts
  depth: number;
};

export type AiBot = { name: string; owner: string; purpose: string; allowed: boolean };

export type SiteInfo = {
  origin: string;
  finalUrl: string;
  https: boolean;
  httpRedirects: boolean | null;     // http:// → https://
  hostVariantDuplicate: boolean | null; // www and non-www both serve pages (duplicate site)
  redirectChain: string[];
  robots: { found: boolean; blocksAll: boolean; sitemaps: string[]; text: string | null };
  sitemap: { found: boolean; url: string | null; urls: number; withLastmod: number; newest: string | null };
  llms: { found: boolean; full: boolean; text: string | null };
  aiBots: AiBot[];
  soft404: boolean | null;          // a missing page returns 200 instead of 404
  favicon: boolean;
  ttfbMs: number;
  brokenLinks: { url: string; status: number; from: string }[];
  heavyImages: { url: string; kb: number }[];
  crawled: number;
  discovered: number;
  ms: number;
};

export type Issue = {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  detail: string;
  fix: string;
  pages?: string[];
};

export type Scores = Partial<Record<Category, number>> & { overall?: number };

export type SpeedResult = {
  strategy: "mobile" | "desktop";
  ok: boolean;
  error?: string;
  performance?: number;
  seo?: number;
  accessibility?: number;
  bestPractices?: number;
  lab?: { fcp?: number; lcp?: number; tbt?: number; cls?: number; si?: number };
  field?: { lcp?: { ms: number; cat: string }; inp?: { ms: number; cat: string }; cls?: { value: number; cat: string }; overall?: string } | null;
  opportunities?: { id: string; title: string; savingsMs: number }[];
  at?: string;
};

export type AiOutput = {
  source: "gemini" | "rules";
  model?: string;
  at: string;
  summary: string;
  plan: { phase: string; items: { task: string; why: string; impact: "high" | "medium" | "low"; effort: "low" | "medium" | "high" }[] }[];
  quickWins: string[];
  pageFixes: { url: string; title: string; description: string; h1?: string }[];
  keywords: { keyword: string; intent: string; page: string; note?: string }[];
  contentIdeas: { title: string; type: string; target: string; outline: string[] }[];
  llmsTxt: string;
  robotsTxt: string;
  schema: string;          // JSON-LD script body
  faq: { q: string; a: string }[];
  error?: string;
};

export type GscData = {
  site: string;
  range: { start: string; end: string };
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  queries: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
  at: string;
};

export type ExpertRec = { title: string; detail: string; when: "now" | "this month" | "later"; effort: "low" | "medium" | "high"; impact: "high" | "medium" | "low" };
export type Expert = { id: string; role: string; focus: string; grade: "A" | "B" | "C" | "D" | "F"; verdict: string; recommendations: ExpertRec[] };
export type ExpertPanel = { source: "gemini" | "rules"; model?: string; at: string; experts: Expert[]; error?: string };

export type SeoPrefs = {
  audit?: "daily" | "weekly" | "monthly" | "off";
  geo?: "daily" | "weekly" | "off";
  engines?: string[];
  report?: { freq: "weekly" | "monthly" | "off"; to: string[] };
  competitors?: { name: string; domain?: string }[];
  location?: string;
};
