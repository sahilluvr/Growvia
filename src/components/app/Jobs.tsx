"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

/* Background tasks: polls /api/jobs (a plain route, so it never blocks navigation), pops up when something is ready. */

export type JobRow = { id: string; kind: string; title: string; link: string | null; status: "queued" | "running" | "done" | "failed"; message: string | null; result: any; seen: boolean; params: Record<string, any>; created_at: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Ctx = { jobs: JobRow[]; track: (id: string) => void };
const JobsCtx = createContext<Ctx>({ jobs: [], track: () => {} });
export const useJobs = () => useContext(JobsCtx);

/** Resolves when the job finishes (from any page). Use it to update a screen with the result. */
export function waitForJob(id: string): Promise<JobRow> {
  return new Promise((resolve) => {
    const on = (e: Event) => { const j = (e as CustomEvent<JobRow>).detail; if (j.id === id) { removeEventListener("gv:job", on); resolve(j); } };
    addEventListener("gv:job", on);
    dispatchEvent(new CustomEvent("gv:track", { detail: id }));
  });
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [toasts, setToasts] = useState<JobRow[]>([]);
  const known = useRef(new Map<string, string>()); // id → last status seen
  const fast = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    let list: JobRow[] = [];
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      if (r.ok) list = ((await r.json()).jobs ?? []) as JobRow[];
    } catch { /* offline — try again later */ }
    const finished: JobRow[] = [];
    for (const j of list) {
      const before = known.current.get(j.id);
      if ((j.status === "done" || j.status === "failed") && before !== j.status && !j.seen) finished.push(j);
      known.current.set(j.id, j.status);
    }
    setJobs(list);
    if (finished.length) {
      setToasts((t) => [...finished, ...t.filter((x) => !finished.some((f) => f.id === x.id))].slice(0, 4));
      const ids = finished.map((f) => f.id);
      setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 20000);
      finished.forEach((j) => dispatchEvent(new CustomEvent("gv:job", { detail: j })));
      fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: finished.map((j) => j.id) }) }).catch(() => {});
      router.refresh();
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        finished.forEach((j) => { try { new Notification(j.status === "done" ? `${j.title} is ready` : `${j.title} didn't finish`, { body: j.message ?? "", tag: j.id, icon: "/icon.svg" }); } catch { /* ignore */ } });
      }
    }
    const active = list.some((j) => j.status === "queued" || j.status === "running");
    fast.current = active;
    timer.current = setTimeout(poll, active ? 2500 : document.hidden ? 60000 : 20000);
  }, [router]);

  useEffect(() => {
    poll();
    const onTrack = () => {
      // A job was just started on this page: poll quickly, and ask once for desktop notifications.
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
      setTimeout(poll, 1200);
    };
    const onVis = () => { if (!document.hidden) poll(); };
    addEventListener("gv:track", onTrack); document.addEventListener("visibilitychange", onVis);
    return () => { removeEventListener("gv:track", onTrack); document.removeEventListener("visibilitychange", onVis); if (timer.current) clearTimeout(timer.current); };
  }, [poll]);

  const track = useCallback((id: string) => dispatchEvent(new CustomEvent("gv:track", { detail: id })), []);
  const running = jobs.filter((j) => j.status === "queued" || j.status === "running");

  return (
    <JobsCtx.Provider value={{ jobs, track }}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[70] lg:bottom-4 grid w-[min(380px,calc(100vw-2rem))] gap-2" aria-live="polite">
        {toasts.map((j) => (
          <div key={j.id} role="status" className="pointer-events-auto flex animate-feedIn items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-frame" data-testid="job-toast">
            {j.status === "done" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-700" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{j.status === "done" ? `${j.title} is ready` : `${j.title} didn't finish`}</p>
              {j.message && <p className="mt-0.5 text-[13px] text-stone-600">{j.message}</p>}
              {j.link && <Link href={j.link} onClick={() => setToasts((t) => t.filter((x) => x.id !== j.id))} className="mt-2 inline-block text-[13px] font-medium underline decoration-lime decoration-2 underline-offset-4">{j.status === "done" ? "View" : "Open"}</Link>}
            </div>
            <button onClick={() => setToasts((t) => t.filter((x) => x.id !== j.id))} aria-label="Dismiss" className="rounded-full p-1 text-stone-400 hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
        ))}
        {running.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-2 justify-self-end rounded-full border border-line bg-white px-3.5 py-2 text-[12px] text-stone-600 shadow-card" data-testid="jobs-running">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {running.length === 1 ? `${running[0].title}…` : `${running.length} tasks running…`} <span className="text-stone-400">you can keep working</span>
          </div>
        )}
      </div>
    </JobsCtx.Provider>
  );
}

/** Inline "working in the background" note for a page, shown while matching jobs run. */
export function RunningNote({ match }: { match: (j: JobRow) => boolean }) {
  const { jobs } = useJobs();
  const list = jobs.filter((j) => (j.status === "queued" || j.status === "running") && match(j));
  if (!list.length) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[13px] text-stone-600">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> {list.map((j) => j.title).join(", ")} running in the background — you can leave this page; you&apos;ll get a pop-up when it&apos;s ready.
    </p>
  );
}

/**
 * Follows background jobs of one kind for one item (e.g. ad copy for ad X): tells you when one is running
 * (even after you navigated away and came back) and calls `onFinish` with the result.
 */
export function useJob(kind: string, match: (params: Record<string, any>) => boolean, onFinish: (j: JobRow) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { jobs, track } = useJobs();
  const cb = useRef(onFinish); cb.current = onFinish;
  const m = useRef(match); m.current = match;
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    const on = (e: Event) => { const j = (e as CustomEvent<JobRow>).detail; if (j.kind === kind && m.current(j.params ?? {})) cb.current(j); };
    addEventListener("gv:job", on);
    return () => removeEventListener("gv:job", on);
  }, [kind]);
  const running = starting || jobs.some((j) => j.kind === kind && (j.status === "queued" || j.status === "running") && match(j.params ?? {}));
  /** Starts the job with your server action (which returns `{ ok, jobId }` or `{ ok: false, error }`). */
  const start = useCallback(async (fn: () => Promise<{ ok: boolean; jobId?: string; error?: string }>) => {
    setStarting(true);
    try {
      const r = await fn();
      if (r.ok && r.jobId) { track(r.jobId); return { ok: true as const }; }
      return { ok: false as const, error: r.error ?? "Couldn't start that." };
    } catch { return { ok: false as const, error: "Connection lost — try again." }; } finally { setTimeout(() => setStarting(false), 2500); }
  }, [track]);
  return { running, start };
}
