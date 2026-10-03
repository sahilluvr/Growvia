import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminClient } from "@/lib/server/admin";
import { fieldsOf, loadForm, settingsOf } from "@/lib/forms";
import { captchaOn, TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY } from "@/lib/captcha";
import { LeadForm } from "@/app/f/[id]/LeadForm";
import { planFor } from "@/lib/billing/plan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Bare form for the <iframe> the embed script adds to your website. */
export default async function EmbedForm({ params, searchParams }: { params: { id: string }; searchParams: { preview?: string } }) {
  const db = adminClient();
  const x = db ? await loadForm(db, params.id) : null;
  if (!x) notFound();
  const s = settingsOf(x.form.settings, x.business.name);
  const brand = s.show_branding || (await planFor(x.business.owner_id)).limits.branding;
  return (
    <div className="bg-transparent p-1">
      {s.intro && <p className="mb-4 text-[14px] text-stone-600">{s.intro}</p>}
      <LeadForm embedded preview={searchParams.preview === "1"} formId={x.form.id} fields={fieldsOf(x.form.fields)} button={s.button} accent={s.accent} success={{ title: s.success_title, text: s.success_text }} captcha={captchaOn && s.captcha ? { siteKey: TURNSTILE_SITE_KEY, script: TURNSTILE_SCRIPT } : null} />
      {brand && <p className="mt-3 text-center text-[11px] text-stone-400">Powered by Growvia</p>}
    </div>
  );
}
