"use client";
import { useTransition } from "react";
import { useFormState } from "react-dom";
import { XCircle } from "lucide-react";
import { cancelBookingAction, saveBookingPageAction } from "@/app/booking-actions";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import { TIMEZONES } from "@/lib/booking";
import type { BookingPage } from "@/lib/email/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingSettings({ page, slugGuess }: { page: BookingPage | null; slugGuess: string }) {
  const [state, action] = useFormState(saveBookingPageAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Page title"><input name="title" defaultValue={page?.title ?? "Book a call"} className={inputCls} maxLength={80} /></Field>
        <Field label="Link name"><input name="slug" defaultValue={page?.slug ?? slugGuess} className={inputCls} maxLength={40} /></Field>
      </div>
      <Field label="Description" hint="optional"><textarea name="description" rows={2} defaultValue={page?.description ?? ""} className={textareaCls} placeholder="A quick call to understand what you need." /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Length"><select name="duration" defaultValue={page?.duration ?? 30} className={inputCls}>{[15, 20, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}</select></Field>
        <Field label="From"><select name="start_hour" defaultValue={page?.start_hour ?? 10} className={inputCls}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}</select></Field>
        <Field label="Until"><select name="end_hour" defaultValue={page?.end_hour ?? 18} className={inputCls}>{Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{h}:00</option>)}</select></Field>
      </div>
      <fieldset>
        <legend className="text-[13px] font-medium">Available days</legend>
        <div className="mt-2 flex flex-wrap gap-3 text-[14px]">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1.5"><input type="checkbox" name="days" value={i} defaultChecked={(page?.days ?? [1, 2, 3, 4, 5]).includes(i)} /> {d}</label>)}</div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time zone"><select name="timezone" defaultValue={page?.timezone ?? "Asia/Kolkata"} className={inputCls}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Where" hint="Meet link, phone or address"><input name="location" defaultValue={page?.location ?? ""} className={inputCls} placeholder="https://meet.google.com/…" /></Field>
      </div>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="active" defaultChecked={page?.active ?? true} /> Booking page is live</label>
      <Notice state={state} />
      <div><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">{page ? "Save" : "Create booking page"}</Submit></div>
    </form>
  );
}

export function CancelBooking({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => { if (confirm("Cancel this meeting? They'll get a cancellation email.")) start(() => cancelBookingAction(id)); }} className="inline-flex shrink-0 items-center gap-1 text-[12px] text-stone-500 hover:text-red-600">
      <XCircle className="h-3.5 w-3.5" /> Cancel
    </button>
  );
}
