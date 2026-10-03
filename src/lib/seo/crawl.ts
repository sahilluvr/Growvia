import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { parse, type HTMLElement } from "node-html-parser";
import type { AiBot, PageResult, SiteInfo } from "./types";

const UA = "Mozilla/5.0 (compatible; GrowviaBot/1.0; +https://usegrowvia.com/bot)";
const ALLOW_PRIVATE = process.env.SEO_ALLOW_PRIVATE === "1"; // local testing only

/** Crawlers that decide whether you show up in AI answers and search. */
export const AI_BOTS: { name: string; owner: string; purpose: string }[] = [
  { name: "GPTBot", owner: "OpenAI", purpose: "trains ChatGPT models" },
  { name: "OAI-SearchBot", owner: "OpenAI", purpose: "ChatGPT search results" },
  { name: "ChatGPT-User", owner: "OpenAI", purpose: "pages ChatGPT opens for a user" },
  { name: "ClaudeBot", owner: "Anthropic", purpose: "trains Claude models" },
  { name: "Claude-SearchBot", owner: "Anthropic", purpose: "Claude search results" },
  { name: "PerplexityBot", owner: "Perplexity", purpose: "Perplexity answers" },
  { name: "Google-Extended", owner: "Google", purpose: "Gemini & AI Overviews training" },
  { name: "Googlebot", owner: "Google", purpose: "Google Search" },
  { name: "Bingbot", owner: "Microsoft", purpose: "Bing & Copilot" },
  { name: "Applebot-Extended", owner: "Apple", purpose: "Apple Intelligence" },
  { name: "CCBot", owner: "Common Crawl", purpose: "open dataset many AIs use" },
];

export class CrawlError extends Error {}

export function normalizeUrl(input: string) {
  let s = input.trim();
  if (!s) throw new CrawlError("Enter your website address.");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { throw new CrawlError("That doesn't look like a website address."); }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new CrawlError("That doesn't look like a website address.");
  u.hash = "";
  return u;
}

function privateIp(ip: string) {
  if (isIP(ip) === 6) return ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith("::ffff:127.") || ip === "::";
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

const hostOk = new Map<string, Promise<boolean>>();
async function safeHost(host: string) {
  if (ALLOW_PRIVATE) return true;
  if (!hostOk.has(host)) hostOk.set(host, (async () => {
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (isIP(host)) return !privateIp(host);
    try { const r = await lookup(host, { all: true }); return r.length > 0 && r.every((x) => !privateIp(x.address)); } catch { return false; }
  })());
  return hostOk.get(host)!;
}

type Fetched = { url: string; status: number; chain: string[]; headers: Headers; body: string; ms: number; bytes: number; error?: string };

/** GET with manual redirects (every hop is checked), a timeout and a size cap. */
async function get(url: string, { timeout = 12000, maxBytes = 3_000_000, method = "GET" }: { timeout?: number; maxBytes?: number; method?: "GET" | "HEAD" } = {}): Promise<Fetched> {
  const chain: string[] = [];
  let cur = url;
  const t0 = Date.now();
  for (let hop = 0; hop < 6; hop++) {
    const u = new URL(cur);
    if (!(await safeHost(u.hostname))) return { url: cur, status: 0, chain, headers: new Headers(), body: "", ms: Date.now() - t0, bytes: 0, error: "blocked address" };
    let res: Response;
    try {
      res = await fetch(cur, { method, redirect: "manual", headers: { "User-Agent": UA, Accept: method === "HEAD" ? "*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5" }, signal: AbortSignal.timeout(timeout), cache: "no-store" });
    } catch (e) {
      return { url: cur, status: 0, chain, headers: new Headers(), body: "", ms: Date.now() - t0, bytes: 0, error: (e as Error).name === "TimeoutError" ? "timed out" : "couldn't connect" };
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      chain.push(cur);
      cur = new URL(res.headers.get("location")!, cur).toString();
      continue;
    }
    let body = "";
    let bytes = Number(res.headers.get("content-length") || 0);
    if (method === "GET") {
      const reader = res.body?.getReader();
      const parts: Uint8Array[] = [];
      let n = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          n += value.length;
          if (n > maxBytes) { reader.cancel().catch(() => {}); break; }
          parts.push(value);
        }
      }
      bytes = n;
      body = Buffer.concat(parts).toString("utf8");
    }
    return { url: cur, status: res.status, chain, headers: res.headers, body, ms: Date.now() - t0, bytes };
  }
  return { url: cur, status: 0, chain, headers: new Headers(), body: "", ms: Date.now() - t0, bytes: 0, error: "too many redirects" };
}

