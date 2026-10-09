import "server-only";
import { AiError, geminiJson } from "./gemini";
import type { SiteRead } from "../ads/analyze";

/* Ad copy and video-ad stories, written from the website + the project's profile. */

export type Brief = {
  business: string; summary: string; audience: string; offer: string; usps: string[]; tone: string; cta: string;
  goal: string; site?: { url: string; title: string; description: string }; images: string[]; logo: string | null; color: string | null;
};

type Biz = { name: string; segment: string; city: string | null; offer: string | null; audience: string | null; voice: string | null; goal: string | null; website: string | null };
const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const clipKeep = (s: unknown, n: number) => String(s ?? "").replace(/\r/g, "").trim().slice(0, n);

export async function writeBrief(b: Biz, site: SiteRead | null, o: { goal: string; offer?: string; audience?: string }): Promise<Omit<Brief, "images" | "logo" | "color">> {
  const prompt = `You are a senior advertising strategist. Build a short creative brief for ads.
Business profile: ${b.name} — ${b.segment}${b.city ? ` in ${b.city}` : ""}. Offer: ${b.offer ?? "n/a"}. Audience: ${b.audience ?? "n/a"}. Voice: ${b.voice ?? "n/a"}.
Campaign goal: ${clip(o.goal, 300) || b.goal || "get more customers"}.
${o.offer ? `What to promote: ${clip(o.offer, 300)}` : ""}
${o.audience ? `Target audience: ${clip(o.audience, 300)}` : ""}
${site ? `WEBSITE ${site.url}\nTitle: ${site.title}\nDescription: ${site.description}\nHeadings: ${site.headings.join(" | ")}\nText: ${site.text.slice(0, 3000)}` : "No website provided."}

Only use facts found above. Never invent prices, discounts, awards, statistics or customer quotes.
Return JSON: {"business":"name","summary":"2 sentences on what they sell and why it's different","audience":"who to target","offer":"the single thing to promote","usps":["3-5 short selling points"],"tone":"brand tone in 3-5 words","cta":"best call to action, 2-4 words"}`;
  const { data } = await geminiJson<Record<string, unknown>>(prompt, { temperature: 0.4, maxTokens: 2048 });
  return {
    business: clip(data.business, 80) || b.name, summary: clip(data.summary, 500), audience: clip(data.audience, 300), offer: clip(data.offer, 300),
    usps: (Array.isArray(data.usps) ? data.usps : []).map((x) => clip(x, 120)).filter(Boolean).slice(0, 6), tone: clip(data.tone, 80), cta: clip(data.cta, 30) || "Learn more",
    goal: clip(o.goal, 300), site: site ? { url: site.url, title: site.title, description: site.description } : undefined,
  };
}

const briefText = (br: Brief) => `Business: ${br.business}. ${br.summary}
Audience: ${br.audience}. Promote: ${br.offer}. Selling points: ${br.usps.join("; ")}. Tone: ${br.tone}. Goal: ${br.goal}. CTA: ${br.cta}.${br.site ? ` Website: ${br.site.url}` : ""}`;

/* ───────── Text ads ───────── */

export const PLATFORMS = {
  google: { label: "Google Search", limits: { headline: 30, description: 90, path: 15 } },
  meta: { label: "Facebook & Instagram", limits: { primary: 500, headline: 40, description: 30 } },
  linkedin: { label: "LinkedIn", limits: { intro: 600, headline: 70 } },
  x: { label: "X (Twitter)", limits: { post: 280 } },
  display: { label: "Display banners", limits: { short: 30, long: 90 } },
} as const;
export type PlatformId = keyof typeof PLATFORMS;

export type TextAds = {
  google?: { headlines: string[]; descriptions: string[]; paths: string[]; keywords: string[]; negatives: string[]; sitelinks: { text: string; desc: string }[] };
  meta?: { variants: { angle: string; primary: string; headline: string; description: string; cta: string }[] };
  linkedin?: { variants: { angle: string; intro: string; headline: string; cta: string }[] };
  x?: { variants: { angle: string; post: string }[] };
  display?: { short: string[]; long: string[] };
  at?: string;
};

