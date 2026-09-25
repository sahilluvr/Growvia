"use client";
import Link from "next/link";
import { useFormState } from "react-dom";
import { forgotAction } from "@/app/actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";

export default function ForgotPage() {
  const [state, action] = useFormState(forgotAction, undefined);
  return (
    <>
      <h1 className="text-[32px] font-semibold tracking-tightest">Reset your password</h1>
      <p className="mt-2 text-[15px] text-stone-500">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <form action={action} className="mt-8 grid gap-4">
        <Field label="Email"><input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@business.com" /></Field>
        <Notice state={state} />
        <Submit pendingText="Sending…">Send reset link</Submit>
      </form>
      <p className="mt-6 text-center text-[14px] text-stone-500"><Link href="/login" className="font-medium text-ink hover:underline">← Back to sign in</Link></p>
    </>
  );
}