/** Safe page fetch for other features (same address checks as the crawler). */
export async function fetchPage(url: string, timeout = 12000) {
  return get(url, { timeout });
}

/** Safe binary download (images) with redirect checks, a timeout and a size cap. */
export async function fetchBinary(url: string, { timeout = 10000, maxBytes = 6_000_000 } = {}): Promise<{ data: Buffer; type: string } | null> {
  let cur = url;
  for (let hop = 0; hop < 5; hop++) {
    let u: URL;
    try { u = new URL(cur); } catch { return null; }
    if (!/^https?:$/.test(u.protocol) || !(await safeHost(u.hostname))) return null;
    let res: Response;
    try { res = await fetch(cur, { redirect: "manual", headers: { "User-Agent": UA, Accept: "image/*" }, signal: AbortSignal.timeout(timeout), cache: "no-store" }); } catch { return null; }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { cur = new URL(res.headers.get("location")!, cur).toString(); continue; }
    if (!res.ok || !res.body) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    const reader = res.body.getReader();
    const parts: Uint8Array[] = []; let n = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > maxBytes) { reader.cancel().catch(() => {}); return null; } parts.push(value); }
    return { data: Buffer.concat(parts), type };
  }
  return null;
}

/* ───────── robots.txt ───────── */

type RobotsGroup = { agents: string[]; rules: { allow: boolean; path: string }[] };
function parseRobots(txt: string) {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let g: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!g || !lastWasAgent) { g = { agents: [], rules: [] }; groups.push(g); }
      g.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (key === "sitemap" && val) sitemaps.push(val);
      else if ((key === "allow" || key === "disallow") && g) g.rules.push({ allow: key === "allow", path: val });
    }
  }
  return { groups, sitemaps };
}

