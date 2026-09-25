"use client";
import { useFormStatus } from "react-dom";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export function Submit({ children, className = "btn-primary w-full", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
      {pending ? (<><Loader2 className="h-4 w-4 animate-spin" /> {pendingText ?? "Working…"}</>) : children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13px] font-medium text-ink">
        {label} {hint && <span className="font-normal text-stone-400">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export { inputCls, textareaCls } from "./styles";

export function Notice({ state }: { state?: { error?: string; message?: string; ok?: boolean } }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[14px] text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl border border-lime-500/40 bg-lime/15 px-3.5 py-3 text-[14px] text-lime-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.message}
      </p>
    );
  return null;
}
