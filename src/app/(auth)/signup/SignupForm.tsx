"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { signUpAction } from "@/app/actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";
import { Turnstile } from "@/components/auth/Turnstile";
import type { Captcha } from "../login/LoginForm";

export function SignupForm({ email, next, website, captcha = null }: { email: string; next: string; website?: string; captcha?: Captcha }) {
  const [state, action] = useFormState(safe(signUpAction), undefined);
  const [show, setShow] = useState(false);
  // When the form appeared (bot check: people take a few seconds to fill it in).
  const [t, setT] = useState("");
  useEffect(() => setT(String(Date.now())), []);
  if (state?.ok && state.message)
    return (
      <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
        <p className="text-lg font-semibold tracking-tight">Check your inbox</p>
        <p className="mt-2 text-[15px] text-stone-500">{state.message}</p>
      </div>
    );
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="t" value={t} />
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Company website<input name="company_url" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <Field label="Your name"><input name="name" autoComplete="name" required className={inputCls} placeholder="Jane Doe" /></Field>
      <Field label="Work email"><input name="email" type="email" autoComplete="email" required defaultValue={email} className={inputCls} placeholder="you@business.com" /></Field>
      {website ? <input type="hidden" name="website" value={website} /> : null}
      <Field label="Password" hint="8+ characters">
        <div className="relative">
          <input name="password" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} className={`${inputCls} pr-11`} placeholder="Create a password" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-stone-400 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      {captcha && <Turnstile siteKey={captcha.siteKey} script={captcha.script} resetKey={state} action="signup" />}
      <Notice state={state} />
      <Submit pendingText="Creating your account…">{website ? "Create account & analyse my site" : "Create free account"}</Submit>
      <p className="text-center text-[12px] text-stone-400">Free forever plan · 14 days of Pro included · No card needed</p>
    </form>
  );
}
