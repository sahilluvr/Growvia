"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Check, Download, Loader2, Play, RefreshCw, Sparkles, Gauge } from "lucide-react";
import { disconnectGscAction, pickGscSiteAction, refreshGscAction, runAiAction, runAuditAction, runSpeedAction, saveWebsiteAction } from "@/app/seo-actions";
import { Notice, Submit, inputCls } from "@/components/ui/Form";
import { CopyButton } from "@/components/app/bits";
import { useJobs } from "@/components/app/Jobs";

export function WebsiteForm({ current }: { current?: string | null }) {
  const [state, action] = useFormState(safe(saveWebsiteAction), undefined);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="grid gap-3 sm:max-w-xl">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="website" defaultValue={current ?? ""} required className={`${inputCls} flex-1`} placeholder="yourwebsite.com" aria-label="Website address" inputMode="url" autoComplete="url" />
        <Submit className="btn-primary h-11 px-5 text-[14px]" pendingText="Saving…">{current ? "Update" : "Add website"}</Submit>
      </div>
      <Notice state={state?.error ? state : undefined} />
    </form>
  );
}

/** Starts the full audit in the background: crawl → speed test + AI plan. Progress shows here and as pop-ups. */
export function RunAudit({ label = "Run new audit", big = false }: { label?: string; big?: boolean }) {
  const { jobs, track } = useJobs();
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [starting, setStarting] = useState(false);
  const seo = jobs.filter((j) => ["seo_audit", "seo_speed", "seo_ai"].includes(j.kind));
  const running = seo.some((j) => j.status === "queued" || j.status === "running");
  const LABEL: Record<string, string> = { seo_audit: "Reading your site like Google & AI crawlers do", seo_speed: "Speed test on mobile & desktop (Google PageSpeed)", seo_ai: "Writing your plan, fixes, llms.txt & schema" };
  async function go() {
    setErr(""); setNote(""); setStarting(true);
    const a = await runAuditAction().catch(() => ({ error: "Connection lost — try again." } as { error?: string; id?: string; ok?: boolean; message?: string }));
    setStarting(false);
    if (!a?.ok || !a.id) return setErr(a?.error ?? "Couldn't start the audit.");
    setNote(a.message ?? ""); track(a.id);
  }
  return (
    <div className="grid gap-3">
      <button onClick={go} disabled={running || starting} className={`btn-primary ${big ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-[14px]"} disabled:opacity-60`}>
        {running || starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-lime" />} {running ? "Audit running in the background…" : starting ? "Starting…" : label}
      </button>
      {running && (
        <ol className="card grid gap-2 p-4 text-[13px]" aria-live="polite" data-testid="audit-steps">
          {seo.filter((j) => j.status === "queued" || j.status === "running").map((j) => (
            <li key={j.id} className="flex items-start gap-2"><Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-stone-500" /><span>{LABEL[j.kind] ?? j.title}</span></li>
          ))}
          <li className="text-[12px] text-stone-500">You can leave this page — you&apos;ll get a pop-up when each part is ready.</li>
        </ol>
      )}
      {!running && note && <p className="text-[13px] text-stone-500">{note}</p>}
      {err && <p className="text-[13px] text-red-600">{err}</p>}
    </div>
  );
}

export function StepButton({ id, kind }: { id: string; kind: "speed" | "ai" | "gsc" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = kind === "speed" ? runSpeedAction : kind === "ai" ? runAiAction : refreshGscAction;
  const { jobs, track } = useJobs();
  const busyJob = jobs.some((j) => j.kind === (kind === "speed" ? "seo_speed" : kind === "ai" ? "seo_ai" : "_") && (j.status === "queued" || j.status === "running"));
  const Icon = kind === "speed" ? Gauge : kind === "ai" ? Sparkles : RefreshCw;
  const label = kind === "speed" ? "Test speed" : kind === "ai" ? "Generate AI plan" : "Refresh data";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button disabled={pending || busyJob} onClick={() => start(async () => { const r = await run(id); setMsg(r?.error ?? r?.message ?? ""); if (r?.id && kind !== "gsc") track(r.id); router.refresh(); })} className="btn-ghost h-9 px-3.5 text-[13px] disabled:opacity-60">
        {pending || busyJob ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />} {busyJob ? (kind === "speed" ? "Testing in the background…" : "Writing in the background…") : pending ? (kind === "gsc" ? "Loading…" : "Starting…") : label}
      </button>
      {msg && <span className="text-[12px] text-stone-500">{msg}</span>}
    </span>
  );
}

/** A generated file with copy + download. */
export function FileBox({ name, text, hint }: { name: string; text: string; hint: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: name.endsWith(".json") ? "application/ld+json" : "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div><p className="font-mono text-[13px] font-medium">{name}</p><p className="text-[12px] text-stone-500">{hint}</p></div>
        <div className="flex gap-2"><CopyButton text={text} /><button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-stone-600 hover:border-ink hover:text-ink"><Download className="h-3.5 w-3.5" /> Download</button></div>
      </div>
      <pre className="max-h-80 overflow-auto bg-paper p-4 font-mono text-[12px] leading-relaxed text-stone-700">{text}</pre>
    </div>
  );
}

export function GscPicker({ sites, current }: { sites: string[]; current: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select disabled={pending} value={current ?? ""} onChange={(e) => { const v = e.target.value; start(async () => { await pickGscSiteAction(v); router.refresh(); }); }} className={`${inputCls} h-10 max-w-md`} aria-label="Search Console property">
      <option value="" disabled>Choose the property for this website…</option>
      {sites.map((s) => <option key={s} value={s}>{s.replace("sc-domain:", "Domain: ")}</option>)}
    </select>
  );
}

export function GscDisconnect() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => { if (confirm("Disconnect Google Search Console from this project?")) start(async () => { await disconnectGscAction(); router.refresh(); }); }} className="text-[13px] text-stone-500 underline-offset-2 hover:text-red-600 hover:underline">Disconnect</button>;
}

export function PrintButton() {
  useEffect(() => { if (new URLSearchParams(location.search).get("print") === "1") setTimeout(() => window.print(), 400); }, []);
  return <button onClick={() => window.print()} className="btn-primary h-10 px-4 text-[14px] print:hidden"><Download className="h-4 w-4 text-lime" /> Download PDF</button>;
}
