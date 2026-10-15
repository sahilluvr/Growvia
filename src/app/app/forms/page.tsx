import type { Metadata } from "next";
import { early, projectIdNow, requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { fieldsOf, settingsOf, normalizeSettings, DEFAULT_FIELDS, type LeadFormRow } from "@/lib/forms";
import { captchaOn } from "@/lib/captcha";
import { systemMailReady } from "@/lib/mail/system";
import { timeAgo } from "@/lib/format";
import { FormBuilder, NewFormButton } from "./client";

export const metadata: Metadata = { title: "Website forms" };

export default async function FormsPage({ searchParams }: { searchParams: { id?: string } }) {
  const db = supabaseServer();
  // Forms and their latest submissions load together, alongside the login check.
  const pid = projectIdNow();
  const formsP = early(pid ? Promise.resolve(db.from("lead_forms").select("*").eq("business_id", pid).order("created_at")) : Promise.resolve(null));
  const recentP = early(pid ? Promise.resolve(db.from("leads").select("id, name, email, created_at, meta, form_id").eq("business_id", pid).not("form_id", "is", null).order("created_at", { ascending: false }).limit(80)) : Promise.resolve(null));
  const { business } = await requireBusiness();
  let { data: forms } = (await formsP) ?? await db.from("lead_forms").select("*").eq("business_id", business.id).order("created_at");
  if (!forms?.length) {
    const { data } = await db.from("lead_forms").insert({ owner_id: business.owner_id, business_id: business.id, name: "Website form", fields: DEFAULT_FIELDS, settings: normalizeSettings({}, business.name, { isNew: true }) }).select("*");
    forms = data ?? [];
  }
  const list = (forms ?? []) as LeadFormRow[];
  const cur = list.find((f) => f.id === searchParams.id) ?? list[0];
  const pre = (await recentP)?.data;
  const { data: recent } = !cur ? { data: [] } : pre ? { data: pre.filter((l) => l.form_id === cur.id).slice(0, 8) } : await db.from("leads").select("id, name, email, created_at, meta").eq("form_id", cur.id).order("created_at", { ascending: false }).limit(8);
  const origin = siteOrigin();
  const [{ count: blocked }, { data: boxes }, { data: team }] = cur ? await Promise.all([
    db.from("form_blocks").select("id", { count: "exact", head: true }).eq("form_id", cur.id).gt("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    db.from("mailboxes").select("id, from_name, from_email").or(`business_id.eq.${business.id},business_id.is.null`),
    db.from("team_members").select("email").eq("owner_id", business.owner_id).eq("status", "active"),
  ]) : [{ count: 0 }, { data: [] }, { data: [] }];
  return (
    <>
      <PageHeader eyebrow={business.name} title="Website forms" sub={`Put a form on ${business.website?.replace(/^https?:\/\//, "") || "your website"} — every enquiry lands in Leads and your team gets an email.`}>
        <NewFormButton />
      </PageHeader>
      {list.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">{list.map((f) => <a key={f.id} href={`/app/forms?id=${f.id}`} className={`rounded-full border px-3 py-1.5 text-[13px] ${f.id === cur?.id ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{f.name} · {f.submissions}</a>)}</div>
      )}
      {cur && (
        <FormBuilder key={cur.id} id={cur.id} name={cur.name} fields={fieldsOf(cur.fields)} settings={settingsOf(cur.settings, business.name)} origin={origin} submissions={cur.submissions}
          blocked={blocked ?? 0} projectName={business.name} hasServerKey={Boolean(cur.server_key_hash)} mailboxes={(boxes ?? []).map((m) => ({ id: m.id, label: `${m.from_name} <${m.from_email}>` }))} team={(team ?? []).map((t) => t.email).filter(Boolean)}
          captchaOn={captchaOn} mailOn={systemMailReady} canDelete={list.length > 1}
          recent={(recent ?? []).map((l) => ({ id: l.id, name: l.name, email: l.email, when: timeAgo(l.created_at), page: (l.meta as { page?: string })?.page ?? null }))} />
      )}
    </>
  );
}
