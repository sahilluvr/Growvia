"use client";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { RefreshCw, Trash2, Plus, Loader2 } from "lucide-react";
import { connectWhatsAppAction, disconnectChannelAction, syncTemplatesAction } from "@/app/channel-actions";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Notice, Submit, inputCls } from "@/components/ui/Form";
import { ChannelIcon, CHANNEL_LABEL, CHANNEL_TINT } from "@/components/icons/Brand";

type Acc = { id: string; provider: string; name: string; username: string | null; picture: string | null; phone_display: string | null; status: string; last_error: string | null; meta: Record<string, unknown> };

export function AccountRow({ a }: { a: Acc }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const templates = (a.meta?.templates as { status: string }[] | undefined) ?? [];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line p-3">
      {a.picture ? <img src={a.picture} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className={`grid h-9 w-9 place-items-center rounded-full ${CHANNEL_TINT[a.provider]}`}><ChannelIcon channel={a.provider} /></span>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{a.name} {a.username && <span className="font-normal text-stone-500">@{a.username}</span>}</div>
        <div className="text-[12px] text-stone-500">
          {CHANNEL_LABEL[a.provider]}{a.phone_display ? ` · ${a.phone_display}` : ""}{a.provider === "whatsapp" ? ` · ${templates.filter((t) => t.status === "APPROVED").length} approved templates` : ""}
          {a.status !== "connected" && <span className="text-amber-700"> · {a.last_error ?? "needs attention"}</span>}
          {msg && <span> · {msg}</span>}
        </div>
      </div>
      {a.provider === "whatsapp" && (
        <button disabled={pending} onClick={() => start(async () => { const r = await syncTemplatesAction(a.id); setMsg(r?.error ?? r?.message ?? ""); })} className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-mist" title="Refresh templates" aria-label="Refresh templates">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      )}
      <button onClick={() => { if (confirm(`Disconnect ${a.name}?`)) start(() => disconnectChannelAction(a.id)); }} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Disconnect"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

export function ConnectWhatsApp({ first }: { first: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn h-11 bg-emerald-600 px-5 text-[14px] text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> {first ? "Connect WhatsApp number" : "Add another number"}</button>
      {open && <WaDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function WaDialog({ onClose }: { onClose: () => void }) {
  const [state, action] = useFormState(connectWhatsAppAction, undefined);
  useEffect(() => { if (state?.ok) setTimeout(onClose, 1200); }, [state, onClose]);
  return (
    <Dialog title="Connect a WhatsApp Business number" onClose={onClose} wide>
      <div className="mb-4 grid gap-2 rounded-xl bg-mist p-4 text-[13px] text-stone-700">
        <p className="font-medium text-ink">Where to find these (Meta app → WhatsApp → API Setup):</p>
        <ol className="grid list-decimal gap-1 pl-5">
          <li>Add your business phone number (or use Meta&apos;s free test number to try it out).</li>
          <li>Copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b> shown under the number.</li>
          <li>For a token that doesn&apos;t expire: Business Settings → <b>System users</b> → Add → give it your WhatsApp account and app → <b>Generate token</b> with <i>whatsapp_business_messaging</i> and <i>whatsapp_business_management</i>.</li>
        </ol>
        <p className="text-stone-500">A number used here moves to the WhatsApp Business Platform. Use a new number, or the WhatsApp Business app&apos;s “connect to a platform” option to keep using the app too.</p>
      </div>
      <form action={action} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number ID" hint="optional — Growvia finds it"><input name="phone_number_id" inputMode="numeric" className={inputCls} placeholder="leave empty if you have one number" /></Field>
          <Field label="WhatsApp Business Account ID"><input name="waba_id" required inputMode="numeric" className={inputCls} placeholder="e.g. 102030405060708" /></Field>
        </div>
        <Field label="Access token"><input name="access_token" required type="password" autoComplete="off" className={inputCls} placeholder="EAAG…" /></Field>
        <Field label="App secret" hint="optional — only if this number uses a different Meta app"><input name="app_secret" type="password" autoComplete="off" className={inputCls} /></Field>
        <Notice state={state} />
        <div className="flex gap-2"><Submit className="btn h-10 bg-emerald-600 px-5 text-[14px] text-white hover:bg-emerald-700" pendingText="Checking with Meta…">Connect</Submit><button type="button" onClick={onClose} className="btn-ghost h-10 px-4 text-[14px]">Cancel</button></div>
        <p className="text-[12px] text-stone-400">The token is encrypted before it&apos;s stored and is only used to send and receive your WhatsApp messages.</p>
      </form>
    </Dialog>
  );
}
