import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/server/admin";
import { verifyId } from "@/lib/server/crypto";
import { fmtDate } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { AiBots, CategoryBars, IssueList, Plan, ScoreRing, SpeedCard, verdict, type AuditView } from "@/app/app/seo/views";
import { PrintButton } from "@/app/app/seo/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SEO & AI search report", robots: { index: false, follow: false } };

/** Shareable, printable report — anyone with the link can view it (the link is signed and can't be guessed). */
export default async function Report({ params }: { params: { token: string } }) {
  const id = verifyId(params.token, "seo-report");
  const db = adminClient();
  if (!id || !db) notFound();
  const { data: row } = await db.from("seo_audits").select("*, businesses(name, city)").eq("id", id).eq("status", "done").maybeSingle();
  if (!row) notFound();
  const a = row as AuditView & { businesses: { name: string; city: string | null } | null };
  const host = new URL(a.site.finalUrl).host;
  const sev = (s: string) => a.issues.filter((i) => i.severity === s).length;
  return (
    <div className="min-h-dvh bg-paper print:bg-white">
      <main className="mx-auto grid max-w-[900px] gap-6 px-4 py-8 sm:px-6 print:max-w-none print:py-0">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <PrintButton />
        </header>
        <section className="card grid gap-6 p-6 sm:grid-cols-[180px_1fr] sm:items-center print:shadow-none">
          <div className="flex flex-col items-center gap-1"><ScoreRing value={a.score} size={160} label="SEO score" />{a.score != null && <b className="text-[15px]">{verdict(a.score)}</b>}</div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500">SEO & AI search report</p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tightest">{a.businesses?.name ?? host}</h1>
            <p className="text-[14px] text-stone-500">{host} · {fmtDate(a.finished_at ?? a.created_at)} · {a.site.crawled} pages checked</p>
            <p className="mt-2 text-[14px]"><b className="text-red-600">{sev("critical")} critical</b> · <b className="text-amber-600">{sev("warning")} important</b> · <b className="text-sky-700">{sev("notice")} minor</b></p>
            <div className="mt-4"><CategoryBars scores={a.scores} /></div>
          </div>
        </section>
        {a.ai?.summary && <section className="card p-6 text-[15px] leading-relaxed print:shadow-none"><h2 className="mb-2 text-[16px] font-semibold">Summary</h2>{a.ai.summary}</section>}
        <section className="card overflow-hidden print:shadow-none"><h2 className="border-b border-line px-5 py-3 text-[16px] font-semibold">What to fix</h2><IssueList issues={a.issues} /></section>
        {(a.speed?.mobile || a.speed?.desktop) && <section className="grid gap-4 sm:grid-cols-2 print:break-inside-avoid"><SpeedCard s={a.speed.mobile} label="Mobile speed" /><SpeedCard s={a.speed.desktop} label="Desktop speed" /></section>}
        <section className="card grid gap-3 p-5 print:shadow-none print:break-inside-avoid"><h2 className="text-[16px] font-semibold">AI assistants & search crawlers</h2><AiBots site={a.site} /></section>
        {a.ai?.plan && <section className="grid gap-3"><h2 className="text-[18px] font-semibold tracking-tight">Action plan</h2><Plan ai={a.ai} /></section>}
        <footer className="pb-8 text-center text-[12px] text-stone-400">Prepared with Growvia · usegrowvia.com</footer>
      </main>
    </div>
  );
}
