"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { inputCls, textareaCls } from "@/components/ui/styles";
import { Turnstile } from "@/components/auth/Turnstile";
import type { FormField } from "@/lib/forms";

type Props = { formId: string; fields: FormField[]; button: string; accent: string; success: { title: string; text: string }; captcha: { siteKey: string; script: string } | null; embedded?: boolean; preview?: boolean };

/** The website form visitors fill in — full page (/f/…) or inside the embed iframe. */
export function LeadForm({ formId, fields, button, accent, success, captcha, embedded = false, preview = false }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  // Tell the page that embeds us how tall we are, so the iframe never scrolls.
  useEffect(() => {
    if (!embedded || !root.current) return;
    const post = () => window.parent?.postMessage({ type: "growvia:height", id: formId, h: Math.ceil(document.documentElement.scrollHeight) }, "*");
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    post();
    return () => ro.disconnect();
  }, [embedded, formId, state, err]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) { setState("done"); return; }
    setErr(""); setState("sending");
    const fd = new FormData(e.currentTarget);
    const q = new URLSearchParams(location.search);
    const utm = Object.fromEntries([...q].filter(([k]) => k.startsWith("utm_")));
    const values: Record<string, string> = {};
    fd.forEach((v, k) => { if (typeof v === "string") values[k] = v; });
    const res = await fetch(`/api/forms/${formId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: values, captcha: values.captcha, page: q.get("parent") || (embedded ? document.referrer : location.href), referrer: q.get("ref") || document.referrer, utm }) }).then((r) => r.json()).catch(() => ({ ok: false, error: "Connection problem — please try again." }));
    if (res.ok) {
      setState("done");
      if (embedded) window.parent?.postMessage({ type: "growvia:submitted", id: formId, redirect: res.redirect ?? null }, "*");
      else if (res.redirect) location.href = res.redirect;
    } else { setErr(res.error ?? "Something went wrong."); setState("idle"); setTries((t) => t + 1); }
  }
  if (state === "done")
    return (
      <div ref={root} className="gv-success rounded-xl border border-lime-500/40 bg-lime/15 p-5 text-center" role="status">
        <CheckCircle2 className="mx-auto h-8 w-8 text-lime-700" />
        <p className="gv-success-title mt-2 text-[16px] font-semibold">{success.title}</p>
        <p className="gv-success-text mt-1 text-[14px] text-stone-600">{success.text}</p>
      </div>
    );
  return (
    <div ref={root}>
      <form onSubmit={submit} className="gv-form grid gap-4">
        <input type="text" name="_gv_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        {fields.map((f) => (
          <label key={f.id} className={`gv-field gv-field-${f.type} gv-field-${f.id} block ${f.type === "checkbox" ? "flex items-start gap-2" : ""}`}>
            {f.type === "checkbox" ? (
              <><input type="checkbox" name={f.id} required={f.required} className="gv-checkbox mt-1" /><span className="gv-label text-[14px] text-stone-700">{f.label}</span></>
            ) : (
              <>
                <span className="gv-label text-[13px] font-medium">{f.label}{!f.required && <span className="gv-optional ml-1 font-normal text-stone-400">optional</span>}</span>
                {f.type === "textarea" ? <textarea name={f.id} required={f.required} rows={3} maxLength={2000} placeholder={f.placeholder} className={`gv-textarea ${textareaCls} mt-1.5`} />
                  : f.type === "select" ? <select name={f.id} required={f.required} className={`gv-select ${inputCls} mt-1.5`} defaultValue=""><option value="" disabled>Choose…</option>{(f.options ?? []).map((o) => <option key={o}>{o}</option>)}</select>
                  : <input name={f.id} type={f.type} required={f.required} maxLength={f.type === "tel" ? 40 : 200} placeholder={f.placeholder} autoComplete={f.maps === "name" ? "name" : f.maps === "email" ? "email" : f.maps === "phone" ? "tel" : f.maps === "company" ? "organization" : "off"} className={`gv-input ${inputCls} mt-1.5`} />}
              </>
            )}
          </label>
        ))}
        {captcha && !preview && <Turnstile siteKey={captcha.siteKey} script={captcha.script} resetKey={tries} action="lead_form" />}
        {err && <p className="gv-error rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">{err}</p>}
        <button type="submit" disabled={state === "sending"} className="gv-button btn h-12 w-full text-[15px] text-white disabled:opacity-70" style={{ background: accent }}>
          {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {state === "sending" ? "Sending…" : button}
        </button>
      </form>
    </div>
  );
}
