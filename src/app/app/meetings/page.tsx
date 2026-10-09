import type { Metadata } from "next";
import { requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { CopyButton } from "@/components/app/bits";
import { BookingSettings, CancelBooking } from "./client";
import { SUPABASE_SERVICE_KEY } from "@/lib/config";
import type { BookingPage } from "@/lib/email/types";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsPage() {
  const db = supabaseServer();
  const [{ business }, { data: page }, { data: bookings }] = await Promise.all([
    requireBusiness(),
    db.from("booking_pages").select("*").maybeSingle<BookingPage>(),
    db.from("bookings").select("*").gte("end_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("start_at"),
  ]);
  const site = siteOrigin();
  const slugGuess = business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "book";
  const upcoming = (bookings ?? []).filter((b) => new Date(b.end_at) > new Date() && b.status === "confirmed");
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b));
  const tz = page?.timezone ?? "Asia/Kolkata";
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <>
      <PageHeader title="Meetings" sub="A booking page leads can use to pick a time with you. Confirmations and calendar invites go out automatically." />
      {!SUPABASE_SERVICE_KEY && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">Add <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel to switch on the public booking page.</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold tracking-tight">Your booking page</h2>
          {page && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-line bg-paper p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="truncate font-mono text-[13px]">{site}/book/{page.slug}</span>
              <div className="flex gap-2"><CopyButton text={`${site}/book/${page.slug}`} label="Copy link" /><a href={`/book/${page.slug}`} target="_blank" className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-stone-600 hover:border-ink">Open</a></div>
            </div>
          )}
          <p className="mt-2 text-[13px] text-stone-500">Use <code className="font-mono">{"{{booking_link}}"}</code> in any email to drop this link in.</p>
          <div className="mt-5"><BookingSettings page={page} slugGuess={slugGuess} /></div>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold tracking-tight">Upcoming <span className="font-normal text-stone-400">· {upcoming.length}</span></h2>
          <ul className="mt-4 grid gap-2">
            {upcoming.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink text-center text-[11px] font-semibold leading-tight text-lime">{new Date(b.start_at).toLocaleDateString("en-US", { timeZone: tz, month: "short" })}<br /><span className="text-[16px] text-white">{new Date(b.start_at).toLocaleDateString("en-US", { timeZone: tz, day: "numeric" })}</span></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{b.name} <span className="font-normal text-stone-500">· {b.email}</span></div>
                  <div className="text-[13px] text-stone-500">{fmt(b.start_at)}{b.notes ? ` · “${b.notes.slice(0, 60)}”` : ""}</div>
                </div>
                <CancelBooking id={b.id} />
              </li>
            ))}
            {!upcoming.length && <li className="rounded-xl border border-dashed border-line p-6 text-center text-[14px] text-stone-500">No upcoming meetings. Share your booking link in emails and on your website.</li>}
          </ul>
          {past.length > 0 && (
            <>
              <h3 className="mt-6 text-[13px] font-medium text-stone-500">Recent</h3>
              <ul className="mt-2 grid gap-1 text-[13px] text-stone-500">{past.map((b) => <li key={b.id}>{fmt(b.start_at)} · {b.name} · <span className="capitalize">{b.status}</span></li>)}</ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
