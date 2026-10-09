import type { Category, Issue, PageResult, Scores, Severity, SiteInfo, SpeedResult } from "./types";
import { CATEGORY_WEIGHT } from "./types";

const pl = (n: number, one: string, many: string) => `${n} page${n === 1 ? "" : "s"} ${n === 1 ? one : many}`;
const PENALTY: Record<Severity, number> = { critical: 22, warning: 9, notice: 3 };

/** Turns crawl results into a list of problems, each with a plain-English fix. */
export function buildIssues(site: SiteInfo, pages: PageResult[]): Issue[] {
  const out: Issue[] = [];
  const add = (i: Issue) => out.push(i);
  const ok = pages.filter((p) => p.status === 200 && p.html && !p.noindex);
  const list = (ps: PageResult[]) => ps.map((p) => p.url);
  const home = pages[0];

  /* ── Technical ── */
  if (!site.https) add({ id: "no-https", category: "technical", severity: "critical", title: "Site isn't on HTTPS", detail: "Browsers mark it “Not secure” and Google ranks secure sites higher.", fix: "Turn on free HTTPS (Let's Encrypt / your host / Cloudflare) and redirect every http:// address to https://." });
  if (site.https && site.httpRedirects === false) add({ id: "http-no-redirect", category: "technical", severity: "warning", title: "http:// version doesn't redirect to https://", detail: "Two copies of your site exist, splitting ranking signals.", fix: "Add a permanent (301) redirect from http:// to https:// in your host or CDN settings." });
  if (site.hostVariantDuplicate) add({ id: "www-duplicate", category: "technical", severity: "warning", title: "Both www and non-www versions load", detail: "Search engines may treat them as duplicate sites.", fix: "Pick one (e.g. https://www.yoursite.com) and 301-redirect the other to it." });
  if (site.redirectChain.length > 1) add({ id: "redirect-chain", category: "technical", severity: "notice", title: `Home page goes through ${site.redirectChain.length} redirects`, detail: site.redirectChain.join(" → "), fix: "Link and redirect straight to the final address to save time on every visit." });
  if (!site.robots.found) add({ id: "no-robots", category: "technical", severity: "warning", title: "No robots.txt file", detail: "Crawlers get no guidance and can't find your sitemap.", fix: "Add a robots.txt — Growvia generated one for you under AI files." });
  if (site.robots.blocksAll) add({ id: "robots-blocks", category: "technical", severity: "critical", title: "robots.txt blocks Google from your whole site", detail: "Your pages can't appear in search.", fix: "Remove “Disallow: /” for Googlebot / all user-agents in robots.txt." });
  if (!site.sitemap.found) add({ id: "no-sitemap", category: "technical", severity: "warning", title: "No XML sitemap found", detail: "Search engines discover new pages slower.", fix: "Publish /sitemap.xml (most CMSs and SEO plugins do this) and list it in robots.txt." });
  else if (site.robots.found && !site.robots.sitemaps.length) add({ id: "sitemap-not-in-robots", category: "technical", severity: "notice", title: "Sitemap isn't listed in robots.txt", detail: `Found at ${site.sitemap.url}.`, fix: `Add “Sitemap: ${site.sitemap.url}” to robots.txt.` });
  if (site.sitemap.found && site.sitemap.urls > 0 && site.sitemap.withLastmod === 0) add({ id: "sitemap-no-lastmod", category: "technical", severity: "notice", title: "Sitemap has no last-modified dates", detail: "Search and AI engines use dates to spot fresh content.", fix: "Enable <lastmod> in your sitemap generator." });
  if (site.soft404) add({ id: "soft-404", category: "technical", severity: "warning", title: "Missing pages return “200 OK” instead of 404", detail: "Google may index thousands of empty pages (soft 404s).", fix: "Make your server return a real 404 status for pages that don't exist." });
  const broken = site.brokenLinks.filter((b) => b.status >= 400 || b.status === 0);
  if (broken.length) add({ id: "broken-links", category: "technical", severity: broken.length > 5 ? "critical" : "warning", title: `${broken.length} broken link${broken.length > 1 ? "s" : ""}`, detail: broken.slice(0, 6).map((b) => `${b.url} (${b.status || "no response"}) — linked from ${b.from}`).join("\n"), fix: "Fix or remove these links, or redirect the old addresses to the right page.", pages: broken.map((b) => b.url) });
  const slow = ok.filter((p) => p.ms > 1500);
  if (site.ttfbMs > 1500) add({ id: "slow-server", category: "technical", severity: "warning", title: `Server is slow to respond (${(site.ttfbMs / 1000).toFixed(1)}s)`, detail: "Every visit and crawl waits for this before anything loads.", fix: "Enable page caching or a CDN, and upgrade slow hosting." });
  else if (slow.length > ok.length / 3 && slow.length > 1) add({ id: "slow-pages", category: "technical", severity: "notice", title: `${pl(slow.length, "responds", "respond")} slowly (over 1.5s)`, detail: "", fix: "Add caching for these pages.", pages: list(slow) });
  const noindex = pages.filter((p) => p.noindex);
  if (noindex.length) add({ id: "noindex", category: "technical", severity: noindex.some((p) => p.url === home?.url) ? "critical" : "notice", title: `${noindex.length} page${noindex.length > 1 ? "s are" : " is"} hidden from search (noindex)`, detail: "Fine for thank-you or login pages; a problem for anything you want found.", fix: "Remove the noindex tag from pages that should rank.", pages: list(noindex) });
  const noCanon = ok.filter((p) => !p.canonical);
  if (noCanon.length) add({ id: "no-canonical", category: "technical", severity: "notice", title: `${pl(noCanon.length, "has", "have")} no canonical tag`, detail: "Helps avoid duplicate-content confusion from tracking parameters.", fix: "Add <link rel=\"canonical\" href=\"…\"> pointing to each page's main address.", pages: list(noCanon) });
  const offCanon = ok.filter((p) => p.canonical && new URL(p.canonical).hostname.replace(/^www\./, "") !== new URL(p.url).hostname.replace(/^www\./, ""));
  if (offCanon.length) add({ id: "canonical-offsite", category: "technical", severity: "warning", title: `${pl(offCanon.length, "points", "point")} their canonical to another domain`, detail: "Google may credit the other site instead.", fix: "Set canonicals to your own page addresses.", pages: list(offCanon) });
  const noVp = ok.filter((p) => !p.viewport);
  if (noVp.length) add({ id: "no-viewport", category: "technical", severity: "warning", title: `${noVp.length} page${noVp.length === 1 ? " isn't" : "s aren't"} set up for mobile`, detail: "No viewport tag — Google ranks by the mobile version.", fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.", pages: list(noVp) });
  const mixed = ok.filter((p) => p.mixedContent > 0);
  if (mixed.length) add({ id: "mixed-content", category: "technical", severity: "warning", title: `${mixed.length} secure pages load insecure (http://) files`, detail: "Browsers block or warn about these.", fix: "Change image/script links to https://.", pages: list(mixed) });
  if (!ok.some((p) => p.lang)) add({ id: "no-lang", category: "technical", severity: "notice", title: "Page language isn't declared", detail: "Helps search and AI engines serve the right audience.", fix: "Add lang=\"en\" (or your language) to the <html> tag." });
  if (!site.favicon) add({ id: "no-favicon", category: "technical", severity: "notice", title: "No favicon", detail: "Google shows it next to your result on mobile.", fix: "Add a square icon at /favicon.ico or <link rel=\"icon\">." });

  /* ── On-page ── */
  const noTitle = ok.filter((p) => !p.title);
  if (noTitle.length) add({ id: "no-title", category: "onpage", severity: "critical", title: `${pl(noTitle.length, "has", "have")} no title`, detail: "The title is the blue link people click in Google.", fix: "Write a unique 50–60 character title per page — see AI fixes.", pages: list(noTitle) });
  const badTitle = ok.filter((p) => p.title && (p.title.length < 25 || p.title.length > 65));
  if (badTitle.length) add({ id: "title-length", category: "onpage", severity: "warning", title: `${badTitle.length} titles are too short or too long`, detail: "Aim for 30–60 characters so they don't get cut off.", fix: "Rewrite them — Growvia's AI suggests replacements.", pages: list(badTitle) });
  const dupTitle = dupes(ok, (p) => p.title);
  if (dupTitle.length) add({ id: "dup-title", category: "onpage", severity: "warning", title: `${pl(dupTitle.length, "shares", "share")} the same title`, detail: "Google can't tell which one to rank.", fix: "Give every page its own title that says what's on it.", pages: dupTitle });
  const noDesc = ok.filter((p) => !p.description);
  if (noDesc.length) add({ id: "no-description", category: "onpage", severity: "warning", title: `${pl(noDesc.length, "has", "have")} no meta description`, detail: "Google then invents a snippet, often a poor one.", fix: "Add a 120–155 character summary with a reason to click.", pages: list(noDesc) });
  const badDesc = ok.filter((p) => p.description && (p.description.length < 70 || p.description.length > 165));
  if (badDesc.length) add({ id: "description-length", category: "onpage", severity: "notice", title: `${badDesc.length} meta descriptions are too short or too long`, detail: "Aim for 120–155 characters.", fix: "Rewrite them — see AI fixes.", pages: list(badDesc) });
  const dupDesc = dupes(ok, (p) => p.description);
  if (dupDesc.length) add({ id: "dup-description", category: "onpage", severity: "notice", title: `${pl(dupDesc.length, "shares", "share")} a meta description`, detail: "", fix: "Write one per page.", pages: dupDesc });
  const noH1 = ok.filter((p) => p.h1.length === 0);
  if (noH1.length) add({ id: "no-h1", category: "onpage", severity: "warning", title: `${pl(noH1.length, "has", "have")} no main heading (H1)`, detail: "The H1 tells people and search engines what the page is about.", fix: "Add one clear H1 per page.", pages: list(noH1) });
  const multiH1 = ok.filter((p) => p.h1.length > 1);
  if (multiH1.length) add({ id: "multi-h1", category: "onpage", severity: "notice", title: `${pl(multiH1.length, "has", "have")} more than one H1`, detail: "", fix: "Keep one H1; use H2/H3 for sections.", pages: list(multiH1) });
  const alt = ok.reduce((n, p) => n + p.imagesNoAlt, 0);
  if (alt) add({ id: "img-alt", category: "onpage", severity: alt > 10 ? "warning" : "notice", title: `${alt} image${alt === 1 ? " has" : "s have"} no alt text`, detail: "Alt text helps Google Images, AI understanding and screen readers.", fix: "Describe each image in a few words (alt=\"…\").", pages: list(ok.filter((p) => p.imagesNoAlt)) });
  const orphanish = ok.filter((p) => p.internalLinks < 3 && p.url !== home?.url);
  if (orphanish.length > 2) add({ id: "few-links", category: "onpage", severity: "notice", title: `${pl(orphanish.length, "has", "have")} very few internal links`, detail: "Internal links spread ranking power and help crawlers.", fix: "Link related pages to each other with descriptive anchor text.", pages: list(orphanish) });

  /* ── Content ── */
  const thin = ok.filter((p) => p.words < 250 && !p.jsOnly);
  if (thin.length) add({ id: "thin", category: "content", severity: thin.length > ok.length / 2 ? "warning" : "notice", title: `${pl(thin.length, "has", "have")} thin content (under 250 words)`, detail: "Short pages rarely rank or get quoted by AI.", fix: "Expand key pages with specifics: services, prices, areas served, FAQs, proof.", pages: list(thin) });
  if (ok.length >= 3 && !ok.some((p) => p.questions > 0)) add({ id: "no-faq", category: "content", severity: "warning", title: "No question-style headings or FAQs", detail: "People (and ChatGPT, Perplexity, Google AI Overviews) search in questions.", fix: "Add an FAQ section answering the top questions customers ask — AI drafted some for you." });
  if (!ok.some((p) => /about|team|who-we-are|story/i.test(new URL(p.url).pathname))) add({ id: "no-about", category: "content", severity: "notice", title: "No About page found", detail: "Trust signals (who you are, experience) matter for Google's E-E-A-T and AI answers.", fix: "Add an About page with your story, team and credentials." });
  if (!ok.some((p) => /contact/i.test(new URL(p.url).pathname))) add({ id: "no-contact", category: "content", severity: "notice", title: "No Contact page found", detail: "", fix: "Add a Contact page with address, phone, email and a map." });

  /* ── AI search (GEO) ── */
  const blocked = site.aiBots.filter((b) => !b.allowed && b.name !== "Googlebot" && b.name !== "Bingbot");
  const blockedSearch = blocked.filter((b) => /search|User|Perplexity/i.test(b.name));
  if (blockedSearch.length) add({ id: "ai-search-blocked", category: "ai", severity: "critical", title: `AI search crawlers are blocked: ${blockedSearch.map((b) => b.name).join(", ")}`, detail: "You can't be recommended in ChatGPT / Claude / Perplexity answers.", fix: "Allow these user-agents in robots.txt (see the robots.txt Growvia generated)." });
  else if (blocked.length) add({ id: "ai-training-blocked", category: "ai", severity: "notice", title: `Some AI training crawlers are blocked: ${blocked.map((b) => b.name).join(", ")}`, detail: "This is a choice — blocking training is fine, but allowing it can raise how often AI models know your brand.", fix: "Decide per bot; Growvia's robots.txt allows search bots and lets you choose for training bots." });
  if (!site.llms.found) add({ id: "no-llms", category: "ai", severity: "warning", title: "No llms.txt file", detail: "A new standard that gives AI assistants a clean summary of your site and key pages.", fix: "Upload the llms.txt Growvia generated to your site root (yoursite.com/llms.txt)." });
  const hasOrg = ok.some((p) => p.schema.some((t) => /Organization|LocalBusiness|Restaurant|Store|Dentist|Physician|RealEstateAgent|ProfessionalService|Corporation/i.test(t)));
  if (!hasOrg) add({ id: "no-org-schema", category: "ai", severity: "warning", title: "No business schema (structured data)", detail: "Schema tells Google and AI exactly who you are, where, hours and contact details.", fix: "Paste the JSON-LD Growvia generated into your home page <head>." });
  const noSchema = ok.filter((p) => p.schema.length === 0);
  if (noSchema.length > ok.length / 2 && hasOrg) add({ id: "few-schema", category: "ai", severity: "notice", title: `${pl(noSchema.length, "has", "have")} no structured data`, detail: "", fix: "Add Article, Service, Product, FAQPage or BreadcrumbList schema where it fits.", pages: list(noSchema) });
  const jsOnly = ok.filter((p) => p.jsOnly);
  if (jsOnly.length) add({ id: "js-only", category: "ai", severity: "critical", title: `${pl(jsOnly.length, "shows", "show")} almost no text without JavaScript`, detail: "Most AI crawlers don't run JavaScript, so they see an empty page.", fix: "Use server-side rendering or pre-rendering so the text is in the HTML.", pages: list(jsOnly) });
  if (ok.length >= 3 && !ok.some((p) => p.modified) && site.sitemap.withLastmod === 0) add({ id: "no-dates", category: "ai", severity: "notice", title: "No content dates", detail: "AI engines prefer recent, dated information.", fix: "Show “Last updated” dates and add dateModified to your schema." });
  if (!ok.some((p) => p.schema.includes("FAQPage")) && ok.some((p) => p.questions > 0)) add({ id: "faq-no-schema", category: "ai", severity: "notice", title: "FAQs aren't marked up with FAQ schema", detail: "", fix: "Wrap your FAQ in FAQPage JSON-LD." });

  /* ── Social ── */
  const noOg = ok.filter((p) => !p.og.title || !p.og.image);
  if (noOg.length) add({ id: "no-og", category: "social", severity: noOg.length === ok.length ? "warning" : "notice", title: `${pl(noOg.length, "has", "have")} no share preview (Open Graph)`, detail: "Links shared on WhatsApp, Facebook and LinkedIn show without an image or title.", fix: "Add og:title, og:description and og:image tags.", pages: list(noOg) });
  if (!ok.some((p) => p.twitterCard)) add({ id: "no-twitter", category: "social", severity: "notice", title: "No X/Twitter card tags", detail: "", fix: "Add <meta name=\"twitter:card\" content=\"summary_large_image\">." });
  if (site.heavyImages.length) add({ id: "heavy-images", category: "technical", severity: site.heavyImages.length > 4 ? "warning" : "notice", title: `${site.heavyImages.length} image${site.heavyImages.length === 1 ? " is" : "s are"} heavier than 250 KB`, detail: site.heavyImages.slice(0, 5).map((i) => `${i.url} — ${i.kb} KB`).join("\n"), fix: "Compress and convert to WebP/AVIF; resize to the size shown on screen.", pages: site.heavyImages.map((i) => i.url) });

  const rank: Record<Severity, number> = { critical: 0, warning: 1, notice: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function dupes(ps: PageResult[], key: (p: PageResult) => string | null) {
  const m = new Map<string, string[]>();
  ps.forEach((p) => { const k = key(p)?.toLowerCase(); if (k) m.set(k, [...(m.get(k) ?? []), p.url]); });
  return [...m.values()].filter((v) => v.length > 1).flat();
}

export function speedScore(speed: { mobile?: SpeedResult; desktop?: SpeedResult }) {
  const m = speed.mobile?.ok ? speed.mobile.performance : undefined;
  const d = speed.desktop?.ok ? speed.desktop.performance : undefined;
  if (m == null && d == null) return undefined;
  if (m == null) return d;
  if (d == null) return m;
  return Math.round(m * 0.65 + d * 0.35); // Google ranks on mobile
}

/** 0–100 per area and overall. */
export function scoreAudit(issues: Issue[], speed: { mobile?: SpeedResult; desktop?: SpeedResult } = {}): Scores {
  const cats: Category[] = ["technical", "onpage", "content", "ai", "social"];
  const s: Scores = {};
  for (const c of cats) {
    const pen = issues.filter((i) => i.category === c).reduce((n, i) => n + PENALTY[i.severity], 0);
    s[c] = Math.max(0, Math.min(100, 100 - pen));
  }
  const sp = speedScore(speed);
  if (sp != null) s.speed = sp;
  const used = (Object.keys(CATEGORY_WEIGHT) as Category[]).filter((c) => s[c] != null);
  const total = used.reduce((n, c) => n + CATEGORY_WEIGHT[c], 0);
  s.overall = Math.round(used.reduce((n, c) => n + (s[c] as number) * CATEGORY_WEIGHT[c], 0) / total);
  return s;
}

/** How ready a page is to be quoted in AI answers (0–100) and what's missing. */
export function pageGeo(p: PageResult) {
  const checks: [boolean, number, string][] = [
    [p.questions > 0, 20, "question-style headings (FAQ)"],
    [p.schema.some((t) => /FAQPage|Article|BlogPosting|HowTo|Product|Service|LocalBusiness|Organization|Restaurant|Dentist|Store|Person|Recipe|Event/i.test(t)), 20, "structured data"],
    [p.words >= 300, 15, "300+ words of real content"],
    [(p.lists ?? 0) > 0, 10, "lists or tables"],
    [(p.facts ?? 0) >= 3, 10, "concrete facts (numbers, prices, years)"],
    [p.author, 10, "author / who wrote it"],
    [Boolean(p.modified), 10, "last-updated date"],
    [!p.jsOnly, 5, "text visible without JavaScript"],
  ];
  return { score: checks.reduce((n, [ok, w]) => n + (ok ? w : 0), 0), missing: checks.filter(([ok]) => !ok).map(([, , l]) => l) };
}
