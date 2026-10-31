import "server-only";
import { parse } from "node-html-parser";
import { safeHost } from "./seo/crawl";

/* From just a website address: the business name and the most likely business type (for one-step sign-up). */

const KEYWORDS: [string, RegExp][] = [
  ["dentist", /\b(dental|dentist|dentistry|orthodont\w*|teeth|tooth|implants?|invisalign|clinic|medical|doctor|physio\w*|chiropract\w*|health ?care)\b/i],
  ["restaurant", /\b(restaurant|caf[eé]|bistro|pizza\w*|menu|dining|bakery|grill|kitchen|eatery|catering|brunch|takeaway|food)\b/i],
  ["salon", /\b(salon|spa|beauty|hair|nails?|barber\w*|massage|lashes|brows|skin ?care|aesthetic\w*)\b/i],
  ["gym", /\b(gym|fitness|yoga|pilates|crossfit|personal train\w*|boxing|martial arts|dance studio|workout)\b/i],
  ["realestate", /\b(real estate|realtor|realty|propert(y|ies)|homes? for sale|listings|broker\w*|mortgage|apartments?|condos?)\b/i],
  ["ecommerce", /\b(shop now|add to cart|free shipping|online store|shopify|our products|collections?|checkout)\b/i],
  ["saas", /\b(software|saas|platform|api|dashboard|integrations|free trial|startup|ai-powered|automation)\b/i],
  ["agency", /\b(agency|digital marketing|branding studio|web design|seo services|we help (brands|businesses)|our clients)\b/i],
  ["creator", /\b(coach\w*|course|creator|podcast|youtube|author|speaker|consultant|newsletter|mentor\w*)\b/i],
];

export async function guessFromWebsite(url: string): Promise<{ name: string | null; segment: string | null }> {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return { name: null, segment: null }; }
  const fromDomain = host.split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    if (!(await safeHost(new URL(url).hostname))) return { name: fromDomain || null, segment: null }; // never fetch private networks
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; GrowviaBot/1.0; +https://usegrowvia.com)" } });
    const html = (await res.text()).slice(0, 400_000);
    const root = parse(html);
    const meta = (n: string) => root.querySelector(`meta[property="${n}"]`)?.getAttribute("content") ?? root.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? "";
    const title = root.querySelector("title")?.text.trim() ?? "";
    const site = meta("og:site_name").trim();
    const name = (site || title.split(/\s[|–—\-:·]\s/)[0] || fromDomain).trim().slice(0, 60) || fromDomain;
    const text = [title, meta("description"), meta("og:description"), root.querySelectorAll("h1, h2").slice(0, 8).map((h) => h.text).join(" "), root.querySelector("body")?.text.slice(0, 4000) ?? ""].join(" ");
    let best: string | null = null, top = 0;
    for (const [id, re] of KEYWORDS) {
      const hits = (text.match(new RegExp(re.source, "gi")) ?? []).length;
      if (hits > top) { top = hits; best = id; }
    }
    return { name, segment: top >= 2 ? best : null };
  } catch {
    return { name: fromDomain || null, segment: null };
  }
}
