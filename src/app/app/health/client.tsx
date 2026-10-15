"use client";
import { safe } from "@/lib/client/safe-action";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Check, Copy, ExternalLink, Loader2, Search, ShieldCheck } from "lucide-react";
import { Run } from "../seo/client2";
import { addDomainAction, checkDomainAction, cleanEmailListAction, cleanPhonesAction, cloudflareFixAction, domainIdeasAction, recheckAllAction, removeDomainAction, resumeMailboxAction, resumeNumberAction, setDailyLimitAction, setWarmupAction } from "@/app/health-actions";
import { Notice, Submit, inputCls } from "@/components/ui/Form";
import type { DomainIdea } from "@/lib/health/registrar";

export const RecheckAll = () => <Run run={recheckAllAction} label="Check everything now" busy="Checking mailboxes, domains and numbers…" />;
export const VerifyDomain = ({ domain }: { domain: string }) => <Run run={() => checkDomainAction(domain)} label="Check again" busy="Reading DNS…" ghost={false} />;
export const ResumeMailbox = ({ id }: { id: string }) => <Run run={() => resumeMailboxAction(id)} label="I've fixed it — resume" busy="Resuming…" ghost={false} />;
export const ResumeNumber = ({ id }: { id: string }) => <Run run={() => resumeNumberAction(id)} label="Resume broadcasts anyway" busy="Resuming…" />;

export function CopyValue({ value, label = "Copy" }: { value: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-white px-2 text-[12px] text-stone-600 hover:border-ink" aria-label={`${label} ${value.slice(0, 30)}`}>
      {ok ? <Check className="h-3.5 w-3.5 text-lime-700" /> : <Copy className="h-3.5 w-3.5" />} {ok ? "Copied" : label}
    </button>
  );
}

