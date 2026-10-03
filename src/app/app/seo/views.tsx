import { AlertTriangle, CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";
import { CATEGORY_LABEL, type AiOutput, type Category, type GscData, type Issue, type PageResult, type Scores, type SiteInfo, type SpeedResult } from "@/lib/seo/types";

export type AuditView = {
  id: string; url: string; status: string; score: number | null; scores: Scores; site: SiteInfo; pages: PageResult[]; issues: Issue[];
  speed: { mobile?: SpeedResult; desktop?: SpeedResult }; ai: Partial<AiOutput>; gsc: GscData | null; error: string | null; created_at: string; finished_at: string | null;
};

export const tone = (n: number | null | undefined) => (n == null ? "text-stone-400" : n >= 85 ? "text-lime-700" : n >= 60 ? "text-amber-600" : "text-red-600");
const stroke = (n: number) => (n >= 85 ? "#6FA80B" : n >= 60 ? "#D97706" : "#DC2626");
export const verdict = (n: number) => (n >= 90 ? "Excellent" : n >= 75 ? "Good" : n >= 60 ? "Needs work" : n >= 40 ? "Poor" : "Critical");

export function ScoreRing({ value, size = 132, label }: { value: number | null | undefined; size?: number; label?: string }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${value ?? "not measured"} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFEFEA" strokeWidth="9" />
        {value != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke(v)} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />}
      </svg>
      <div className="absolute text-center">
        <div className={`font-semibold tabular-nums tracking-tight ${tone(value)}`} style={{ fontSize: size * 0.3 }}>{value ?? "—"}</div>
        {label && <div className="text-[11px] text-stone-500">{label}</div>}
      </div>
    </div>
  );
}

