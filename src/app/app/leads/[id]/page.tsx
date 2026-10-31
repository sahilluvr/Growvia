import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, Phone, Building2, CalendarClock } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { currencyForCity, fmtDate, money, STAGE_META, timeAgo } from "@/lib/format";
import { LeadHeaderActions, Composer, TagEditor, StartWhatsApp, AddToCampaign } from "./client";
import type { WaTemplate } from "@/lib/meta/graph";
import type { Lead } from "@/lib/data/types";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = supabaseServer();
  const [{ business }, { data: lead }, { data: msgs }, { data: bookings }, { data: enr }, { data: templates }, { count: mailboxes }] = await Promise.all([
    requireBusiness(),
    db.from("leads").select("*").eq("id", params.id).maybeSingle<Lead>(),
    db.from("messages").select("id, thread_id, direction, subject, body_text, status, sent_at, created_at, scheduled_at, opened_at, clicked_at, error").eq("lead_id", params.id).order("created_at", { ascending: false }).limit(50),
    db.from("bookings").select("*").eq("lead_id", params.id).order("start_at", { ascending: false }),
    db.from("enrollments").select("id, status, step_index, sequences(id, name)").eq("lead_id", params.id),
    db.from("email_templates").select("id, name, subject, body").order("name"),
    db.from("mailboxes").select("id", { count: "exact", head: true }),
  ]);
  const { data: seqs } = await db.from("sequences").select("id, name, status").neq("kind", "broadcast").in("status", ["draft", "active", "paused"]).order("created_at", { ascending: false }).limit(50);
  const { data: waAccs } = await db.from("channel_accounts").select("id, name, phone_display, meta").eq("provider", "whatsapp");
  if (!lead) notFound();
  const { data: subs } = await db.from("lead_submissions").select("id, form_name, answers, labels, consent, hidden, page, referrer, utm, files, created_at").eq("lead_id", params.id).order("created_at", { ascending: false }).limit(50);
  type Ev = { at: string; kind: "out" | "in" | "booking"; title: string; body?: string | null; meta?: string; href?: string };
  const events: Ev[] = [
    ...(msgs ?? []).map((m) => ({
      at: m.sent_at ?? m.scheduled_at ?? m.created_at, kind: m.direction as "out" | "in", title: m.subject ?? "(no subject)", body: m.body_text, href: `/app/inbox?t=${m.thread_id}`,
      meta: m.direction === "in" ? "Replied" : m.status === "scheduled" ? `Scheduled · ${fmtDate(m.scheduled_at!)}` : m.status === "failed" ? `Failed · ${m.error ?? ""}` : m.clicked_at ? "Sent · opened · clicked" : m.opened_at ? "Sent · opened" : "Sent",
    })),
    ...(bookings ?? []).map((b) => ({ at: b.start_at, kind: "booking" as const, title: `Meeting ${b.status === "cancelled" ? "(cancelled)" : ""}`, meta: fmtDate(b.start_at), body: b.notes })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <Link href="/app/leads" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Leads</Link>
      <div className="mt-3 grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="grid content-start gap-4">
          <section className="card p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-lg font-semibold text-lime">{lead.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">{lead.name}</h1>
                <p className="flex items-center gap-1.5 text-[13px] text-stone-500"><span className={`h-2 w-2 rounded-full ${STAGE_META[lead.stage].dot}`} /> {STAGE_META[lead.stage].label}{lead.value ? ` · ${money(lead.value, currencyForCity(business.city))}` : ""}</p>
              </div>
            </div>
            <ul className="mt-4 grid gap-2 text-[14px]">
              {lead.email && <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-stone-400" /><a href={`mailto:${lead.email}`} className="truncate hover:underline">{lead.email}</a></li>}
              {lead.phone && <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-stone-400" /><a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a></li>}
              {lead.company && <li className="flex items-center gap-2"><Building2 className="h-4 w-4 text-stone-400" />{lead.company}</li>}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lead.unsubscribed && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[12px] text-stone-600">Unsubscribed</span>}
              {lead.email_status === "bounced" && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] text-red-700">Email bounced</span>}
              <span className="rounded-full bg-mist px-2.5 py-1 text-[12px] text-stone-600">Source: {lead.source}</span>
              {(() => { const m = (lead.meta ?? {}) as { page?: string; utm?: Record<string, string>; form?: string }; return <>
                {m.form && <span className="rounded-full bg-mist px-2.5 py-1 text-[12px] text-stone-600">Form: {m.form}</span>}
                {m.page && <span className="max-w-[260px] truncate rounded-full bg-mist px-2.5 py-1 text-[12px] text-stone-600" title={m.page}>Page: {m.page.replace(/^https?:\/\//, "")}</span>}
                {m.utm && Object.keys(m.utm).length > 0 && <span className="rounded-full bg-mist px-2.5 py-1 text-[12px] text-stone-600">Campaign: {[m.utm.utm_source, m.utm.utm_medium, m.utm.utm_campaign].filter(Boolean).join(" / ")}</span>}
              </>; })()}
            </div>
            <div className="mt-4"><TagEditor id={lead.id} tags={lead.tags ?? []} /></div>
            <div className="mt-4"><LeadHeaderActions currency={currencyForCity(business.city)} lead={lead} /></div>
            {lead.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-paper p-3 text-[13px] text-stone-600">{lead.notes}</p>}
            {(subs ?? []).length > 0 && <Submissions subs={subs as never} />}
            <p className="mt-4 text-[12px] text-stone-400">Added {timeAgo(lead.created_at)}{lead.last_contacted_at ? ` · last emailed ${timeAgo(lead.last_contacted_at)}` : ""}{lead.last_replied_at ? ` · replied ${timeAgo(lead.last_replied_at)}` : ""}</p>
          </section>
          {(lead.email || (enr ?? []).length > 0) && (
            <section className="card p-5">
              <h2 className="text-[14px] font-semibold">Email campaigns</h2>
              {lead.email && <AddToCampaign leadId={lead.id} campaigns={(seqs ?? []).filter((q) => !(enr ?? []).some((e) => (e as unknown as { sequences: { id: string } | null }).sequences?.id === q.id)).map((q) => ({ id: q.id, name: q.name, status: q.status }))} />}
              <ul className="mt-2 grid gap-1.5 text-[13px]">
                {(enr as unknown as { id: string; status: string; step_index: number; sequences: { id: string; name: string } | null }[]).map((e) => (
                  <li key={e.id} className="flex justify-between gap-2"><Link href={`/app/email/${e.sequences?.id}`} className="truncate hover:underline">{e.sequences?.name}</Link><span className="shrink-0 capitalize text-stone-500">{e.status} · {e.step_index} sent</span></li>
                ))}
              </ul>
            </section>
          )}
        </aside>
        <div className="grid content-start gap-4">
          {(waAccs ?? []).length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-[16px] font-semibold tracking-tight">WhatsApp</h2>
              <StartWhatsApp leadId={lead.id} hasPhone={Boolean(lead.wa_id || lead.phone)} optedIn={Boolean(lead.wa_opt_in)} accounts={(waAccs ?? []).map((a) => ({ id: a.id, name: a.name, phone: a.phone_display, templates: ((a.meta?.templates ?? []) as WaTemplate[]).filter((t) => t.status === "APPROVED") }))} />
            </section>
          )}
          <section className="card p-5">
            <h2 className="mb-3 text-[16px] font-semibold tracking-tight">Send an email</h2>
            <Composer leadId={lead.id} templates={templates ?? []} disabled={!mailboxes || !lead.email || Boolean(lead.unsubscribed)}
              reason={!mailboxes ? "Connect a mailbox in Settings to email from Growvia." : !lead.email ? "Add an email address to this lead first." : lead.unsubscribed ? "This person unsubscribed." : ""} businessName={business.name} />
          </section>
          <section className="card p-5">
            <h2 className="mb-3 text-[16px] font-semibold tracking-tight">Timeline</h2>
            <ol className="grid gap-3">
              {events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full ${e.kind === "in" ? "bg-lime text-ink" : e.kind === "booking" ? "bg-sky-100 text-sky-700" : "bg-ink text-white"}`}>
                    {e.kind === "booking" ? <CalendarClock className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      {e.href ? <Link href={e.href} className="truncate text-[14px] font-medium hover:underline">{e.title}</Link> : <span className="truncate text-[14px] font-medium">{e.title}</span>}
                      <span className="shrink-0 text-[12px] text-stone-400">{timeAgo(e.at)}</span>
                    </div>
                    <p className="text-[12px] text-stone-500">{e.kind === "in" ? `${lead.name} · ` : e.kind === "out" ? "You · " : ""}{e.meta}</p>
                    {e.body && <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[13px] text-stone-600">{e.body}</p>}
                  </div>
                </li>
              ))}
              {!events.length && <li className="text-[14px] text-stone-500">No emails or meetings yet.</li>}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

type Sub = { id: string; form_name: string | null; answers: Record<string, string | string[]>; labels: Record<string, string>; consent: { given: boolean; at: string | null; text: string } | null; hidden: Record<string, string | string[]>; page: string | null; referrer: string | null; utm: Record<string, string>; files: { key: string; name: string; size: number }[]; created_at: string };
const plain = (t: string) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

/** Every form submission from this lead, newest first — answers, consent, hidden values, page, UTMs and files. */
function Submissions({ subs }: { subs: Sub[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-[14px] font-semibold">Form submissions <span className="font-normal text-stone-400">({subs.length})</span></h3>
      <ol className="mt-2 grid gap-3">
        {subs.map((s, i) => (
          <li key={s.id} className="rounded-xl border border-line p-3 text-[13px]">
            <p className="flex flex-wrap items-center justify-between gap-2 text-stone-500"><span><b className="text-ink">{s.form_name ?? "Form"}</b>{i === 0 ? " · latest" : ""}</span><span>{fmtDate(s.created_at)}</span></p>
            <dl className="mt-2 grid gap-1.5">
              {Object.entries(s.answers ?? {}).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2"><dt className="text-stone-500">{plain(s.labels?.[k] ?? k)}</dt><dd className="min-w-0 break-words">{Array.isArray(v) ? <ul className="list-disc pl-4">{v.map((x) => <li key={x}>{x}</li>)}</ul> : v}</dd></div>
              ))}
              {(s.files ?? []).map((f) => (
                <div key={f.key} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2"><dt className="text-stone-500">{plain(s.labels?.[f.key] ?? f.key)}</dt><dd><a href={`/api/forms/file?sub=${s.id}&key=${encodeURIComponent(f.key)}`} target="_blank" rel="noopener" className="font-medium underline">{f.name}</a> <span className="text-stone-400">({Math.round(f.size / 1024)} KB · link expires after 10 minutes)</span></dd></div>
              ))}
              {s.consent && <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2"><dt className="text-stone-500">Consent</dt><dd>{s.consent.given ? <>Yes · {s.consent.at ? fmtDate(s.consent.at) : ""}</> : "No"}<span className="mt-0.5 block text-[12px] text-stone-400">Shown: “{plain(s.consent.text)}”</span></dd></div>}
              {Object.entries(s.hidden ?? {}).map(([k, v]) => <div key={k} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2"><dt className="text-stone-500">{plain(s.labels?.[k] ?? k)} <span className="text-[11px]">(hidden)</span></dt><dd>{Array.isArray(v) ? v.join("; ") : v}</dd></div>)}
              {s.page && <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2"><dt className="text-stone-500">Page</dt><dd className="break-all">{s.page}</dd></div>}
              {s.referrer && <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2"><dt className="text-stone-500">Came from</dt><dd className="break-all">{s.referrer}</dd></div>}
              {Object.keys(s.utm ?? {}).length > 0 && <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2"><dt className="text-stone-500">Campaign</dt><dd className="flex flex-wrap gap-1">{Object.entries(s.utm).map(([k, v]) => <span key={k} className="rounded-full bg-mist px-2 py-0.5 text-[12px]">{k.replace("utm_", "")}: {v}</span>)}</dd></div>}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}
