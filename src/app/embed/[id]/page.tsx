import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { siteOrigin } from "@/lib/data";
import type { Metadata } from "next";
import { adminClient } from "@/lib/server/admin";
import { cleanCss, fieldsOf, loadForm, settingsOf } from "@/lib/forms";
import { captchaOn, TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY } from "@/lib/captcha";
import { LeadForm } from "@/app/f/[id]/LeadForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Bare form for the <iframe> the embed script adds to your website. */
export default async function EmbedForm({ params, searchParams }: { params: { id: string }; searchParams: { preview?: string; parent?: string } }) {
  const db = adminClient();
  const x = db ? await loadForm(db, params.id) : null;
  if (!x) notFound();
  const s = settingsOf(x.form.settings, x.business.name);
  // Locked to certain websites? The iframe only renders on those (the parent page arrives as ?parent= or Referer).
  if (s.allowed_origins.length && searchParams.preview !== "1") {
    const host = (u: string | null | undefined) => { try { return u ? new URL(u).hostname.toLowerCase().replace(/^www\./, "") : null; } catch { return null; } };
    const parent = host(searchParams.parent) ?? host(headers().get("referer"));
    const ok = parent && (parent === host(siteOrigin()) || s.allowed_origins.some((a) => parent === a || parent.endsWith(`.${a}`)));
    if (!ok) return <p className="p-4 text-[13px] text-stone-500">This form can only be shown on {s.allowed_origins.join(", ")}.</p>;
  }
  const brand = s.show_branding; // optional on every plan — lead capture and automations never depend on it
  return (
    <div className="gv-embed bg-transparent p-1">
      {/* The website owner's own CSS (Forms → Design). Loaded last so it wins over Growvia's defaults. */}
      {s.custom_css && <style dangerouslySetInnerHTML={{ __html: cleanCss(s.custom_css) }} />}
      {s.intro && <p className="gv-intro mb-4 text-[14px] text-stone-600">{s.intro}</p>}
      <LeadForm embedded preview={searchParams.preview === "1"} formId={x.form.id} fields={x.form.fields} button={s.button} accent={s.accent} errorText={s.error_text} style={s.style} success={{ title: s.success_title, text: s.success_text }} captcha={captchaOn && s.captcha ? { siteKey: TURNSTILE_SITE_KEY, script: TURNSTILE_SCRIPT } : null} />
      {brand && <p className="gv-branding mt-3 text-center text-[11px] text-stone-400">Powered by Growvia</p>}
    </div>
  );
}
