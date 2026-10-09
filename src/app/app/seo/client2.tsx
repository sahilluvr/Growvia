"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Loader2, Plus, RefreshCw, Sparkles, Trash2, Send, Play, Users } from "lucide-react";
import { addKeywordsAction, addPromptsAction, checkSerpAction, deletePromptAction, removeKeywordAction, runExpertsAction, runGeoAction, saveSeoSettingsAction, sendReportNowAction, suggestKeywordsAction, suggestPromptsAction, syncRankingsAction, trackKeywordAction, type KeywordIdea } from "@/app/seo-actions";
import { Field, Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";
import { useJobs } from "@/components/app/Jobs";

type Res = { ok?: boolean; error?: string; message?: string; id?: string } | undefined;

/** A button that runs a server action, shows progress, then refreshes the page data. */
export function Run({ run, label, busy, icon = "refresh", ghost = true, job }: { run: () => Promise<Res>; label: string; busy: string; icon?: "refresh" | "sparkles" | "play" | "send" | "users"; ghost?: boolean; job?: string }) {
  const router = useRouter();
  const { jobs, track } = useJobs();
  const busyJob = Boolean(job) && jobs.some((j) => j.kind === job && (j.status === "queued" || j.status === "running"));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const I = { refresh: RefreshCw, sparkles: Sparkles, play: Play, send: Send, users: Users }[icon];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button disabled={pending || busyJob} onClick={() => start(async () => { const r = await run(); setMsg(r?.error ? { t: r.error, bad: true } : r?.message ? { t: r.message } : null); if (job && r?.id) track(r.id); router.refresh(); })} className={`${ghost ? "btn-ghost" : "btn-primary"} h-9 px-3.5 text-[13px] disabled:opacity-60`}>
        {pending || busyJob ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <I className={`h-3.5 w-3.5 ${ghost ? "" : "text-lime"}`} />} {busyJob ? "Running in the background…" : pending ? (job ? "Starting…" : busy) : label}
      </button>
      {msg && <span className={`text-[12px] ${msg.bad ? "text-red-600" : "text-stone-500"}`}>{msg.t}</span>}
    </span>
  );
}

export const SyncRankings = () => <Run run={syncRankingsAction} label="Update from Search Console" busy="Loading Google data…" />;
export const CheckSerp = () => <Run run={checkSerpAction} label="Check live Google positions" busy="Checking Google…" />;
export const RunGeo = () => <Run run={() => runGeoAction()} label="Ask AI assistants now" busy="Asking ChatGPT, Gemini… (up to a minute)" icon="play" ghost={false} job="geo_run" />;
export const RunExperts = ({ id }: { id: string }) => <Run run={() => runExpertsAction(id)} label="Ask the expert panel" busy="Experts are reviewing…" icon="users" ghost={false} job="seo_experts" />;

