import "server-only";
import { parse } from "node-html-parser";
import { fetchBinary, fetchPage, normalizeUrl, CrawlError } from "../seo/crawl";

/* Reads a website like a copywriter would: what it sells, the words it uses, its images and colours. */

export type SiteRead = {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  images: string[]; // absolute URLs on the site (not yet copied)
  logo: string | null;
  color: string | null;
};

const clean = (s: string | undefined | null, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function readSite(input: string): Promise<SiteRead> {
  const u = normalizeUrl(input);
  const r = await fetchPage(u.toString(), 15000);
  if (r.error === "blocked address") throw new CrawlError("That address can't be read (private or local network).");
  if (r.error || !r.status) throw new CrawlError(`Couldn't open ${u.host} — ${r.error ?? "no response"}. Check the address and try again.`);
  if (r.status >= 400) throw new CrawlError(`${u.host} answered with an error (${r.status}). Try the home page address.`);
  const root = parse(r.body, { blockTextElements: { script: false, style: false, noscript: false } });
  const meta = (sel: string) => root.querySelector(sel)?.getAttribute("content") ?? "";
  const abs = (src: string | undefined) => { if (!src || src.startsWith("data:")) return null; try { return new URL(src, r.url).toString(); } catch { return null; } };

  const imgs: string[] = [];
  const push = (x: string | null) => { if (x && /^https?:/.test(x) && !imgs.includes(x) && !/\.svg(\?|$)|sprite|pixel|tracking|gravatar|facebook\.com\/tr/i.test(x)) imgs.push(x); };
  push(abs(meta('meta[property="og:image"]') || meta('meta[name="og:image"]')));
  push(abs(meta('meta[name="twitter:image"]')));
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("srcset")?.split(",").pop()?.trim().split(" ")[0];
    const w = Number(img.getAttribute("width") || 0);
    if (w && w < 200) continue;
    if (/logo|icon|avatar|badge|flag/i.test(`${src} ${img.getAttribute("class") ?? ""} ${img.getAttribute("alt") ?? ""}`)) continue;
    push(abs(src));
    if (imgs.length >= 14) break;
  }
  const logoEl = root.querySelectorAll("img").find((i) => /logo/i.test(`${i.getAttribute("src")} ${i.getAttribute("class")} ${i.getAttribute("alt")} ${i.getAttribute("id")}`));
  const icon = root.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") || root.querySelector('link[rel="icon"]')?.getAttribute("href");

  const headings = root.querySelectorAll("h1, h2, h3").map((h) => clean(h.text, 120)).filter((x) => x.length > 2).slice(0, 20);
  const text = clean(root.querySelectorAll("p, li, h1, h2, h3, blockquote").map((e) => e.text).join(" · "), 4000);
  const color = meta('meta[name="theme-color"]');
  return {
    url: r.url,
    title: clean(root.querySelector("title")?.text, 160),
    description: clean(meta('meta[name="description"]') || meta('meta[property="og:description"]'), 300),
    headings, text, images: imgs,
    logo: abs(logoEl?.getAttribute("src")) ?? abs(icon ?? undefined),
    color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : null,
  };
}

/** Copies up to `max` site images into our storage so the video editor can use them (same-origin, CORS-safe). */
export async function importImages(urls: string[], upload: (data: Buffer, type: string) => Promise<string | null>, max = 6) {
  const out: string[] = [];
  const got = await Promise.all(urls.slice(0, 12).map((u) => fetchBinary(u).catch(() => null)));
  for (const g of got) {
    if (out.length >= max) break;
    if (!g || !/^image\/(jpeg|png|webp)$/.test(g.type) || g.data.length < 8000) continue; // skip icons and odd formats
    const url = await upload(g.data, g.type).catch(() => null);
    if (url) out.push(url);
  }
  return out;
}
