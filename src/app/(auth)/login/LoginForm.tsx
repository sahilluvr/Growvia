"use client";
import Link from "next/link";
import { useFormState } from "react-dom";
import { signInAction } from "@/app/actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";

export function LoginForm({ next, email, linkError }: { next: string; email: string; linkError: boolean }) {
  const [state, action] = useFormState(signInAction, linkError ? { error: "That link has expired or was already used. Please sign in or request a new one." } : undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email"><input name="email" type="email" autoComplete="email" required defaultValue={email} className={inputCls} placeholder="you@business.com" /></Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} placeholder="••••••••" />
      </Field>
      <div className="-mt-1 text-right"><Link href="/forgot" className="text-[13px] text-stone-500 hover:text-ink">Forgot password?</Link></div>
      <Notice state={state} />
      <Submit pendingText="Signing in…">Sign in</Submit>
    </form>
  );
}
