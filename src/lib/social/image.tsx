import "server-only";
import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

// Geist (SIL Open Font License) — bundled so headlines render bold on any server.
let fontsP: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" }[]> | null = null;
const fonts = () => (fontsP ??= Promise.all(([["Geist-Regular.ttf", 400], ["Geist-Bold.ttf", 700], ["Geist-Black.ttf", 800]] as const).map(async ([f, weight]) => ({
  name: "Geist", weight, style: "normal" as const, data: await readFile(path.join(process.cwd(), "src/lib/social/fonts", f)),
}))).catch(() => { fontsP = null; return []; }));

/* Branded social images, drawn in Growvia (no design tool needed). Optional AI photo background. */

export const PALETTES = {
  ink: { bg: "#0B0D0C", fg: "#FFFFFF", accent: "#C8F169", muted: "#A8ADA6" },
  lime: { bg: "#C8F169", fg: "#0B0D0C", accent: "#0B0D0C", muted: "#3A4033" },
  ocean: { bg: "#0E3B5C", fg: "#FFFFFF", accent: "#7FD3FF", muted: "#B5CCDD" },
  sunset: { bg: "#FF6B3D", fg: "#FFFFFF", accent: "#FFE3A3", muted: "#FFE1D6" },
  paper: { bg: "#F6F4EE", fg: "#0B0D0C", accent: "#FF6B3D", muted: "#6E736D" },
  plum: { bg: "#3B1D4A", fg: "#FFFFFF", accent: "#F7B2E6", muted: "#D7C3E0" },
} as const;
export type Palette = keyof typeof PALETTES;
export const LAYOUTS = ["bold", "photo", "minimal", "quote"] as const;
export type Layout = (typeof LAYOUTS)[number];
export const SIZES = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630] } as const;
export type Size = keyof typeof SIZES;

export type Design = { headline: string; sub?: string; brand: string; palette?: Palette; layout?: Layout; size?: Size; photo?: string | null; cta?: string };

// Satori has no emoji font offline — strip them so rendering never fails.
const plain = (s: string | undefined, n: number) => (s ?? "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim().slice(0, n);

export async function renderDesign(d: Design): Promise<Buffer> {
  const p = PALETTES[d.palette ?? "ink"] ?? PALETTES.ink;
  const [w, h] = SIZES[d.size ?? "square"] ?? SIZES.square;
  const layout: Layout = d.photo ? (d.layout === "minimal" || d.layout === "quote" ? d.layout : "photo") : d.layout === "photo" ? "bold" : (d.layout ?? "bold");
  const headline = plain(d.headline, 90) || plain(d.brand, 60);
  const sub = plain(d.sub, 140);
  const brand = plain(d.brand, 60);
  const cta = plain(d.cta, 40);
  const big = Math.round(w * (headline.length > 50 ? 0.075 : headline.length > 28 ? 0.095 : 0.12));
  const pad = Math.round(w * 0.08);

  let el: React.ReactElement;
  if (layout === "photo" && d.photo) {
    el = (
      <div style={{ width: w, height: h, display: "flex", position: "relative", background: p.bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.photo} width={w} height={h} style={{ position: "absolute", top: 0, left: 0, width: w, height: h, objectFit: "cover" }} alt="" />
        <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.78) 100%)" }} />
        <div style={{ position: "absolute", left: pad, right: pad, bottom: pad, display: "flex", flexDirection: "column", color: "#fff" }}>
          <div style={{ display: "flex", fontSize: big, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{headline}</div>
          {sub && <div style={{ display: "flex", marginTop: 22, fontSize: Math.round(w * 0.036), lineHeight: 1.3, opacity: 0.92 }}>{sub}</div>}
          <div style={{ display: "flex", alignItems: "center", marginTop: 36, fontSize: Math.round(w * 0.028) }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: p.accent, marginRight: 14 }} />{brand}{cta ? `  ·  ${cta}` : ""}
          </div>
        </div>
      </div>
    );
  } else if (layout === "minimal") {
    el = (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: pad, background: d.photo ? "#fff" : p.bg, color: d.photo ? "#0B0D0C" : p.fg }}>
        <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: p.accent }} />
        {d.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.photo} width={w - pad * 2} height={Math.round(h * 0.42)} style={{ width: w - pad * 2, height: Math.round(h * 0.42), objectFit: "cover", borderRadius: 28 }} alt="" />
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: Math.round(big * 0.9), fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>{headline}</div>
          {sub && <div style={{ display: "flex", marginTop: 20, fontSize: Math.round(w * 0.034), lineHeight: 1.35, color: d.photo ? "#6E736D" : p.muted }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: Math.round(w * 0.026), color: d.photo ? "#6E736D" : p.muted }}><span>{brand}</span><span>{cta}</span></div>
      </div>
    );
  } else if (layout === "quote") {
    el = (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "center", padding: pad, background: p.bg, color: p.fg }}>
        <div style={{ display: "flex", fontSize: Math.round(w * 0.25), lineHeight: 0.8, color: p.accent, fontWeight: 800 }}>“</div>
        <div style={{ display: "flex", fontSize: Math.round(big * 0.75), fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }}>{headline}</div>
        {sub && <div style={{ display: "flex", marginTop: 28, fontSize: Math.round(w * 0.032), color: p.muted }}>— {sub}</div>}
        <div style={{ display: "flex", marginTop: 60, fontSize: Math.round(w * 0.026), color: p.muted }}>{brand}</div>
      </div>
    );
  } else {
    el = (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: pad, background: p.bg, color: p.fg, position: "relative" }}>
        <div style={{ position: "absolute", right: -w * 0.18, top: -w * 0.18, width: w * 0.62, height: w * 0.62, borderRadius: w, background: p.accent, opacity: 0.9, display: "flex" }} />
        <div style={{ display: "flex", fontSize: Math.round(w * 0.028), fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: p.muted }}>{brand}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: big, fontWeight: 800, lineHeight: 1.0, letterSpacing: -3 }}>{headline}</div>
          {sub && <div style={{ display: "flex", marginTop: 26, fontSize: Math.round(w * 0.038), lineHeight: 1.3, color: p.muted }}>{sub}</div>}
        </div>
        <div style={{ display: "flex" }}>
          {cta ? <div style={{ display: "flex", padding: "18px 34px", borderRadius: 999, background: p.accent, color: p.bg, fontSize: Math.round(w * 0.03), fontWeight: 700 }}>{cta}</div> : <div style={{ display: "flex", width: 90, height: 10, borderRadius: 5, background: p.accent }} />}
        </div>
      </div>
    );
  }
  const f = await fonts();
  const res = new ImageResponse(<div style={{ display: "flex", fontFamily: f.length ? "Geist" : undefined }}>{el}</div>, { width: w, height: h, ...(f.length ? { fonts: f } : {}) });
  return Buffer.from(await res.arrayBuffer());
}

