"use client";
import { safe } from "@/lib/client/safe-action";
import Link from "next/link";
import { useFormState } from "react-dom";
import { signInAction } from "@/app/actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";
import { Turnstile } from "@/components/auth/Turnstile";

export type Captcha = { siteKey: string; script: string } | null;

export function LoginForm({ next, email, linkError, captcha = null }: { next: string; email: string; linkError: boolean; captcha?: Captcha }) {
  const [state, action] = useFormState(safe(signInAction), linkError ? { error: "That email link couldn’t sign you in here (it was opened in another browser, already used, or expired). Your email is usually confirmed anyway — just sign in." } : undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email"><input name="email" type="email" autoComplete="email" required defaultValue={email} className={inputCls} placeholder="you@business.com" /></Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} placeholder="••••••••" />
      </Field>
      <div className="-mt-1 text-right"><Link href="/forgot" className="text-[13px] text-stone-500 hover:text-ink">Forgot password?</Link></div>
      {captcha && <Turnstile siteKey={captcha.siteKey} script={captcha.script} resetKey={state} action="login" />}
      <Notice state={state} />
      <Submit pendingText="Signing in…">Sign in</Submit>
    </form>
  );
}
