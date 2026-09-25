"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { createBookingAction } from "@/app/booking-actions";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import type { Day } from "@/lib/booking";

export function BookingForm({ slug, days }: { slug: string; days: Day[] }) {
  const [state, action] = useFormState(createBookingAction, undefined);
  const [day, setDay] = useState(days[0]?.key ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  if (state?.ok) return (
    <div className="grid place-items-center py-10 text-center" role="status">
      <CheckCircle2 className="h-10 w-10 text-lime-700" />
      <p className="mt-3 text-[20px] font-semibold tracking-tight">You&apos;re booked!</p>
      <p className="mt-1 text-[14px] text-stone-500">{state.message}. A confirmation with a calendar invite is on its way to your inbox.</p>
    </div>
  );
  if (!days.length) return <p className="py-10 text-center text-[14px] text-stone-500">No times are available right now. Please check back soon.</p>;
  const current = days.find((d) => d.key === day) ?? days[0];
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="start" value={slot ?? ""} />
      <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <p className="text-[13px] font-medium">Pick a day</p>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {days.map((d) => (
            <button type="button" key={d.key} onClick={() => { setDay(d.key); setSlot(null); }} aria-pressed={current.key === d.key}
              className={`shrink-0 rounded-xl border px-3 py-2 text-[13px] ${current.key === d.key ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600 hover:border-stone-400"}`}>{d.label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[13px] font-medium">Pick a time</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {current.slots.map((s) => (
            <button type="button" key={s.start} onClick={() => setSlot(s.start)} aria-pressed={slot === s.start}
              className={`rounded-lg border px-2 py-2 text-[13px] ${slot === s.start ? "border-ink bg-lime font-medium text-ink" : "border-line bg-white text-stone-700 hover:border-ink"}`}>{s.label}</button>
          ))}
        </div>
      </div>
      {slot && (
        <div className="grid gap-4 border-t border-line pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name"><input name="name" required maxLength={120} className={inputCls} autoComplete="name" /></Field>
            <Field label="Email"><input name="email" type="email" required maxLength={200} className={inputCls} autoComplete="email" /></Field>
          </div>
          <Field label="Anything we should know?" hint="optional"><textarea name="notes" rows={2} maxLength={1000} className={textareaCls} /></Field>
          <Notice state={state} />
          <Submit pendingText="Booking…">Confirm booking</Submit>
        </div>
      )}
    </form>
  );
}
