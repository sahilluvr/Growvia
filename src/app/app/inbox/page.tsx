import Link from "next/link";
import type { Metadata } from "next";
import { Inbox as InboxIcon, Mail, Check, CheckCheck, AlertTriangle } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { timeAgo, fmtDate } from "@/lib/format";
import { ChannelIcon, CHANNEL_LABEL, CHANNEL_TINT } from "@/components/icons/Brand";
import { AutoRefresh, ChannelReplyBox, InboxSync, MarkRead, ReplyBox, ThreadActions } from "./client";
import type { WaTemplate } from "@/lib/meta/graph";

export const metadata: Metadata = { title: "Inbox" };

type ThreadRow = { id: string; subject: string; unread: boolean; status: string; channel: string; last_message_at: string; leads: { id: string; name: string; email: string | null } | null; messages: { body_text: string | null; direction: string }[] };
type Msg = { id: string; direction: string; channel: string; body_text: string | null; from_email: string | null; created_at: string; sent_at: string | null; status: string; opened_at: string | null; clicked_at: string | null; error: string | null; scheduled_at: string | null; delivery: string | null };

const CHANNELS = [["all", "All"], ["email", "Email"], ["whatsapp", "WhatsApp"], ["instagram", "Instagram"], ["messenger", "Messenger"]] as const;

function Ticks({ m }: { m: Msg }) {
  if (m.status === "failed" || m.delivery === "failed") return <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="h-3 w-3" /> {m.error ?? "not delivered"}</span>;
  if (m.channel === "email") return <>{m.status === "scheduled" ? ` · scheduled ${m.scheduled_at ? fmtDate(m.scheduled_at) : ""}` : m.clicked_at ? " · clicked" : m.opened_at ? " · opened" : m.status === "sent" ? " · sent" : ""}</>;
  if (m.delivery === "read") return <CheckCheck className="inline h-3.5 w-3.5 text-lime" aria-label="Read" />;
  if (m.delivery === "delivered") return <CheckCheck className="inline h-3.5 w-3.5" aria-label="Delivered" />;
  return <Check className="inline h-3.5 w-3.5" aria-label="Sent" />;
}

