export const fmtDate = (s: string | null | undefined, withTime = false) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Asia/Kolkata" }) : "—";
export const ago = (s: string | null | undefined) => {
  if (!s) return "never";
  const m = Math.round((Date.now() - Date.parse(s)) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 60) return `${d} days ago`;
  return fmtDate(s);
};

export function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] text-stone-500">{label}</p>
      <p className={`mt-1 text-[26px] font-semibold tabular-nums tracking-tight ${tone === "good" ? "text-lime-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-600" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-stone-500">{sub}</p>}
    </div>
  );
}

export function Bars({ data, format = (n: number) => String(n) }: { data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-1" role="img" aria-label="Chart">
      {data.map((d) => (
        <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
          <div className="rounded-t bg-lime-600/80 transition group-hover:bg-lime-700" style={{ height: `${Math.max(d.value ? 3 : 0, (d.value / max) * 100)}%` }} />
          <span className="mt-1 truncate text-center text-[10px] text-stone-400">{d.label}</span>
          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[11px] text-white group-hover:block">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function PlanBadge({ label, source }: { label: string; source: string }) {
  const cls = source === "paid" ? "bg-lime/30 text-lime-900" : source === "trial" ? "bg-sky-50 text-sky-700" : source === "comp" || source === "agency" ? "bg-violet-50 text-violet-700" : "bg-mist text-stone-600";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] ${cls}`}>{label}</span>;
}