/* ───────── Optional AI photo (Gemini image model) ───────── */

const BASE = (process.env.GEMINI_BASE?.trim() || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
const KEY = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || "";
const IMG_MODELS = [process.env.GEMINI_IMAGE_MODEL?.trim(), "gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);
export const photoReady = Boolean(KEY) && process.env.GEMINI_IMAGE_MODEL?.trim() !== "off";

/** Returns a data: URL, or an error message the user can act on. Never throws. */
export async function aiPhoto(prompt: string, aspect: Size = "square"): Promise<{ url?: string; error?: string }> {
  if (!KEY) return { error: "AI photos need GEMINI_API_KEY in Vercel." };
  const shape = aspect === "story" ? "tall 9:16 vertical" : aspect === "portrait" ? "4:5 portrait" : aspect === "landscape" ? "wide 16:9" : "square 1:1";
  const text = `${prompt.slice(0, 800)}\n\nStyle: high-quality, natural light, professional social-media photograph, ${shape} composition, leave calm space for a headline. Absolutely no text, letters, logos or watermarks.`;
  let last = "";
  for (const model of IMG_MODELS) {
    try {
      const res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(KEY)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 404 || res.status === 400 && /not (found|supported)|modalit/i.test(body?.error?.message ?? "")) { last = "model unavailable"; continue; }
      if (res.status === 429) return { error: "Gemini's free image limit was reached — the design was made without a photo. Try again later or upload your own photo." };
      if (!res.ok) { last = body?.error?.message ?? `error ${res.status}`; continue; }
      const part = (body?.candidates?.[0]?.content?.parts ?? []).find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
      if (part) return { url: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` };
      last = "no image returned";
    } catch (e) {
      last = (e as Error).name === "TimeoutError" ? "timed out" : "couldn't reach Gemini";
    }
  }
  return { error: `AI photo isn't available on this Gemini key (${last}) — the design was made without it. You can set GEMINI_IMAGE_MODEL or upload your own photo.` };
}
