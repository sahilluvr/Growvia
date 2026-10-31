"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Globe, Loader2, Mail, MapPin, Phone, Search, Sparkles, Star, Upload, Users, X } from "lucide-react";
import { campaignForTagAction, saveFoundAction, startFindAction, stepFindAction, type FindJob } from "@/app/finder-actions";
import { ImportDialog } from "../ImportDialog";

type Status = { ready: boolean; allowance: number; used: number; suggestions: string[]; area: string; planLabel: string; last: FindJob | null };
const COUNTS = [10, 20, 30, 50];
const eta = (n: number) => Math.round(5 + Math.ceil(n / 5) * 4);
const fmtSecs = (s: number) => (s < 60 ? `${s} seconds` : `${Math.round(s / 60)} minute${Math.round(s / 60) === 1 ? "" : "s"}`);
const input = "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] outline-none focus:border-ink";

export function FinderClient({ status, initial }: { status: Status; initial?: { what: string; where: string } }) {
  const [tab, setTab] = useState<"maps" | "import">(status.ready ? "maps" : "import");
  return (
    <div className="grid gap-5" data-testid="lead-finder">
      <Link href="/app/leads" className="inline-flex w-fit items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to leads</Link>
      <div className="inline-flex w-fit rounded-xl border border-line bg-white p-1" role="tablist">
        <TabBtn on={tab === "maps"} onClick={() => setTab("maps")} icon={<MapPin className="h-4 w-4" />}>Find businesses</TabBtn>
        <TabBtn on={tab === "import"} onClick={() => setTab("import")} icon={<Upload className="h-4 w-4" />}>I have a list</TabBtn>
      </div>
      {tab === "maps" ? (status.ready ? <MapsFinder status={status} initial={initial} /> : <NotReady onImport={() => setTab("import")} />) : <ImportFlow />}
    </div>
  );
}

