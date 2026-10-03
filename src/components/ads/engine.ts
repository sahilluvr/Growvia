import fixWebmDuration from "fix-webm-duration";

/* In-browser video engine for ad videos: draws scenes on a <canvas>, animates an illustrated presenter,
   plays the AI voice-over and generated music, and records everything with MediaRecorder. Free — no servers. */

export type Scene = { id: string; kind: string; voice: string; text: string; image: number | null };
export type Settings = { format: "9:16" | "1:1" | "16:9"; palette: string; avatar: string; avatarUrl?: string; avatarPos: "corner" | "presenter" | "none"; captions: boolean; music: "upbeat" | "calm" | "corporate" | "none" };
export type Brand = { name: string; host: string; cta: string; logo: HTMLImageElement | null };
export type Input = { scenes: Scene[]; timing: number[]; images: (HTMLImageElement | null)[]; settings: Settings; brand: Brand; font: string; watermark?: boolean; avatarImg?: HTMLImageElement | null };

export const SIZES = { "9:16": [720, 1280], "1:1": [960, 960], "16:9": [1280, 720] } as const;
export const PALETTES: Record<string, { bg: string; fg: string; accent: string; muted: string }> = {
  ink: { bg: "#0B0D0C", fg: "#FFFFFF", accent: "#C8F169", muted: "#A8ADA6" },
  lime: { bg: "#C8F169", fg: "#0B0D0C", accent: "#0B0D0C", muted: "#3A4033" },
  ocean: { bg: "#0E3B5C", fg: "#FFFFFF", accent: "#7FD3FF", muted: "#B5CCDD" },
  sunset: { bg: "#FF6B3D", fg: "#FFFFFF", accent: "#FFE3A3", muted: "#FFE1D6" },
  paper: { bg: "#F6F4EE", fg: "#0B0D0C", accent: "#FF6B3D", muted: "#6E736D" },
  plum: { bg: "#3B1D4A", fg: "#FFFFFF", accent: "#F7B2E6", muted: "#D7C3E0" },
};

/* ───────── Avatars (original illustrated presenters) ───────── */

export type AvatarDef = { id: string; name: string; skin: string; hair: string; style: "long" | "short" | "curly" | "wavy" | "bun" | "buzz"; shirt: string; beard?: boolean; glasses?: boolean };
export const AVATARS: AvatarDef[] = [
  { id: "maya", name: "Maya", skin: "#E8B996", hair: "#2B1B14", style: "long", shirt: "#C5F23A" },
  { id: "arjun", name: "Arjun", skin: "#B9825A", hair: "#141010", style: "short", shirt: "#1E4E8C", beard: true },
  { id: "zoe", name: "Zoe", skin: "#8D5A3B", hair: "#1A1210", style: "curly", shirt: "#FF6B3D" },
  { id: "leo", name: "Leo", skin: "#F1CBB0", hair: "#C8903B", style: "wavy", shirt: "#2B2F2D", glasses: true },
  { id: "priya", name: "Priya", skin: "#C68E68", hair: "#1C1311", style: "bun", shirt: "#7B3FA0" },
  { id: "sam", name: "Sam", skin: "#6E4631", hair: "#0F0B0A", style: "buzz", shirt: "#2A9D8F", glasses: true },
];

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