export function RemoveButton({ id, kind, label }: { id: string; kind: "keyword" | "prompt"; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await (kind === "keyword" ? removeKeywordAction(id) : deletePromptAction(id)); router.refresh(); })} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${label}`}><Trash2 className="h-3.5 w-3.5" /></button>;
}

function ListForm({ action, name, placeholder, submit, rows = 3 }: { action: (s: Res, f: FormData) => Promise<Res>; name: string; placeholder: string; submit: string; rows?: number }) {
  const [state, act] = useFormState(safe(action), undefined);
  const router = useRouter();
  const [v, setV] = useState("");
  useEffect(() => { if (state?.ok) { setV(""); router.refresh(); } }, [state, router]);
  return (
    <form action={act} className="grid gap-2">
      <textarea name={name} value={v} onChange={(e) => setV(e.target.value)} rows={rows} className={textareaCls} placeholder={placeholder} aria-label={placeholder} />
      <div className="flex flex-wrap items-center gap-2"><Submit className="btn-primary h-9 px-4 text-[13px]" pendingText="Adding…"><Plus className="h-3.5 w-3.5 text-lime" /> {submit}</Submit><Notice state={state} /></div>
    </form>
  );
}
export const AddKeywords = () => <ListForm action={addKeywordsAction} name="keywords" placeholder={"One keyword per line, e.g.\nitalian restaurant mohali\nbest pasta near me"} submit="Track keywords" />;
export const AddPrompts = () => <ListForm action={addPromptsAction} name="prompts" placeholder={"One question per line, the way a customer would ask ChatGPT, e.g.\nWhat's the best Italian restaurant in Mohali for a family dinner?"} submit="Add questions" />;

export function KeywordIdeas() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<KeywordIdea[] | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  // Instant first (cached, or Search Console + Google autocomplete), then AI ideas stream in.
  const load = () => start(async () => {
    setErr("");
    const q = await suggestKeywordsAction({ quick: true, fresh: Boolean(ideas) });
    if (q.error) setErr(q.error);
    setIdeas(q.ideas ?? []);
    if (q.more) {
      setMore(true);
      suggestKeywordsAction({ fresh: Boolean(ideas) }).then((r) => { if (r.ideas) setIdeas((cur) => { const seen = new Set((cur ?? []).map((i) => i.keyword)); return [...(cur ?? []), ...r.ideas!.filter((i) => !seen.has(i.keyword))]; }); }).catch(() => {}).finally(() => setMore(false));
    }
  });
  const chip = (s: KeywordIdea["source"]) => (s === "search console" ? "bg-lime/25 text-lime-800" : s === "ai" ? "bg-sky-50 text-sky-700" : "bg-mist text-stone-600");
  return (
    <div className="grid gap-3">
      <div><button onClick={load} disabled={pending} className="btn-ghost h-9 px-3.5 text-[13px]">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {ideas ? "Refresh ideas" : "Suggest keywords"}</button>{err && <span className="ml-2 text-[12px] text-red-600">{err}</span>}{more && <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-stone-500"><Loader2 className="h-3 w-3 animate-spin" /> adding AI ideas…</span>}</div>
      {err && /Upgrade to Pro/.test(err) && <UpgradeLink />}
      {ideas && (ideas.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {ideas.map((i) => (
            <li key={i.keyword} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1"><b className="font-medium">{i.keyword}</b> <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] ${chip(i.source)}`}>{i.source}</span>{(i.note || i.impressions) && <span className="block text-[12px] text-stone-500">{i.impressions ? `${i.impressions} impressions · position ${i.position}` : ""}{i.impressions && i.note ? " · " : ""}{i.note}</span>}</span>
              {added.includes(i.keyword) ? <span className="text-[12px] text-lime-700">Tracking ✓</span> : <button onClick={() => start(async () => { const r = await trackKeywordAction(i.keyword, i.source === "ai" ? "ai" : i.source === "search console" ? "gsc" : "suggest"); if (r?.error) { setErr(r.error); return; } setAdded((a) => [...a, i.keyword]); router.refresh(); })} className="btn-ghost h-8 px-3 text-[12px]"><Plus className="h-3 w-3" /> Track</button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-stone-500">No new ideas right now.</p>)}
    </div>
  );
}

export function PromptIdeas() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");
  const add = (list: string[]) => start(async () => { const f = new FormData(); f.set("prompts", list.join("\n")); const r = await addPromptsAction(undefined, f); if (r?.error) { setErr(r.error); return; } setErr(""); setIdeas((i) => i?.filter((x) => !list.includes(x)) ?? null); setPicked([]); router.refresh(); });
  const suggest = () => start(async () => {
    const q = await suggestPromptsAction({ quick: true, fresh: Boolean(ideas) });
    setIdeas(q.prompts ?? []); setPicked(q.prompts ?? []);
    if (q.more) {
      setMore(true);
      suggestPromptsAction({ fresh: Boolean(ideas) }).then((r) => { if (r.prompts?.length) { setIdeas(r.prompts); setPicked(r.prompts); } }).catch(() => {}).finally(() => setMore(false));
    }
  });
  return (
    <div className="grid gap-2">
      <div><button onClick={suggest} disabled={pending} className="btn-ghost h-9 px-3.5 text-[13px]">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Suggest questions customers ask AI</button>{more && <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-stone-500"><Loader2 className="h-3 w-3 animate-spin" /> tailoring them with AI…</span>}</div>
      {err && <p role="alert" className="text-[13px] text-red-600">{err} {/Upgrade to Pro/.test(err) && <UpgradeLink />}</p>}
      {ideas && ideas.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-line p-3">
          {ideas.map((q) => <label key={q} className="flex items-start gap-2 text-[13px]"><input type="checkbox" checked={picked.includes(q)} onChange={() => setPicked((p) => (p.includes(q) ? p.filter((x) => x !== q) : [...p, q]))} className="mt-0.5" /> {q}</label>)}
          <div><button disabled={pending || !picked.length} onClick={() => add(picked)} className="btn-primary h-9 px-4 text-[13px]"><Plus className="h-3.5 w-3.5 text-lime" /> Add {picked.length} selected</button></div>
        </div>
      )}
    </div>
  );
}

