"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { RefreshCw, Trash2, Plus, Loader2 } from "lucide-react";
import { connectWhatsAppAction, connectWhatsAppEmbeddedAction, disconnectChannelAction, syncTemplatesAction } from "@/app/channel-actions";
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

type OneClick = { appId: string; configId: string; version: string } | null;

export function ConnectWhatsApp({ first, oneClick = null }: { first: boolean; oneClick?: OneClick }) {
  const [open, setOpen] = useState(false);
  if (oneClick) return <OneClickWhatsApp first={first} cfg={oneClick} />;
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn h-11 bg-emerald-600 px-5 text-[14px] text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> {first ? "Connect WhatsApp number" : "Add another number"}</button>
      {open && <WaDialog onClose={() => setOpen(false)} />}
    </>
  );
}

declare global {
  interface Window { FB?: { init: (o: Record<string, unknown>) => void; login: (cb: (r: { authResponse?: { code?: string } | null; status?: string }) => void, o: Record<string, unknown>) => void }; fbAsyncInit?: () => void }
}
let sdk: Promise<void> | null = null;
function loadFacebook(appId: string, version: string) {
  sdk ??= new Promise<void>((resolve, reject) => {
    if (window.FB) { window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version }); return resolve(); }
    window.fbAsyncInit = () => { window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version }); resolve(); };
    const el = document.createElement("script");
    el.src = "https://connect.facebook.net/en_US/sdk.js"; el.async = true; el.crossOrigin = "anonymous";
    el.onerror = () => { sdk = null; reject(new Error("blocked")); };
    document.body.appendChild(el);
  });
  return sdk;
}

/** One button: Facebook's own window walks the customer through business, number and SMS code. */
function OneClickWhatsApp({ first, cfg }: { first: boolean; cfg: NonNullable<OneClick> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [manual, setManual] = useState(false);
  const picked = useRef<{ waba?: string; phone?: string }>({});
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      let host = ""; try { host = new URL(e.origin).hostname; } catch { return; }
      if (!/(^|\.)facebook\.com$/.test(host)) return;
      let d: { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string; error_message?: string } } | null = null;
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (d.event?.startsWith("FINISH")) picked.current = { waba: d.data?.waba_id, phone: d.data?.phone_number_id };
      else if (d.event === "CANCEL" && d.data?.error_message) setMsg({ text: `Facebook reported a problem: ${d.data.error_message}` });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  const start = async (coexist = false) => {
    setBusy(true); setMsg(null); picked.current = {};
    try { await loadFacebook(cfg.appId, cfg.version); }
    catch { setBusy(false); setMsg({ text: "Facebook's login window couldn't load — an ad blocker or privacy extension may be blocking it. Allow facebook.com for this site and try again." }); return; }
    window.FB!.login((r) => {
      const code = r?.authResponse?.code;
      if (!code) { setBusy(false); setMsg({ text: "You closed the Facebook window before finishing — nothing was changed. Click Connect to try again." }); return; }
      setMsg({ text: "Connecting your number…" });
      // Facebook sends the chosen account a moment before or after the code.
      setTimeout(async () => {
        const res = await connectWhatsAppEmbeddedAction({ code, wabaId: picked.current.waba, phoneNumberId: picked.current.phone, coexist })
          .catch(() => ({ ok: false as const, error: "Connection lost — please try again." }));
        setBusy(false);
        setMsg(res && "ok" in res && res.ok ? { ok: true, text: res.message ?? "Connected." } : { text: (res as { error?: string })?.error ?? "Something went wrong." });
      }, 600);
    }, { config_id: cfg.configId, response_type: "code", override_default_response_type: true, extras: coexist ? { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" } : { setup: {}, sessionInfoVersion: "3" } });
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => start(false)} disabled={busy} data-testid="wa-oneclick" className="btn h-11 w-full bg-emerald-600 px-5 text-[14px] text-white hover:bg-emerald-700 sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChannelIcon channel="whatsapp" className="h-4 w-4" />} {first ? "Connect WhatsApp" : "Add another number"}
        </button>
        <button onClick={() => start(true)} disabled={busy} data-testid="wa-coexist" className="btn-ghost h-11 w-full px-4 text-[14px] sm:w-auto">Use my WhatsApp Business app number</button>
      </div>
      <ul className="grid gap-1 text-[12px] text-stone-500">
        <li>• <b>Connect WhatsApp</b>: for a number that isn&apos;t on any WhatsApp app. A Facebook window guides you: pick your business, add the number, enter the code Meta texts you. About 5 minutes.</li>
        <li>• <b>Use my WhatsApp Business app number</b>: keep chatting from the app on your phone and use Growvia too. Update the WhatsApp Business app first; in the window, confirm on your phone (scan the QR code) and choose whether to share recent chats. Availability depends on your country.</li>
      </ul>
      {msg && <p role="status" className={`rounded-xl px-3 py-2 text-[13px] ${msg.ok ? "bg-lime/20 text-lime-900" : "bg-mist text-stone-700"}`}>{msg.text}</p>}
      <button type="button" onClick={() => setManual(true)} className="justify-self-start text-[12px] text-stone-500 underline underline-offset-2">Connect with IDs instead (advanced)</button>
      {manual && <WaDialog onClose={() => setManual(false)} />}
    </div>
  );
}

function WaDialog({ onClose }: { onClose: () => void }) {
  const [state, action] = useFormState(safe(connectWhatsAppAction), undefined);
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