/** Draws a presenter bust centred at (cx, cy) with head radius r. `mouth` 0..1 opens the mouth. */
export function drawAvatar(ctx: CanvasRenderingContext2D, a: AvatarDef, cx: number, cy: number, r: number, t: number, mouth: number) {
  const bob = Math.sin(t * 2.1) * r * 0.03 + mouth * r * 0.02;
  const tilt = Math.sin(t * 0.9) * 0.04;
  ctx.save();
  ctx.translate(cx, cy + bob);
  // shoulders
  ctx.fillStyle = a.shirt;
  ctx.beginPath(); ctx.ellipse(0, r * 1.95, r * 1.55, r * 0.95, 0, Math.PI, 0); ctx.lineTo(r * 1.55, r * 3); ctx.lineTo(-r * 1.55, r * 3); ctx.fill();
  ctx.fillStyle = shade(a.shirt, 0.82); ctx.beginPath(); ctx.moveTo(-r * 0.38, r * 1.05); ctx.lineTo(0, r * 1.55); ctx.lineTo(r * 0.38, r * 1.05); ctx.fill();
  // neck
  ctx.fillStyle = shade(a.skin, 0.9); ctx.fillRect(-r * 0.3, r * 0.7, r * 0.6, r * 0.55);
  ctx.rotate(tilt);
  // hair behind
  ctx.fillStyle = a.hair;
  if (a.style === "long") { ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 1.12, r * 1.35, 0, 0, Math.PI * 2); ctx.fill(); }
  if (a.style === "curly") for (let i = 0; i < 14; i++) { const ang = (i / 14) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * 0.98, Math.sin(ang) * r * 0.92 - r * 0.12, r * 0.38, 0, Math.PI * 2); ctx.fill(); }
  if (a.style === "bun") { ctx.beginPath(); ctx.arc(0, -r * 1.12, r * 0.42, 0, Math.PI * 2); ctx.fill(); }
  // ears + head
  ctx.fillStyle = shade(a.skin, 0.94);
  ctx.beginPath(); ctx.ellipse(-r * 0.96, r * 0.08, r * 0.17, r * 0.24, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.96, r * 0.08, r * 0.17, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = a.skin; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
  // hair front
  ctx.fillStyle = a.hair;
  if (a.style === "buzz") { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 0.93, r * 0.6, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1; }
  else if (a.style === "short") { ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 1.0, r * 0.62, 0, Math.PI, 0); ctx.quadraticCurveTo(r * 0.5, -r * 0.35, -r * 0.2, -r * 0.5); ctx.quadraticCurveTo(-r * 0.7, -r * 0.35, -r * 1.0, -r * 0.55); ctx.fill(); }
  else if (a.style === "wavy") { ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 1.02, r * 0.7, 0, Math.PI, 0); ctx.bezierCurveTo(r * 0.6, -r * 0.1, r * 0.2, -r * 0.55, -r * 0.1, -r * 0.35); ctx.bezierCurveTo(-r * 0.5, -r * 0.15, -r * 0.8, -r * 0.4, -r * 1.02, -r * 0.5); ctx.fill(); }
  else if (a.style === "curly") { ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.95, r * 0.5, 0, Math.PI, 0); ctx.fill(); }
  else { ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 1.0, r * 0.62, 0, Math.PI, 0); ctx.quadraticCurveTo(0, -r * 0.25, -r * 1.0, -r * 0.55); ctx.fill(); }
  if (a.beard) { ctx.fillStyle = shade(a.hair, 1.3); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 0.72, r * 0.5, 0, 0, Math.PI); ctx.fill(); ctx.globalAlpha = 1; }
  // eyes (blink every few seconds)
  const blink = (t % 3.7) < 0.12 ? 0.12 : 1;
  ctx.fillStyle = "#1A1210";
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.36, -r * 0.02, r * 0.1, r * 0.13 * blink, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#fff"; if (blink === 1) for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.36 + r * 0.03, -r * 0.06, r * 0.035, 0, Math.PI * 2); ctx.fill(); }
  // brows
  ctx.strokeStyle = shade(a.hair, 1.1); ctx.lineWidth = r * 0.07; ctx.lineCap = "round";
  const lift = mouth * r * 0.05;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.5, -r * 0.27 - lift); ctx.quadraticCurveTo(s * r * 0.36, -r * 0.36 - lift, s * r * 0.2, -r * 0.29 - lift); ctx.stroke(); }
  // glasses
  if (a.glasses) { ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = r * 0.05; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.36, -r * 0.02, r * 0.22, 0, Math.PI * 2); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-r * 0.14, -r * 0.04); ctx.lineTo(r * 0.14, -r * 0.04); ctx.stroke(); }
  // nose + cheeks
  ctx.strokeStyle = shade(a.skin, 0.78); ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.moveTo(0, r * 0.08); ctx.quadraticCurveTo(r * 0.08, r * 0.24, -r * 0.03, r * 0.27); ctx.stroke();
  ctx.fillStyle = "rgba(255,120,120,0.18)"; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.55, r * 0.28, r * 0.15, r * 0.09, 0, 0, Math.PI * 2); ctx.fill(); }
  // mouth
  const open = Math.min(1, mouth);
  ctx.fillStyle = "#5B1F1F";
  if (open > 0.05) { ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * (0.2 + open * 0.08), r * (0.04 + open * 0.2), 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillRect(-r * 0.14, r * 0.5 - r * (0.04 + open * 0.2) + 1, r * 0.28, r * 0.05 * open); }
  else { ctx.strokeStyle = "#5B1F1F"; ctx.lineWidth = r * 0.055; ctx.beginPath(); ctx.moveTo(-r * 0.22, r * 0.46); ctx.quadraticCurveTo(0, r * 0.62, r * 0.22, r * 0.46); ctx.stroke(); }
  ctx.restore();
}

