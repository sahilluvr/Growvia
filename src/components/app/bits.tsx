"use client";
import { useState, useTransition } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-stone-600 transition-colors hover:border-ink hover:text-ink ${className}`}
    >
      {done ? <Check className="h-3.5 w-3.5 text-lime-700" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

/** Button that runs a server action with a pending state. */
export function ActionButton({ action, children, className = "btn-ghost h-9 px-3.5 text-[13px]", confirm: confirmText, title }: {
  action: () => Promise<unknown>; children: React.ReactNode; className?: string; confirm?: string; title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => { await action(); });
      }}
      className={`${className} disabled:opacity-60`}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {children}
    </button>
  );
}
