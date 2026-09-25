"use client";
import { useFormState } from "react-dom";
import { resetPasswordAction } from "@/app/actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";

export default function ResetPage() {
  const [state, action] = useFormState(resetPasswordAction, undefined);
  return (
    <>
      <h1 className="text-[32px] font-semibold tracking-tightest">Choose a new password</h1>
      <p className="mt-2 text-[15px] text-stone-500">Make it at least 8 characters.</p>
      <form action={action} className="mt-8 grid gap-4">
        <Field label="New password"><input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></Field>
        <Field label="Confirm password"><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></Field>
        <Notice state={state} />
        <Submit pendingText="Saving…">Save password</Submit>
      </form>
    </>
  );
}
