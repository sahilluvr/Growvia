import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminClient } from "@/lib/server/admin";
import { SEGMENTS } from "@/lib/plans";
import { fieldsOf, loadForm, settingsOf } from "@/lib/forms";
import { captchaOn, TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY } from "@/lib/captcha";
import { LeadForm } from "./LeadForm";
import { LogoMark } from "@/components/Logo";
import { planFor } from "@/lib/billing/plan";

export const dynamic = "force-dynamic";

async function get(id: string) {
  const db = adminClient();
  return db ? loadForm(db, id) : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const x = await get(params.id);
  return { title: x ? `Contact ${x.business.name}` : "Contact", robots: { index: false } };
}

/** Shareable contact page for a project's website form. */
export default async function PublicLeadPage({ params, searchParams }: { params: { id: string }; searchParams: { sent?: string } }) {
  const x = await get(params.id);
  if (!x) notFound();
  const { form, business: b } = x;
  const s = settingsOf(form.settings, b.name);
  // Free plan forms always carry the badge; Pro can remove it.
  const brand = s.show_branding || (await planFor(b.owner_id)).limits.branding;
  const seg = SEGMENTS.find((z) => z.id === b.segment)?.label;
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl text-xl font-semibold text-lime" style={{ background: s.accent }}>{b.name.slice(0, 1).toUpperCase()}</span>
          <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-tightest">{s.title}</h1>
          <p className="mt-1 text-[14px] text-stone-500">{[seg, b.city].filter(Boolean).join(" · ")}</p>
          {s.intro ? <p className="mt-4 text-[14px] text-stone-600">{s.intro}</p> : b.offer && <p className="mt-4 rounded-xl bg-lime/20 px-4 py-3 text-[14px] font-medium text-lime-800">{b.offer}</p>}
          <div className="mt-6">
            {searchParams.sent ? (
              <div className="rounded-xl border border-lime-500/40 bg-lime/15 p-5 text-center" role="status"><p className="text-[16px] font-semibold">{s.success_title}</p><p className="mt-1 text-[14px] text-stone-600">{s.success_text}</p></div>
            ) : <LeadForm formId={form.id} fields={fieldsOf(form.fields)} button={s.button} accent={s.accent} success={{ title: s.success_title, text: s.success_text }} captcha={captchaOn && s.captcha ? { siteKey: TURNSTILE_SITE_KEY, script: TURNSTILE_SCRIPT } : null} />}
          </div>
        </div>
        {brand && <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-stone-400"><LogoMark className="h-4 w-4" /> Powered by Growvia</p>}
      </div>
    </main>
  );
}
