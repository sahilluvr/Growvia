"use client";
import { useEffect, useRef } from "react";

/*
  Plays the blog's animated visuals (Viz) and table/heading accents as they scroll into view.
  Content is fully visible in the server HTML; this only "rewinds" things the moment JS loads, then plays them.
  With "reduce motion" on, nothing is rewound — everything simply stays visible.
*/
export function PostMotion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".viz, .rv"));
    const vh = innerHeight;
    const fmt = (el: HTMLElement, n: number) => {
      const dec = Number(el.dataset.dec || 0);
      const s = el.dataset.comma === "1" ? n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : n.toFixed(dec);
      el.textContent = `${el.dataset.pre || ""}${s}${el.dataset.post || ""}`;
    };
    const counters = (el: HTMLElement, start: boolean) => el.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => {
      const end = Number(c.dataset.count);
      if (!start) { c.dataset.final = c.textContent || ""; return fmt(c, 0); }
      const t0 = performance.now(), dur = 1300;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        if (p < 1) { fmt(c, end * e); requestAnimationFrame(tick); } else c.textContent = c.dataset.final || c.textContent;
      };
      setTimeout(() => requestAnimationFrame(tick), 250);
    });
    // Rewind: visuals always (so they play even above the fold); plain accents only when below the fold (no flash).
    const waiting = els.filter((el) => el.classList.contains("viz") || el.getBoundingClientRect().top > vh * 0.95);
    waiting.forEach((el) => { el.classList.add("rv-wait", "rv-nt"); counters(el, false); });
    requestAnimationFrame(() => requestAnimationFrame(() => waiting.forEach((el) => el.classList.remove("rv-nt"))));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement;
      el.classList.remove("rv-wait"); el.classList.add("is-in");
      counters(el, true);
      io.unobserve(el);
    }), { threshold: 0.25, rootMargin: "0px 0px -8% 0px" });
    waiting.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="post-motion">{children}</div>;
}
