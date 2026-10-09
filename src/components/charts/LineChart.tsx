"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/*
 * Small, dependency-free SVG line chart.
 * Validated categorical palette (fixed order, never cycled); 2px lines; crosshair + one tooltip for all series;
 * legend for 2+ series with direct end labels for ≤4; recessive grid; table view for accessibility.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export type Series = { name: string; values: (number | null)[] };

type Props = {
  labels: string[];              // x labels (e.g. dates), one per value
  series: Series[];
  height?: number;
  invert?: boolean;              // rank charts: 1 at the top
  min?: number; max?: number;
  unit?: "number" | "percent";   // y-value format (plain strings so Server Components can pass them)
  xAxis?: "date" | "text";
  title?: string;                // accessible name
  empty?: string;
};

const niceStep = (range: number, ticks: number) => {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * pow;
};

const fmtDate = (s: string) => { const d = new Date(`${s}T00:00:00Z`); return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }); };

export function LineChart({ labels, series, height = 220, invert = false, min, max, unit = "number", xAxis = "date", title = "Chart", empty = "No data yet" }: Props) {
  const format = (v: number) => (unit === "percent" ? `${Math.round(v)}%` : `${Math.round(v * 10) / 10}`);
  const xFormat = xAxis === "date" ? fmtDate : (l: string) => l;
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0); // measured from the container, so the chart never pushes the page wider
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null && Number.isFinite(v));
  const lo0 = min ?? (all.length ? Math.min(...all) : 0);
  const hi0 = max ?? (all.length ? Math.max(...all) : 1);
  const step = niceStep((hi0 - lo0) || Math.abs(hi0) || 1, 4);
  const lo = min ?? Math.floor(lo0 / step) * step;
  const hi = max ?? Math.max(lo + step, Math.ceil(hi0 / step) * step);
  const padL = 40, padR = series.length > 1 && series.length <= 4 ? 96 : 14, padT = 12, padB = 26;
  const iw = w - padL - padR, ih = height - padT - padB;
  const x = (i: number) => padL + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => { const t = (v - lo) / (hi - lo || 1); return padT + (invert ? t : 1 - t) * ih; };
  const ticks = useMemo(() => { const t: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) t.push(Math.round(v * 1000) / 1000); return t; }, [lo, hi, step]);
  const xTicks = labels.length <= 8 ? labels.map((_, i) => i) : Array.from({ length: 6 }, (_, k) => Math.round((k / 5) * (labels.length - 1)));
  const few = labels.length <= 16;

  if (!all.length) return <div className="grid place-items-center rounded-xl bg-paper text-[13px] text-stone-500" style={{ height }}>{empty}</div>;

  const path = (vals: (number | null)[]) => {
    let d = "", pen = false;
    vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = labels.length <= 1 ? 0 : Math.round(((px) / r.width) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };
  const endLabels = series.length > 1 && series.length <= 4 ? series.map((s, k) => { const i = [...s.values].map((v, j) => (v == null ? -1 : j)).filter((j) => j >= 0).at(-1); return i == null ? null : { k, i, v: s.values[i]! }; }).filter(Boolean) as { k: number; i: number; v: number }[] : [];
  // keep end labels from colliding
  const placed = endLabels.map((l) => ({ ...l, ly: y(l.v) })).sort((a, b) => a.ly - b.ly);
  for (let j = 1; j < placed.length; j++) if (placed[j].ly - placed[j - 1].ly < 13) placed[j].ly = placed[j - 1].ly + 13;

  return (
    <div ref={wrap} className="relative w-full min-w-0 max-w-full">
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-stone-600" aria-hidden="true">
          {series.map((s, k) => <li key={s.name} className="flex items-center gap-1.5"><span className="inline-block h-[2px] w-4 rounded" style={{ background: SERIES[k % SERIES.length] }} />{s.name}</li>)}
        </ul>
      )}
      {w === 0 ? <div style={{ height }} /> : <svg width={w} height={height} role="img" aria-label={title} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke="#EFEFEA" strokeWidth={1} />
            <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#9A9E98">{format(t)}</text>
          </g>
        ))}
        {xTicks.map((i) => <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="#9A9E98">{xFormat(labels[i])}</text>)}
        {series.map((s, k) => (
          <g key={s.name}>
            <path d={path(s.values)} fill="none" stroke={SERIES[k % SERIES.length]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {few && s.values.map((v, i) => v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={SERIES[k % SERIES.length]} stroke="#fff" strokeWidth={2} />)}
          </g>
        ))}
        {placed.map((l) => <text key={l.k} x={padL + iw + 8} y={l.ly} dy="0.32em" fontSize={11} fill="#4F534E">{series[l.k].name.length > 14 ? `${series[l.k].name.slice(0, 13)}…` : series[l.k].name}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="#9A9E98" strokeWidth={1} />}
        {hover != null && series.map((s, k) => s.values[hover] == null ? null : <circle key={k} cx={x(hover)} cy={y(s.values[hover]!)} r={4.5} fill={SERIES[k % SERIES.length]} stroke="#fff" strokeWidth={2} />)}
        <rect x={padL} y={padT} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} tabIndex={0}
          onKeyDown={(e) => { if (e.key === "ArrowRight") setHover((h) => Math.min(labels.length - 1, (h ?? -1) + 1)); if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? 1) - 1)); }}
          onFocus={() => setHover((h) => h ?? labels.length - 1)} onBlur={() => setHover(null)} aria-label={`${title}: use arrow keys to read values`} />
      </svg>}
      {hover != null && (
        <div className="pointer-events-none absolute top-6 z-10 min-w-[140px] rounded-lg border border-line bg-white px-3 py-2 text-[12px] shadow-frame" style={{ left: Math.min(Math.max(0, x(hover) - 70), w - 160) }}>
          <p className="mb-1 text-stone-500">{xFormat(labels[hover])}</p>
          {series.map((s, k) => (
            <p key={s.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-stone-600"><span className="inline-block h-[2px] w-3 rounded" style={{ background: SERIES[k % SERIES.length] }} />{s.name}</span>
              <b className="font-semibold tabular-nums text-ink">{s.values[hover] == null ? "—" : format(s.values[hover]!)}</b>
            </p>
          ))}
        </div>
      )}
      <details className="mt-1 text-[12px] text-stone-500 print:hidden">
        <summary className="cursor-pointer select-none">Table view</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead><tr><th className="py-1 pr-3 font-medium">Date</th>{series.map((s) => <th key={s.name} className="py-1 pr-3 font-medium">{s.name}</th>)}</tr></thead>
            <tbody>{labels.map((l, i) => <tr key={l + i} className="border-t border-line"><td className="py-1 pr-3">{xFormat(l)}</td>{series.map((s) => <td key={s.name} className="py-1 pr-3 text-ink">{s.values[i] == null ? "—" : format(s.values[i]!)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Tiny trend line for tables (no axes). */
export function Sparkline({ values, invert = false, width = 90, height = 26 }: { values: (number | null)[]; invert?: boolean; width?: number; height?: number }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <span className="text-[11px] text-stone-400">—</span>;
  const lo = Math.min(...v), hi = Math.max(...v);
  const pts = values.map((x, i) => (x == null ? null : [2 + (i / (values.length - 1)) * (width - 4), 2 + (invert ? (x - lo) / (hi - lo || 1) : 1 - (x - lo) / (hi - lo || 1)) * (height - 4)] as const)).filter(Boolean) as (readonly [number, number])[];
  return <svg width={width} height={height} aria-hidden="true"><polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#2a78d6" strokeWidth={1.5} strokeLinejoin="round" /></svg>;
}

/** Horizontal bars for share-of-voice style comparisons (one measure, one axis). */
export function BarList({ rows }: { rows: { label: string; value: number; highlight?: boolean }[] }) {
  const format = (v: number) => `${v}`;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,140px)_1fr_40px] items-center gap-3 text-[13px]" title={`${r.label}: ${format(r.value)}`}>
          <span className={`truncate ${r.highlight ? "font-semibold text-ink" : "text-stone-600"}`}>{r.label}</span>
          <span className="h-3 rounded bg-mist"><span className="block h-full rounded" style={{ width: `${(r.value / max) * 100}%`, background: r.highlight ? SERIES[0] : "#9A9E98" }} /></span>
          <span className="text-right tabular-nums text-ink">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