export function CategoryBars({ scores }: { scores: Scores }) {
  const cats: Category[] = ["technical", "onpage", "content", "ai", "speed", "social"];
  return (
    <ul className="grid gap-3">
      {cats.map((c) => {
        const v = scores[c];
        return (
          <li key={c} className="grid grid-cols-[110px_1fr_36px] items-center gap-3 text-[13px]">
            <span className="text-stone-600">{CATEGORY_LABEL[c]}</span>
            <span className="h-2 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full" style={{ width: `${v ?? 0}%`, background: v == null ? "transparent" : stroke(v) }} /></span>
            <span className={`text-right font-semibold tabular-nums ${tone(v)}`}>{v ?? "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}

const SEV = {
  critical: { icon: XCircle, cls: "text-red-600", chip: "bg-red-50 text-red-700", label: "Critical" },
  warning: { icon: AlertTriangle, cls: "text-amber-600", chip: "bg-amber-50 text-amber-800", label: "Important" },
  notice: { icon: Info, cls: "text-sky-600", chip: "bg-sky-50 text-sky-700", label: "Minor" },
} as const;

export function IssueList({ issues, limit, showPages = true }: { issues: Issue[]; limit?: number; showPages?: boolean }) {
  const list = limit ? issues.slice(0, limit) : issues;
  if (!list.length) return <p className="flex items-center gap-2 p-5 text-[14px] text-lime-800"><CheckCircle2 className="h-4 w-4" /> No issues found here.</p>;
  return (
    <ul className="divide-y divide-line">
      {list.map((i) => {
        const S = SEV[i.severity];
        return (
          <li key={i.id} className="p-4">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3">
                <S.icon className={`mt-0.5 h-4 w-4 shrink-0 ${S.cls}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium">{i.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${S.chip}`}>{S.label}</span>
                    <span className="text-[11px] text-stone-400">{CATEGORY_LABEL[i.category]}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-stone-600"><b className="font-medium text-ink">Fix:</b> {i.fix}</p>
                </div>
              </summary>
              {(i.detail || (showPages && i.pages?.length)) && (
                <div className="ml-7 mt-2 grid gap-2 text-[13px] text-stone-600">
                  {i.detail && <p className="whitespace-pre-line">{i.detail}</p>}
                  {showPages && i.pages?.length ? (
                    <ul className="grid gap-0.5 font-mono text-[12px] text-stone-500">
                      {i.pages.slice(0, 12).map((p) => <li key={p} className="truncate">{p}</li>)}
                      {i.pages.length > 12 && <li>…and {i.pages.length - 12} more</li>}
                    </ul>
                  ) : null}
                </div>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}

const ms = (v?: number) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const catTone = (c?: string) => (c === "FAST" ? "text-lime-700" : c === "AVERAGE" ? "text-amber-600" : c === "SLOW" ? "text-red-600" : "text-stone-500");
const catWord = (c?: string) => (c === "FAST" ? "Good" : c === "AVERAGE" ? "Needs work" : c === "SLOW" ? "Poor" : "");

export function SpeedCard({ s, label }: { s?: SpeedResult; label: string }) {
  if (!s) return <div className="card p-5 text-[14px] text-stone-500">{label}: not tested yet.</div>;
  if (!s.ok) return <div className="card p-5"><p className="text-[14px] font-medium">{label}</p><p className="mt-2 flex gap-2 text-[13px] text-amber-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{s.error}</p></div>;
  const labRows: [string, string, number | undefined, number, number][] = [
    ["Largest content shows", "LCP", s.lab?.lcp, 2500, 4000],
    ["First content shows", "FCP", s.lab?.fcp, 1800, 3000],
    ["Page blocked (JS)", "TBT", s.lab?.tbt, 200, 600],
    ["Speed Index", "SI", s.lab?.si, 3400, 5800],
  ];
  return (
    <div className="card grid gap-4 p-5">
      <div className="flex items-center gap-4">
        <ScoreRing value={s.performance} size={96} label="Speed" />
        <div className="grid grid-cols-3 gap-3 text-center text-[12px] text-stone-500">
          {[["SEO", s.seo], ["Accessibility", s.accessibility], ["Best practices", s.bestPractices]].map(([k, v]) => <div key={k as string}><div className={`text-[20px] font-semibold tabular-nums ${tone(v as number)}`}>{(v as number) ?? "—"}</div>{k as string}</div>)}
        </div>
      </div>
      <p className="text-[14px] font-medium">{label}</p>
      <div className="grid gap-1.5 text-[13px]">
        {labRows.map(([name, code, v, good, poor]) => (
          <div key={code} className="flex justify-between gap-2"><span className="text-stone-600">{name} <span className="text-stone-400">{code}</span></span><span className={`font-medium tabular-nums ${v == null ? "" : v <= good ? "text-lime-700" : v <= poor ? "text-amber-600" : "text-red-600"}`}>{ms(v)}</span></div>
        ))}
        <div className="flex justify-between gap-2"><span className="text-stone-600">Layout shift <span className="text-stone-400">CLS</span></span><span className={`font-medium tabular-nums ${s.lab?.cls == null ? "" : s.lab.cls <= 0.1 ? "text-lime-700" : s.lab.cls <= 0.25 ? "text-amber-600" : "text-red-600"}`}>{s.lab?.cls?.toFixed(2) ?? "—"}</span></div>
      </div>
      {s.field && (
        <div className="rounded-xl bg-mist p-3 text-[13px]">
          <p className="mb-1.5 font-medium">Real visitors (Chrome, last 28 days){s.field.overall ? <span className={`ml-1 ${catTone(s.field.overall)}`}>· {catWord(s.field.overall)}</span> : null}</p>
          <div className="grid grid-cols-3 gap-2">
            <div>LCP <b className={catTone(s.field.lcp?.cat)}>{ms(s.field.lcp?.ms)}</b></div>
            <div>INP <b className={catTone(s.field.inp?.cat)}>{ms(s.field.inp?.ms)}</b></div>
            <div>CLS <b className={catTone(s.field.cls?.cat)}>{s.field.cls?.value?.toFixed(2) ?? "—"}</b></div>
          </div>
        </div>
      )}
      {!!s.opportunities?.length && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Biggest speed-ups</p>
          <ul className="grid gap-1 text-[13px] text-stone-600">
            {s.opportunities.map((o) => <li key={o.id} className="flex justify-between gap-3"><span>{o.title}</span><span className="shrink-0 tabular-nums text-stone-500">−{ms(o.savingsMs)}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AiBots({ site }: { site: SiteInfo }) {
  return (
    <ul className="grid gap-1.5 text-[13px] sm:grid-cols-2">
      {site.aiBots.map((b) => (
        <li key={b.name} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2">
          {b.allowed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-700" /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
          <span className="min-w-0 flex-1"><b className="font-medium">{b.name}</b> <span className="text-stone-500">· {b.owner} — {b.purpose}</span></span>
          <span className={`shrink-0 text-[12px] ${b.allowed ? "text-lime-700" : "text-red-600"}`}>{b.allowed ? "Allowed" : "Blocked"}</span>
        </li>
      ))}
    </ul>
  );
}

export function Plan({ ai }: { ai: Partial<AiOutput> }) {
  const chip = (v: string) => (v === "high" ? "bg-lime/25 text-lime-800" : v === "medium" ? "bg-amber-50 text-amber-800" : "bg-mist text-stone-600");
  return (
    <div className="grid gap-5">
      {ai.plan?.map((p) => (
        <section key={p.phase} className="card p-5">
          <h3 className="text-[16px] font-semibold tracking-tight">{p.phase}</h3>
          <ol className="mt-3 grid gap-3">
            {p.items.map((it, n) => (
              <li key={n} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-lime">{n + 1}</span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{it.task}</p>
                  <p className="mt-0.5 text-[13px] text-stone-600">{it.why}</p>
                  <div className="mt-1.5 flex gap-1.5 text-[11px]"><span className={`rounded-full px-2 py-0.5 ${chip(it.impact)}`}>{it.impact} impact</span><span className="rounded-full bg-mist px-2 py-0.5 text-stone-600">{it.effort} effort</span></div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
