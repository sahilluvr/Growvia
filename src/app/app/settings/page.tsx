import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { MailboxManager } from "./MailboxManager";
import { CRON_SECRET, SUPABASE_SERVICE_KEY } from "@/lib/config";
import { PageHeader } from "@/components/app/PageHeader";
import { CopyButton } from "@/components/app/bits";
import { BusinessForm, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, business } = await requireBusiness();
  const site = siteOrigin();
  const formUrl = `${site}/f/${business.id}`;
  const { data: boxes } = await supabaseServer().from("mailboxes").select("id, owner_id, label, from_name, from_email, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, username, daily_limit, signature, status, last_error, imap_last_uid, imap_uidvalidity, last_sync_at, created_at").order("created_at");
  const automationReady = Boolean(SUPABASE_SERVICE_KEY && CRON_SECRET);
  return (
    <>
      <PageHeader title="Settings" sub="Your account, your business and how Growvia works for you." />
      <div className="grid gap-4">
        <Section title="Business profile" sub="Growvia uses this to build your plan and write your content.">
          <BusinessForm b={business} />
        </Section>
        <Section title="Email sending" sub="Connect the mailbox your campaigns and replies are sent from.">
          <MailboxManager mailboxes={boxes ?? []} />
        </Section>
        <Section title="Automation" sub="Keeps campaigns sending and replies syncing even when Growvia isn't open.">
          {automationReady ? (
            <div className="grid gap-3 text-[14px] text-stone-600">
              <p className="flex items-center gap-2 font-medium text-lime-800"><span className="h-2 w-2 rounded-full bg-lime-500" /> Scheduler endpoint is ready</p>
              <p>Growvia checks every minute when the Supabase scheduler is set up. Run <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-[12px]">supabase/cron.sql</code> once in the Supabase SQL Editor with these values:</p>
              <pre className="overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-lime">{`url     = '${site}/api/cron/tick'\nsecret  = your CRON_SECRET from Vercel`}</pre>
              <p className="text-[13px] text-stone-500">Without it, emails still send whenever you use Growvia, plus a daily run.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-900">
              <p className="font-medium">Finish automation setup</p>
              <p className="mt-1">Add <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> (Supabase → Project Settings → API) and <code className="font-mono">CRON_SECRET</code> (any long random text) in Vercel → Environment Variables, then redeploy. These power scheduled sending, reply syncing, the booking page and open/click tracking.</p>
            </div>
          )}
        </Section>
        <Section title="Lead form" sub="Share this link anywhere. Submissions appear in Leads instantly.">
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate font-mono text-[13px] text-stone-600">{formUrl}</span>
            <div className="flex gap-2"><CopyButton text={formUrl} label="Copy link" /><a href={`/f/${business.id}`} target="_blank" className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-stone-600 hover:border-ink">Preview</a></div>
          </div>
        </Section>
        <Section title="Your profile"><ProfileForm name={user.name} email={user.email} /></Section>
        <Section title="Password"><PasswordForm /></Section>
        <Section title="Session" sub="Your data is stored securely in Supabase.">
          <form action="/auth/signout" method="post"><button className="btn-ghost h-10 px-4 text-[14px]"><LogOut className="h-4 w-4" /> Sign out</button></form>
        </Section>
      </div>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-[260px_1fr]">
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-1 text-[14px] text-stone-500">{sub}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}
