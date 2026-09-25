import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { repo } from "@/lib/data";
import { SEGMENTS } from "@/lib/plans";
import { LeadForm } from "./LeadForm";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const b = UUID.test(params.id) ? await repo().publicBusiness(params.id) : null;
  return { title: b ? `Contact ${b.name}` : "Contact", robots: { index: false } };
}

export default async function PublicLeadPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const b = await repo().publicBusiness(params.id);
  if (!b) notFound();
  const seg = SEGMENTS.find((s) => s.id === b.segment)?.label;
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-xl font-semibold text-lime">{b.name.slice(0, 1).toUpperCase()}</span>
          <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-tightest">Get in touch with {b.name}</h1>
          <p className="mt-1 text-[14px] text-stone-500">{[seg, b.city].filter(Boolean).join(" · ")}</p>
          {b.offer && <p className="mt-4 rounded-xl bg-lime/20 px-4 py-3 text-[14px] font-medium text-lime-800">{b.offer}</p>}
          <LeadForm bid={b.id} name={b.name} />
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-stone-400"><LogoMark className="h-4 w-4" /> Powered by Growvia</p>
      </div>
    </main>
  );
}
