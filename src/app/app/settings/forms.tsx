"use client";
import { useFormState } from "react-dom";
import { changePasswordAction, updateBusinessAction, updateProfileAction } from "@/app/actions";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";
import { SEGMENTS } from "@/lib/plans";
import { ALL_CHANNELS, GOALS } from "@/lib/engine";
import type { Business } from "@/lib/data/types";

export function BusinessForm({ b }: { b: Business }) {
  const [state, action] = useFormState(updateBusinessAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name"><input name="name" defaultValue={b.name} required maxLength={80} className={inputCls} /></Field>
        <Field label="Business type">
          <select name="segment" defaultValue={b.segment} className={inputCls}>{SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </Field>
        <Field label="Website"><input name="website" defaultValue={b.website ?? ""} maxLength={200} className={inputCls} /></Field>
        <Field label="City"><input name="city" defaultValue={b.city ?? ""} maxLength={60} className={inputCls} /></Field>
        <Field label="Main goal">
          <select name="goal" defaultValue={b.goal ?? GOALS[0]} className={inputCls}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select>
        </Field>
        <Field label="Brand voice">
          <select name="voice" defaultValue={b.voice ?? "Friendly"} className={inputCls}>{["Friendly", "Professional", "Bold", "Playful"].map((v) => <option key={v}>{v}</option>)}</select>
        </Field>
        <Field label="Ideal customer"><input name="audience" defaultValue={b.audience ?? ""} maxLength={160} className={inputCls} /></Field>
        <Field label="Best offer"><input name="offer" defaultValue={b.offer ?? ""} maxLength={160} className={inputCls} /></Field>
      </div>
      <fieldset>
        <legend className="text-[13px] font-medium">Channels</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_CHANNELS.map((c) => (
            <label key={c} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
              <input type="checkbox" name="channels" value={c} defaultChecked={b.channels.includes(c)} className="accent-lime-500" /> {c}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-[14px] text-stone-600"><input type="checkbox" name="rebuild" className="h-4 w-4 accent-ink" /> Rebuild my growth plan with these details</label>
      <Notice state={state} />
      <div><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">Save business</Submit></div>
    </form>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useFormState(updateProfileAction, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name"><input name="name" defaultValue={name} required maxLength={80} className={inputCls} /></Field>
      <Field label="Email"><input value={email} disabled className={`${inputCls} bg-mist text-stone-500`} /></Field>
      <div className="sm:col-span-2"><Notice state={state} /></div>
      <div><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">Save profile</Submit></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useFormState(changePasswordAction, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="New password" hint="8+ characters"><input name="password" type="password" minLength={8} required autoComplete="new-password" className={inputCls} /></Field>
      <Field label="Confirm password"><input name="confirm" type="password" minLength={8} required autoComplete="new-password" className={inputCls} /></Field>
      <div className="sm:col-span-2"><Notice state={state} /></div>
      <div><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">Change password</Submit></div>
    </form>
  );
}
