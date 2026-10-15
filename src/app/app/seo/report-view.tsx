import { ArrowDownRight, ArrowUpRight, CheckCircle2, Minus, PlusCircle } from "lucide-react";
import { BarList, LineChart } from "@/components/charts/LineChart";
import type { ReportData } from "@/lib/seo/report";

const ENGINE: Record<string, string> = { gemini: "Gemini", perplexity: "Perplexity", openai: "ChatGPT" };
const dFmt = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function Delta({ v, invert = false, unit = "" }: { v: number | null; invert?: boolean; unit?: string }) {
  if (v == null) return null;
  const good = invert ? v < 0 : v > 0;
  const Icon = v === 0 ? Minus : (v > 0) ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-[12px] font-medium ${v === 0 ? "text-stone-500" : good ? "text-lime-700" : "text-red-600"}`}><Icon className="h-3.5 w-3.5" />{Math.abs(Math.round(v * 10) / 10)}{unit} <span className="font-normal text-stone-400">vs previous</span></span>;
}

function Kpi({ label, value, delta, sub }: { label: string; value: string; delta?: React.ReactNode; sub?: string }) {
  return <div className="card p-4"><p className="text-[12px] text-stone-500">{label}</p><p className="mt-1 text-[26px] font-semibold tabular-nums tracking-tight">{value}</p><div className="min-h-[18px]">{delta}</div>{sub && <p className="text-[12px] text-stone-400">{sub}</p>}</div>;
}

/** The body of a weekly / monthly / custom report — used in the app and on the shareable link. */
export function ReportView({ r }: { r: ReportData }) {
  const sd = r.start && r.end ? (r.end.score ?? 0) - (r.start.score ?? 0) : null;
  const pd = r.totals.position != null && r.totals.prevPosition != null ? r.totals.position - r.totals.prevPosition : null;
  const top10 = r.keywords.filter((k) => k.end != null && k.end <= 10).length;
  const movers = r.keywords.filter((k) => k.start != null && k.end != null).map((k) => ({ ...k, d: k.start! - k.end! })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const chartKw = [...r.keywords].filter((k) => k.series.some((s) => s.position != null)).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
  const kwDays = [...new Set(chartKw.flatMap((k) => k.series.map((s) => s.day)))].sort();
  const engines = [...new Set(r.geo.prompts.flatMap((p) => Object.keys(p.engines)))];
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="SEO score" value={`${r.end?.score ?? "—"}`} delta={<Delta v={sd} unit=" pts" />} />
        <Kpi label="AI visibility" value={r.geo.rate != null ? `${r.geo.rate}%` : "—"} delta={<Delta v={r.geo.rate != null && r.geo.prevRate != null ? r.geo.rate - r.geo.prevRate : null} unit=" pts" />} sub={r.geo.checks ? `${r.geo.checks} AI answers checked` : "no AI checks in this period"} />
        <Kpi label="Google clicks" value={`${r.totals.clicks.toLocaleString("en-IN")}`} delta={<Delta v={r.totals.prevClicks || r.totals.clicks ? r.totals.clicks - r.totals.prevClicks : null} />} sub={`${r.totals.impressions.toLocaleString("en-IN")} times shown`} />
        <Kpi label="Avg. Google position" value={r.totals.position != null ? `${r.totals.position}` : "—"} delta={<Delta v={pd} invert />} sub={r.keywords.length ? `${top10} of ${r.keywords.length} keywords in top 10` : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5 print:break-inside-avoid">
          <h3 className="mb-3 text-[15px] font-semibold">SEO score over time</h3>
          <LineChart title="SEO score over time" labels={r.audits.map((a) => a.day)} min={0} max={100} series={[{ name: "Overall", values: r.audits.map((a) => a.score) }, { name: "AI search", values: r.audits.map((a) => a.scores?.ai ?? null) }, { name: "Technical", values: r.audits.map((a) => a.scores?.technical ?? null) }]} empty="Run at least one audit in this period" />
        </section>
        <section className="card p-5 print:break-inside-avoid">
          <h3 className="mb-3 text-[15px] font-semibold">AI visibility — % of AI answers that mention you</h3>
          <LineChart title="AI visibility over time" labels={r.geo.runs.map((x) => x.day)} min={0} max={100} unit="percent" series={[{ name: "Mentioned", values: r.geo.runs.map((x) => x.rate) }]} empty="Add questions under AI visibility and run a check" />
          {r.geo.byEngine.length > 0 && <div className="mt-3 flex flex-wrap gap-2 text-[12px]">{r.geo.byEngine.map((e) => <span key={e.engine} className="rounded-full bg-mist px-2.5 py-1">{ENGINE[e.engine] ?? e.engine}: <b className="tabular-nums">{e.rate}%</b> of {e.checks}</span>)}</div>}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5 print:break-inside-avoid">
          <h3 className="mb-3 text-[15px] font-semibold">Google clicks per day</h3>
          <LineChart title="Google clicks per day" labels={r.traffic.map((t) => t.day)} min={0} series={[{ name: "Clicks", values: r.traffic.map((t) => t.clicks) }]} empty="Connect Google Search Console to see traffic" />
        </section>
        <section className="card p-5 print:break-inside-avoid">
          <h3 className="mb-3 text-[15px] font-semibold">Times shown in Google per day</h3>
          <LineChart title="Impressions per day" labels={r.traffic.map((t) => t.day)} min={0} series={[{ name: "Impressions", values: r.traffic.map((t) => t.impressions) }]} empty="Connect Google Search Console to see traffic" />
        </section>
      </div>

      {chartKw.length > 0 && (
        <section className="card p-5 print:break-inside-avoid">
          <h3 className="mb-1 text-[15px] font-semibold">Keyword positions</h3>
          <p className="mb-3 text-[12px] text-stone-500">Position in Google (1 = top). Top keywords by how often you were shown.</p>
          <LineChart title="Keyword positions" invert min={1} labels={kwDays} series={chartKw.map((k) => ({ name: k.keyword, values: kwDays.map((d) => k.series.find((s) => s.day === d)?.position ?? null) }))} />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {movers.length > 0 && (
          <section className="card overflow-hidden print:break-inside-avoid">
            <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Keyword movement</h3>
            <table className="w-full text-[13px]"><thead className="text-[12px] text-stone-500"><tr><th className="px-5 py-2 text-left font-medium">Keyword</th><th className="px-2 py-2 text-right font-medium">Start</th><th className="px-2 py-2 text-right font-medium">Now</th><th className="px-5 py-2 text-right font-medium">Change</th></tr></thead>
              <tbody className="divide-y divide-line">{movers.slice(0, 12).map((m) => <tr key={m.id}><td className="max-w-[220px] truncate px-5 py-2">{m.keyword}</td><td className="px-2 py-2 text-right tabular-nums text-stone-500">{m.start!.toFixed(1)}</td><td className="px-2 py-2 text-right tabular-nums">{m.end!.toFixed(1)}</td><td className={`px-5 py-2 text-right tabular-nums ${m.d > 0 ? "text-lime-700" : m.d < 0 ? "text-red-600" : "text-stone-500"}`}>{m.d > 0 ? "▲" : m.d < 0 ? "▼" : "→"} {Math.abs(m.d).toFixed(1)}</td></tr>)}</tbody>
            </table>
          </section>
        )}
        {r.geo.shareOfVoice.length > 1 && (
          <section className="card p-5 print:break-inside-avoid">
            <h3 className="mb-1 text-[15px] font-semibold">Share of voice in AI answers</h3>
            <p className="mb-3 text-[12px] text-stone-500">How often each business was named across all AI answers in this period.</p>
            <BarList rows={r.geo.shareOfVoice.map((s) => ({ label: s.you ? `${s.name} (you)` : s.name, value: s.count, highlight: s.you }))} />
          </section>
        )}
      </div>

      {(r.fixed.length > 0 || r.added.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5 print:break-inside-avoid"><h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><CheckCircle2 className="h-4 w-4 text-lime-700" /> Fixed in this period ({r.fixed.length})</h3><ul className="grid gap-1 text-[13px] text-stone-700">{r.fixed.map((i) => <li key={i.id}>{i.title}</li>)}{!r.fixed.length && <li className="text-stone-400">Nothing yet</li>}</ul></section>
          <section className="card p-5 print:break-inside-avoid"><h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><PlusCircle className="h-4 w-4 text-amber-600" /> New issues ({r.added.length})</h3><ul className="grid gap-1 text-[13px] text-stone-700">{r.added.map((i) => <li key={i.id}>{i.title}</li>)}{!r.added.length && <li className="text-stone-400">None — nice</li>}</ul></section>
        </div>
      )}

      {r.geo.prompts.length > 0 && engines.length > 0 && (
        <section className="card overflow-x-auto print:break-inside-avoid">
          <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Do AI assistants recommend you?</h3>
          <table className="w-full min-w-[520px] text-[13px]"><thead className="text-[12px] text-stone-500"><tr><th className="px-5 py-2 text-left font-medium">Question</th>{engines.map((e) => <th key={e} className="px-3 py-2 text-center font-medium">{ENGINE[e] ?? e}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{r.geo.prompts.filter((p) => Object.keys(p.engines).length).map((p) => <tr key={p.prompt}><td className="px-5 py-2">{p.prompt}</td>{engines.map((e) => <td key={e} className="px-3 py-2 text-center">{p.engines[e] == null ? <span className="text-stone-300">—</span> : p.engines[e] ? <span className="font-medium text-lime-700">✓ Yes</span> : <span className="text-red-600">✗ No</span>}</td>)}</tr>)}</tbody>
          </table>
        </section>
      )}

      {r.end?.experts?.experts?.length ? (
        <section className="card p-5 print:break-inside-avoid">
          <h3 className="mb-3 text-[15px] font-semibold">Expert recommendations</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {r.end.experts.experts.map((e) => (
              <div key={e.id}><p className="text-[14px] font-medium">{e.role} <span className="ml-1 rounded-full bg-mist px-2 py-0.5 text-[11px]">Grade {e.grade}</span></p><ul className="mt-1 list-disc pl-5 text-[13px] text-stone-600">{e.recommendations.slice(0, 3).map((x) => <li key={x.title}>{x.title}</li>)}</ul></div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
