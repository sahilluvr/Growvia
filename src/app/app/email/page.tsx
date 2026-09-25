import Link from "next/link";
import type { Metadata } from "next";
import { Mail, ArrowUpRight } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { createSequenceAction } from "@/app/email-actions";
import { Submit } from "@/components/ui/Form";
import { inputCls } from "@/components/ui/styles";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Email campaigns" };

const STATUS: Record<string, string> = { draft: "bg-mist text-stone-600", active: "bg-ink text-lime", paused: "bg-amber-50 text-amber-700", completed: "bg-lime/25 text-lime-800" };

export default async function EmailCampaigns() {
  const db = supabaseServer();
  const [, { data: seqs }, { data: templates }, { count: mailboxes }] = await Promise.all([
    requireBusiness(),
    db.from("sequences").select("*, sequence_steps(id), enrollments(status), messages(status, opened_at, clicked_at, direction)").order("created_at", { ascending: false }),
    db.from("email_templates").select("id, name").order("name"),
    db.from("mailboxes").select("id", { count: "exact", head: true }),
  ]);
  type Row = { id: string; name: string; status: string; created_at: string; sequence_steps: { id: string }[]; enrollments: { status: string }[]; messages: { status: string; opened_at: string | null; clicked_at: string | null; direction: string }[] };
  return (
    <>
      <PageHeader title="Email campaigns" sub="Automated email sequences: send, wait, follow up — and stop the moment someone replies." />
      {!mailboxes && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-amber-900"><b>Connect a mailbox first</b> — campaigns send from your own email address.</p>
          <Link href="/app/settings" className="btn-primary h-10 px-4 text-[14px]">Connect mailbox</Link>
        </div>
      )}
      <form action={createSequenceAction} className="card mb-6 grid gap-3 p-5 sm:grid-cols-[1fr_260px_auto] sm:items-end">
        <label className="block"><span className="text-[13px] font-medium">New campaign</span><input name="name" required maxLength={100} className={`${inputCls} mt-1.5`} placeholder="e.g. Win back lapsed customers" /></label>
        <label className="block"><span className="text-[13px] font-medium">Start from</span>
          <select name="template" className={`${inputCls} mt-1.5`} defaultValue="">
            <option value="">Recommended 3-email sequence</option>
            {(templates ?? []).map((t) => <option key={t.id} value={t.id}>Template: {t.name}</option>)}
          </select>
        </label>
        <Submit className="btn-primary h-11 px-5 text-[14px]" pendingText="Creating…">Create campaign</Submit>
      </form>
      <div className="grid gap-3">
        {((seqs ?? []) as unknown as Row[]).map((s) => {
          const out = s.messages.filter((m) => m.direction === "out" && m.status === "sent");
          const opened = out.filter((m) => m.opened_at).length;
          const replied = s.enrollments.filter((e) => e.status === "replied").length;
          const pct = (n: number) => (out.length ? `${Math.round((n / out.length) * 100)}%` : "—");
          return (
            <Link key={s.id} href={`/app/email/${s.id}`} className="card group grid gap-4 p-5 transition-shadow hover:shadow-frame sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-stone-400" /><span className="truncate text-[16px] font-semibold tracking-tight">{s.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium capitalize ${STATUS[s.status]}`}>{s.status}</span></div>
                <p className="mt-1 text-[13px] text-stone-500">{s.sequence_steps.length} email{s.sequence_steps.length === 1 ? "" : "s"} · {s.enrollments.length} lead{s.enrollments.length === 1 ? "" : "s"} · created {timeAgo(s.created_at)}</p>
              </div>
              <div className="flex gap-6 text-center">
                {[["Sent", String(out.length)], ["Opened", pct(opened)], ["Replied", s.enrollments.length ? `${Math.round((replied / s.enrollments.length) * 100)}%` : "—"]].map(([k, v]) => (
                  <div key={k}><div className="text-[18px] font-semibold tabular-nums">{v}</div><div className="text-[12px] text-stone-500">{k}</div></div>
                ))}
                <ArrowUpRight className="h-4 w-4 self-center text-stone-300 transition-colors group-hover:text-ink" />
              </div>
            </Link>
          );
        })}
        {!seqs?.length && <p className="rounded-xl border border-dashed border-line p-6 text-center text-[14px] text-stone-500">No email campaigns yet. Create one above — we&apos;ll draft a 3-email sequence you can edit.</p>}
      </div>
    </>
  );
}
