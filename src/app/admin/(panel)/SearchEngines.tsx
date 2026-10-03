"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { indexNowAllAction } from "@/app/admin-actions";

export function SendIndexNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="grid gap-2">
      <button disabled={pending} onClick={() => start(async () => { const r = await indexNowAllAction(); setMsg(r?.error ? { ok: false, text: r.error } : { ok: true, text: r?.message ?? "Sent." }); router.refresh(); })} className="btn-ghost h-9 w-fit px-3 text-[13px]" data-testid="indexnow-send">{pending ? "Sending…" : "Send all pages now"}</button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-[13px] ${msg.ok ? "text-lime-800" : "text-red-700"}`} data-testid="indexnow-msg">{msg.text}</p>}
    </div>
  );
}
