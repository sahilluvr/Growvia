"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed, Gauge, Globe2, Loader2, MapPin, MessageSquareText, Search, Sparkles, Trophy, X } from "lucide-react";
import type { JobState, Snapshot } from "@/lib/growth";
import { AiStage, Burst } from "./AiStage";

/* ───────── Score ring (animated count-up, gradient stroke) ───────── */
export function ScoreRing({ score, size = 168, label = "Growth Score", pending = false }: { score: number | null; size?: number; label?: string; pending?: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (score == null) return;
    const from = shown, to = score, t0 = performance.now(), dur = 1200;
    let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); setShown(Math.round(from + (to - from) * e)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);
  const r = (size - 16) / 2, c = 2 * Math.PI * r, pct = score == null ? 0 : shown / 100;
  const tone = score == null ? "text-stone-400" : shown >= 75 ? "text-lime-800" : shown >= 50 ? "text-amber-700" : "text-red-700";
  const id = `gv-ring-${size}`;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={score == null ? `${label}: calculating` : `${label}: ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A8DA16" /><stop offset="55%" stopColor="#4B9BE0" /><stop offset="100%" stopColor="#7A5CF0" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFEFEA" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .2s linear" }} className={pending && score == null ? "animate-pulse" : ""} />
      </svg>
      <div className="absolute grid place-items-center text-center">
        {score == null ? <Loader2 className="h-7 w-7 animate-spin text-stone-400" /> : <span className={`text-[44px] font-semibold leading-none tracking-tight tabular-nums ${tone}`} style={{ fontSize: size / 3.8 }}>{shown}</span>}
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</span>
      </div>
    </div>
  );
}

export function AiOrb({ still = false }: { still?: boolean }) {
  return <div className={`gv-orb ${still ? "still" : ""}`} aria-hidden><div className="gv-orb-ring" /><div className="gv-orb-ring r2" /><div className="gv-orb-core" /></div>;
}

const PARTS: { key: keyof Snapshot["parts"]; label: string; icon: React.ElementType; empty: string; href: string }[] = [
  { key: "seo", label: "Google SEO", icon: Search, empty: "Checking…", href: "/app/seo" },
  { key: "ai", label: "AI visibility", icon: Sparkles, empty: "Asking AI…", href: "/app/seo?tab=geo" },
  { key: "speed", label: "Speed", icon: Gauge, empty: "Testing…", href: "/app/seo?tab=speed" },
  { key: "local", label: "Google Maps", icon: MapPin, empty: "Connect", href: "/app/local" },
];

export function ScoreParts({ parts, analysing }: { parts: Snapshot["parts"]; analysing: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PARTS.map(({ key, label, icon: I, empty, href }) => {
        const v = parts[key];
        const waiting = v == null && analysing && key !== "local";
        return (
          <Link key={key} href={href} className="gv-glass group rounded-xl p-3 transition hover:-translate-y-0.5">
            <span className="flex items-center gap-1.5 text-[12px] text-stone-500"><I className="h-3.5 w-3.5" />{label}</span>
            {v != null ? <span className="mt-1 block text-[22px] font-semibold tabular-nums tracking-tight">{v}<span className="text-[12px] font-normal text-stone-400">/100</span></span>
              : waiting ? <span className="gv-shimmer mt-2 block h-5 w-16 rounded-md" />
              : <span className="mt-1 block text-[13px] font-medium text-stone-600 group-hover:text-ink">{key === "local" ? "Connect →" : empty === "Checking…" ? "Not checked" : "Not yet"}</span>}
          </Link>
        );
      })}
    </div>
  );
}

/* ───────── Live Growth Report ───────── */
const STEPS: { key: keyof Snapshot["jobs"]; title: string; lines: string[] }[] = [
  { key: "audit", title: "Reading your website", lines: ["Crawling your pages…", "Checking titles and descriptions…", "Looking for broken links…", "Checking what Google can index…"] },
  { key: "speed", title: "Measuring speed", lines: ["Loading your site on a phone…", "Timing the first paint…", "Comparing desktop and mobile…"] },
  { key: "geo", title: "Asking AI assistants about you", lines: ["Asking what customers ask…", "Reading AI answers…", "Spotting which businesses get recommended…"] },
  { key: "plan", title: "Writing your action plan", lines: ["Ranking fixes by impact…", "Picking your quickest wins…", "Drafting keywords and content ideas…"] },
];

function stepState(j: JobState, started: boolean): "wait" | "work" | "done" | "slow" {
  if (j.status === "done") return "done";
  if (j.status === "failed") return "slow";
  if (j.status === "running" || (j.status === "queued" && /retrying|waiting/i.test(j.message ?? ""))) return /retrying|waiting/i.test(j.message ?? "") ? "slow" : "work";
  if (j.status === "queued") return started ? "work" : "wait";
  return "wait";
}

export function ReportLive({ initial, site, welcome, plan, interval }: { initial: Snapshot; site: string | null; welcome: boolean; plan?: string; interval?: string }) {
  const [s, setS] = useState(initial);
  const [line, setLine] = useState(0);
  const t0 = useRef(Date.now());
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!s.analysing && s.score != null) return;
    if (!s.hasWebsite) return;
    const id = setInterval(async () => {
      if (Date.now() - t0.current > 6 * 60_000) { setLate(true); return; }
      const r = await fetch("/api/report", { cache: "no-store" }).catch(() => null);
      if (!r?.ok || !(r.headers.get("content-type") ?? "").includes("json")) return; // signed out / redirected — try again next tick
      const next = await r.json().catch(() => null);
      if (next && typeof next === "object" && "jobs" in next) setS(next as Snapshot);
    }, 3000);
    return () => clearInterval(id);
  }, [s.analysing, s.score, s.hasWebsite]);
  useEffect(() => { const id = setInterval(() => setLine((x) => x + 1), 1800); return () => clearInterval(id); }, []);

  const states = STEPS.map((st, i) => stepState(s.jobs[st.key], i === 0 || s.jobs[STEPS[i - 1].key].status !== "none"));
  const active = states.findIndex((x) => x === "work");
  const allDone = !s.analysing && s.score != null;
  const wasRunning = useRef(!allDone);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => { if (allDone && wasRunning.current) { wasRunning.current = false; setCelebrate(true); } }, [allDone]);
  const host = (() => { try { return site ? new URL(site).host : null; } catch { return site; } })();
  const planHref = plan ? `/app/billing?plan=${plan}&interval=${interval === "year" ? "year" : "month"}&welcome=1#upgrade` : null;

  if (!s.hasWebsite) {
    return (
      <section className="gv-aurora rounded-3xl border border-line p-8 text-center sm:p-12">
        <div className="mx-auto w-fit"><AiOrb still /></div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Add your website to get your Growth Report</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-stone-600">Growvia checks how Google and AI assistants see you, measures your speed and writes a plan — in about two minutes.</p>
        <Link href="/app/seo" className="btn-primary mt-6 inline-flex h-11 px-5 text-[14px]">Add website <ArrowRight className="h-4 w-4 text-lime" /></Link>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      {!allDone ? <AiStage s={s} host={host} /> : (
      <section className="gv-aurora relative rounded-3xl border border-line p-6 sm:p-10">
        {celebrate && <Burst />}
        <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
          <div className="mx-auto grid place-items-center">{allDone ? <ScoreRing score={s.score} size={190} /> : <div className="grid place-items-center gap-4"><AiOrb /><span className="text-[12px] font-medium uppercase tracking-[0.14em] text-stone-500">Growvia AI · live</span></div>}</div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500"><Sparkles className="h-3.5 w-3.5 text-lime-700" />{welcome ? "Your Growth Report" : "Growth Report"}{host && <span className="truncate normal-case tracking-normal text-stone-400">· {host}</span>}</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">
              {allDone ? (s.score! >= 75 ? "You're in great shape — here's how to pull further ahead." : s.score! >= 50 ? "A solid start — a few fixes will make a real difference." : "Big opportunities ahead — let's fix the basics first.") : <span>Growvia AI is analysing <span className="gv-ai-text">{host ?? "your business"}</span></span>}
            </h1>
            {allDone && <p className="mt-3 text-[15px] text-stone-600">{s.facts.pages ? `Growvia AI read ${s.facts.pages} pages, ` : ""}{s.geo.length ? `asked AI assistants ${s.geo.length} questions ` : ""}and found {s.wins.length || "a few"} quick wins for you.</p>}
            {!allDone && <p className="mt-2 h-6 text-[15px] text-stone-600" aria-live="polite">{active >= 0 ? STEPS[active].lines[line % STEPS[active].lines.length] : "Putting your report together…"}</p>}
            {!allDone && (
            <ol className="mt-5 grid gap-2 sm:grid-cols-2">
              {STEPS.map((st, i) => {
                const x = states[i];
                return (
                  <li key={st.key} className={`gv-glass flex items-center gap-3 rounded-xl px-3 py-2.5 ${x === "work" ? "gv-glow-border" : ""}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${x === "done" ? "bg-lime text-ink" : x === "work" ? "bg-ink text-lime" : "bg-mist text-stone-400"}`}>
                      {x === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : x === "work" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDashed className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[14px] ${x === "wait" ? "text-stone-400" : "font-medium"}`}>{st.title}</span>
                      {x === "slow" && <span className="block text-[12px] text-stone-500">Taking a little longer — we&apos;ll keep going in the background.</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            )}
            {(late || (!allDone && states.every((x) => x === "done" || x === "slow") && states.some((x) => x === "slow"))) && (
              <p className="mt-4 text-[13px] text-stone-600">Some parts are still running. You can keep going — we&apos;ll notify you in the bell when everything is ready.</p>
            )}
          </div>
        </div>
      </section>
      )}

      {(s.score != null || s.parts.seo != null) && <div className="gv-rise"><ScoreParts parts={s.parts} analysing={s.analysing} /></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card gv-rise p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"><MessageSquareText className="h-4 w-4 text-stone-500" /> Do AI assistants recommend you?</h2>
          {s.geo.length ? (
            <ul className="mt-4 grid gap-2">
              {s.geo.map((g) => (
                <li key={g.prompt} className="flex items-start gap-3 rounded-xl border border-line p-3">
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${g.mentioned ? "bg-lime text-ink" : "bg-red-50 text-red-700"}`}>{g.mentioned ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                  <span className="min-w-0 text-[14px]"><span className="text-stone-700">“{g.prompt}”</span><span className={`mt-0.5 block text-[12px] font-medium ${g.mentioned ? "text-lime-800" : "text-red-700"}`}>{g.mentioned ? "Recommends you" : "Doesn't mention you yet"}</span></span>
                </li>
              ))}
            </ul>
          ) : <div className="mt-4 grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="gv-shimmer h-14 rounded-xl" />)}<p className="text-[12px] text-stone-500">Asking assistants the questions your customers ask…</p></div>}
          {s.rivals.length > 0 && <p className="mt-4 text-[13px] text-stone-600"><b className="text-ink">Recommended instead:</b> {s.rivals.join(", ")}</p>}
          <Link href="/app/seo?tab=geo" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">Improve AI visibility <ArrowRight className="h-3.5 w-3.5" /></Link>
        </section>

        <section className="card gv-rise p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"><Trophy className="h-4 w-4 text-stone-500" /> Your quickest wins</h2>
          {s.wins.length ? (
            <ol className="mt-4 grid gap-2">
              {s.wins.map((w, i) => (
                <li key={w.title} className="flex items-start gap-3 rounded-xl border border-line p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-lime">{i + 1}</span>
                  <span className="min-w-0"><span className="block text-[14px] font-medium">{w.title}</span>{w.fix && <span className="mt-0.5 block text-[13px] text-stone-600">{w.fix}</span>}</span>
                </li>
              ))}
            </ol>
          ) : <div className="mt-4 grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="gv-shimmer h-14 rounded-xl" />)}<p className="text-[12px] text-stone-500">Finding the fixes that matter most…</p></div>}
          <Link href="/app/seo?tab=issues" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">See the full SEO report <ArrowRight className="h-3.5 w-3.5" /></Link>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold"><Globe2 className="h-4 w-4 text-lime" /> {planHref ? "One last step: confirm your plan" : "Next: your plan and setup checklist"}</p>
          <p className="mt-1 text-[13px] text-white/60">{planHref ? "Your report keeps updating while you finish." : "Home shows your Growth Score, what to connect and the 3 most valuable things to do next."}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {planHref && <Link href={planHref} className="btn-lime h-11 px-5 text-[14px]">Confirm plan <ArrowRight className="h-4 w-4" /></Link>}
          <Link href="/app" className={`${planHref ? "btn-ghost border-white/20 bg-transparent text-white hover:bg-white/10" : "btn-lime"} h-11 px-5 text-[14px]`}>Go to my dashboard {!planHref && <ArrowRight className="h-4 w-4" />}</Link>
        </div>
      </section>
    </div>
  );
}