/** Can this bot fetch the home page? Uses the most specific matching group and the longest matching rule. */
function robotsAllows(groups: RobotsGroup[], bot: string, path = "/") {
  const b = bot.toLowerCase();
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && b.startsWith(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    if (r.path === "") continue; // "Disallow:" with nothing after it blocks nothing
    const rx = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (rx.test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}

/* ───────── sitemap ───────── */

async function readSitemap(urls: string[], deadline: number) {
  const out: { loc: string; lastmod: string | null }[] = [];
  let found: string | null = null;
  const queue = [...urls];
  const seen = new Set<string>();
  while (queue.length && seen.size < 6 && Date.now() < deadline) {
    const u = queue.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    const r = await get(u, { timeout: 10000, maxBytes: 8_000_000 });
    if (r.status !== 200 || !/<(urlset|sitemapindex)/i.test(r.body)) continue;
    found ??= u;
    if (/<sitemapindex/i.test(r.body)) {
      for (const m of r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) queue.push(decode(m[1]));
    } else {
      for (const m of r.body.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
        const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1];
        if (loc) out.push({ loc: decode(loc), lastmod: m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1] ?? null });
        if (out.length >= 50000) break;
      }
    }
  }
  return { found, entries: out };
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/* ───────── page analysis ───────── */

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

function analyze(url: string, f: Fetched, depth: number, origin: string): { page: PageResult; links: string[]; images: string[] } {
  const ct = f.headers.get("content-type") ?? "";
  const html = /html/i.test(ct) || /^\s*<(!doctype|html)/i.test(f.body);
  const base: PageResult = { url, status: f.status, redirectedTo: f.chain.length ? f.url : null, ms: f.ms, bytes: f.bytes, html, title: null, description: null, h1: [], h2: [], questions: 0, words: 0, canonical: null, noindex: false, lang: null, viewport: false, images: 0, imagesNoAlt: 0, lazyImages: 0, internalLinks: 0, externalLinks: 0, schema: [], og: { title: false, description: false, image: null }, twitterCard: false, hreflang: 0, scripts: 0, mixedContent: 0, modified: null, author: false, jsOnly: false, depth };
  if (!html || f.status !== 200) return { page: base, links: [], images: [] };
  const root = parse(f.body, { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });
  const meta = (sel: string) => root.querySelector(sel)?.getAttribute("content") ?? null;
  const robots = `${meta('meta[name="robots"]') ?? ""} ${meta('meta[name="googlebot"]') ?? ""} ${f.headers.get("x-robots-tag") ?? ""}`.toLowerCase();
  const schema: string[] = [];
  let modified: string | null = meta('meta[property="article:modified_time"]');
  let author = Boolean(meta('meta[name="author"]'));
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          const t = o["@type"];
          (Array.isArray(t) ? t : t ? [t] : []).forEach((x) => typeof x === "string" && schema.push(x));
          if (typeof o.dateModified === "string") modified ??= o.dateModified;
          if (o.author) author = true;
          if (o["@graph"]) walk(o["@graph"]);
          if (o.mainEntity) walk(o.mainEntity);
        }
      };
      walk(JSON.parse(s.text));
    } catch { /* invalid JSON-LD */ }
  }
  const scripts = root.querySelectorAll("script").length;
  const lists = root.querySelectorAll("ul, ol, table").filter((n) => n.querySelectorAll("li, tr").length >= 2 && !n.closest("nav") && !n.closest("footer") && !n.closest("header")).length;
  root.querySelectorAll("script, style, noscript, svg, template").forEach((n) => n.remove());
  const body = root.querySelector("body") ?? root;
  const text = clean(body.text);
  const words = text ? text.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
  const host = new URL(origin).hostname.replace(/^www\./, "");
  const links: string[] = [];
  let internal = 0;
  let external = 0;
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try {
      const u = new URL(href, f.url);
      u.hash = "";
      if (u.hostname.replace(/^www\./, "") === host) { internal++; links.push(u.toString()); } else if (/^https?:$/.test(u.protocol)) external++;
    } catch { /* bad href */ }
  }
  const imgs = root.querySelectorAll("img");
  const images: string[] = [];
  for (const i of imgs) { const s = i.getAttribute("src"); if (s && !s.startsWith("data:")) { try { images.push(new URL(s, f.url).toString()); } catch { /* */ } } }
  const isHttps = f.url.startsWith("https:");
  const mixed = isHttps ? root.querySelectorAll("img[src^='http:'], script[src^='http:'], link[href^='http:'][rel='stylesheet'], iframe[src^='http:']").length : 0;
  const heads = (tag: string) => root.querySelectorAll(tag).map((h: HTMLElement) => clean(h.text)).filter(Boolean);
  const h1 = heads("h1");
  const h2 = heads("h2");
  const canonicalHref = root.querySelector('link[rel="canonical"]')?.getAttribute("href");
  return {
    page: {
      ...base,
      title: clean(root.querySelector("title")?.text) || null,
      description: clean(meta('meta[name="description"]')) || null,
      h1: h1.slice(0, 5),
      h2: h2.slice(0, 12),
      questions: [...h2, ...heads("h3")].filter((h) => h.endsWith("?")).length,
      words,
      canonical: canonicalHref ? new URL(canonicalHref, f.url).toString() : null,
      noindex: /noindex/.test(robots),
      lang: root.querySelector("html")?.getAttribute("lang") ?? null,
      viewport: Boolean(root.querySelector('meta[name="viewport"]')),
      images: imgs.length,
      imagesNoAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
      lazyImages: imgs.filter((i) => i.getAttribute("loading") === "lazy").length,
      internalLinks: internal,
      externalLinks: external,
      schema: [...new Set(schema)],
      og: { title: Boolean(meta('meta[property="og:title"]')), description: Boolean(meta('meta[property="og:description"]')), image: meta('meta[property="og:image"]') },
      twitterCard: Boolean(meta('meta[name="twitter:card"]')),
      hreflang: root.querySelectorAll('link[rel="alternate"][hreflang]').length,
      scripts,
      mixedContent: mixed,
      modified,
      author,
      jsOnly: words < 60 && scripts >= 3,
      lists,
      facts: (text.match(/(?:₹|\$|€|£)\s?\d[\d,.]*|\b\d+(?:\.\d+)?\s?(?:%|km|kg|years?|yrs|mins?|hours?|people|customers|clients|reviews|\+)|\b(?:19|20)\d{2}\b/gi) ?? []).length,
    },
    links,
    images,
  };
}

