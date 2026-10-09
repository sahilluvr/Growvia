"use client";
import { safe } from "@/lib/client/safe-action";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { sendBroadcastAction } from "@/app/email-actions";
import { EmailEditor } from "@/components/app/EmailEditor";
import { Notice, Submit, inputCls } from "@/components/ui/Form";
import { STAGE_META } from "@/lib/format";

type L = { id: string; name: string; email: string | null; tags: string[]; stage: string; ok: boolean };
type Mode = "all" | "tag" | "stage" | "ids";

export function ComposeForm({ businessName, leads, mailboxes, templates, initial }: {
  businessName: string; leads: L[]; mailboxes: { id: string; label: string; limit: number | null }[];
  templates: { id: string; name: string; subject: string; body: string }[]; initial: { ids: string[]; tag: string };
}) {
  const [state, action] = useFormState(safe(sendBroadcastAction), undefined);
  const [mode, setMode] = useState<Mode>(initial.ids.length ? "ids" : initial.tag ? "tag" : "all");
  const tags = useMemo(() => Array.from(new Set(leads.flatMap((l) => l.tags))).sort(), [leads]);
  const [tag, setTag] = useState(initial.tag || tags[0] || "");
  const [stages, setStages] = useState<string[]>(["new", "contacted", "qualified"]);
  const [picked, setPicked] = useState<string[]>(initial.ids);
  const [q, setQ] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [at, setAt] = useState("");
  const [tpl, setTpl] = useState({ subject: "", body: "Hi {{first_name}},\n\n\n\n{{sender_name}}", key: 0 });

  useEffect(() => { if (state?.ok) { setTpl((t) => ({ subject: "", body: "Hi {{first_name}},\n\n\n\n{{sender_name}}", key: t.key + 1 })); setSchedule(false); setAt(""); } }, [state]);

  const audience = leads.filter((l) => mode === "all" || (mode === "tag" && l.tags.includes(tag)) || (mode === "stage" && stages.includes(l.stage)) || (mode === "ids" && picked.includes(l.id)));
  const reachable = audience.filter((l) => l.ok).length;
  const skipped = audience.length - reachable;
  const matches = q.trim() ? leads.filter((l) => l.ok && !picked.includes(l.id) && `${l.name} ${l.email}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const limit = mailboxes[0]?.limit ?? null;

  if (!mailboxes.length) return (
    <div className="card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[14px] text-stone-600"><b className="text-ink">Connect a mailbox first.</b> Emails go out from your own address, so replies land in your Growvia inbox.</p>
      <Link href="/app/settings?tab=email" className="btn-primary h-10 px-4 text-[14px]">Connect mailbox</Link>
    </div>
  );

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="card grid gap-4 p-5">
        {templates.length > 0 && (
          <select aria-label="Start from template" value="" className={`${inputCls} h-10 max-w-xs text-[13px]`} onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setTpl((p) => ({ subject: t.subject, body: t.body, key: p.key + 1 })); }}>
            <option value="">Start from a template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <EmailEditor key={tpl.key} subject={tpl.subject} body={tpl.body} businessName={businessName} ai={{ purpose: "a one-off email sent to many leads (newsletter / announcement / offer)" }} />
      </div>

      <aside className="grid content-start gap-4">
        <div className="card grid gap-3 p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold"><Users className="h-4 w-4" /> Who gets it</p>
          <input type="hidden" name="mode" value={mode} />
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Audience">
            {([["all", "Everyone"], ["tag", "A tag"], ["stage", "Pipeline stage"], ["ids", "Pick people"]] as [Mode, string][]).map(([m, l]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`rounded-lg border px-2.5 py-2 text-[13px] ${mode === m ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{l}</button>
            ))}
          </div>
          {mode === "tag" && (tags.length ? (
            <select name="tag" value={tag} onChange={(e) => setTag(e.target.value)} className={`${inputCls} h-10`} aria-label="Tag">
              {tags.map((t) => <option key={t}>{t}</option>)}
            </select>
          ) : <p className="text-[13px] text-stone-500">No tags yet — add tags to leads first.</p>)}
          {mode === "stage" && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STAGE_META).map(([k, m]) => (
                <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${stages.includes(k) ? "border-ink" : "border-line text-stone-500"}`}>
                  <input type="checkbox" name="stages" value={k} checked={stages.includes(k)} onChange={(e) => setStages((s) => e.target.checked ? [...s, k] : s.filter((x) => x !== k))} className="sr-only" />
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />{m.label}
                </label>
              ))}
            </div>
          )}
          {mode === "ids" && (
            <div className="grid gap-2">
              <input type="hidden" name="ids" value={picked.join(",")} />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-10 pl-9`} placeholder="Search leads by name or email" aria-label="Search leads" />
              </div>
              {matches.map((l) => (
                <button key={l.id} type="button" onClick={() => { setPicked((p) => [...p, l.id]); setQ(""); }} className="rounded-lg border border-line bg-white px-3 py-2 text-left text-[13px] hover:border-ink">
                  {l.name} <span className="text-stone-400">{l.email}</span>
                </button>
              ))}
              <div className="flex flex-wrap gap-1.5">
                {picked.map((id) => { const l = leads.find((x) => x.id === id); return l ? (
                  <button key={id} type="button" onClick={() => setPicked((p) => p.filter((x) => x !== id))} className="rounded-full bg-mist px-2.5 py-1 text-[12px]" aria-label={`Remove ${l.name}`}>{l.name} ×</button>
                ) : null; })}
              </div>
            </div>
          )}
          <p className="rounded-lg bg-mist px-3 py-2 text-[13px]" data-testid="audience-count">
            <b className="tabular-nums">{reachable}</b> {reachable === 1 ? "person" : "people"} will get this{skipped ? <span className="text-stone-500"> · {skipped} skipped (no email, unsubscribed or bounced)</span> : null}
          </p>
        </div>

        <div className="card grid gap-3 p-5">
          <label className="block"><span className="text-[13px] font-medium">Send from</span>
            <select name="mailbox_id" className={`${inputCls} mt-1.5 h-10`}>{mailboxes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-stone-600"><input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} /> Schedule for later</label>
          {schedule && (
            <>
              {/* Browser-local time → ISO, so the server (UTC) sends at the right moment. */}
              <input type="datetime-local" required className={`${inputCls} h-10 text-[13px]`} aria-label="Send at" onChange={(e) => setAt(e.target.value ? new Date(e.target.value).toISOString() : "")} />
              <input type="hidden" name="schedule_at" value={at} />
            </>
          )}
          {limit && reachable > limit && <p className="text-[12px] text-amber-700">Your mailbox sends up to {limit} emails a day, so this will go out over {Math.ceil(reachable / limit)} days automatically.</p>}
          <Notice state={state} />
          <Submit className="btn-primary h-11 w-full text-[14px]" pendingText={schedule ? "Scheduling…" : "Sending…"}>{schedule ? "Schedule email" : `Send to ${reachable} ${reachable === 1 ? "person" : "people"}`}</Submit>
          <p className="text-[12px] text-stone-400">Every email is personalised, includes an unsubscribe link, and replies arrive in your Growvia inbox.</p>
        </div>
      </aside>
    </form>
  );
}
