export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const STAGE_META: Record<string, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-sky-500" },
  contacted: { label: "Contacted", dot: "bg-amber-500" },
  qualified: { label: "Qualified", dot: "bg-violet-500" },
  won: { label: "Won", dot: "bg-lime-500" },
  lost: { label: "Lost", dot: "bg-stone-400" },
};

export const CONTENT_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-mist text-stone-600" },
  approved: { label: "Approved", cls: "bg-sky-50 text-sky-700" },
  scheduled: { label: "Scheduled", cls: "bg-amber-50 text-amber-700" },
  published: { label: "Posted", cls: "bg-lime/25 text-lime-800" },
};
