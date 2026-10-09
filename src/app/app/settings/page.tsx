import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, LogOut } from "lucide-react";
import { requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { MailboxManager } from "./MailboxManager";
import { CRON_SECRET, SUPABASE_SERVICE_KEY } from "@/lib/config";
import { PageHeader } from "@/components/app/PageHeader";
import { BusinessForm, PasswordForm, ProfileForm } from "./forms";
import { NotifyForm, TeamManager } from "./team-client";
import { NOTIFY_TYPES } from "@/lib/notify";
import { canManage, myRole, ROLES } from "@/lib/team";
import { integrations } from "@/lib/integrations";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  ["project", "This project", "Project"], ["forms", "Website forms", "Project"],
  ["account", "Your account", "Account"], ["team", "Team", "Account"], ["billing", "Plan & billing", "Account"], ["notifications", "Notifications", "Account"], ["email", "Email sending", "Account"], ["integrations", "Integrations", "Account"],
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { user, business } = await requireBusiness();
  const tab = TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab! : "project";
  const site = siteOrigin();
  const db = supabaseServer();
  const role = await myRole(business.owner_id, user.id);
  return (
    <>
      <PageHeader title="Settings" sub={`Project settings apply to ${business.name}. Account settings apply everywhere.`} />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Settings sections">
        {TABS.map(([k, l, g], i) => (
          <span key={k} className="flex shrink-0 items-end">
            {(i === 0 || TABS[i - 1][2] !== g) && <span className="mb-2.5 ml-2 mr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-stone-400">{g}</span>}
            <Link href={k === "forms" ? "/app/forms" : k === "billing" ? "/app/billing" : `/app/settings?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] ${tab === k ? "border-ink font-medium text-ink" : "border-transparent text-stone-500 hover:text-ink"}`}>{l}</Link>
          </span>
        ))}
      </nav>

      {tab === "project" && (
        <div className="grid gap-4">
          <Section title="Business profile" sub="Growvia uses this to build your plan and write your content, emails and posts."><BusinessForm b={business} /></Section>
          <Section title="Also for this project">
            <ul className="grid gap-2 text-[14px]">
              <li><Link href="/app/forms" className="underline decoration-lime decoration-2 underline-offset-4">Website lead forms</Link> — embed on your site, enquiries land in Leads</li>
              <li><Link href="/app/seo?tab=settings" className="underline decoration-lime decoration-2 underline-offset-4">SEO & AI visibility settings</Link> — schedules, competitors, report emails</li>
              <li><Link href="/app/channels" className="underline decoration-lime decoration-2 underline-offset-4">Channels</Link> — WhatsApp, Facebook, Instagram</li>
            </ul>
          </Section>
        </div>
      )}

      {tab === "account" && (
        <div className="grid gap-4">
          <Section title="Your profile"><ProfileForm name={user.name} email={user.email} /></Section>
          <Section title="Password"><PasswordForm /></Section>
          <Section title="Session"><form action="/auth/signout" method="post"><button className="btn-ghost h-10 px-4 text-[14px]"><LogOut className="h-4 w-4" /> Sign out</button></form></Section>
        </div>
      )}

      {tab === "team" && await (async () => {
        const [{ data: members }, { workspaces }, { data: owner }] = await Promise.all([
          db.from("team_members").select("id, email, role, status, workspace_ids, user_id, invite_token, created_at").eq("owner_id", business.owner_id).order("created_at"),
          repoList(),
          db.from("profiles").select("name, email").eq("id", business.owner_id).maybeSingle(),
        ]);
        return (
          <Section title="Team" sub="Invite colleagues and clients. Limit someone to certain workspaces to share only those projects.">
            <TeamManager owner={{ name: owner?.name ?? (business.owner_id === user.id ? user.name : "Account owner"), email: owner?.email ?? (business.owner_id === user.id ? user.email : "") }} me={user.id} role={role} canManage={canManage(role)}
              members={(members ?? []).map((m) => ({ ...m, invite_url: m.invite_token ? `${site}/invite/${m.invite_token}` : null }))} workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))} roles={ROLES} />
          </Section>
        );
      })()}

      {tab === "notifications" && await (async () => {
        const [{ data: prefs }, { data: log }] = await Promise.all([
          db.from("user_prefs").select("notify").eq("user_id", user.id).maybeSingle(),
          db.from("email_log").select("type, subject, recipients, status, error, created_at").order("created_at", { ascending: false }).limit(25),
        ]);
        return (
          <div className="grid gap-4">
            <Section title="Email me when…" sub="Your personal choices — teammates choose their own."><NotifyForm types={NOTIFY_TYPES.map((t) => ({ ...t }))} prefs={(prefs?.notify ?? {}) as Record<string, boolean>} /></Section>
            <Section title="Recent Growvia emails" sub="Welcome, alerts, reports, invites and form replies sent for this account.">
              {log?.length ? (
                <ul className="divide-y divide-line text-[13px]">
                  {log.map((l, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="min-w-0 flex-1"><b className="font-medium">{l.subject}</b><span className="block text-stone-500">{l.type.replace(/_/g, " ")} · to {l.recipients.join(", ")}</span></span><span className={`text-[12px] ${l.status === "sent" ? "text-lime-700" : l.status === "failed" ? "text-red-600" : "text-stone-500"}`}>{l.status}{l.error ? ` — ${l.error}` : ""} · {timeAgo(l.created_at)}</span></li>)}
                </ul>
              ) : <p className="text-[14px] text-stone-500">No emails yet.</p>}
            </Section>
          </div>
        );
      })()}

      {tab === "email" && await (async () => {
        const { data: boxes } = await db.from("mailboxes").select("id, owner_id, label, from_name, from_email, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, username, daily_limit, signature, status, last_error, imap_last_uid, imap_uidvalidity, last_sync_at, created_at, health, business_id").order("created_at");
        const { data: projects } = await db.from("businesses").select("id, name").eq("owner_id", business.owner_id).order("created_at");
        const automationReady = Boolean(SUPABASE_SERVICE_KEY && CRON_SECRET);
        return (
          <div className="grid gap-4">
            <div id="mailboxes" className="scroll-mt-24" /><Section title="Mailboxes" sub="The addresses your campaigns and replies are sent from. Replies come back into Inbox."><MailboxManager mailboxes={boxes ?? []} projects={projects ?? []} current={business.id} /></Section>
            <Section title="Automation" sub="Keeps campaigns sending and replies syncing even when Growvia isn't open.">
              {automationReady ? (
                <div className="grid gap-3 text-[14px] text-stone-600">
                  <p className="flex items-center gap-2 font-medium text-lime-800"><span className="h-2 w-2 rounded-full bg-lime-500" /> Scheduler endpoint is ready</p>
                  <p>Run <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-[12px]">supabase/cron.sql</code> once in Supabase with:</p>
                  <pre className="overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-lime">{`url     = '${site}/api/cron/tick'\nsecret  = your CRON_SECRET from Vercel`}</pre>
                </div>
              ) : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-900">Add <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> and <code className="font-mono">CRON_SECRET</code> in Vercel, then redeploy.</p>}
            </Section>
          </div>
        );
      })()}

      {tab === "integrations" && (
        <Section title="Integrations" sub="Switched on with settings in Vercel → Environment Variables (values are never shown here). Redeploy after changes.">
          <ul className="divide-y divide-line">
            {integrations().map((x) => (
              <li key={x.name} className="flex items-start gap-3 py-3">
                {x.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-700" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />}
                <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">{x.name} <span className="font-normal text-stone-400">· {x.group}</span></p><p className="text-[13px] text-stone-500">{x.what}</p><p className="font-mono text-[11px] text-stone-400">{x.keys}</p></div>
                <span className={`shrink-0 text-[12px] font-medium ${x.ok ? "text-lime-700" : "text-stone-500"}`}>{x.ok ? "On" : "Off"}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

async function repoList() {
  const { repo } = await import("@/lib/data");
  return repo().listWorkspaces();
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-[260px_1fr]">
      <div><h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>{sub && <p className="mt-1 text-[14px] text-stone-500">{sub}</p>}</div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
