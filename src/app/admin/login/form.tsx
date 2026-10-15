"use client";
import { safe } from "@/lib/client/safe-action";
import { useFormState } from "react-dom";
import { adminLoginAction } from "@/app/admin-actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";

export function AdminLoginForm() {
  const [state, action] = useFormState(safe(adminLoginAction), undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Email"><input name="email" type="email" required autoComplete="username" className={inputCls} /></Field>
      <Field label="Password"><input name="password" type="password" required autoComplete="current-password" className={inputCls} /></Field>
      <Notice state={state} />
      <Submit className="btn-primary h-11 w-full" pendingText="Signing in…">Sign in</Submit>
    </form>
  );
}