export default async function InboxPage({ searchParams }: { searchParams: { t?: string; f?: string; c?: string } }) {
  const db = supabaseServer();
  const filter = searchParams.f === "unread" ? "unread" : searchParams.f === "closed" ? "closed" : "open";
  const ch = CHANNELS.some(([k]) => k === searchParams.c) ? searchParams.c! : "all";
  let q = db.from("threads").select("id, subject, unread, status, channel, last_message_at, leads(id, name, email), messages(body_text, direction)").order("last_message_at", { ascending: false }).order("created_at", { referencedTable: "messages", ascending: false }).limit(1, { referencedTable: "messages" }).limit(150);
  q = filter === "closed" ? q.eq("status", "closed") : q.eq("status", "open");
  if (filter === "unread") q = q.eq("unread", true);
  if (ch !== "all") q = q.eq("channel", ch);
  const selectedId = searchParams.t && /^[0-9a-f-]{36}$/i.test(searchParams.t) ? searchParams.t : null;
  const [, { data: threads }, { count: mailboxes }, { data: templates }, { data: sel }] = await Promise.all([
    requireBusiness(),
    q,
    db.from("mailboxes").select("id", { count: "exact", head: true }),
    db.from("email_templates").select("id, name, body").order("name"),
    selectedId ? db.from("threads").select("*, leads(*), messages(*), channel_accounts(id, provider, name, meta)").eq("id", selectedId).order("created_at", { referencedTable: "messages", ascending: true }).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const list = (threads ?? []) as unknown as ThreadRow[];
  const qs = (o: Record<string, string>) => `/app/inbox?${new URLSearchParams({ f: filter, c: ch, ...o })}`;
  const waTemplates = ((sel?.channel_accounts?.meta?.templates ?? []) as WaTemplate[]).filter((t) => t.status === "APPROVED");

  return (
    <>
      <AutoRefresh seconds={12} />
      <PageHeader title="Inbox" sub="Email, WhatsApp, Instagram and Messenger — every conversation with your customers in one place.">
        <InboxSync hasMailbox={Boolean(mailboxes)} />
      </PageHeader>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CHANNELS.map(([k, l]) => (
          <Link key={k} href={`/app/inbox?${new URLSearchParams({ f: filter, c: k })}`} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${ch === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>
            {k !== "all" && <ChannelIcon channel={k} className="h-3.5 w-3.5" />} {l}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className={`card overflow-hidden ${sel ? "hidden lg:block" : ""}`}>
          <div className="flex gap-1 border-b border-line p-2">
            {[["open", "Open"], ["unread", "Unread"], ["closed", "Closed"]].map(([k, l]) => (
              <Link key={k} href={`/app/inbox?${new URLSearchParams({ f: k, c: ch })}`} className={`rounded-lg px-3 py-1.5 text-[13px] ${filter === k ? "bg-ink text-white" : "text-stone-600 hover:bg-mist"}`}>{l}</Link>
            ))}
          </div>
          <ul className="max-h-[70dvh] divide-y divide-line overflow-y-auto">
            {list.map((t) => (
              <li key={t.id}>
                <Link href={qs({ t: t.id })} className={`flex gap-3 px-4 py-3 transition-colors hover:bg-paper ${selectedId === t.id ? "bg-paper" : ""}`}>
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${CHANNEL_TINT[t.channel] ?? CHANNEL_TINT.email}`}><ChannelIcon channel={t.channel} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[14px] ${t.unread ? "font-semibold" : "font-medium"}`}>{t.leads?.name ?? "Unknown"}</span>
                      <span className="shrink-0 text-[12px] text-stone-400">{timeAgo(t.last_message_at)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-lime-500" aria-label="Unread" />}
                      <span className="truncate text-[13px] text-ink">{t.channel === "email" ? t.subject : CHANNEL_LABEL[t.channel]}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-stone-500">{t.messages?.[0]?.direction === "out" ? "You: " : ""}{t.messages?.[0]?.body_text?.slice(0, 120)}</p>
                  </div>
                </Link>
              </li>
            ))}
            {!list.length && <li className="flex flex-col items-center gap-2 p-10 text-center text-[14px] text-stone-500"><InboxIcon className="h-6 w-6 text-stone-300" />{filter === "unread" ? "All caught up." : "No conversations yet. Connect WhatsApp/Instagram in Channels, or send a campaign."}</li>}
          </ul>
        </section>

        <section className={`card flex min-h-[60dvh] flex-col ${sel ? "" : "hidden lg:flex"}`}>
          {sel ? (
            <>
              {sel.unread && <MarkRead id={sel.id} />}
              <header className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${CHANNEL_TINT[sel.channel] ?? CHANNEL_TINT.email}`}><ChannelIcon channel={sel.channel} className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <Link href={qs({})} className="mb-1 inline-block text-[13px] text-stone-500 lg:hidden">← All conversations</Link>
                    <h2 className="truncate text-[18px] font-semibold tracking-tight">{sel.channel === "email" ? sel.subject : sel.leads?.name}</h2>
                    {sel.leads && <Link href={`/app/leads/${sel.leads.id}`} className="text-[13px] text-stone-500 hover:text-ink">{sel.channel === "email" ? `${sel.leads.name} · ${sel.leads.email}` : `${CHANNEL_LABEL[sel.channel]}${sel.leads.phone ? ` · ${sel.leads.phone}` : ""}${sel.channel_accounts ? ` · via ${sel.channel_accounts.name}` : ""}`}</Link>}
                  </div>
                </div>
                <ThreadActions id={sel.id} status={sel.status} />
              </header>
              <ol className="flex-1 space-y-3 overflow-y-auto p-5">
                {(sel.messages as Msg[]).map((m) => (
                  <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.direction === "out" ? `ml-auto ${m.channel === "whatsapp" ? "bg-emerald-800" : "bg-ink"} text-white` : "bg-mist text-ink"}`}>
                    <p className="whitespace-pre-line text-[14px] leading-relaxed">{m.body_text}</p>
                    <p className={`mt-2 flex items-center justify-end gap-1 text-[11px] ${m.direction === "out" ? "text-white/60" : "text-stone-500"}`}>
                      {m.direction === "out" ? "You" : m.from_email} · {fmtDate(m.sent_at ?? m.created_at)} {m.direction === "out" && <Ticks m={m} />}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="border-t border-line p-4">
                {sel.channel === "email"
                  ? <ReplyBox threadId={sel.id} templates={templates ?? []} disabled={!mailboxes} />
                  : <ChannelReplyBox threadId={sel.id} channel={sel.channel} lastInbound={sel.last_inbound_at} templates={waTemplates} leadName={sel.leads?.name ?? ""} disconnected={!sel.channel_accounts} />}
              </div>
            </>
          ) : (
            <div className="m-auto flex flex-col items-center gap-2 p-10 text-center text-[14px] text-stone-500"><Mail className="h-6 w-6 text-stone-300" /> Select a conversation</div>
          )}
        </section>
      </div>
    </>
  );
}
