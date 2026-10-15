import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { timeAgo } from "@/lib/format";
import { ComposeForm } from "./client";

export const metadata: Metadata = { title: "Write an email" };

export default async function ComposePage({ searchParams }: { searchParams: { ids?: string; tag?: string } }) {
  const { business } = await requireBusiness();
  const db = supabaseServer();
  const [{ data: leads }, { data: boxes }, { data: templates }, { data: recent }] = await Promise.all([
    db.from("leads").select("id, name, email, tags, stage, unsubscribed, email_status").eq("business_id", business.id).order("created_at", { ascending: false }).limit(5000),
    db.from("mailboxes").select("id, from_name, from_email, daily_limit").order("created_at"),
    db.from("email_templates").select("id, name, subject, body").order("name"),
    db.from("sequences").select("id, name, status, created_at, enrollments(status), messages(status, opened_at, direction)").eq("kind", "broadcast").order("created_at", { ascending: false }).limit(8),
  ]);
  const ids = (searchParams.ids ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  type R = { id: string; name: string; status: string; created_at: string; enrollments: { status: string }[]; messages: { status: string; opened_at: string | null; direction: string }[] };
  return (
    <>
      <PageHeader title="Write an email" sub={`Send one email to one person, a tag, a pipeline stage or everyone in ${business.name} — now or at a time you choose.`} />
      <ComposeForm
        businessName={business.name}
        leads={(leads ?? []).map((l) => ({ id: l.id, name: l.name, email: l.email, tags: l.tags ?? [], stage: l.stage, ok: Boolean(l.email) && !l.unsubscribed && l.email_status !== "bounced" }))}
        mailboxes={(boxes ?? []).map((b) => ({ id: b.id, label: `${b.from_name ? `${b.from_name} · ` : ""}${b.from_email}`, limit: b.daily_limit ?? null }))}
        templates={templates ?? []}
        initial={{ ids, tag: searchParams.tag ?? "" }}
      />
      {Boolean(recent?.length) && (
        <section className="mt-8">
          <h2 className="mb-3 text-[16px] font-semibold tracking-tight">Recent one-off emails</h2>
          <div className="grid gap-2">
            {((recent ?? []) as unknown as R[]).map((r) => {
              const out = r.messages.filter((m) => m.direction === "out" && m.status === "sent");
              const waiting = r.enrollments.filter((e) => e.status === "active").length;
              return (
                <Link key={r.id} href={`/app/email/${r.id}?tab=people`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:shadow-frame">
                  <span className="min-w-0"><span className="block truncate text-[14px] font-medium">{r.name.replace(/^Broadcast: /, "")}</span><span className="text-[12px] text-stone-500">{timeAgo(r.created_at)} · {r.enrollments.length} recipients</span></span>
                  <span className="text-[13px] tabular-nums text-stone-600">{out.length} sent · {out.filter((m) => m.opened_at).length} opened{waiting ? ` · ${waiting} waiting` : ""}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
