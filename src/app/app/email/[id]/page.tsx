import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { SequenceHeader, StepsEditor, EnrollPanel, SettingsForm, PeopleTable } from "./client";
import type { Sequence, Step } from "@/lib/email/types";

export const metadata: Metadata = { title: "Email campaign" };

export default async function SequencePage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = supabaseServer();
  const [{ business }, { data: seq }, { data: steps }, { data: enr }, { data: msgs }, { data: boxes }, { data: leads }] = await Promise.all([
    requireBusiness(),
    db.from("sequences").select("*").eq("id", params.id).maybeSingle<Sequence>(),
    db.from("sequence_steps").select("*").eq("sequence_id", params.id).order("position"),
    db.from("enrollments").select("id, status, step_index, next_run_at, last_error, lead_id, leads(name, email, tags)").eq("sequence_id", params.id).order("created_at", { ascending: false }),
    db.from("messages").select("step_id, status, opened_at, clicked_at").eq("sequence_id", params.id).eq("direction", "out"),
    db.from("mailboxes").select("id, from_name, from_email").order("created_at"),
    db.from("leads").select("tags, stage, email, unsubscribed"),
  ]);
  if (!seq) notFound();
  const tab = searchParams.tab ?? "emails";
  const stepStats = Object.fromEntries((steps ?? []).map((s) => {
    const m = (msgs ?? []).filter((x) => x.step_id === s.id && x.status === "sent");
    return [s.id, { sent: m.length, opened: m.filter((x) => x.opened_at).length, clicked: m.filter((x) => x.clicked_at).length }];
  }));
  const people = (enr ?? []) as unknown as { id: string; status: string; step_index: number; next_run_at: string; last_error: string | null; leads: { name: string; email: string | null; tags: string[] } | null }[];
  const counts = people.reduce<Record<string, number>>((a, p) => ((a[p.status] = (a[p.status] ?? 0) + 1), a), {});
  const sent = (msgs ?? []).filter((m) => m.status === "sent");
  const tags = Array.from(new Set((leads ?? []).flatMap((l) => l.tags ?? []))).sort();
  const reachable = (leads ?? []).filter((l) => l.email && !l.unsubscribed).length;

  return (
    <>
      <Link href="/app/email" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Email campaigns</Link>
      <SequenceHeader seq={seq} hasMailbox={Boolean(seq.mailbox_id)} stats={[
        ["Leads", String(people.length)], ["Sent", String(sent.length)],
        ["Opened", sent.length ? `${Math.round((sent.filter((m) => m.opened_at).length / sent.length) * 100)}%` : "—"],
        ["Clicked", sent.length ? `${Math.round((sent.filter((m) => m.clicked_at).length / sent.length) * 100)}%` : "—"],
        ["Replied", String(counts.replied ?? 0)], ["Finished", String(counts.completed ?? 0)],
      ]} />
      <nav className="mb-5 flex gap-1 border-b border-line">
        {[["emails", `Emails (${steps?.length ?? 0})`], ["people", `Leads (${people.length})`], ["settings", "Settings"]].map(([k, l]) => (
          <Link key={k} href={`/app/email/${seq.id}?tab=${k}`} className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] ${tab === k ? "border-ink font-medium text-ink" : "border-transparent text-stone-500 hover:text-ink"}`}>{l}</Link>
        ))}
      </nav>
      {tab === "emails" && <StepsEditor sequenceId={seq.id} steps={(steps ?? []) as Step[]} stats={stepStats} businessName={business.name} />}
      {tab === "people" && (
        <div className="grid gap-4">
          <EnrollPanel sequenceId={seq.id} tags={tags} reachable={reachable} />
          <PeopleTable people={people} />
        </div>
      )}
      {tab === "settings" && <SettingsForm seq={seq} mailboxes={boxes ?? []} />}
    </>
  );
}
