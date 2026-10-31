"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/*
 * Hero visual (v078): the Growth Score radar. A sweep runs round the dial, five areas light up one by one and the
 * score counts up. Typing a website in the hero (event "gv:domain") re-runs it for that site as a preview.
 * Hover or tap an area to see an example finding and fix. Pure SVG + CSS — no 3D, so the hero stays fast.
 * Numbers are an illustrative preview; the real score comes from the free analysis.
 */

type Seg = { id: string; label: string; issue: string; fix: string };
const SEGS: Seg[] = [
  { id: "seo", label: "SEO", issue: "6 pages missing meta descriptions", fix: "AI writes them for you" },
  { id: "ai", label: "AI search", issue: "Not mentioned by ChatGPT for “near me”", fix: "FAQ + profile tuned for AI answers" },
  { id: "reviews", label: "Reviews", issue: "4 Google reviews without a reply", fix: "Draft replies in one click" },
  { id: "speed", label: "Speed", issue: "Hero image is 2.4 MB", fix: "Compress and lazy-load" },
  { id: "leads", label: "Leads", issue: "No follow-up for new enquiries", fix: "3-email sequence, ready to launch" },
];
const SIZE = 420, C = SIZE / 2, R = 150, GAP = 6;

function hash(s: string) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
/** Per-area values for the preview: stable for a given domain, never a claim about the real site. */
function valuesFor(domain: string) {
  if (!domain) return [72, 48, 81, 64, 58];
  const h = hash(domain);
  return SEGS.map((_, i) => 35 + ((h >>> (i * 5)) % 56));
}
function arc(i: number, value: number, r = R) {
  const span = 360 / SEGS.length, a0 = -90 + i * span + GAP / 2, a1 = a0 + (span - GAP) * Math.max(0.04, value / 100);
  const p = (a: number) => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
function track(i: number) { return arc(i, 100); }
const tone = (v: number) => (v >= 75 ? "#84cc16" : v >= 55 ? "#f59e0b" : "#ef4444");

/** live: progress 0–1 from a real analysis (dashboard "analysing" stage) — arcs fill as agents finish, no fake numbers. */
export function GrowthRadar({ className = "", domain: fixed, progress }: { className?: string; domain?: string; progress?: number }) {
  const live = typeof progress === "number";
  const [domain, setDomain] = useState(fixed ?? "");
  const [lit, setLit] = useState(0);         // how many areas are lit
  const [shown, setShown] = useState(0);     // counted-up score
  const [hover, setHover] = useState<number | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const vals = useMemo(() => valuesFor(domain), [domain]);
  const score = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);

  // Listen for the website typed in the hero.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const d = String((e as CustomEvent).detail ?? "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").slice(0, 28);
      clearTimeout(t); t = setTimeout(() => setDomain(/\.[a-z]{2,}$/i.test(d) ? d.toLowerCase() : ""), 450);
    };
    addEventListener("gv:domain", on);
    return () => { removeEventListener("gv:domain", on); clearTimeout(t); };
  }, []);

  // Live mode: light areas in step with real progress.
  useEffect(() => { if (live) setLit(Math.round(Math.min(1, Math.max(0, progress!)) * SEGS.length)); }, [live, progress]);

  // Run the reveal: areas light up one by one, score counts up.
  useEffect(() => {
    if (live) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setLit(SEGS.length); setShown(score); return; }
    setLit(0); setShown(0);
    const timers = SEGS.map((_, i) => setTimeout(() => setLit(i + 1), 450 + i * 420));
    let raf = 0; const start = performance.now() + 450, dur = SEGS.length * 420 + 300;
    const step = (now: number) => { const k = Math.min(1, Math.max(0, (now - start) / dur)); setShown(Math.round(score * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, [score, live]);

  const onMove = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -8, y: ((e.clientX - r.left) / r.width - 0.5) * 8 });
  };
  const active = hover != null ? SEGS[hover] : null;

  return (
    <div ref={box} className={`select-none ${className || "relative h-full w-full"}`} onPointerMove={onMove} onPointerLeave={() => { setTilt({ x: 0, y: 0 }); setHover(null); }} data-testid="growth-radar">
      <div className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        <svg viewBox={`-56 -24 ${SIZE + 112} ${SIZE + 48}`} className="h-full w-full overflow-visible" role="img" aria-label={`Growth Score preview ${score} out of 100 across SEO, AI search, reviews, speed and leads`}>
          <defs>
            <radialGradient id="gr-core" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#f3f5ee" /></radialGradient>
            <linearGradient id="gr-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#C5F23A" stopOpacity="0" /><stop offset="100%" stopColor="#C5F23A" stopOpacity="0.55" /></linearGradient>
            <filter id="gr-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {/* rings */}
          {[R + 34, R + 18, R - 34, R - 70].map((r, i) => <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#0b0d0c" strokeOpacity={i === 1 ? 0.08 : 0.05} strokeDasharray={i % 2 ? "2 6" : undefined} />)}
          {/* sweep */}
          <g className="gv-radar-sweep" style={{ transformOrigin: `${C}px ${C}px` }}>
            <path d={`M ${C} ${C} L ${C + R + 30} ${C} A ${R + 30} ${R + 30} 0 0 0 ${C + (R + 30) * Math.cos(-0.55)} ${C + (R + 30) * Math.sin(-0.55)} Z`} fill="url(#gr-sweep)" opacity="0.6" />
            <line x1={C} y1={C} x2={C + R + 30} y2={C} stroke="#C5F23A" strokeWidth="2" strokeLinecap="round" />
          </g>
          {/* area tracks + values */}
          {SEGS.map((s, i) => {
            const on = i < lit, v = live ? 100 : vals[i], isH = hover === i;
            return (
              <g key={s.id} onPointerEnter={() => setHover(i)} onClick={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} role="button" aria-label={`${s.label}: ${v} — ${s.issue}`} style={{ cursor: "pointer", outline: "none" }}>
                <path d={track(i)} fill="none" stroke="#0b0d0c" strokeOpacity="0.07" strokeWidth={isH ? 26 : 22} strokeLinecap="round" />
                <path d={arc(i, on ? v : 0)} fill="none" stroke={live ? "#84cc16" : tone(v)} strokeWidth={isH ? 26 : 22} strokeLinecap="round" filter={on ? "url(#gr-glow)" : undefined} style={{ transition: "d 700ms cubic-bezier(.2,.8,.2,1), stroke-width 200ms" }} opacity={on ? 1 : 0} />
                {(() => {
                  const a = ((-90 + i * 72 + 36) * Math.PI) / 180, lr = R + 52;
                  return <text x={C + lr * Math.cos(a)} y={C + lr * Math.sin(a)} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight={isH ? 700 : 600} fill={on ? "#0b0d0c" : "#a8a29e"} style={{ transition: "fill 300ms" }}>{s.label}{on ? (live ? " ✓" : ` · ${v}`) : ""}</text>;
                })()}
              </g>
            );
          })}
          {/* core */}
          <circle cx={C} cy={C} r={R - 46} fill="url(#gr-core)" stroke="#0b0d0c" strokeOpacity="0.06" />
          <text x={C} y={C - 50} textAnchor="middle" fontSize="12" letterSpacing="2" fill="#78716c">{live ? "ANALYSING" : "GROWTH SCORE"}</text>
          <text x={C} y={C + 8} textAnchor="middle" fontSize={live ? 54 : 64} fontWeight="700" fill="#0b0d0c" style={{ fontVariantNumeric: "tabular-nums" }}>{live ? `${Math.round(Math.min(1, progress!) * 100)}%` : shown}</text>
          <text x={C} y={C + 44} textAnchor="middle" fontSize="13" fill="#57534e">{domain || "your-business.com"}</text>
        </svg>
      </div>
      {/* tooltip */}
      <div aria-live="polite" className={`pointer-events-none absolute -bottom-10 left-1/2 z-10 w-[min(92%,340px)] -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-[13px] text-white shadow-xl transition-all duration-300 ${active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
        {active && <><p className="font-semibold text-lime">{active.label}</p><p className="mt-0.5 text-white/80">Found: {active.issue}</p><p className="text-white/80">Fix: {active.fix}</p></>}
      </div>
      {!live && <p className={`pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400 transition-opacity ${active ? "opacity-0" : "opacity-100"}`}>preview · tap an area · type your website</p>}
    </div>
  );
}
