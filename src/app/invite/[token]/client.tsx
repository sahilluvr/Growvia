"use client";
import { useState, useTransition } from "react";
import { acceptInviteAction } from "@/app/team-actions";

export function AcceptInvite({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="grid gap-2">
      <button disabled={pending} onClick={() => start(async () => { const r = await acceptInviteAction(token); if (r?.error) setErr(r.error); })} className="btn-primary h-11 text-[14px]">{pending ? "Joining…" : "Accept & open Growvia"}</button>
      {err && <p className="text-[13px] text-red-600">{err}</p>}
    </div>
  );
}
