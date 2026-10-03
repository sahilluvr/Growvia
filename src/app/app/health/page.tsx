import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, Globe2, Info, Mail, MessageCircle, PauseCircle, XCircle } from "lucide-react";
import { withProject } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { timeAgo } from "@/lib/format";
import { gscReady } from "@/lib/google/gsc";
import { cleanDomain, domainOf, isFreeDomain, PROVIDER_LABEL, type Check, type DomainReport } from "@/lib/health/domain";
import { warmupPlan, type Health, type MailboxH, type Reason } from "@/lib/health/email";
import { domainReport, refreshMailboxHealth } from "@/lib/health/jobs";
import { refreshWaHealth, type WaHealth } from "@/lib/health/whatsapp";
import type { PmDay } from "@/lib/google/postmaster";
import type { ChannelAccount } from "@/lib/meta/channels";
import { AddDomain, CloudflareFix, CopyValue, DomainFinder, ListCleaner, RecheckAll, RemoveDomain, ResumeMailbox, ResumeNumber, VerifyDomain, WarmupControl } from "./client";

export const metadata: Metadata = { title: "Sending health" };
export const maxDuration = 60;

const TABS = [["overview", "Overview"], ["email", "Email"], ["whatsapp", "WhatsApp"], ["domains", "Domains"]] as const;
const TONE = { good: "text-lime-700 bg-lime/20", new: "text-sky-700 bg-sky-50", watch: "text-amber-800 bg-amber-50", risk: "text-red-700 bg-red-50" } as const;
const LABEL = { good: "Healthy", new: "Not much sending yet", watch: "Needs attention", risk: "At risk" } as const;

function Ring({ score, size = 56 }: { score: number; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, color = score >= 80 ? "#65a30d" : score >= 60 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score} out of 100`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ecebe6" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight="600" fill="#0b0d0c">{score}</text>
    </svg>
  );
}
const Dot = ({ s }: { s: Check["status"] }) => (s === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-600" /> : s === "bad" ? <XCircle className="h-4 w-4 shrink-0 text-red-600" /> : s === "warn" ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : <CircleDashed className="h-4 w-4 shrink-0 text-stone-400" />);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "–");

function ReasonList({ reasons }: { reasons: Reason[] }) {
  if (!reasons.length) return <p className="flex items-center gap-2 text-[13px] text-lime-800"><CheckCircle2 className="h-4 w-4" /> Nothing to fix.</p>;
  return (
    <ul className="grid gap-1.5">
      {reasons.map((r, i) => (
        <li key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] ${r.level === "bad" ? "bg-red-50 text-red-900" : r.level === "warn" ? "bg-amber-50 text-amber-950" : "bg-mist text-stone-700"}`}>
          {r.level === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{r.text}</span>
          {r.fix && <Link href={r.fix.href} className="shrink-0 font-medium underline underline-offset-2">{r.fix.label}</Link>}
        </li>
      ))}
    </ul>
  );
}

