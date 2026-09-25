import Link from "next/link";
import type { Metadata } from "next";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { fmtDate, timeAgo } from "@/lib/format";
import { BroadcastForm, TemplateManager } from "./client";
import type { WaTemplate } from "@/lib/meta/graph";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppPage() {
  const db = supabaseServer();
  const [, { data: accounts }, { data: broadcasts }, { data: leads }] = await Promise.all([
    requireBusiness(),
    db.from("channel_accounts").select("id, name, phone_display, meta").eq("provider", "whatsapp").order("created_at"),
    db.from("wa_broadcasts").select("*").order("created_at", { ascending: false }).limit(30),
    db.from("leads").select("id, phone, wa_id, wa_opt_in, tags"),
  ]);
  const ids = (broadcasts ?? []).map((b) => b.id);
  const { data: msgs } = ids.length ? await db.from("messages").select("broadcast_id, delivery, status, lead_id").in("broadcast_id", ids) : { data: [] };
  const { data: inbound } = ids.length ? await db.from("messages").select("lead_id, sent_at").eq("channel", "whatsapp").eq("direction", "in") : { data: [] };
  const allTpl = (accounts ?? []).map((a) => ({ id: a.id, name: a.name, phone: a.phone_display as string | null, templates: (a.meta?.templates ?? []) as WaTemplate[] }));
  const accs = allTpl.map((a) => ({ ...a, templates: a.templates.filter((t) => t.status === "APPROVED"), waiting: a.templates.filter((t) => t.status === "PENDING").length }));
  const all = leads ?? [];
  const withPhone = all.filter((l) => l.wa_id || l.phone);
  const tags = Array.from(new Set(all.flatMap((l) => l.tags ?? []))).sort();
  return (
    <>
      <PageHeader title="WhatsApp" sub="Broadcast approved templates to your contacts and track delivered, read and replies. Chats continue in your Inbox." />
      {!accs.length ? (
        <div className="card flex flex-col items-start gap-3 p-6">
          <p className="text-[15px] font-medium">Connect your WhatsApp Business number first</p>
          <p className="text-[14px] text-stone-500">Takes about 10 minutes with Meta&apos;s free test number, then you can switch to your real number.</p>
          <Link href="/app/channels" className="btn h-10 bg-emerald-600 px-4 text-[14px] text-white">Connect WhatsApp</Link>
        </div>
      ) : (
        <BroadcastForm accounts={accs} tags={tags} reachable={withPhone.length} optedIn={withPhone.filter((l) => l.wa_opt_in).length} />
      )}
      {allTpl.length > 0 && <TemplateManager accounts={allTpl} />}
      <section className="mt-8">
        <h2 className="mb-3 text-[16px] font-semibold tracking-tight">Broadcasts</h2>
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {(broadcasts ?? []).map((b) => {
              const m = (msgs ?? []).filter((x) => x.broadcast_id === b.id);
              const recips = new Set(m.map((x) => x.lead_id));
              const replied = new Set((inbound ?? []).filter((x) => recips.has(x.lead_id) && x.sent_at > b.created_at).map((x) => x.lead_id)).size;
              const count = (d: string) => m.filter((x) => x.delivery === d || (d === "delivered" && x.delivery === "read")).length;
              return (
                <li key={b.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium">{b.name} <span className="font-normal text-stone-500">· template {b.template_name}</span></div>
                    <div className="text-[12px] text-stone-500 capitalize">{b.status}{b.status === "scheduled" && b.scheduled_at ? ` · ${fmtDate(b.scheduled_at)}` : ` · ${timeAgo(b.created_at)}`} · {b.lead_ids.length} contacts</div>
                  </div>
                  <div className="flex gap-5 text-center">
                    {[["Sent", b.sent_count], ["Delivered", count("delivered")], ["Read", count("read")], ["Replied", replied], ["Failed", b.failed_count + m.filter((x) => x.delivery === "failed" && x.status !== "failed").length]].map(([k, v]) => (
                      <div key={k as string}><div className="text-[17px] font-semibold tabular-nums">{v as number}</div><div className="text-[11px] text-stone-500">{k as string}</div></div>
                    ))}
                  </div>
                </li>
              );
            })}
            {!broadcasts?.length && <li className="p-6 text-center text-[14px] text-stone-500">No broadcasts yet.</li>}
          </ul>
        </div>
      </section>
    </>
  );
}