const fit = (s: unknown, n: number) => { const t = clip(s, 400); if (t.length <= n) return t; const cut = t.slice(0, n + 1); const i = cut.lastIndexOf(" "); return (i > n * 0.6 ? cut.slice(0, i) : t.slice(0, n)).replace(/[,.;:\-–—\s]+$/, ""); };
const META_CTAS = ["Learn more", "Shop now", "Book now", "Sign up", "Contact us", "Get offer", "Order now", "Send message", "Call now", "Get quote", "Download", "Apply now"];

export async function writeTextAds(br: Brief, platforms: PlatformId[], tone?: string): Promise<TextAds> {
  if (!platforms.length) throw new AiError("Pick at least one ad platform.");
  const want = platforms.map((p) => ({
    google: `"google":{"headlines":[15 headlines, each MAX 30 characters, varied: brand, benefit, offer, CTA, keyword],"descriptions":[4 descriptions, each MAX 90 characters],"paths":[2 URL path words, MAX 15 chars each],"keywords":[15 search keywords with buying intent],"negatives":[5 negative keywords],"sitelinks":[4 of {"text": MAX 25 chars,"desc": MAX 35 chars}]}`,
    meta: `"meta":{"variants":[3 of {"angle":"2-4 words","primary":"primary text 60-300 chars, hook in the first line, may use 1-2 emoji","headline":"MAX 40 chars","description":"MAX 30 chars","cta":"one of ${META_CTAS.join(" | ")}"}]}`,
    linkedin: `"linkedin":{"variants":[2 of {"angle":"...","intro":"150-500 chars, professional","headline":"MAX 70 chars","cta":"Learn more | Sign up | Register | Request demo | Download | Apply"}]}`,
    x: `"x":{"variants":[3 of {"angle":"...","post":"MAX 260 chars incl. 1-2 hashtags"}]}`,
    display: `"display":{"short":[5 headlines MAX 30 chars],"long":[5 headlines MAX 90 chars]}`,
  })[p]).join(",\n");
  const prompt = `You are a senior performance-marketing copywriter.
${briefText(br)}
Tone: ${clip(tone, 40) || br.tone || "clear and friendly"}.
Write ad copy. Respect every character limit strictly (count characters). No ALL CAPS words, no excessive punctuation, no claims not supported by the brief (no invented prices, discounts, stats, awards or reviews). Each variant must use a genuinely different angle.
Return JSON: {${want}}`;
  const { data } = await geminiJson<TextAds>(prompt, { temperature: 0.8, maxTokens: 8000 });
  const out: TextAds = { at: new Date().toISOString() };
  if (platforms.includes("google") && data.google) {
    const g = data.google;
    out.google = {
      headlines: [...new Set((g.headlines ?? []).map((h) => fit(h, 30)).filter(Boolean))].slice(0, 15),
      descriptions: (g.descriptions ?? []).map((d) => fit(d, 90)).filter(Boolean).slice(0, 4),
      paths: (g.paths ?? []).map((x) => fit(String(x).replace(/[^\p{L}\p{N}-]+/gu, "-"), 15)).filter(Boolean).slice(0, 2),
      keywords: (g.keywords ?? []).map((k) => clip(k, 80).toLowerCase()).filter(Boolean).slice(0, 20),
      negatives: (g.negatives ?? []).map((k) => clip(k, 60).toLowerCase()).filter(Boolean).slice(0, 10),
      sitelinks: (g.sitelinks ?? []).map((s) => ({ text: fit(s?.text, 25), desc: fit(s?.desc, 35) })).filter((s) => s.text).slice(0, 4),
    };
  }
  if (platforms.includes("meta") && data.meta) out.meta = { variants: (data.meta.variants ?? []).map((v) => ({ angle: clip(v.angle, 40), primary: clipKeep(v.primary, 500), headline: fit(v.headline, 40), description: fit(v.description, 30), cta: META_CTAS.find((c) => c.toLowerCase() === clip(v.cta, 30).toLowerCase()) ?? "Learn more" })).filter((v) => v.primary).slice(0, 4) };
  if (platforms.includes("linkedin") && data.linkedin) out.linkedin = { variants: (data.linkedin.variants ?? []).map((v) => ({ angle: clip(v.angle, 40), intro: clipKeep(v.intro, 600), headline: fit(v.headline, 70), cta: clip(v.cta, 20) || "Learn more" })).filter((v) => v.intro).slice(0, 3) };
  if (platforms.includes("x") && data.x) out.x = { variants: (data.x.variants ?? []).map((v) => ({ angle: clip(v.angle, 40), post: fit(v.post, 280) })).filter((v) => v.post).slice(0, 4) };
  if (platforms.includes("display") && data.display) out.display = { short: (data.display.short ?? []).map((x) => fit(x, 30)).filter(Boolean).slice(0, 5), long: (data.display.long ?? []).map((x) => fit(x, 90)).filter(Boolean).slice(0, 5) };
  if (!out.google && !out.meta && !out.linkedin && !out.x && !out.display) throw new AiError("The AI didn't return any ads — try again.");
  return out;
}

