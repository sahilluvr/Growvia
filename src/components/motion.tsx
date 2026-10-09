"use client";
/* Small, dependency-free motion helpers for the marketing site. All respect "reduce motion". */
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

/** Thin lime bar at the top that fills as you scroll the page. */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    }); };
    on();
    addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={bar} aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left scale-x-0 bg-lime-500" />;
}

/** Heading words rise in one after another when scrolled into view. */
export function Words({ text, className = "", delay = 0, step = 55 }: { text: string; className?: string; delay?: number; step?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (reduced()) return setOn(true);
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden align-bottom">
          <span className="word-rise inline-block" data-on={on} style={{ transitionDelay: `${delay + i * step}ms` }}>{w}&nbsp;</span>
        </span>
      ))}
    </span>
  );
}

/** A soft light that follows the cursor across every `.spot` card inside. */
export function SpotlightGroup({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !finePointer() || reduced()) return;
    const move = (e: PointerEvent) => {
      el.querySelectorAll<HTMLElement>(".spot").forEach((c) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", `${e.clientX - r.left}px`); c.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

/** Gentle 3D tilt toward the cursor (desktop only). */
export function Tilt({ children, className = "", max = 5 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !finePointer() || reduced()) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { el.style.transform = `perspective(1400px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`; });
    };
    const leave = () => { cancelAnimationFrame(raf); el.style.transform = ""; };
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf); };
  }, [max]);
  return <div ref={ref} className={`transition-transform duration-300 ease-out will-change-transform ${className}`}>{children}</div>;
}

/** Number that counts up from 0 when it comes into view. Keeps any prefix/suffix (e.g. "$8,420", "+32%"). */
export function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = value.match(/^(\D*)([\d,.]+)(.*)$/);
  const [shown, setShown] = useState(m ? `${m[1]}0${m[3]}` : value);
  useEffect(() => {
    if (!m) return;
    const target = parseFloat(m[2].replace(/,/g, "")), decimals = (m[2].split(".")[1] ?? "").length, comma = m[2].includes(",");
    const fmt = (n: number) => { const s = n.toFixed(decimals); return comma ? Number(s).toLocaleString("en-US", { minimumFractionDigits: decimals }) : s; };
    if (reduced()) return setShown(value);
    const el = ref.current; if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / duration), k = 1 - Math.pow(1 - p, 3); setShown(`${m[1]}${fmt(target * k)}${m[3]}`); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className="tabular-nums">{shown}</span>;
}

/** Cycles through words with a vertical slide. */
export function Rotator({ words, className = "", every = 2200 }: { words: string[]; className?: string; every?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced() || words.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % words.length), every);
    return () => clearInterval(id);
  }, [words.length, every]);
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <span className={`relative inline-grid overflow-hidden text-left align-bottom ${className}`} aria-live="polite">
      <span className="invisible col-start-1 row-start-1">{longest}</span>
      {words.map((w, k) => (
        <span key={w} aria-hidden={k !== i} className="col-start-1 row-start-1 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ transform: `translateY(${k === i ? 0 : k === (i - 1 + words.length) % words.length ? -110 : 110}%)`, opacity: k === i ? 1 : 0 }}>{w}</span>
      ))}
    </span>
  );
}

/** Pulls its child a little toward the cursor (for primary buttons). */
export function Magnetic({ children, strength = 0.25, className = "" }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !finePointer() || reduced()) return;
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`; };
    const leave = () => { el.style.transform = ""; };
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [strength]);
  return <span ref={ref} className={`inline-flex transition-transform duration-300 ease-out ${className}`}>{children}</span>;
}

/** Follows the cursor with a large soft glow inside its (relative) parent. */
export function CursorGlow({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current, host = el?.parentElement; if (!el || !host || !finePointer() || reduced()) return;
    let raf = 0;
    const move = (e: PointerEvent) => { const r = host.getBoundingClientRect(); cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = `translate(${e.clientX - r.left - 300}px, ${e.clientY - r.top - 300}px)`; }); };
    const leave = () => { el.style.opacity = "0"; };
    host.addEventListener("pointermove", move); host.addEventListener("pointerleave", leave);
    return () => { host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} aria-hidden="true" className={`pointer-events-none absolute left-0 top-0 h-[600px] w-[600px] rounded-full opacity-0 transition-opacity duration-500 [background:radial-gradient(circle,rgba(197,242,58,0.22),transparent_60%)] ${className}`} />;
}
