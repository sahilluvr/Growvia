import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/server/admin";
import { verifyId } from "@/lib/server/crypto";
import { buildReport } from "@/lib/seo/report";
import { Logo } from "@/components/Logo";
import { ReportView } from "@/app/app/seo/report-view";
import { PrintButton } from "@/app/app/seo/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SEO & AI visibility report", robots: { index: false, follow: false } };

/** Shareable weekly / monthly / custom report (signed link, no login). */
export default async function RangeReport({ params }: { params: { token: string } }) {
  const v = verifyId(params.token, "seo-range");
  const [businessId, from, to] = (v ?? "").split("~");
  const db = adminClient();
  if (!v || !db || !/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) notFound();
  const r = await buildReport(db, businessId, { from, to });
  if (!r) notFound();
  return (
    <div className="min-h-dvh bg-paper print:bg-white">
      <main className="mx-auto grid max-w-[1000px] gap-6 px-4 py-8 sm:px-6 print:max-w-none print:py-0">
        <header className="flex flex-wrap items-center justify-between gap-3"><Logo /><PrintButton /></header>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500">SEO & AI visibility report</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-tightest">{r.business.name}</h1>
          <p className="text-[14px] text-stone-500">{r.business.website?.replace(/^https?:\/\//, "")} · {from} → {to}</p>
        </div>
        <ReportView r={r} />
        <footer className="pb-8 text-center text-[12px] text-stone-400">Prepared with Growvia</footer>
      </main>
    </div>
  );
}
