"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { Turnstile } from "@/components/auth/Turnstile";
import { linkSegments, type FormField, type FormStyle } from "@/lib/forms-model";
import { prefillFrom, validate, type FileInfo } from "@/lib/forms-validate";

type Props = {
  formId: string; fields: FormField[]; button: string; accent: string; success: { title: string; text: string }; errorText?: string;
  captcha: { siteKey: string; script: string } | null; embedded?: boolean; preview?: boolean; style?: Partial<FormStyle>;
  /** Builder preview: show the thank-you state or sample validation errors. */
  previewState?: "form" | "success" | "errors";
};

/** Text with safe [text](https://url) links (opens in a new tab). Never raw HTML. */
export function Linked({ text }: { text: string }) {
  return <>{linkSegments(text).map((s, i) => s.href ? <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{s.t}</a> : <span key={i}>{s.t}</span>)}</>;
}

const RADIUS = { square: "rounded-none", rounded: "rounded-xl", pill: "rounded-full" } as const;

/** The website form visitors fill in — hosted page (/f/…), embed iframe, or the builder preview. */
export function LeadForm({ formId, fields, button, accent, success, errorText, captcha, embedded = false, preview = false, style = {}, previewState = "form" }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [tries, setTries] = useState(0);
  const [pre, setPre] = useState<Record<string, string | string[]>>({});
  const loadedAt = useRef(Date.now());
  const root = useRef<HTMLDivElement>(null);
  const dark = style.theme === "dark";
  const r = RADIUS[style.radius ?? "rounded"];
  const box = `w-full border px-3.5 text-[15px] outline-none transition focus:ring-2 ${r === "rounded-full" ? "rounded-2xl" : r} ${dark ? "border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:ring-white/20" : "border-line bg-white text-ink placeholder:text-stone-400 focus:ring-ink/10"}`;

  // URL pre-fill: the hosted page reads its own query; the iframe reads the parent page's (passed as ?parent=).
  useEffect(() => {
    try {
      const own = new URLSearchParams(location.search);
      const parent = own.get("parent");
      const search = parent ? new URL(parent).search : location.search;
      setPre(prefillFrom(fields, search));
    } catch { /* no pre-fill */ }
  }, [fields]);

  useEffect(() => {
    if (!embedded || !root.current) return;
    const post = () => window.parent?.postMessage({ type: "growvia:height", id: formId, h: Math.ceil(document.documentElement.scrollHeight) }, "*");
    const ro = new ResizeObserver(post); ro.observe(document.body); post();
    return () => ro.disconnect();
  }, [embedded, formId, state, err, fieldErr]);

  const sampleErrors = useMemo(() => Object.fromEntries(fields.filter((f) => f.required && f.type !== "hidden").slice(0, 3).map((f) => [f.key, f.error || (f.maps === "consent" ? "Please tick the box to agree before sending." : `Please fill in “${f.label.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}”.`)])), [fields]);
  const shownErr = previewState === "errors" ? sampleErrors : fieldErr;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) { setState("done"); return; }
    setErr(""); setFieldErr({});
    const fd = new FormData(e.currentTarget);
    // Same rules as the server, so mistakes show instantly.
    const data: Record<string, string | string[]> = {};
    for (const f of fields) data[f.key] = f.type === "multiselect" ? fd.getAll(f.key).map(String) : String(fd.get(f.key) ?? "");
    const files: Record<string, FileInfo | undefined> = {};
    for (const f of fields.filter((x) => x.type === "file")) { const file = fd.get(f.key); if (file instanceof File && file.size) files[f.key] = { name: file.name, size: file.size, ext: (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? "").toLowerCase() }; }
    const check = validate(fields, data, files);
    if (!check.ok) { setFieldErr(check.fields); setErr(check.error); return; }
    setState("sending");
    const q = new URLSearchParams(location.search);
    const parent = q.get("parent");
    const ref = q.get("ref");
    const utmSrc = parent ? (() => { try { return new URL(parent).searchParams; } catch { return q; } })() : q;
    const utm: Record<string, string> = {};
    utmSrc.forEach((v, k) => { if (k.startsWith("utm_")) utm[k] = v; });
    const hasFile = Object.keys(files).length > 0;
    let res: Response | null;
    if (hasFile) {
      fd.set("_page", parent ?? location.href); if (ref ?? document.referrer) fd.set("_referrer", ref ?? document.referrer);
      Object.entries(utm).forEach(([k, v]) => fd.set(k, v)); fd.set("_gv_t", String(loadedAt.current));
      res = await fetch(`/api/forms/${formId}`, { method: "POST", headers: { Accept: "application/json" }, body: fd }).catch(() => null);
    } else {
      const payload: Record<string, unknown> = { ...data, _gv_hp: String(fd.get("_gv_hp") ?? ""), _gv_t: String(loadedAt.current) };
      res = await fetch(`/api/forms/${formId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: payload, page: parent ?? location.href, referrer: ref ?? document.referrer, utm, turnstileToken: String(fd.get("cf-turnstile-response") ?? "") }) }).catch(() => null);
    }
    const out = res ? await res.json().catch(() => null) : null;
    if (!out?.ok) { setErr(out?.error ?? errorText ?? "Something went wrong — please try again."); setFieldErr(out?.fields ?? {}); setState("idle"); setTries((t) => t + 1); return; }
    setState("done");
    if (embedded) window.parent?.postMessage({ type: "growvia:submitted", id: formId, redirect: out.redirect ?? null }, "*");
    else if (out.redirect) location.href = out.redirect;
  }

  if (state === "done" || previewState === "success") {
    return (
      <div ref={root} className={`gv-success p-5 text-center ${r === "rounded-full" ? "rounded-2xl" : r} ${dark ? "bg-white/10 text-white" : "border border-lime-500/40 bg-lime/15"}`} role="status">
        <CheckCircle2 className="mx-auto h-8 w-8" style={{ color: accent }} />
        <p className="gv-success-title mt-2 text-[16px] font-semibold">{success.title}</p>
        <p className={`gv-success-text mt-1 text-[14px] ${dark ? "text-white/70" : "text-stone-600"}`}>{success.text}</p>
      </div>
    );
  }

  return (
    <div ref={root} className={dark ? "text-white" : ""} style={style.font === "system" ? { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" } : undefined}>
      <form onSubmit={submit} className="gv-form grid gap-4" noValidate>
        {fields.map((f) => {
          if (f.type === "hidden") return <input key={f.key} type="hidden" name={f.key} value={String(pre[f.key] ?? f.default ?? "")} readOnly />;
          const e = shownErr[f.key];
          const id = `gv-${formId.slice(0, 6)}-${f.key}`;
          const pv = pre[f.key];
          const help = f.help ? <span className={`gv-help mt-1 block text-[12px] ${dark ? "text-white/55" : "text-stone-500"}`}><Linked text={f.help} /></span> : null;
          const errEl = e ? <span id={`${id}-err`} className="gv-field-error mt-1 block text-[12px] text-red-600" role="alert">{e}</span> : null;
          const label = <span className="gv-label text-[13px] font-medium"><Linked text={f.label} />{!f.required && f.type !== "checkbox" && <span className="gv-optional ml-1 font-normal opacity-50">optional</span>}</span>;
          const common = { id, name: f.key, "aria-invalid": e ? true : undefined, "aria-describedby": e ? `${id}-err` : undefined };
          const wrap = (inner: React.ReactNode) => <div key={f.key} className={`gv-field gv-field-${f.type} gv-field-${f.key}`}>{inner}</div>;
          if (f.type === "checkbox") return wrap(<><label htmlFor={id} className="flex items-start gap-2.5"><input type="checkbox" {...common} value={f.checked_value ?? "yes"} className="gv-checkbox mt-1 h-4 w-4" style={{ accentColor: accent }} /><span className="text-[14px]"><Linked text={f.label} /></span></label>{help}{errEl}</>);
          if (f.type === "multiselect" || f.type === "radio") {
            const chosen = Array.isArray(pv) ? pv : pv ? [pv] : f.default ? [f.default] : [];
            return wrap(<fieldset aria-describedby={e ? `${id}-err` : undefined}><legend className="mb-1.5">{label}</legend>{help}<div className="mt-1 flex flex-wrap gap-2">{(f.options ?? []).map((o, i) => (
              <label key={o} className={`gv-choice flex cursor-pointer items-center gap-2 border px-3 py-2 text-[14px] ${r === "rounded-none" ? "rounded-none" : "rounded-full"} ${dark ? "border-white/15" : "border-line bg-white"} has-[:checked]:border-ink has-[:checked]:font-medium`}>
                <input type={f.type === "radio" ? "radio" : "checkbox"} name={f.key} value={o} defaultChecked={chosen.includes(o)} id={i === 0 ? id : undefined} style={{ accentColor: accent }} /> {o}
              </label>))}</div>{errEl}</fieldset>);
          }
          if (f.type === "range") {
            const opts = f.options ?? [];
            const start = Math.max(0, opts.indexOf(String(pv ?? f.default ?? opts[0] ?? "")));
            return wrap(<RangeField id={id} f={f} opts={opts} start={start} accent={accent} label={label} help={help} err={errEl} />);
          }
          if (f.type === "file") return wrap(<label htmlFor={id} className="block">{label}{help}<span className={`gv-file mt-1.5 flex items-center gap-3 border border-dashed px-3.5 py-3 text-[14px] ${r === "rounded-full" ? "rounded-2xl" : r} ${dark ? "border-white/25" : "border-stone-300 bg-white"}`}><Upload className="h-4 w-4 shrink-0 opacity-60" /><input type="file" {...common} accept={(f.accept ?? []).map((x) => `.${x}`).join(",")} className="w-full text-[13px]" /></span><span className="mt-1 block text-[11px] opacity-60">{(f.accept ?? []).map((x) => x.toUpperCase()).join(", ")} · up to {f.max_mb ?? 10} MB</span>{errEl}</label>);
          if (f.type === "textarea") return wrap(<label htmlFor={id} className="block">{label}{help}<textarea {...common} rows={4} maxLength={f.max ?? 5000} defaultValue={String(pv ?? f.default ?? "")} placeholder={f.placeholder} className={`gv-textarea mt-1.5 py-3 ${box.replace(/rounded-full/, "rounded-2xl")}`} />{errEl}</label>);
          if (f.type === "select") return wrap(<label htmlFor={id} className="block">{label}{help}<select {...common} defaultValue={String(pv ?? f.default ?? "")} className={`gv-select mt-1.5 h-12 ${box}`}><option value="" disabled>Choose…</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select>{errEl}</label>);
          return wrap(<label htmlFor={id} className="block">{label}{help}<input type={f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text"} {...common} maxLength={f.max ?? (f.type === "url" ? 500 : 300)} defaultValue={String(pv ?? f.default ?? "")} placeholder={f.placeholder} autoComplete={f.maps === "name" ? "name" : f.maps === "email" ? "email" : f.maps === "phone" ? "tel" : f.maps === "company" ? "organization" : f.type === "url" ? "url" : "off"} className={`gv-input mt-1.5 h-12 ${box}`} />{errEl}</label>);
        })}
        <input type="text" name="_gv_hp" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-px w-px opacity-0" />
        {captcha && !preview && <Turnstile key={tries} siteKey={captcha.siteKey} script={captcha.script} />}
        {(err || previewState === "errors") && <p className="gv-error rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">{previewState === "errors" ? errorText ?? "Please fix the highlighted fields." : err}</p>}
        <button type="submit" disabled={state === "sending"} className={`gv-button btn h-12 w-full text-[15px] text-white disabled:opacity-70 ${r}`} style={{ background: accent }}>
          {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : button}
        </button>
      </form>
    </div>
  );
}

function RangeField({ id, f, opts, start, accent, label, help, err }: { id: string; f: FormField; opts: string[]; start: number; accent: string; label: React.ReactNode; help: React.ReactNode; err: React.ReactNode }) {
  const [i, setI] = useState(start);
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between">{label}<span className="text-[14px] font-semibold">{opts[i]}</span></label>{help}
      <input type="range" id={id} min={0} max={Math.max(0, opts.length - 1)} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} className="gv-range mt-2 w-full" style={{ accentColor: accent }} aria-valuetext={opts[i]} />
      <input type="hidden" name={f.key} value={opts[i] ?? ""} />
      <div className="mt-1 flex justify-between text-[11px] opacity-60">{opts.map((o) => <span key={o}>{o}</span>)}</div>{err}
    </div>
  );
}