export function WarmupControl({ id, enabled, dailyLimit }: { id: string; enabled: boolean; dailyLimit: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [preset, setPreset] = useState<"new" | "steady">("new");
  const [limit, setLimit] = useState(dailyLimit);
  const go = (fn: () => Promise<{ error?: string; message?: string } | undefined>) => start(async () => { const r = await fn(); setMsg(r?.error ? { t: r.error, bad: true } : r?.message ? { t: r.message } : null); router.refresh(); });
  return (
    <div className="grid gap-2" data-testid={`warmup-${id}`}>
      {!enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={preset} onChange={(e) => setPreset(e.target.value as "new" | "steady")} className={`${inputCls} h-9 w-auto text-[13px]`} aria-label="Warm-up speed">
            <option value="new">New mailbox or domain — 10/day, +3 a day</option>
            <option value="steady">Used for normal email — 25/day, +5 a day</option>
          </select>
          <button disabled={pending} onClick={() => go(() => setWarmupAction(id, true, preset))} className="btn-primary h-9 px-3.5 text-[13px]">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-lime" />} Start safe warm-up</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <label className="flex items-center gap-2">Full daily limit
          <input type="number" min={1} max={2000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${inputCls} h-8 w-20 text-[13px]`} aria-label="Daily limit" />
        </label>
        {limit !== dailyLimit && <button disabled={pending} onClick={() => go(() => setDailyLimitAction(id, limit))} className="btn-ghost h-8 px-3 text-[12px]">Save</button>}
        {enabled && <button disabled={pending} onClick={() => go(() => setWarmupAction(id, false))} className="text-[12px] text-stone-500 underline">Turn warm-up off</button>}
      </div>
      {msg && <p className={`text-[12px] ${msg.bad ? "text-red-600" : "text-lime-800"}`}>{msg.t}</p>}
    </div>
  );
}

export function ListCleaner({ kind }: { kind: "email" | "phone" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cc, setCc] = useState("91");
  const [res, setRes] = useState<{ ok?: boolean; error?: string; message?: string; examples?: { why: string; email?: string; phone?: string }[] } | null>(null);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {kind === "phone" && <label className="flex items-center gap-1.5 text-[13px]">Default country code <input value={cc} onChange={(e) => setCc(e.target.value.replace(/\D/g, "").slice(0, 4))} className={`${inputCls} h-9 w-16 text-[13px]`} aria-label="Default country code" /></label>}
        <button disabled={pending} onClick={() => start(async () => { const r = kind === "email" ? await cleanEmailListAction() : await cleanPhonesAction(cc || "91"); setRes(r ?? null); router.refresh(); })} className="btn-primary h-9 px-4 text-[13px]">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-lime" />} {pending ? "Checking…" : kind === "email" ? "Check my contact list" : "Check phone numbers"}
        </button>
      </div>
      {res && <Notice state={res} />}
      {res?.examples?.length ? <ul className="grid gap-0.5 text-[12px] text-stone-600">{res.examples.map((x, i) => <li key={i}><span className="font-mono">{x.email ?? x.phone}</span> — {x.why}</li>)}</ul> : null}
    </div>
  );
}

export function AddDomain() {
  const [state, action] = useFormState(safe(addDomainAction), undefined);
  return (
    <form action={action} className="flex flex-wrap items-start gap-2" data-testid="add-domain">
      <input name="domain" required placeholder="yourbusiness.com" className={`${inputCls} h-10 w-56`} aria-label="Domain" />
      <Submit className="btn-primary h-10 px-4 text-[13px]" pendingText="Checking…">Check domain</Submit>
      <div className="w-full"><Notice state={state} /></div>
    </form>
  );
}

export function RemoveDomain({ domain }: { domain: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => { if (confirm(`Stop checking ${domain}?`)) start(async () => { await removeDomainAction(domain); router.refresh(); }); }} className="text-[12px] text-stone-400 hover:text-red-600">Remove</button>;
}

export function CloudflareFix({ domain }: { domain: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok?: boolean; error?: string; message?: string } | null>(null);
  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost h-9 px-3.5 text-[13px]">Fix automatically on Cloudflare</button>;
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-paper p-3 text-[13px]">
      <p>Create a token at <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener" className="underline">Cloudflare → My Profile → API Tokens</a> → Create Token → template <b>“Edit zone DNS”</b> → pick {domain}. Paste it here. Growvia uses it once and doesn&apos;t save it.</p>
      <div className="flex flex-wrap gap-2">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={`${inputCls} h-9 min-w-0 flex-1 text-[13px]`} placeholder="Cloudflare API token" aria-label="Cloudflare API token" autoComplete="off" />
        <button disabled={pending || !token} onClick={() => start(async () => { const r = await cloudflareFixAction(domain, token); setRes(r ?? null); if (r?.ok) { setToken(""); router.refresh(); } })} className="btn-primary h-9 px-4 text-[13px]">{pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add records</button>
      </div>
      {res && <Notice state={res} />}
    </div>
  );
}

export function DomainFinder({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [pending, start] = useTransition();
  const [ideas, setIdeas] = useState<DomainIdea[] | null>(null);
  const [error, setError] = useState("");
  const search = () => start(async () => { setError(""); const r = await domainIdeasAction(q); if (r.error) setError(r.error); setIdeas(r.ideas ?? null); });
  return (
    <div className="grid gap-3" data-testid="domain-finder">
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className={`${inputCls} h-10 min-w-0 flex-1`} placeholder="Business name or a domain" aria-label="Find a domain" />
        <button disabled={pending} onClick={search} className="btn-primary h-10 px-4 text-[13px]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-lime" />} Find domains</button>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      {ideas && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {ideas.map((d) => (
            <li key={d.domain} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[14px]">
              <span className="font-medium">{d.domain} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${d.available === true ? "bg-lime/25 text-lime-800" : d.available === false ? "bg-mist text-stone-500" : "bg-amber-50 text-amber-800"}`}>{d.available === true ? "Available" : d.available === false ? "Taken" : "Check at registrar"}</span></span>
              {d.available !== false && <span className="flex flex-wrap gap-1.5">{d.buy.map((b) => <a key={b.name} href={b.url} target="_blank" rel="noopener" className="btn-ghost h-8 px-2.5 text-[12px]">{b.name} <ExternalLink className="h-3 w-3" /></a>)}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-stone-500">Tip: short and easy to say out loud wins. .com and .in are the most trusted in India. After buying, add it above and Growvia shows exactly what to set up.</p>
    </div>
  );
}
