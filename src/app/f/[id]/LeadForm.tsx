"use client";
import { useFormState } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { publicLeadAction } from "@/app/actions";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";

export function LeadForm({ bid, name }: { bid: string; name: string }) {
  const [state, action] = useFormState(publicLeadAction, undefined);
  if (state?.ok)
    return (
      <div className="mt-6 rounded-xl border border-lime-500/40 bg-lime/15 p-5 text-center" role="status">
        <CheckCircle2 className="mx-auto h-8 w-8 text-lime-700" />
        <p className="mt-2 text-[16px] font-semibold">Thanks — message sent!</p>
        <p className="mt-1 text-[14px] text-stone-600">{name} will get back to you soon.</p>
      </div>
    );
  return (
    <form action={action} className="mt-6 grid gap-4">
      <input type="hidden" name="bid" value={bid} />
      <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <Field label="Your name"><input name="name" required maxLength={120} className={inputCls} autoComplete="name" /></Field>
      <Field label="Email"><input name="email" type="email" maxLength={200} className={inputCls} autoComplete="email" /></Field>
      <Field label="Phone" hint="optional"><input name="phone" maxLength={40} className={inputCls} autoComplete="tel" /></Field>
      <Field label="How can we help?"><textarea name="message" rows={3} maxLength={2000} className={textareaCls} /></Field>
      <Notice state={state} />
      <Submit pendingText="Sending…">Send message</Submit>
    </form>
  );
}