/**
 * Your own photo as the presenter: a round portrait that gently breathes, nods while talking,
 * and pulses a ring with the voice. `r` is the circle radius.
 */
export function drawPhotoAvatar(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number, t: number, mouth: number, accent: string) {
  const talk = Math.min(1, mouth);
  const nod = Math.sin(t * 5.2) * r * 0.012 * talk + Math.sin(t * 1.3) * r * 0.01;
  // voice ring (behind)
  if (talk > 0.04) {
    ctx.save(); ctx.globalAlpha = 0.25 + talk * 0.45; ctx.strokeStyle = accent; ctx.lineWidth = r * (0.05 + talk * 0.1);
    ctx.beginPath(); ctx.arc(cx, cy, r * (1.06 + talk * 0.08), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.fillStyle = "#EEE"; ctx.fill(); ctx.clip();
  if (img.complete && img.naturalWidth) {
    const zoom = 1.04 + Math.sin(t * 0.7) * 0.015 + talk * 0.02;
    const s = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight) * zoom;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    // faces are usually in the upper part of a portrait
    const bias = img.naturalHeight > img.naturalWidth * 1.1 ? (h - 2 * r) * 0.3 : 0;
    ctx.drawImage(img, cx - w / 2, cy - h / 2 + nod + bias, w, h);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = Math.max(2, r * 0.06); ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
  // little "speaking" bars under the portrait
  if (talk > 0.04) {
    ctx.save(); ctx.fillStyle = accent;
    const bw = r * 0.09, gap = r * 0.06, x0 = cx - (bw * 3 + gap * 2) / 2, base = cy + r * 0.86;
    for (let k = 0; k < 3; k++) { const hh = r * (0.1 + talk * (0.18 + 0.12 * Math.sin(t * 13 + k * 1.7))); roundRect(ctx, x0 + k * (bw + gap), base - hh, bw, hh, bw / 2); ctx.fill(); }
    ctx.restore();
  }
}

/* ───────── Timing ───────── */

const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean);
/** Seconds per scene: from the voice-over when there is one, otherwise from reading pace. */
export function sceneTimes(scenes: Scene[], timing?: number[] | null) {
  if (timing && timing.length === scenes.length) return timing.map((x) => Math.max(1.4, x));
  return scenes.map((s, i) => Math.max(i === scenes.length - 1 ? 3 : 2.2, wordsOf(s.voice).length / 2.6));
}
export const totalOf = (times: number[]) => times.reduce((a, b) => a + b, 0) + 0.8; // short hold on the end card

/* ───────── Drawing ───────── */

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = []; let line = "";
  for (const w of wordsOf(text)) { const next = line ? `${line} ${w}` : w; if (ctx.measureText(next).width > max && line) { out.push(line); line = w; } else line = next; }
  if (line) out.push(line);
  return out;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/** Black or white text, whichever reads better on `hex`. */
const onColor = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? "#0B0D0C" : "#FFFFFF"; };
const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, img: HTMLImageElement | null, p: number, i: number, pal: typeof PALETTES.ink, t: number) {
  if (img && img.complete && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (1.06 + 0.1 * p);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    const dx = (i % 2 ? -1 : 1) * (w - W) * 0.25 * (p - 0.5);
    ctx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0.45)"); g.addColorStop(0.45, "rgba(0,0,0,0.15)"); g.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.9; ctx.fillStyle = pal.accent;
    const R = Math.min(W, H);
    ctx.beginPath(); ctx.arc(W * 0.85 + Math.sin(t * 0.5) * R * 0.04, H * 0.12, R * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.14; ctx.beginPath(); ctx.arc(W * 0.1, H * 0.92 + Math.cos(t * 0.4) * R * 0.03, R * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, inp: Input, i: number, local: number, dur: number, t: number) {
  const sc = inp.scenes[i];
  const pal = PALETTES[inp.settings.palette] ?? PALETTES.ink;
  const img = sc.image != null ? inp.images[sc.image] ?? null : null;
  const hasImg = Boolean(img?.naturalWidth);
  drawBackground(ctx, W, H, img, local / dur, i, pal, t);
  const fg = hasImg ? "#FFFFFF" : pal.fg;
  const accent = hasImg ? pal.accent === "#0B0D0C" ? "#C8F169" : pal.accent : pal.accent;
  const U = Math.min(W, H) / 100;
  const pad = U * 7;
  const isCta = sc.kind === "cta" && i === inp.scenes.length - 1;
  const portrait = H > W;

  if (isCta) {
    const cy = portrait ? H * 0.42 : H * 0.45;
    if (inp.brand.logo?.naturalWidth) {
      const lw = U * 22, lh = (inp.brand.logo.naturalHeight / inp.brand.logo.naturalWidth) * lw;
      ctx.save(); ctx.globalAlpha = ease(local / 0.5); ctx.fillStyle = "#fff"; roundRect(ctx, W / 2 - lw / 2 - U * 2, cy - U * 30 - lh, lw + U * 4, lh + U * 4, U * 3); ctx.fill();
      ctx.drawImage(inp.brand.logo, W / 2 - lw / 2, cy - U * 28 - lh, lw, lh); ctx.restore();
    }
    ctx.textAlign = "center"; ctx.fillStyle = fg;
    ctx.font = `800 ${U * 11}px ${inp.font}`;
    const nameLines = wrap(ctx, inp.brand.name, W - pad * 2);
    nameLines.forEach((l, k) => { ctx.globalAlpha = ease((local - 0.1 * k) / 0.5); ctx.fillText(l, W / 2, cy - U * 8 + k * U * 12); });
    ctx.globalAlpha = 1;
    ctx.font = `500 ${U * 4.6}px ${inp.font}`; ctx.fillStyle = hasImg ? "rgba(255,255,255,0.85)" : pal.muted;
    wrap(ctx, sc.text && sc.text.toLowerCase() !== inp.brand.cta.toLowerCase() ? sc.text : "", W - pad * 2).slice(0, 2).forEach((l, k) => ctx.fillText(l, W / 2, cy + U * 6 + nameLines.length * U * 6 + k * U * 6));
    const bw = Math.min(W - pad * 2, U * 56), bh = U * 12, by = cy + U * 20 + nameLines.length * U * 6;
    const pulse = 1 + Math.sin(t * 5) * 0.02;
    ctx.save(); ctx.translate(W / 2, by + bh / 2); ctx.scale(pulse, pulse); ctx.fillStyle = accent; roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = onColor(accent);
    ctx.font = `700 ${U * 5.2}px ${inp.font}`; ctx.textBaseline = "middle"; ctx.fillText(inp.brand.cta, 0, U * 0.3); ctx.restore(); ctx.textBaseline = "alphabetic";
    if (inp.brand.host) { ctx.fillStyle = hasImg ? "rgba(255,255,255,0.8)" : pal.muted; ctx.font = `600 ${U * 4.2}px ${inp.font}`; ctx.fillText(inp.brand.host, W / 2, by + bh + U * 9); }
    ctx.textAlign = "left";
    return;
  }

  // Big on-screen words, word by word.
  const size = U * (sc.text.length > 26 ? 8.5 : 10.5);
  ctx.font = `800 ${size}px ${inp.font}`;
  const lines = wrap(ctx, sc.text, W - pad * 2).slice(0, 4);
  const top = portrait ? H * 0.2 : H * 0.28;
  let n = 0;
  lines.forEach((line, k) => {
    let x = portrait ? (W - ctx.measureText(line).width) / 2 : pad;
    const y = top + k * size * 1.08;
    for (const w of wordsOf(line)) {
      const a = ease((local - 0.15 - n * 0.08) / 0.35);
      ctx.globalAlpha = a; ctx.fillStyle = fg;
      ctx.fillText(w, x, y + (1 - a) * size * 0.4);
      x += ctx.measureText(`${w} `).width; n++;
    }
  });
  ctx.globalAlpha = 1;
  // accent underline
  const lw = ease((local - 0.3) / 0.5) * U * 22;
  ctx.fillStyle = accent; roundRect(ctx, portrait ? W / 2 - lw / 2 : pad, top + lines.length * size * 1.08 - size * 0.55, lw, U * 1.6, U * 0.8); ctx.fill();
}

type Region = { x0: number; x1: number; y: number };
function drawCaptions(ctx: CanvasRenderingContext2D, W: number, H: number, inp: Input, i: number, local: number, dur: number, reg: Region) {
  const ws = wordsOf(inp.scenes[i].voice);
  if (!ws.length) return;
  const U = Math.min(W, H) / 100;
  const cur = Math.min(ws.length - 1, Math.floor((local / Math.max(0.1, dur - 0.2)) * ws.length));
  ctx.font = `700 ${U * 5.2}px ${inp.font}`;
  // Break the line into chunks that fit the free space, then show the chunk being spoken.
  const max = reg.x1 - reg.x0 - U * 6;
  const chunks: number[][] = []; let line: number[] = [];
  ws.forEach((w, k) => { const test = [...line, k].map((j) => ws[j]).join(" "); if (line.length && (ctx.measureText(test).width > max || line.length >= 6)) { chunks.push(line); line = [k]; } else line.push(k); });
  if (line.length) chunks.push(line);
  const part = chunks.find((c) => c.includes(cur)) ?? chunks[0];
  const text = part.map((k) => ws[k]).join(" ");
  const total = ctx.measureText(text).width;
  const mid = (reg.x0 + reg.x1) / 2;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(ctx, mid - total / 2 - U * 3, reg.y - U * 6.5, total + U * 6, U * 9.5, U * 2.5); ctx.fill();
  let x = mid - total / 2;
  part.forEach((k) => { ctx.fillStyle = k === cur ? "#C8F169" : "#FFFFFF"; ctx.fillText(ws[k], x, reg.y); x += ctx.measureText(`${ws[k]} `).width; });
}

/** Renders the frame at time t (seconds). `mouth` is the voice level 0..1 used for the presenter's lips. */
export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, inp: Input, times: number[], t: number, mouth: number) {
  let acc = 0, i = 0;
  while (i < times.length - 1 && t >= acc + times[i]) { acc += times[i]; i++; }
  const local = Math.max(0, t - acc);
  ctx.clearRect(0, 0, W, H);
  drawScene(ctx, W, H, inp, i, local, times[i], t);
  // crossfade from the previous scene
  const fade = 0.35;
  if (i > 0 && local < fade) { ctx.save(); ctx.globalAlpha = 1 - local / fade; drawScene(ctx, W, H, inp, i - 1, times[i - 1], times[i - 1], t); ctx.restore(); }
  const isCta = inp.scenes[i]?.kind === "cta" && i === inp.scenes.length - 1;
  const U = Math.min(W, H) / 100;
  // presenter + captions share the bottom of the frame without overlapping
  const portrait = H > W, pad = U * 7;
  const photo = inp.settings.avatar === "custom" && inp.avatarImg ? inp.avatarImg : null;
  const av = photo ? null : AVATARS.find((a) => a.id === inp.settings.avatar);
  const accent = (PALETTES[inp.settings.palette] ?? PALETTES.ink).accent;
  const pos = !av && !photo ? "none" : isCta && inp.settings.avatarPos !== "none" ? "cta" : inp.settings.avatarPos;
  let reg: Region = { x0: pad, x1: W - pad, y: portrait ? H * 0.8 : H * 0.87 };
  const bubble = (cx: number, cy: number, r: number) => {
    if (photo) return drawPhotoAvatar(ctx, photo, cx, cy, r * 1.35, t, mouth, accent);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.clip();
    ctx.fillStyle = (PALETTES[inp.settings.palette] ?? PALETTES.ink).accent; ctx.fillRect(cx - r * 1.4, cy - r * 1.4, r * 2.8, r * 2.8);
    drawAvatar(ctx, av!, cx, cy - r * 0.15, r * 0.62, t, mouth); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.lineWidth = U * 0.8; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
  };
  if (pos === "presenter") {
    const r = U * (portrait ? 13 : 10);
    if (photo) drawPhotoAvatar(ctx, photo, W - r * 2, H - r * 2.1, r * 1.6, t, mouth, accent);
    else drawAvatar(ctx, av!, W - r * 2, H - r * 2.4, r, t, mouth);
    reg = { ...reg, x1: W - r * 3.7 - U * 2 };
  } else if (pos === "corner") {
    const r = U * 7.2, R = r * 1.35, cx = U * 5 + R;
    if (portrait) bubble(cx, H * 0.66, r);
    else { const cy = H - U * 5 - R; bubble(cx, cy, r); reg = { x0: cx + R + U * 2, x1: W - pad, y: cy + U * 2 }; }
  } else if (pos === "cta") {
    const r = U * 6, R = r * 1.35; bubble(U * 5 + R, U * 7 + R, r);
  }
  if (inp.settings.captions && !isCta) drawCaptions(ctx, W, H, inp, i, local, times[i], reg);
  // story-style progress bars
  const n = times.length, gap = U * 1, bw = (W - U * 8 - gap * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    const p = k < i ? 1 : k > i ? 0 : Math.min(1, local / times[k]);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; roundRect(ctx, U * 4 + k * (bw + gap), U * 3, bw, U * 0.8, U * 0.4); ctx.fill();
    ctx.fillStyle = "#FFFFFF"; roundRect(ctx, U * 4 + k * (bw + gap), U * 3, bw * p, U * 0.8, U * 0.4); ctx.fill();
  }
  if (inp.watermark) drawWatermark(ctx, W, U, inp.font);
}

/** Free plan: a small "Made with Growvia" tag in the top-right corner. */
function drawWatermark(ctx: CanvasRenderingContext2D, W: number, U: number, font: string) {
  const label = "Made with Growvia";
  ctx.save();
  ctx.font = `600 ${Math.round(U * 2.6)}px ${font}`;
  const w = ctx.measureText(label).width + U * 5, h = U * 5, x = W - w - U * 4, y = U * 6;
  ctx.globalAlpha = 0.88; ctx.fillStyle = "rgba(11,13,12,0.72)"; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = "#C8F169"; ctx.beginPath(); ctx.arc(x + U * 2.3, y + h / 2, U * 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#FFFFFF"; ctx.textBaseline = "middle"; ctx.fillText(label, x + U * 3.8, y + h / 2 + U * 0.1);
  ctx.restore();
}

/* ───────── Music (generated, royalty-free) ───────── */

const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** Schedules an original backing track of `dur` seconds into `out`. */
export function scheduleMusic(ac: BaseAudioContext, out: AudioNode, mood: Settings["music"], start: number, dur: number) {
  if (mood === "none") return;
  const bpm = mood === "upbeat" ? 116 : mood === "corporate" ? 100 : 78;
  const beat = 60 / bpm, bar = beat * 4;
  const prog = mood === "calm" ? [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] : [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
  const master = ac.createGain(); master.gain.value = mood === "calm" ? 0.16 : 0.13;
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = mood === "calm" ? 1400 : 2400;
  lp.connect(master); master.connect(out);
  const end = start + dur;
  master.gain.setValueAtTime(master.gain.value, Math.max(start, end - 1.2)); master.gain.linearRampToValueAtTime(0.0001, end);
  let noise: AudioBuffer | null = null;
  if (mood !== "calm") { noise = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
  for (let b = 0, t0 = start; t0 < end; b++, t0 += bar) {
    const chord = prog[b % prog.length];
    for (const m of chord) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle"; o.frequency.value = NOTE(m);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.08); g.gain.setValueAtTime(0.22, t0 + bar - 0.2); g.gain.linearRampToValueAtTime(0.0001, t0 + bar);
      o.connect(g); g.connect(lp); o.start(t0); o.stop(Math.min(end, t0 + bar) + 0.05);
    }
    for (let k = 0; k < 4; k++) {
      const tb = t0 + k * beat; if (tb >= end) break;
      const bass = ac.createOscillator(), bg = ac.createGain();
      bass.type = "sine"; bass.frequency.value = NOTE(chord[0] - 12);
      bg.gain.setValueAtTime(0.5, tb); bg.gain.exponentialRampToValueAtTime(0.001, tb + beat * 0.9);
      bass.connect(bg); bg.connect(lp); bass.start(tb); bass.stop(tb + beat);
      if (mood !== "calm") {
        const kick = ac.createOscillator(), kg = ac.createGain();
        kick.frequency.setValueAtTime(120, tb); kick.frequency.exponentialRampToValueAtTime(40, tb + 0.15);
        kg.gain.setValueAtTime(mood === "upbeat" ? 0.9 : 0.5, tb); kg.gain.exponentialRampToValueAtTime(0.001, tb + 0.2);
        kick.connect(kg); kg.connect(master); kick.start(tb); kick.stop(tb + 0.22);
        if (noise) { const h = ac.createBufferSource(), hg = ac.createGain(), hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000; h.buffer = noise; hg.gain.value = 0.25; h.connect(hp); hp.connect(hg); hg.connect(master); h.start(tb + beat / 2); }
      }
    }
  }
}

/* ───────── Playback & recording ───────── */

export function pickMime() {
  const opts = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof MediaRecorder === "undefined") return null;
  return opts.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export type Player = { stop: () => void; done: Promise<Blob | null> };

/**
 * Plays (and optionally records) the ad from `from` seconds. The voice-over drives the presenter's mouth.
 * When recording, audio goes to the recorder instead of the speakers.
 */
export async function play(canvas: HTMLCanvasElement, inp: Input, times: number[], voice: AudioBuffer | null, o: { record?: boolean; from?: number; onTime?: (t: number) => void }): Promise<Player> {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  const total = totalOf(times);
  const ac = new AudioContext();
  await ac.resume().catch(() => {});
  const dest = o.record ? ac.createMediaStreamDestination() : null;
  const out: AudioNode = dest ?? ac.destination;
  const analyser = ac.createAnalyser(); analyser.fftSize = 512;
  const buf = new Uint8Array(analyser.fftSize);
  const from = Math.max(0, Math.min(total - 0.1, o.from ?? 0));
  const t0 = ac.currentTime + 0.15;
  if (voice) {
    const src = ac.createBufferSource(); src.buffer = voice;
    const vg = ac.createGain(); vg.gain.value = 1;
    src.connect(vg); vg.connect(analyser); vg.connect(out);
    if (from < voice.duration) src.start(t0, from);
  }
  scheduleMusic(ac, out, inp.settings.music, t0 - from, total);
  let rec: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  const mime = pickMime();
  if (o.record) {
    if (!mime) throw new Error("This browser can't record video — use Chrome, Edge or Safari on a computer.");
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...(dest ? dest.stream.getAudioTracks() : [])]);
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.start(500);
  }
  let stopped = false;
  let resolve!: (b: Blob | null) => void;
  const done = new Promise<Blob | null>((r) => (resolve = r));
  let smooth = 0;
  const finish = () => {
    if (stopped) return; stopped = true;
    const close = () => ac.close().catch(() => {});
    if (rec && rec.state !== "inactive") {
      const ms = (ac.currentTime - t0) * 1000;
      rec.onstop = async () => {
        close();
        if (!chunks.length) return resolve(null);
        const blob = new Blob(chunks, { type: mime!.split(";")[0] });
        // Recorded WebM files have no duration in their header — add it so players show a seek bar.
        resolve(blob.type === "video/webm" ? await fixWebmDuration(blob, ms, { logger: false }).catch(() => blob) : blob);
      };
      rec.stop();
    }
    else { close(); resolve(null); }
  };
  const frame = () => {
    if (stopped) return;
    const t = from + Math.max(0, ac.currentTime - t0);
    analyser.getByteTimeDomainData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    const level = Math.min(1, Math.sqrt(sum / buf.length) * 5);
    smooth = smooth * 0.55 + level * 0.45;
    drawFrame(ctx, W, H, inp, times, Math.min(t, total), smooth);
    o.onTime?.(t);
    if (t >= total) return finish();
    // rAF pauses in background tabs; a timer keeps recordings going (at a lower frame rate) if the tab is hidden.
    if (document.hidden) setTimeout(frame, 1000 / 30); else requestAnimationFrame(frame);
  };
  frame();
  return { stop: finish, done };
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = url;
  });
}