function TabBtn({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button role="tab" aria-selected={on} onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[14px] font-medium ${on ? "bg-ink text-white" : "text-stone-600 hover:text-ink"}`}>{icon}{children}</button>;
}

function NotReady({ onImport }: { onImport: () => void }) {
  return (
    <div className="card grid gap-3 p-6">
      <h2 className="text-[17px] font-semibold">Finding businesses on Google Maps is coming soon</h2>
      <p className="text-[14px] text-stone-600">Meanwhile, upload a list you already have — Growvia checks the emails and writes a campaign for them.</p>
      <button onClick={onImport} className="btn-primary h-11 w-fit px-5 text-[14px]"><Upload className="h-4 w-4" /> Import a list</button>
    </div>
  );
}

/* ───────── Find businesses ───────── */

function MapsFinder({ status, initial }: { status: Status; initial?: { what: string; where: string } }) {
  const router = useRouter();
  const left = Math.max(0, status.allowance - status.used);
  const fresh = Boolean(initial?.what);
  const [what, setWhat] = useState(initial?.what ?? "");
  const [where, setWhere] = useState(initial?.where || status.area);
  const [count, setCount] = useState(Math.min(20, Math.max(10, left)));
  const last = fresh ? null : status.last;
  const [job, setJob] = useState<FindJob | null>(last);
  const [phase, setPhase] = useState<"setup" | "searching" | "checking" | "results">(last ? (last.status === "done" ? "results" : "checking") : "setup");
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(last?.status === "done" ? last.results.filter((c) => c.email).map((c) => c.id) : []));
  const [withCampaign, setWithCampaign] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const polling = useRef(false);

  // Check websites a few at a time until done.
  useEffect(() => {
    if (phase !== "checking" || !job || polling.current) return;
    polling.current = true;
    let stop = false;
    (async () => {
      let cur = job;
      let fails = 0;
      while (!stop && cur.status === "enriching") {
        const r = await stepFindAction(cur.id).catch(() => ({ ok: false as const, error: "Connection lost" }));
        if (r.ok) { cur = r.job; setJob(r.job); fails = 0; } else if (++fails >= 3) { setErr(r.error); break; } else await new Promise((res) => setTimeout(res, 1500));
      }
      polling.current = false;
      if (!stop && cur.status === "done") {
        setPicked(new Set(cur.results.filter((c) => c.email).map((c) => c.id)));
        setPhase("results");
      }
    })();
    return () => { stop = true; };
  }, [phase, job]);

  useEffect(() => {
    if (phase !== "checking" && phase !== "searching") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const start = async () => {
    setErr(""); setDone("");
    setPhase("searching"); setStartedAt(Date.now());
    const r = await startFindAction({ what, where, count }).catch(() => ({ ok: false as const, error: "Connection lost — try again." }));
    if (!r.ok) { setErr(r.error); setPhase("setup"); return; }
    setJob(r.job);
    if (r.job.status === "done") { setPicked(new Set(r.job.results.filter((c) => c.email).map((c) => c.id))); setPhase("results"); }
    else setPhase("checking");
  };

  const save = async () => {
    if (!job) return;
    setSaving(true); setErr("");
    const r = await saveFoundAction(job.id, [...picked], withCampaign).catch(() => ({ ok: false as const, error: "Connection lost — try again." }));
    setSaving(false);
    if (!r.ok) { setErr(r.error); return; }
    if (r.sequenceId) { router.push(`/app/email/${r.sequenceId}?ai=1&found=1`); return; }
    setDone(r.message);
  };

  const reset = () => { setJob(null); setPhase("setup"); setPicked(new Set()); setDone(""); setErr(""); };

  if (phase === "setup") return (
    <div className="card grid gap-6 p-6 sm:p-7">
      <Field n={1} label="Who do you want to reach?">
        <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. property managers" className={input} aria-label="Who to look for" maxLength={80} />
        <div className="mt-2.5 flex flex-wrap gap-2">
          {status.suggestions.map((s) => (
            <button key={s} type="button" onClick={() => setWhat(s)} aria-pressed={what === s} className={`rounded-full border px-3 py-1.5 text-[13px] transition ${what === s ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-stone-400"}`}>{s}</button>
          ))}
        </div>
      </Field>
      <Field n={2} label="Where?">
        <div className="relative"><MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City, neighbourhood or region — e.g. Austin, TX" className={`${input} pl-10`} aria-label="Area" maxLength={80} /></div>
      </Field>
      <Field n={3} label="How many?">
        <div className="flex flex-wrap gap-2">
          {COUNTS.map((c) => (
            <button key={c} type="button" disabled={c > left && c !== COUNTS[0]} onClick={() => setCount(c)} aria-pressed={count === c} className={`h-11 min-w-[64px] rounded-xl border px-4 text-[15px] font-medium transition disabled:opacity-35 ${count === c ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-stone-400"}`}>{c}</button>
          ))}
        </div>
        <p className="mt-2.5 text-[13px] text-stone-500">Takes about <b>{fmtSecs(eta(count))}</b>. {left} of {status.allowance} lookups left this month on {status.planLabel}.</p>
      </Field>
      {err && <Alert text={err} />}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={start} disabled={what.trim().length < 3 || where.trim().length < 2 || left <= 0} className="btn-primary h-12 px-6 text-[15px] disabled:opacity-40"><Search className="h-4 w-4" /> Find {Math.min(count, left)} leads</button>
        <p className="text-[12px] text-stone-500">Businesses only, from Google Maps. Emails come from each business&apos;s own website.</p>
      </div>
    </div>
  );

  if (phase === "searching" || phase === "checking") {
    const total = job?.results.length ?? 0;
    const checked = job ? job.results.filter((c) => c.status !== "pending").length : 0;
    const pct = phase === "searching" ? 6 : Math.max(8, Math.round((checked / Math.max(1, total)) * 100));
    const remaining = phase === "searching" ? eta(count) - Math.round((now - startedAt) / 1000) : job?.etaSeconds ?? 0;
    return (
      <div className="card grid gap-5 p-6 sm:p-7" aria-live="polite">
        <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-ink" /><h2 className="text-[17px] font-semibold">{phase === "searching" ? `Searching Google Maps for ${what || job?.what} in ${where || job?.where}…` : `Checking websites for contact emails… ${checked} of ${total}`}</h2></div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-ink transition-all duration-700" style={{ width: `${pct}%` }} /></div>
        <p className="text-[13px] text-stone-500">{remaining > 3 ? `About ${fmtSecs(remaining)} left.` : "Almost done…"} You can leave this page — the search is saved and continues when you come back.</p>
        {job && <ResultList job={job} picked={null} />}
        {err && <Alert text={err} />}
      </div>
    );
  }

  // Results
  const results = job?.results ?? [];
  const withEmail = results.filter((c) => c.email).length;
  const withPhone = results.filter((c) => c.phone).length;
  const chosen = results.filter((c) => picked.has(c.id));
  const chosenEmail = chosen.filter((c) => c.email).length;
  if (done) return (
    <div className="card grid gap-3 p-6"><p className="flex items-center gap-2 text-[16px] font-semibold"><Check className="h-5 w-5 text-lime-700" /> {done}</p>
      <div className="flex gap-2"><Link href="/app/leads" className="btn-primary h-11 px-5 text-[14px]"><Users className="h-4 w-4" /> See leads</Link><button onClick={reset} className="btn-ghost h-11 px-5 text-[14px]">Find more</button></div></div>
  );
  return (
    <div className="grid gap-4">
      <div className="card grid gap-4 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold">Found {results.length} {job?.what.toLowerCase()} in {job?.where}</h2>
            <p className="mt-1 text-[14px] text-stone-500"><Mail className="mr-1 inline h-3.5 w-3.5" />{withEmail} with an email · <Phone className="mx-1 inline h-3.5 w-3.5" />{withPhone} with a phone number</p>
          </div>
          <button onClick={reset} className="btn-ghost h-10 px-4 text-[13px]"><X className="h-3.5 w-3.5" /> New search</button>
        </div>
        <div className="flex flex-wrap gap-2 text-[13px]">
          <button onClick={() => setPicked(new Set(results.filter((c) => c.email).map((c) => c.id)))} className="rounded-full border border-line px-3 py-1 hover:border-stone-400">Select all with email</button>
          <button onClick={() => setPicked(new Set(results.filter((c) => c.email || c.phone).map((c) => c.id)))} className="rounded-full border border-line px-3 py-1 hover:border-stone-400">Also include phone-only</button>
          <button onClick={() => setPicked(new Set())} className="rounded-full border border-line px-3 py-1 hover:border-stone-400">Clear</button>
        </div>
        <ResultList job={job!} picked={picked} onToggle={(id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })} />
      </div>
      <div className="card sticky bottom-3 z-10 grid gap-3 p-5 sm:flex sm:items-center sm:justify-between">
        <label className="flex items-start gap-2.5 text-[14px]">
          <input type="checkbox" checked={withCampaign} onChange={(e) => setWithCampaign(e.target.checked)} className="mt-1 h-4 w-4" disabled={!chosenEmail} />
          <span><b><Sparkles className="mr-1 inline h-3.5 w-3.5" />Write a 3-email campaign for them</b><br /><span className="text-stone-500">You&apos;ll see the emails first, then just press Launch.</span></span>
        </label>
        <button onClick={save} disabled={saving || !chosen.length} className="btn-primary h-12 px-6 text-[15px] disabled:opacity-40">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {withCampaign && chosenEmail ? "Adding leads & writing emails…" : "Adding…"}</> : <>Add {chosen.length} lead{chosen.length === 1 ? "" : "s"}{withCampaign && chosenEmail ? " & write campaign" : ""}</>}
        </button>
      </div>
      {err && <Alert text={err} />}
    </div>
  );
}