const skipExt = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|webm|docx?|xlsx?|pptx?|css|js|xml|json|ico|woff2?)(\?|$)/i;
const norm = (u: string) => { const x = new URL(u); x.hash = ""; if (x.pathname !== "/" && x.pathname.endsWith("/")) x.pathname = x.pathname.slice(0, -1); return x.toString(); };

/** Crawls a website like a search engine would and returns everything the audit needs. */
export async function crawlSite(input: string, { maxPages = 25, budgetMs = 38000 } = {}): Promise<{ site: SiteInfo; pages: PageResult[] }> {
  const t0 = Date.now();
  const deadline = t0 + budgetMs;
  const start = normalizeUrl(input);
  if (!(await safeHost(start.hostname))) throw new CrawlError("That address points to a private network and can't be checked.");
  let home = await get(start.toString());
  if (home.status === 0 && start.protocol === "https:") { // some sites still only speak http
    const alt = new URL(start); alt.protocol = "http:";
    const h2 = await get(alt.toString());
    if (h2.status) home = h2;
  }
  if (home.status === 0) throw new CrawlError(`Couldn't open ${start.hostname} (${home.error}). Check the address and that the site is online.`);
  const finalUrl = new URL(home.url);
  const origin = finalUrl.origin;

  // Site-wide files and checks, in parallel.
  const httpVariant = new URL(origin); httpVariant.protocol = "http:";
  const hostVariant = new URL(origin); hostVariant.hostname = finalUrl.hostname.startsWith("www.") ? finalUrl.hostname.slice(4) : `www.${finalUrl.hostname}`;
  const [robotsR, llmsR, llmsFullR, probe, httpR, hostR, favR] = await Promise.all([
    get(`${origin}/robots.txt`, { timeout: 8000, maxBytes: 500_000 }),
    get(`${origin}/llms.txt`, { timeout: 8000, maxBytes: 500_000 }),
    get(`${origin}/llms-full.txt`, { timeout: 8000, maxBytes: 200_000, method: "HEAD" }),
    get(`${origin}/growvia-check-${Math.random().toString(36).slice(2, 10)}`, { timeout: 8000, maxBytes: 200_000 }),
    finalUrl.protocol === "https:" ? get(httpVariant.toString(), { timeout: 8000, method: "HEAD" }) : Promise.resolve(null),
    get(hostVariant.toString(), { timeout: 8000, method: "HEAD" }),
    get(`${origin}/favicon.ico`, { timeout: 6000, method: "HEAD" }),
  ]);
  const robotsFound = robotsR.status === 200 && !/<html/i.test(robotsR.body.slice(0, 500));
  const robots = robotsFound ? parseRobots(robotsR.body) : { groups: [], sitemaps: [] };
  const sm = await readSitemap(robots.sitemaps.length ? robots.sitemaps.slice(0, 3) : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`], Math.min(deadline, Date.now() + 10000));
  const aiBots: AiBot[] = AI_BOTS.map((b) => ({ ...b, allowed: robotsAllows(robots.groups, b.name) }));
  const homeRoot = home.status === 200 ? parse(home.body) : null;

  // Crawl: home first, then sitemap URLs and discovered links (breadth-first).
  const host = finalUrl.hostname.replace(/^www\./, "");
  const sameSite = (u: string) => { try { const x = new URL(u); return x.hostname.replace(/^www\./, "") === host && /^https?:$/.test(x.protocol) && !skipExt.test(x.pathname); } catch { return false; } };
  const queue: { url: string; depth: number }[] = [];
  const seen = new Set<string>();
  const push = (u: string, depth: number) => { if (!sameSite(u)) return; const n = norm(u); if (seen.has(n)) return; seen.add(n); queue.push({ url: n, depth }); };
  seen.add(norm(home.url));
  const pages: PageResult[] = [];
  const linkFrom = new Map<string, string>();
  const allImages = new Set<string>();
  const first = analyze(norm(home.url), home, 0, origin);
  pages.push(first.page);
  first.links.forEach((l) => { if (!linkFrom.has(norm(l))) linkFrom.set(norm(l), home.url); });
  first.images.forEach((i) => allImages.add(i));
  sm.entries.slice(0, 200).forEach((e) => push(e.loc, 1));
  first.links.forEach((l) => push(l, 1));
  let discovered = seen.size;

  while (queue.length && pages.length < maxPages && Date.now() < deadline - 3000) {
    const batch = queue.splice(0, Math.min(5, maxPages - pages.length));
    const results = await Promise.all(batch.map(async (q) => ({ q, f: await get(q.url, { timeout: 10000 }) })));
    for (const { q, f } of results) {
      const a = analyze(q.url, f, q.depth, origin);
      pages.push(a.page);
      a.images.forEach((i) => allImages.size < 60 && allImages.add(i));
      a.links.forEach((l) => { const n = norm(l); if (!linkFrom.has(n)) linkFrom.set(n, q.url); if (q.depth < 3) push(l, q.depth + 1); });
    }
    discovered = seen.size;
  }

  // Broken internal links (links we saw but didn't crawl) and heavy images, within the remaining time.
  const crawled = new Set(pages.map((p) => p.url));
  const unchecked = [...linkFrom.keys()].filter((u) => !crawled.has(u) && sameSite(u)).slice(0, 25);
  const brokenLinks: SiteInfo["brokenLinks"] = pages.filter((p) => p.status >= 400 || p.status === 0).map((p) => ({ url: p.url, status: p.status, from: linkFrom.get(p.url) ?? "sitemap" }));
  const heavyImages: SiteInfo["heavyImages"] = [];
  if (Date.now() < deadline - 2000) {
    const [linkChecks, imgChecks] = await Promise.all([
      Promise.all(unchecked.map(async (u) => ({ u, r: await get(u, { method: "HEAD", timeout: 6000 }) }))),
      Promise.all([...allImages].slice(0, 25).map(async (u) => ({ u, r: await get(u, { method: "HEAD", timeout: 6000 }) }))),
    ]);
    for (const { u, r } of linkChecks) if (r.status >= 400 && r.status !== 405 && r.status !== 403) brokenLinks.push({ url: u, status: r.status, from: linkFrom.get(u) ?? "" });
    for (const { u, r } of imgChecks) { const kb = Math.round(Number(r.headers.get("content-length") || 0) / 1024); if (kb > 250) heavyImages.push({ url: u, kb }); }
  }

  const lastmods = sm.entries.map((e) => e.lastmod).filter((x): x is string => Boolean(x)).sort();
  const site: SiteInfo = {
    origin,
    finalUrl: home.url,
    https: finalUrl.protocol === "https:",
    httpRedirects: httpR ? httpR.chain.length > 0 && httpR.url.startsWith("https:") : null,
    hostVariantDuplicate: hostR.status === 200 && hostR.chain.length === 0 ? true : hostR.status === 0 ? null : false,
    redirectChain: home.chain,
    robots: { found: robotsFound, blocksAll: robotsFound && !robotsAllows(robots.groups, "Googlebot"), sitemaps: robots.sitemaps, text: robotsFound ? robotsR.body.slice(0, 4000) : null },
    sitemap: { found: Boolean(sm.found), url: sm.found, urls: sm.entries.length, withLastmod: lastmods.length, newest: lastmods.at(-1) ?? null },
    llms: { found: llmsR.status === 200 && /^\s*#/.test(llmsR.body) && !/<html/i.test(llmsR.body.slice(0, 300)), full: llmsFullR.status === 200, text: llmsR.status === 200 && !/<html/i.test(llmsR.body.slice(0, 300)) ? llmsR.body.slice(0, 4000) : null },
    aiBots,
    soft404: probe.status === 0 ? null : probe.status === 200,
    favicon: favR.status === 200 || Boolean(homeRoot?.querySelector('link[rel~="icon"]')),
    ttfbMs: home.ms,
    brokenLinks: brokenLinks.slice(0, 40),
    heavyImages: heavyImages.sort((a, b) => b.kb - a.kb).slice(0, 15),
    crawled: pages.length,
    discovered,
    ms: Date.now() - t0,
  };
  return { site, pages };
}
