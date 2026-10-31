import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { adminClient } from "@/lib/server/admin";
import { PageHeader } from "@/components/app/PageHeader";
import { latestScans, type ScanRow } from "@/lib/security/store";
import { AREA_LABEL, priorities, type Area, type SecCheck } from "@/lib/security/scan";
import { planFor } from "@/lib/billing/plan";
import { ScanButton, FixItem } from "./client";

export const metadata: Metadata = { title: "Security health" };
export const maxDuration = 60;

const color = (s: number) => (s >= 80 ? "#65a30d" : s >= 65 ? "#d97706" : "#dc2626");
function Ring({ score, grade, size = 132 }: { score: number; grade: string; size?: number }) {
  const r = size / 2 - 9, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Security score ${score} out of 100, grade ${grade}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ecebe6" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color(score)} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="45%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill="#0b0d0c">{score}</text>
      <text x="50%" y="66%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.11} fill="#78716c">grade {grade}</text>
    </svg>
  );
}
const Icon = ({ s }: { s: SecCheck["status"] }) => (s === "pass" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-600" /> : s === "fail" ? <XCircle className="h-4 w-4 shrink-0 text-red-600" /> : s === "warn" ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : <Info className="h-4 w-4 shrink-0 text-stone-400" />);

export default async function SecurityPage() {
  const { business } = await requireBusiness();
  const db = adminClient();
  const owner = (business as { owner_id?: string }).owner_id ?? "";
  const [scans, plan] = await Promise.all([db ? latestScans(db, business.id, 12).catch(() => [] as ScanRow[]) : Promise.resolve([] as ScanRow[]), owner ? planFor(owner).catch(() => null) : Promise.resolve(null)]);
  const last = scans[0] ?? null;
  const prev = scans[1] ?? null;
  const r = last?.report ?? null;
  const fixes = r ? priorities(r) : [];
  const areas = r ? (Object.keys(AREA_LABEL) as Area[]).map((a) => ({ a, checks: r.checks.filter((c) => c.area === a) })).filter((x) => x.checks.length) : [];
  const history = [...scans].reverse();

  return (
    <>
      <PageHeader eyebrow={business.name} title="Security health" sub="An outside-in check of your website, the way any browser or visitor sees it, with a score and the fixes that matter most." />
      {!business.website ? (
        <div className="card grid gap-3 p-6"><p className="text-[15px]">Add your website address first, then run your first security check.</p><Link href="/app/settings" className="btn-primary h-11 w-fit px-5 text-[14px]">Add website</Link></div>
      ) : !r ? (
        <div className="card grid gap-4 p-6 sm:p-8" data-testid="security-empty">
          <ShieldCheck className="h-8 w-8 text-lime-700" />
          <h2 className="text-[20px] font-semibold">Check {business.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</h2>
          <p className="max-w-xl text-[15px] text-stone-600">HTTPS and certificate, browser protection headers, insecure content, exposed private files, email spoofing protection and your domain. Takes about 20 seconds.</p>
          <ScanButton label="Run security check" />
        </div>
      ) : (
        <div className="grid gap-4" data-testid="security-report">
          <section className="card grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
            <Ring score={r.score} grade={r.grade} />
            <div className="grid gap-2">
              <p className="text-[13px] text-stone-500">{r.host} · checked {new Date(last!.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{prev ? <> · {r.score - prev.score === 0 ? "no change" : `${r.score - prev.score > 0 ? "+" : ""}${r.score - prev.score} since last check`}</> : null}</p>
              <h2 className="text-[20px] font-semibold leading-tight">{r.score >= 90 ? "Strong security basics" : r.score >= 65 ? "Good, with a few things to fix" : "Important fixes needed"}</h2>
              <p className="text-[14px] text-stone-600"><b className="text-red-700">{r.counts.fail} to fix</b> · <b className="text-amber-700">{r.counts.warn} to improve</b> · <b className="text-lime-700">{r.counts.pass} passed</b></p>
              <div className="flex flex-wrap items-center gap-3"><ScanButton label="Check again" />
                <span className="text-[12px] text-stone-500">{plan?.pro ? "Rechecked automatically every week." : "Free plan: one check a month. Paid plans recheck weekly and alert you."}</span></div>
            </div>
          </section>

          {history.length > 1 && (
            <section className="card p-5">
              <h3 className="mb-3 text-[14px] font-semibold">Score over time</h3>
              <div className="flex h-24 items-end gap-1.5" role="img" aria-label="Security score history">
                {history.map((s) => <div key={s.id} title={`${s.score} · ${s.created_at.slice(0, 10)}`} className="flex-1 rounded-t-md" style={{ height: `${Math.max(6, s.score)}%`, background: color(s.score) }} />)}
              </div>
            </section>
          )}

          <section className="card p-5 sm:p-6">
            <h3 className="text-[16px] font-semibold">What to fix first</h3>
            {fixes.length ? <ol className="mt-3 grid gap-2">{fixes.map((c, i) => <FixItem key={c.id} n={i + 1} c={c} open={i < 2} />)}</ol>
              : <p className="mt-3 flex items-center gap-2 text-[14px] text-lime-800"><CheckCircle2 className="h-4 w-4" /> Nothing to fix. Keep an eye on certificate and domain renewals.</p>}
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            {areas.map(({ a, checks }) => {
              const ok = checks.filter((c) => c.status === "pass").length;
              return (
                <div key={a} className="card p-5">
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[14px] font-semibold">{AREA_LABEL[a]}</h3><span className="text-[12px] text-stone-500">{ok}/{checks.filter((c) => c.status !== "info").length} passed</span></div>
                  <ul className="grid gap-1.5">{checks.map((c) => <li key={c.id} className="flex items-start gap-2 text-[13px]"><Icon s={c.status} /><span><span className="font-medium">{c.title}</span><span className="block text-stone-500">{c.detail}</span></span></li>)}</ul>
                </div>
              );
            })}
          </section>

          <p className="text-[12px] text-stone-500">This is an outside-in health check of your own website using normal, read-only requests. It isn&apos;t a penetration test and can&apos;t see inside your server, plugins or admin accounts. Keep software updated and use strong, unique passwords with two-factor sign-in.</p>
        </div>
      )}
    </>
  );
}