function ResultList({ job, picked, onToggle }: { job: FindJob; picked: Set<string> | null; onToggle?: (id: string) => void }) {
  const rows = useMemo(() => [...job.results].sort((a, b) => Number(Boolean(b.email)) - Number(Boolean(a.email))), [job.results]);
  return (
    <ul className="grid max-h-[460px] gap-1.5 overflow-y-auto pr-1">
      {rows.map((c) => {
        const can = Boolean(c.email || c.phone);
        const on = picked?.has(c.id) ?? false;
        return (
          <li key={c.id}>
            <label className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[14px] transition ${picked ? (on ? "border-ink/40 bg-stone-50" : "border-line") : "border-line"} ${picked && can ? "cursor-pointer hover:border-stone-400" : ""}`}>
              {picked && <input type="checkbox" checked={on} disabled={!can} onChange={() => onToggle?.(c.id)} className="h-4 w-4 shrink-0" aria-label={`Select ${c.name}`} />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}{c.rating ? <span className="ml-2 text-[12px] font-normal text-stone-500"><Star className="mb-0.5 inline h-3 w-3" /> {c.rating.toFixed(1)} ({c.reviews ?? 0})</span> : null}</p>
                <p className="truncate text-[12px] text-stone-500">{c.address}</p>
                <p className="truncate text-[12px] sm:hidden">{c.status === "pending" ? <span className="text-stone-400">checking…</span> : c.email ? <span className="text-lime-800">{c.email}</span> : <span className="text-stone-400">{c.phone ?? (c.status === "no_website" ? "no website" : "no email found")}</span>}</p>
              </div>
              <div className="hidden shrink-0 text-right text-[12px] sm:block">
                {c.status === "pending" ? <span className="inline-flex items-center gap-1 text-stone-400"><Loader2 className="h-3 w-3 animate-spin" /> checking</span>
                  : c.email ? <span className="inline-flex items-center gap-1 text-lime-800"><Mail className="h-3 w-3" /> {c.email}</span>
                  : c.status === "no_website" ? <span className="text-stone-400">no website</span> : <span className="text-stone-400">no email found</span>}
                {c.phone && <p className="text-stone-500"><Phone className="mr-1 inline h-3 w-3" />{c.phone}</p>}
              </div>
              {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-stone-400 hover:text-ink" aria-label="Website"><Globe className="h-4 w-4" /></a>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────── Import a list ───────── */

function ImportFlow() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const write = async () => {
    setBusy(true); setErr("");
    const r = await campaignForTagAction(tag, who).catch(() => ({ ok: false as const, error: "Connection lost — try again." }));
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.push(`/app/email/${r.sequenceId}?ai=1&found=1`);
  };
  return (
    <div className="grid gap-4">
      <div className="card grid gap-3 p-6">
        <Field n={1} label="Upload your list">
          <p className="mb-3 text-[14px] text-stone-600">A CSV or Excel export works (name, email, company…), or paste the rows. Give it a tag like <i>“dubai directors”</i> so you can find them later.</p>
          <button onClick={() => setOpen(true)} className="btn-ghost h-11 w-fit px-5 text-[14px]"><Upload className="h-4 w-4" /> Upload or paste a list</button>
        </Field>
      </div>
      <div className="card grid gap-4 p-6">
        <Field n={2} label="Write a campaign for them">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="The tag you used — e.g. dubai directors" className={input} aria-label="Tag" maxLength={40} />
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Who they are — e.g. directors of software companies" className={input} aria-label="Who they are" maxLength={80} />
          </div>
        </Field>
        {err && <Alert text={err} />}
        <button onClick={write} disabled={busy || !tag.trim()} className="btn-primary h-12 w-fit px-6 text-[15px] disabled:opacity-40">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing the emails…</> : <><Sparkles className="h-4 w-4" /> Write campaign</>}</button>
        <p className="text-[12px] text-stone-500">You&apos;ll review the emails, then press Launch. Sending respects your mailbox&apos;s daily limit, adds an unsubscribe link and stops when someone replies.</p>
      </div>
      {open && <ImportDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function Field({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-white">{n}</span>{label}</p>
      {children}
    </div>
  );
}
function Alert({ text }: { text: string }) { return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{text}</p>; }