/* ───────── Video story ───────── */

export type Scene = { id: string; kind: "hook" | "problem" | "solution" | "benefit" | "proof" | "offer" | "cta"; voice: string; text: string; image: number | null; seconds?: number };
export type VideoSettings = { format: "9:16" | "1:1" | "16:9"; length: 15 | 30 | 45 | 60; style: string; voice: string; avatar: string; avatarUrl?: string; avatarPos: "corner" | "presenter" | "none"; music: "upbeat" | "calm" | "corporate" | "none"; palette: string; captions: boolean };
export type VideoData = { title?: string; scenes: Scene[]; settings: VideoSettings; timing?: number[]; audioSeconds?: number; at?: string };

export const STYLES = {
  "problem-solution": "Problem → solution: name a pain the audience feels, show how the business solves it",
  offer: "Offer / promo: lead with the offer and urgency without fake deadlines",
  explainer: "Explainer: how it works in 3 simple steps",
  story: "Customer story: a relatable everyday moment (fictional scenario, no fake quotes or names of real customers)",
  "behind-the-scenes": "Behind the scenes: the people and craft behind the business",
} as const;

export const DEFAULT_SETTINGS: VideoSettings = { format: "9:16", length: 30, style: "problem-solution", voice: "Kore", avatar: "maya", avatarPos: "corner", music: "upbeat", palette: "ink", captions: true };

export async function writeVideoScript(br: Brief, s: VideoSettings, extra?: string): Promise<{ title: string; scenes: Scene[] }> {
  const words = Math.round(s.length * 2.3); // ≈ natural voice-over pace
  const scenes = s.length <= 15 ? 4 : s.length <= 30 ? 5 : s.length <= 45 ? 6 : 7;
  const prompt = `You are a direct-response video ad scriptwriter.
${briefText(br)}
Write a ${s.length}-second ${s.format} video ad. Style: ${STYLES[s.style as keyof typeof STYLES] ?? s.style}.
${extra ? `Extra direction: ${clip(extra, 400)}` : ""}
Rules: exactly ${scenes} scenes; total voice-over about ${words} words (spoken, natural, second person, short sentences); first scene is a scroll-stopping hook (under 3 seconds); last scene is the call to action "${br.cta}" and mentions ${br.business}${br.site ? ` (and the website ${new URL(br.site.url).host})` : ""}.
Each scene: "kind" (hook|problem|solution|benefit|proof|offer|cta), "voice" (what the narrator says), "text" (bold on-screen words, MAX 6 words, not identical to the voice line), "image" (index 0-${Math.max(0, br.images.length - 1)} of the website photos that fits best, or null for a branded text scene). ${br.images.length ? `There are ${br.images.length} photos.` : "There are no photos: use null."}
No invented prices, stats, awards, reviews or testimonials. No emoji.
Return JSON: {"title":"short internal title","scenes":[{"kind":"hook","voice":"...","text":"...","image":0}]}`;
  const { data } = await geminiJson<{ title?: string; scenes?: Partial<Scene>[] }>(prompt, { temperature: 0.8, maxTokens: 4096 });
  const kinds = ["hook", "problem", "solution", "benefit", "proof", "offer", "cta"];
  const out = (data.scenes ?? []).slice(0, 8).map((x, i) => ({
    id: `s${i}-${Math.random().toString(36).slice(2, 6)}`,
    kind: (kinds.includes(String(x.kind)) ? x.kind : i === 0 ? "hook" : "benefit") as Scene["kind"],
    voice: clip(x.voice, 400), text: clip(x.text, 60),
    image: typeof x.image === "number" && x.image >= 0 && x.image < br.images.length ? x.image : null,
  })).filter((x) => x.voice || x.text);
  if (out.length < 2) throw new AiError("The AI didn't return a usable story — try again.");
  return { title: clip(data.title, 80) || `${br.business} — ${s.length}s ad`, scenes: out };
}