type Prefs = { audit?: string; geo?: string; engines?: string[]; report?: { freq: string; to: string[] }; competitors?: { name: string; domain?: string }[]; location?: string };
export function SettingsForm({ prefs, engines, mailReady, userEmail }: { prefs: Prefs; engines: { id: string; label: string; ready: boolean; key: string }[]; mailReady: boolean; userEmail: string }) {
  const [state, action] = useFormState(safe(saveSeoSettingsAction), undefined);
  const sel = (name: string, value: string, opts: [string, string][]) => <select name={name} defaultValue={value} className={inputCls}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  return (
    <form action={action} className="grid gap-5">
      <section className="card grid gap-4 p-5">
        <h3 className="text-[15px] font-semibold">Automatic tracking</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Re-audit the website">{sel("audit", prefs.audit ?? "weekly", [["daily", "Every day"], ["weekly", "Every week (recommended)"], ["monthly", "Every month"], ["off", "Off — only when I click"]])}</Field>
          <Field label="Check AI assistants">{sel("geo", prefs.geo ?? "weekly", [["daily", "Every day"], ["weekly", "Every week (recommended)"], ["off", "Off"]])}</Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">AI assistants to check</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {engines.map((e) => (
              <label key={e.id} className={`flex items-start gap-2 rounded-xl border border-line p-3 text-[13px] ${e.ready ? "" : "opacity-60"}`}>
                <input type="checkbox" name="engines" value={e.id} defaultChecked={e.ready && (!prefs.engines?.length || prefs.engines.includes(e.id))} disabled={!e.ready} className="mt-0.5" />
                <span><b className="font-medium">{e.label}</b><span className="block text-[12px] text-stone-500">{e.ready ? "Ready" : `Add ${e.key} in Vercel`}</span></span>
              </label>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-stone-500">Keyword positions update every day automatically when Google Search Console is connected.</p>
      </section>
      <section className="card grid gap-4 p-5">
        <h3 className="text-[15px] font-semibold">Competitors &amp; location</h3>
        <p className="text-[13px] text-stone-600">{(prefs.competitors ?? []).length ? `Tracking ${(prefs.competitors ?? []).map((c) => c.name).slice(0, 4).join(", ")}${(prefs.competitors ?? []).length > 4 ? "…" : ""}. ` : ""}<a href="/app/competitors" className="font-medium underline decoration-lime decoration-2 underline-offset-4">Manage competitors →</a> (Google, Maps, reviews and AI, head-to-head)</p>
        <Field label="Location for rankings" hint="optional — e.g. Mohali, Punjab, India"><input name="location" defaultValue={prefs.location ?? ""} className={inputCls} /></Field>
      </section>
      <section className="card grid gap-4 p-5">
        <h3 className="text-[15px] font-semibold">Email reports</h3>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <Field label="Send">{sel("report_freq", prefs.report?.freq ?? "off", [["weekly", "Every Monday"], ["monthly", "Every month"], ["off", "Don't send"]])}</Field>
          <Field label="To (comma separated)"><input name="report_to" defaultValue={(prefs.report?.to ?? [userEmail]).join(", ")} className={inputCls} placeholder="you@company.com, client@example.com" /></Field>
        </div>
        {!mailReady && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">To send emails, add <b>RESEND_API_KEY</b> and <b>EMAIL_FROM</b> in Vercel (free at resend.com).</p>}
      </section>
      <div className="flex items-center gap-3"><Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Saving…">Save settings</Submit><Notice state={state} /></div>
    </form>
  );
}

export function RangePicker({ from, to, preset }: { from: string; to: string; preset: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const go = (q: Record<string, string>) => router.push(`/app/seo?${new URLSearchParams({ tab: "reports", ...q })}`);
  const presets: [string, string][] = [["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["month", "This month"], ["lastmonth", "Last month"]];
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {presets.map(([k, l]) => <button key={k} onClick={() => go({ preset: k })} className={`rounded-full border px-3 py-1.5 text-[13px] ${preset === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600 hover:border-stone-400"}`}>{l}</button>)}
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-[13px]">
        <input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} className="bg-transparent outline-none" aria-label="Report start date" /> –
        <input type="date" value={t} min={f} onChange={(e) => setT(e.target.value)} className="bg-transparent outline-none" aria-label="Report end date" />
        <button onClick={() => go({ preset: "custom", from: f, to: t })} className={`rounded-full px-2.5 py-0.5 ${preset === "custom" ? "bg-ink text-white" : "bg-mist"}`}>Apply</button>
      </span>
    </div>
  );
}

export const SendReport = ({ from, to }: { from: string; to: string }) => <Run run={() => sendReportNowAction(from, to)} label="Email this report" busy="Sending…" icon="send" />;

function UpgradeLink() {
  return <a href="/app/billing#upgrade" className="ml-1 inline-flex items-center rounded-full bg-lime px-2.5 py-0.5 text-[12px] font-medium text-ink">See Pro</a>;
}