export default async function HealthPage({ searchParams }: { searchParams: { tab?: string; d?: string; postmaster?: string; google_error?: string } }) {
  const db = supabaseServer();
  const tab = TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab! : "overview";
  // Everything loads in one round trip with the login check (row-level security scopes each query).
  const { business, user, data: [first, second, domsQ, linkQ, leadsQ] } = await withProject((id) => Promise.all([
    db.from("mailboxes").select("*").order("created_at"),
    db.from("channel_accounts").select("*").eq("provider", "whatsapp").order("created_at"),
    db.from("sender_domains").select("*").order("created_at"),
    db.from("postmaster_links").select("owner_id, email, domains, synced_at, error"),
    db.from("leads").select("email, email_status, phone, wa_id, wa_opt_in").eq("business_id", id).limit(20000),
  ]));
  const owner = business.owner_id ?? user.id;
  let { data: mbs } = first, { data: nums } = second;
  // First visit: check right away so the page is never empty.
  const fresh = (mbs ?? []).filter((m) => !m.health?.checked_at) as MailboxH[];
  const freshNums = (nums ?? []).filter((n) => !n.meta?.health?.checked_at) as ChannelAccount[];
  if (fresh.length || freshNums.length) {
    await Promise.all([...fresh.slice(0, 5).map((m) => refreshMailboxHealth(db, m).catch(() => null)), ...freshNums.slice(0, 3).map((n) => refreshWaHealth(db, n).catch(() => null))]);
    // (a slightly different query, so Next's per-request fetch de-duplication doesn't hand back the first result)
    // (mailbox checks also record the sending domain, so reload domains too)
    let d2;
    [{ data: mbs }, { data: nums }, { data: d2 }] = await Promise.all([db.from("mailboxes").select("*").order("created_at").limit(500), db.from("channel_accounts").select("*").eq("provider", "whatsapp").order("created_at").limit(500), db.from("sender_domains").select("*").order("created_at").limit(500)]);
    domsQ.data = d2 ?? domsQ.data;
  }
  const site = business.website ? cleanDomain(business.website) : null;
  let doms = (domsQ.data ?? []).filter((d) => d.owner_id === owner);
  // First visit only: check the website's domain too (a fresh query, so it isn't de-duplicated with the one above).
  if (site && !isFreeDomain(site) && !/^[\d.]+$/.test(site.split(":")[0]) && !doms.some((d) => d.domain === site)) {
    await domainReport(db, owner, site, null, 20).catch(() => null);
    doms = ((await db.from("sender_domains").select("*").eq("owner_id", owner).order("created_at").limit(200)).data ?? []);
  }
  const link = (linkQ.data ?? []).find((l) => l.owner_id === owner) ?? null;
  const leadRows = leadsQ.data;
  const mailboxes = (mbs ?? []) as MailboxH[];
  const numbers = (nums ?? []) as ChannelAccount[];
  const domains = (doms ?? []) as { domain: string; checks: DomainReport; postmaster: { days?: PmDay[]; error?: string | null } | null; checked_at: string | null }[];
  const leads = leadRows ?? [];
  const L = { emails: leads.filter((l) => l.email).length, bounced: leads.filter((l) => l.email_status === "bounced").length, invalid: leads.filter((l) => l.email_status === "invalid").length, risky: leads.filter((l) => l.email_status === "risky").length, phones: leads.filter((l) => l.phone).length, wa: leads.filter((l) => l.wa_id).length, opt: leads.filter((l) => l.wa_opt_in).length };

  // Everything that needs doing, worst first.
  type Issue = Reason & { where: string };
  const issues: Issue[] = [];
  for (const m of mailboxes) {
    if (m.health?.paused) issues.push({ level: "bad", where: m.from_email, text: `Campaigns paused: ${m.health.paused_reason}.`, fix: { label: "Review", href: "/app/health?tab=email" } });
    for (const r of (m.health?.reasons ?? []) as Reason[]) if (r.level !== "info" && !/^(SPF|DKIM|DMARC|No MX|Two|On a spam|MX)/.test(r.text)) issues.push({ ...r, where: m.from_email });
  }
  for (const d of domains) for (const c of d.checks?.checks ?? []) if (c.status === "bad") issues.push({ level: c.id === "blocklist" ? "bad" : "warn", where: d.domain, text: `${c.title} — ${c.detail}`, fix: { label: "Fix", href: `/app/health?tab=domains&d=${d.domain}` } });
  for (const n of numbers) for (const r of ((n.meta?.health as WaHealth | undefined)?.reasons ?? [])) if (r.level !== "info") issues.push({ ...r, where: n.phone_display ?? n.name });
  if (L.invalid + L.bounced > 0 && L.emails) issues.push({ level: "info", where: "Contacts", text: `${L.invalid + L.bounced} of ${L.emails} email addresses can't receive email — campaigns skip them automatically.` });
  issues.sort((a, b) => ({ bad: 0, warn: 1, info: 2 }[a.level] - { bad: 0, warn: 1, info: 2 }[b.level]));

  const emailScore = mailboxes.length ? Math.round(mailboxes.reduce((s, m) => s + (m.health?.score ?? 0), 0) / mailboxes.length) : null;
  const waWorst = numbers.map((n) => (n.meta?.health as WaHealth | undefined)?.quality ?? "UNKNOWN").sort((a, b) => ["RED", "YELLOW", "UNKNOWN", "GREEN"].indexOf(a) - ["RED", "YELLOW", "UNKNOWN", "GREEN"].indexOf(b))[0];
  const domOk = domains.filter((d) => !(d.checks?.checks ?? []).some((c) => c.status === "bad")).length;

  return (
    <>
      <PageHeader title="Sending health" sub="Make sure your emails and WhatsApp messages actually arrive — checked every day, with plain-English fixes.">
        <RecheckAll />
      </PageHeader>
      {searchParams.google_error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{searchParams.google_error === "setup" ? "Google sign-in isn't set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel." : searchParams.google_error}</p>}
      {searchParams.postmaster && <p className="mb-4 rounded-xl bg-lime/20 px-4 py-3 text-[14px] text-lime-900">{searchParams.postmaster === "0" ? "Connected, but this Google account has no verified domains in Postmaster Tools yet — add your domain at postmaster.google.com." : `Gmail Postmaster Tools connected (${searchParams.postmaster} domain${searchParams.postmaster === "1" ? "" : "s"}). Data appears after the next check.`}</p>}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Link href="/app/health?tab=email" className="card flex items-center gap-3 p-4 hover:border-ink">
          {emailScore != null ? <Ring score={emailScore} /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-mist"><Mail className="h-5 w-5 text-stone-400" /></span>}
          <div><p className="text-[13px] text-stone-500">Email</p><p className="text-[15px] font-semibold">{mailboxes.length ? `${mailboxes.length} mailbox${mailboxes.length === 1 ? "" : "es"}${mailboxes.some((m) => m.health?.paused) ? " · paused" : ""}` : "No mailbox yet"}</p></div>
        </Link>
        <Link href="/app/health?tab=whatsapp" className="card flex items-center gap-3 p-4 hover:border-ink">
          <span className={`grid h-14 w-14 place-items-center rounded-full ${waWorst === "GREEN" ? "bg-lime/25 text-lime-800" : waWorst === "YELLOW" ? "bg-amber-50 text-amber-700" : waWorst === "RED" ? "bg-red-50 text-red-700" : "bg-mist text-stone-400"}`}><MessageCircle className="h-5 w-5" /></span>
          <div><p className="text-[13px] text-stone-500">WhatsApp</p><p className="text-[15px] font-semibold">{numbers.length ? `Quality ${waWorst === "GREEN" ? "high" : waWorst === "YELLOW" ? "medium" : waWorst === "RED" ? "low" : "unknown"}` : "No number yet"}</p></div>
        </Link>
        <Link href="/app/health?tab=domains" className="card flex items-center gap-3 p-4 hover:border-ink">
          <span className={`grid h-14 w-14 place-items-center rounded-full ${domains.length && domOk === domains.length ? "bg-lime/25 text-lime-800" : domains.length ? "bg-amber-50 text-amber-700" : "bg-mist text-stone-400"}`}><Globe2 className="h-5 w-5" /></span>
          <div><p className="text-[13px] text-stone-500">Domains</p><p className="text-[15px] font-semibold">{domains.length ? `${domOk} of ${domains.length} set up` : "None yet"}</p></div>
        </Link>
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sending health sections">
        {TABS.map(([k, l]) => <Link key={k} href={`/app/health?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14px] ${tab === k ? "border-ink font-medium text-ink" : "border-transparent text-stone-500 hover:text-ink"}`}>{l}{k === "overview" && issues.filter((i) => i.level !== "info").length ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">{issues.filter((i) => i.level !== "info").length}</span> : null}</Link>)}
      </nav>

      {tab === "overview" && (
        <section className="card grid gap-3 p-5" data-testid="issues">
          <h2 className="text-[16px] font-semibold tracking-tight">{issues.filter((i) => i.level !== "info").length ? "Fix these, most important first" : "All good"}</h2>
          {issues.length ? (
            <ul className="grid gap-2">
              {issues.map((i, k) => (
                <li key={k} className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center ${i.level === "bad" ? "border-red-200 bg-red-50/50" : i.level === "warn" ? "border-amber-200 bg-amber-50/40" : "border-line"}`}>
                  <span className="flex flex-1 items-start gap-2 text-[14px]">{i.level === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" /> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${i.level === "bad" ? "text-red-600" : "text-amber-600"}`} />}<span><b className="font-medium">{i.where}:</b> {i.text}</span></span>
                  {i.fix && <Link href={i.fix.href} className="btn-ghost h-8 shrink-0 px-3 text-[12px]">{i.fix.label}</Link>}
                </li>
              ))}
            </ul>
          ) : <p className="text-[14px] text-stone-500">{mailboxes.length || numbers.length ? "Your mailboxes, domains and numbers look healthy. Growvia checks every day and emails you if anything changes." : "Connect a mailbox (Settings) or a WhatsApp number (Channels) to start monitoring."}</p>}
          {!mailboxes.length && <Link href="/app/settings?tab=email" className="btn-primary h-9 w-fit px-4 text-[13px]">Connect a mailbox</Link>}
        </section>
      )}

      {tab === "email" && (
        <div className="grid gap-5">
          {!mailboxes.length && <section className="card p-6 text-[14px] text-stone-600">No mailbox connected yet. <Link href="/app/settings?tab=email" className="font-medium underline">Connect one in Settings</Link> — Growvia then checks its health every day.</section>}
          {mailboxes.map((m) => {
            const h = (m.health ?? {}) as Partial<Health>, s = h.stats, w = warmupPlan(m);
            const d = domains.find((x) => x.domain === domainOf(m.from_email));
            return (
              <section key={m.id} className="card grid gap-4 p-5" data-testid={`mailbox-${m.from_email}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <Ring score={h.score ?? 0} size={64} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{m.from_email}</p>
                    <p className="text-[13px] text-stone-500">{PROVIDER_LABEL[d?.checks?.provider ?? "other"]} · checked {h.checked_at ? timeAgo(h.checked_at) : "never"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${h.paused ? "bg-red-50 text-red-700" : TONE[h.status ?? "new"]}`}>{h.paused ? "Campaigns paused" : LABEL[h.status ?? "new"]}</span>
                </div>
                {h.paused && (
                  <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-900 sm:flex-row sm:items-center">
                    <PauseCircle className="h-5 w-5 shrink-0" />
                    <p className="flex-1"><b>Campaigns from this mailbox are paused</b> — {h.paused_reason}. Sending more now could get it blocked. Clean your list below, then resume. One-to-one emails still work.</p>
                    <ResumeMailbox id={m.id} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-5">
                  {[["Sent (30 days)", s ? s.sent30.toLocaleString("en-IN") : "–", ""], ["Bounced (7 days)", s ? pct(s.bounced7, s.tried7) : "–", "under 2%"], ["Replies", s ? pct(s.replies30, s.sent30) : "–", ""], ["Unsubscribed", s ? pct(s.unsubs30, s.sent30) : "–", "under 1%"], ["Gmail spam rate", h.spamRate != null ? `${(h.spamRate * 100).toFixed(2)}%` : "–", h.reputation ? `reputation ${h.reputation.toLowerCase()}` : "connect Postmaster"]].map(([k, v, hint]) => (
                    <div key={k} className="rounded-xl bg-paper p-3"><div className="text-stone-500">{k}</div><div className="text-[18px] font-semibold tabular-nums">{v}</div>{hint && <div className="text-[11px] text-stone-400">{hint}</div>}</div>
                  ))}
                </div>
                {d && !d.checks?.free && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    {(d.checks?.checks ?? []).map((c) => <span key={c.id} className="inline-flex items-center gap-1.5"><Dot s={c.status} /> {c.id === "blocklist" ? "Blocklists" : c.id.toUpperCase()}</span>)}
                    <Link href={`/app/health?tab=domains&d=${d.domain}`} className="ml-auto text-[12px] underline">Domain setup →</Link>
                  </div>
                )}
                <ReasonList reasons={(h.reasons ?? []) as Reason[]} />
                <div className="grid gap-2 rounded-xl border border-line p-4">
                  <p className="text-[14px] font-medium">Safe warm-up {w.active ? <span className="ml-1 rounded-full bg-lime/25 px-2 py-0.5 text-[12px] font-medium text-lime-800">day {w.day}: {w.limit}/day</span> : m.warmup?.enabled ? <span className="ml-1 rounded-full bg-mist px-2 py-0.5 text-[12px]">complete</span> : null}</p>
                  <p className="text-[13px] text-stone-600">{w.active ? `Campaigns send up to ${w.limit} emails today, rising to ${w.target}/day by ${w.doneOn}. It holds automatically if bounces or complaints rise.` : "New mailboxes that suddenly send hundreds of emails look like spammers. Warm-up raises the daily limit gradually with your real campaign emails — no fake email networks, so it's safe with Gmail and Outlook rules."}</p>
                  <WarmupControl id={m.id} enabled={Boolean(m.warmup?.enabled)} dailyLimit={m.daily_limit} />
                </div>
              </section>
            );
          })}
          <section className="card grid gap-3 p-5" id="list">
            <h2 className="text-[15px] font-semibold">Check your contact list before sending</h2>
            <p className="text-[13px] text-stone-600">Finds addresses that would bounce — typos like gmial.com (fixed automatically), domains with no mail server, temporary addresses — and keeps campaigns away from them. Bounces are the #1 reason mailboxes get blocked.</p>
            <p className="text-[13px]"><b>{L.emails}</b> emails · <span className="text-red-700">{L.bounced} bounced</span> · <span className="text-red-700">{L.invalid} invalid</span> · <span className="text-amber-700">{L.risky} temporary</span></p>
            <ListCleaner kind="email" />
          </section>
          <section className="card grid gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Google&apos;s view of your emails (Gmail Postmaster Tools)</h2>
            <p className="text-[13px] text-stone-600">Free from Google: your domain&apos;s reputation and how many Gmail users mark you as spam. Add your domain at <a href="https://postmaster.google.com" target="_blank" rel="noopener" className="underline">postmaster.google.com</a> (it gives you one TXT record), then connect here. Google shows data once you send about 100+ emails a day to Gmail users.</p>
            {link ? <p className="text-[13px]">Connected as <b>{link.email}</b> · {link.domains.length} domain{link.domains.length === 1 ? "" : "s"}{link.synced_at ? ` · updated ${timeAgo(link.synced_at)}` : ""}{link.error ? <span className="text-red-700"> · {link.error}</span> : null} · <a href="/api/oauth/google/start?for=postmaster" className="underline">reconnect</a></p>
              : <div><a href="/api/oauth/google/start?for=postmaster" className={`btn-primary h-9 px-4 text-[13px] ${gscReady ? "" : "pointer-events-none opacity-50"}`}>Connect Postmaster Tools</a></div>}
          </section>
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="grid gap-5">
          {!numbers.length && <section className="card p-6 text-[14px] text-stone-600">No WhatsApp number connected. <Link href="/app/channels" className="font-medium underline">Connect one in Channels</Link>.</section>}
          {numbers.map((n) => {
            const h = (n.meta?.health ?? null) as WaHealth | null, s = h?.stats;
            const q = h?.quality ?? "UNKNOWN";
            return (
              <section key={n.id} className="card grid gap-4 p-5" data-testid={`number-${n.id}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={`grid h-14 w-14 place-items-center rounded-full text-[12px] font-semibold ${q === "GREEN" ? "bg-lime/25 text-lime-800" : q === "YELLOW" ? "bg-amber-50 text-amber-700" : q === "RED" ? "bg-red-50 text-red-700" : "bg-mist text-stone-500"}`}>{q === "GREEN" ? "HIGH" : q === "YELLOW" ? "MED" : q === "RED" ? "LOW" : "?"}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-semibold">{n.phone_display ?? n.name}</p><p className="text-[13px] text-stone-500">{n.name} · quality rating from Meta · checked {h?.checked_at ? timeAgo(h.checked_at) : "never"}</p></div>
                  {h?.history?.length ? <span className="flex gap-0.5" title="Quality, last 30 checks">{h.history.map((x) => <span key={x.day} className={`h-4 w-1.5 rounded-sm ${x.q === "GREEN" ? "bg-lime-500" : x.q === "YELLOW" ? "bg-amber-400" : x.q === "RED" ? "bg-red-500" : "bg-stone-300"}`} />)}</span> : null}
                </div>
                {h?.paused && (
                  <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-900 sm:flex-row sm:items-center">
                    <PauseCircle className="h-5 w-5 shrink-0" /><p className="flex-1"><b>Broadcasts paused</b> because Meta rates this number LOW. Chats keep working. Waiting protects your number from a lower messaging limit or a ban.</p><ResumeNumber id={n.id} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-5">
                  {[["Daily limit (new chats)", h?.tierLimit ? h.tierLimit.toLocaleString("en-IN") : h?.tier === "TIER_UNLIMITED" ? "Unlimited" : "–", h?.leftToday != null ? `${h.leftToday.toLocaleString("en-IN")} left today` : ""], ["Sent (30 days)", s ? s.sent30.toLocaleString("en-IN") : "–", ""], ["Delivered", s ? pct(s.delivered30, s.sent30) : "–", ""], ["Read", s ? pct(s.read30, s.sent30) : "–", ""], ["Replied STOP", s ? pct(s.optOuts30, s.sent30) : "–", "under 1%"]].map(([k, v, hint]) => (
                    <div key={k} className="rounded-xl bg-paper p-3"><div className="text-stone-500">{k}</div><div className="text-[18px] font-semibold tabular-nums">{v}</div>{hint && <div className="text-[11px] text-stone-400">{hint}</div>}</div>
                  ))}
                </div>
                {h?.templates && <p className="text-[13px] text-stone-600">Templates: {h.templates.approved} approved{h.templates.pending ? ` · ${h.templates.pending} in review` : ""}{h.templates.paused ? <span className="text-amber-700"> · {h.templates.paused} paused by Meta</span> : ""}{h.templates.rejected ? ` · ${h.templates.rejected} rejected` : ""}</p>}
                <ReasonList reasons={h?.reasons ?? []} />
              </section>
            );
          })}
          <section className="card grid gap-3 p-5" id="phones">
            <h2 className="text-[15px] font-semibold">Check your phone numbers</h2>
            <p className="text-[13px] text-stone-600">Formats every number for WhatsApp (+91…), finds numbers that can&apos;t be mobiles and duplicates. Messages to wrong numbers fail and hurt your quality rating.</p>
            <p className="text-[13px]"><b>{L.phones}</b> numbers · {L.wa} ready for WhatsApp · {L.opt} agreed to WhatsApp messages</p>
            <ListCleaner kind="phone" />
            <p className="text-[12px] text-stone-500">Best way to stay green: message only people who opted in, send broadcasts in the morning or evening (not late night), and always offer “Reply STOP to opt out”.</p>
          </section>
        </div>
      )}

      {tab === "domains" && (
        <div className="grid gap-5">
          {domains.map((d) => {
            const r = d.checks;
            if (!r?.checks) return null;
            const open = searchParams.d ? searchParams.d === d.domain : domains.length === 1 || r.checks.some((c) => c.status === "bad");
            return (
              <section key={d.domain} className="card grid gap-4 p-5" data-testid={`domain-${d.domain}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <Ring score={r.score} />
                  <div className="min-w-0 flex-1"><p className="text-[16px] font-semibold">{d.domain}</p><p className="text-[13px] text-stone-500">{r.free ? "Free email provider" : r.dnsHost ? `DNS at ${r.dnsHost.name}` : "DNS provider unknown"} · checked {d.checked_at ? timeAgo(d.checked_at) : "never"}</p></div>
                  <VerifyDomain domain={d.domain} />
                  <RemoveDomain domain={d.domain} />
                </div>
                {r.dnsHost && r.checks.some((c) => c.status === "bad") && (
                  <p className="flex flex-wrap items-center gap-2 rounded-xl bg-mist px-4 py-3 text-[13px]">{r.dnsHost.hint}{r.dnsHost.url && <a href={r.dnsHost.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium underline">Open {r.dnsHost.name} DNS <ExternalLink className="h-3 w-3" /></a>}</p>
                )}
                <details open={open} className="group">
                  <summary className="cursor-pointer text-[13px] font-medium text-stone-600">{r.checks.filter((c) => c.status === "ok").length} of {r.checks.length} checks passed — {open ? "hide" : "show"} details</summary>
                  <ul className="mt-3 grid gap-3">
                    {r.checks.map((c) => (
                      <li key={c.id} className="rounded-xl border border-line p-4" data-testid={`check-${c.id}`}>
                        <div className="flex items-start gap-2"><Dot s={c.status} /><div className="flex-1"><p className="text-[14px] font-medium">{c.title}</p><p className="text-[13px] text-stone-600">{c.detail}</p></div></div>
                        {c.found?.length && c.status !== "ok" ? <p className="mt-2 break-all rounded bg-paper px-2 py-1 font-mono text-[11px] text-stone-500">Now: {c.found.join(" | ")}</p> : null}
                        {c.add?.length ? (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-left text-[12px]">
                              <thead className="text-stone-500"><tr><th className="py-1 pr-3 font-medium">Type</th><th className="py-1 pr-3 font-medium">Host / Name</th><th className="py-1 font-medium">Value</th></tr></thead>
                              <tbody>{c.add.map((a, i) => (
                                <tr key={i} className="border-t border-line align-top">
                                  <td className="py-2 pr-3 font-mono">{a.type}{a.priority != null ? ` (${a.priority})` : ""}</td>
                                  <td className="py-2 pr-3"><span className="flex items-center gap-1.5"><span className="font-mono">{a.host}</span><CopyValue value={a.host} /></span></td>
                                  <td className="py-2"><span className="flex items-start gap-1.5"><span className="break-all font-mono">{a.value}</span><CopyValue value={a.value} /></span></td>
                                </tr>
                              ))}</tbody>
                            </table>
                            <p className="mt-1 text-[11px] text-stone-400">“@” means the domain itself. Some providers want the full name ({d.domain}) instead.</p>
                          </div>
                        ) : null}
                        {c.steps?.length ? <ol className="mt-2 grid list-decimal gap-1 pl-5 text-[13px] text-stone-700">{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
                      </li>
                    ))}
                  </ul>
                </details>
                {r.dnsHost?.name === "Cloudflare" && r.checks.some((c) => c.status === "bad" && c.add?.length) && <CloudflareFix domain={d.domain} />}
              </section>
            );
          })}
          <section className="card grid gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Connect a domain</h2>
            <p className="text-[13px] text-stone-600">Add the domain you send email from (the part after @). Growvia checks its setup and shows exactly what to add at your DNS provider — with copy buttons, and one click on Cloudflare.</p>
            <AddDomain />
          </section>
          <section className="card grid gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Don&apos;t have a domain yet?</h2>
            <p className="text-[13px] text-stone-600">A business email like hello@yourbusiness.com gets far better delivery and trust than a Gmail address. Domains cost about ₹800–1,200 a year.</p>
            <DomainFinder initial={business.name} />
          </section>
        </div>
      )}
    </>
  );
}
