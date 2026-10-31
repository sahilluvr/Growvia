"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { runSecurityScanAction } from "@/app/security-actions";
import type { SecCheck } from "@/lib/security/scan";

export function ScanButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="grid gap-2">
      <button disabled={pending} onClick={() => start(async () => {
        setMsg(null);
        const r = await runSecurityScanAction().catch(() => ({ ok: false as const, error: "Connection lost — try again." }));
        setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
        if (r.ok) router.refresh();
      })} className="btn-primary h-11 w-fit px-5 text-[14px] disabled:opacity-60" data-testid="security-scan">
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking your website… (about 20 seconds)</> : <><ShieldCheck className="h-4 w-4" /> {label}</>}
      </button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-[13px] ${msg.ok ? "text-lime-800" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}

export function FixItem({ n, c, open: initial }: { n: number; c: SecCheck; open?: boolean }) {
  const [open, setOpen] = useState(Boolean(initial));
  const fail = c.status === "fail";
  return (
    <li className={`rounded-2xl border ${fail ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/30"}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white ${fail ? "bg-red-600" : "bg-amber-500"}`}>{n}</span>
        {fail ? <XCircle className="h-4 w-4 shrink-0 text-red-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
        <span className="flex-1 text-[14px] font-medium">{c.title}{c.critical && fail ? <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">Urgent</span> : null}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-2 px-4 pb-4 pl-[3.25rem] text-[13px] text-stone-700">
          <p><b>Why it matters:</b> {c.why}</p>
          {c.detail && <p className="text-stone-500">{c.detail}</p>}
          {c.fix && <p><b>How to fix:</b> {c.fix}</p>}
          {c.steps?.length ? <ul className="list-disc space-y-1 pl-4">{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ul> : null}
        </div>
      )}
    </li>
  );
}
