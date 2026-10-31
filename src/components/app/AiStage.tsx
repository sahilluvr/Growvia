"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Gauge, Loader2, MessageSquareText, Search, Sparkles, Wand2 } from "lucide-react";
import type { Snapshot } from "@/lib/growth";
import { GrowthRadar } from "../GrowthRadar";

/* ───────── Neural network canvas: drifting nodes that link up, brighter while the AI is working ───────── */
export function NeuralCanvas({ busy = true }: { busy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => { const r = c.getBoundingClientRect(); w = r.width; h = r.height; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener("resize", size);
    const N = Math.round(Math.min(70, (w * h) / 9000));
    const pts = Array.from({ length: N }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, p: Math.random() * Math.PI * 2 }));
    const pulses: { a: number; b: number; t: number }[] = [];
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) { if (!reduce) { p.x += p.vx; p.y += p.vy; p.p += 0.03; } if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 130) { ctx.strokeStyle = `rgba(75,155,224,${(1 - d / 130) * (busy ? 0.22 : 0.1)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); if (busy && Math.random() < 0.0009) pulses.push({ a: i, b: j, t: 0 }); }
      }
      for (const p of pts) { const r = 1.6 + Math.sin(p.p) * 0.6; ctx.fillStyle = "rgba(122,92,240,.45)"; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); }
      for (let k = pulses.length - 1; k >= 0; k--) {
        const q = pulses[k]; q.t += 0.025; if (q.t >= 1) { pulses.splice(k, 1); continue; }
        const a = pts[q.a], b = pts[q.b], x = a.x + (b.x - a.x) * q.t, y = a.y + (b.y - a.y) * q.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7); g.addColorStop(0, "rgba(168,218,22,.95)"); g.addColorStop(1, "rgba(168,218,22,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, [busy]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

/* ───────── Confetti burst for the score reveal ───────── */
export function Burst() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d")!; const r = c.getBoundingClientRect(); c.width = r.width; c.height = r.height;
    const cols = ["#C5F23A", "#A8DA16", "#4B9BE0", "#7A5CF0", "#FFB38A"];
    const ps = Array.from({ length: 140 }, () => ({ x: r.width / 2, y: r.height * 0.42, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3, s: 3 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, life: 0 }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height); let alive = 0;
      for (const p of ps) { p.life++; p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.2; if (p.y < c.height + 20 && p.life < 160) { alive++; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.max(0, 1 - p.life / 160); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); } }
      if (alive) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />;
}

type AgentKey = "audit" | "speed" | "geo" | "plan";
const AGENTS: { key: AgentKey; name: string; job: string; icon: React.ElementType; pos: string }[] = [
  { key: "audit", name: "SEO agent", job: "Reading your website", icon: Search, pos: "left-[4%] top-[14%] sm:left-[8%]" },
  { key: "speed", name: "Speed agent", job: "Timing every page", icon: Gauge, pos: "right-[4%] top-[14%] sm:right-[8%]" },
  { key: "geo", name: "AI-search agent", job: "Asking AI assistants", icon: MessageSquareText, pos: "left-[4%] bottom-[12%] sm:left-[8%]" },
  { key: "plan", name: "Strategist", job: "Writing your plan", icon: Wand2, pos: "right-[4%] bottom-[12%] sm:right-[8%]" },
];

const stateOf = (s: Snapshot, k: AgentKey) => {
  const j = s.jobs[k];
  if (j.status === "done") return "done";
  if (j.status === "failed" || /retrying|waiting/i.test(j.message ?? "")) return "slow";
  if (j.status === "running" || j.status === "queued") return "work";
  return "wait";
};

/** Live "AI thinking" log built from real results as they arrive. */
function useFeed(s: Snapshot, host: string | null) {
  return useMemo(() => {
    const out: { t: string; tone: "info" | "good" | "warn" }[] = [{ t: `Connecting to ${host ?? "your website"}…`, tone: "info" }];
    const audit = stateOf(s, "audit");
    if (audit !== "wait") out.push({ t: "Crawling pages, titles, headings and links…", tone: "info" });
    if (s.facts.pages) out.push({ t: `Read ${s.facts.pages} page${s.facts.pages === 1 ? "" : "s"}${s.facts.https ? " · secure (HTTPS) ✓" : ""}`, tone: "good" });
    if (s.parts.seo != null) out.push({ t: `Google SEO score ${s.parts.seo}/100${s.facts.critical ? ` · ${s.facts.critical} critical issue${s.facts.critical === 1 ? "" : "s"}` : ""}${s.facts.warnings ? ` · ${s.facts.warnings} to improve` : ""}`, tone: s.parts.seo >= 70 ? "good" : "warn" });
    if (stateOf(s, "speed") !== "wait") out.push({ t: "Loading your site on a phone and a laptop…", tone: "info" });
    if (s.parts.speed != null) out.push({ t: `Speed score ${s.parts.speed}/100`, tone: s.parts.speed >= 70 ? "good" : "warn" });
    if (stateOf(s, "geo") !== "wait") out.push({ t: "Asking AI assistants the questions your customers ask…", tone: "info" });
    for (const g of s.geo) out.push({ t: `“${g.prompt}” → ${g.mentioned ? "recommends you ✓" : "doesn't mention you yet"}`, tone: g.mentioned ? "good" : "warn" });
    if (s.rivals.length) out.push({ t: `Assistants recommend instead: ${s.rivals.slice(0, 3).join(", ")}`, tone: "warn" });
    if (stateOf(s, "plan") === "work") out.push({ t: "Ranking fixes by impact and effort…", tone: "info" });
    if (s.wins.length) out.push({ t: `Action plan ready · ${s.wins.length} quick wins found`, tone: "good" });
    return out;
  }, [s, host]);
}

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); const id = setInterval(() => setN((x) => (x >= text.length ? x : x + 2)), 18); return () => clearInterval(id); }, [text]);
  return <>{text.slice(0, n)}{n < text.length && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-lime-500" />}</>;
}

/** The live analysis stage: neural canvas, glowing core, four agents and a streaming log. */
export function AiStage({ s, host }: { s: Snapshot; host: string | null }) {
  const feed = useFeed(s, host);
  const done = AGENTS.filter((a) => stateOf(s, a.key) === "done").length;
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [feed.length]);
  return (
    <section className="gv-stage relative overflow-hidden rounded-3xl border border-line">
      <div className="grid lg:grid-cols-[1.25fr_1fr]">
        <div className="relative min-h-[420px] sm:min-h-[460px]">
          <div className="absolute inset-[6%] sm:inset-[8%]"><GrowthRadar className="relative h-full w-full" domain={host ?? undefined} progress={Math.max(0.04, done / 4)} /></div>
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <span className="gv-glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold tabular-nums"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500" /></span>{Math.round((done / 4) * 100)}% analysed</span>
          </div>
          {AGENTS.map((a) => {
            const st = stateOf(s, a.key), I = a.icon;
            return (
              <div key={a.key} className={`absolute ${a.pos} z-10`}>
                <div className={`gv-glass flex items-center gap-2.5 rounded-2xl px-3 py-2 transition-all duration-500 ${st === "work" ? "gv-glow-border scale-105" : st === "wait" ? "opacity-60" : ""}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-xl ${st === "done" ? "bg-lime text-ink" : st === "work" ? "bg-ink text-lime" : "bg-mist text-stone-400"}`}>
                    {st === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : st === "work" ? <I className="h-4 w-4 animate-pulse" /> : <I className="h-4 w-4" />}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block text-[13px] font-semibold leading-tight">{a.name}</span>
                    <span className="block text-[11px] text-stone-500">{st === "done" ? "Done" : st === "slow" ? "Taking a bit longer…" : st === "work" ? a.job : "Waiting"}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="relative border-t border-line bg-white/70 p-5 backdrop-blur-sm lg:border-l lg:border-t-0 sm:p-6">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500"><Sparkles className="h-3.5 w-3.5 text-lime-700" /> Live AI analysis</p>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]">Growvia AI is analysing <span className="gv-ai-text">{host ?? "your business"}</span></h1>
          <ol ref={logRef} className="mt-4 grid max-h-[300px] gap-1.5 overflow-y-auto pr-1 font-mono text-[12.5px] leading-relaxed [scrollbar-width:thin]" aria-live="polite">
            {feed.map((l, i) => (
              <li key={`${i}-${l.t}`} className="gv-rise flex gap-2">
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${l.tone === "good" ? "bg-lime-500" : l.tone === "warn" ? "bg-amber-500" : "bg-sky-400"}`} />
                <span className={l.tone === "good" ? "text-ink" : l.tone === "warn" ? "text-stone-700" : "text-stone-500"}>{i === feed.length - 1 ? <Typed text={l.t} /> : l.t}</span>
              </li>
            ))}
            {s.analysing && <li className="flex items-center gap-2 text-stone-400"><Loader2 className="h-3 w-3 animate-spin" /> thinking…</li>}
          </ol>
        </div>
      </div>
    </section>
  );
}
