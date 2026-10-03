import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, AlertTriangle, ArrowRight, Clock, Mail, Globe2, Search } from "lucide-react";
import { withProject } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { ChannelIcon } from "@/components/icons/Brand";

export const metadata: Metadata = { title: "Connect your tools" };

type State = "done" | "todo" | "attention";
type Tool = { key: string; name: string; why: string; time: string; state: State; detail?: string; href: string; cta: string; icon: React.ReactNode; optional?: boolean };

const Badge = ({ s }: { s: State }) => s === "done" ? <span className="inline-flex items-center gap-1 rounded-full bg-lime/25 px-2 py-0.5 text-[12px] font-medium text-lime-800"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</span>
  : s === "attention" ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> Needs a look</span>
  : <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[12px] text-stone-500"><CircleDashed className="h-3.5 w-3.5" /> Not connected</span>;

/** One place that shows what's connected and what to do next — in plain language, one button each. */
export default async function IntegrationsPage() {
  const db = supabaseServer();
  const { business, data: [mb, ch, forms, leads] } = await withProject((id) => Promise.all([
    db.from("mailboxes").select("id, status, from_email").limit(20),
    db.from("channel_accounts").select("provider, status, name, phone_display").limit(50),
    db.from("lead_forms").select("id, submissions").eq("business_id", id),
    db.from("leads").select("id", { count: "exact", head: true }).eq("business_id", id).not("form_id", "is", null),
  ]));
  const b = business as typeof business & { gsc_site?: string | null; local_state?: { google?: unknown; location?: { title?: string } } | null };
  const boxes = mb.data ?? [], acc = ch.data ?? [];
  const of = (p: string) => acc.filter((a) => a.provider === p);
  const st = (rows: { status: string }[]): State => !rows.length ? "todo" : rows.some((r) => r.status !== "connected") ? "attention" : "done";
  const formLeads = (leads.count ?? 0) + (forms.data ?? []).reduce((s, f) => s + (f.submissions ?? 0), 0);
  const social = [...of("facebook"), ...of("instagram")];
  const tools: Tool[] = [
    { key: "email", name: "Your email", why: "Send campaigns and follow-ups from your own address, and see replies in Inbox.", time: "3 minutes", state: st(boxes), detail: boxes.map((x) => x.from_email).join(", "), href: "/app/settings?tab=email", cta: boxes.length ? "Manage" : "Connect email", icon: <Mail className="h-5 w-5" /> },
    { key: "form", name: "Website form", why: "Every enquiry from your website lands in Leads — and you get an email.", time: "5 minutes", state: formLeads ? "done" : "todo", detail: formLeads ? `${formLeads} lead${formLeads === 1 ? "" : "s"} received` : "Add it to your website — step-by-step for WordPress, Wix, Shopify and more", href: "/app/forms#install", cta: formLeads ? "Open forms" : "Add to my website", icon: <Globe2 className="h-5 w-5" /> },
    { key: "google", name: "Google Search Console", why: "See which Google searches find you, and track your positions every day.", time: "1 minute", state: b.gsc_site ? "done" : "todo", detail: b.gsc_site ?? undefined, href: b.gsc_site ? "/app/seo?tab=search" : "/api/oauth/google/start?for=gsc", cta: b.gsc_site ? "Open" : "Sign in with Google", icon: <Search className="h-5 w-5" /> },
    { key: "gbp", name: "Google Business Profile", why: "Track calls, directions and reviews from Google Maps, and post updates.", time: "1 minute", state: b.local_state?.location ? "done" : b.local_state?.google ? "attention" : "todo", detail: b.local_state?.location?.title, href: "/app/local", cta: b.local_state?.location ? "Open" : "Sign in with Google", icon: <ChannelIcon channel="gbp" className="h-5 w-5" /> },
    { key: "whatsapp", name: "WhatsApp Business", why: "Chat with customers and send offers to people who opted in.", time: "5 minutes", state: st(of("whatsapp")), detail: of("whatsapp").map((a) => a.phone_display ?? a.name).join(", "), href: "/app/channels", cta: of("whatsapp").length ? "Manage" : "Connect WhatsApp", icon: <ChannelIcon channel="whatsapp" className="h-5 w-5" /> },
    { key: "social", name: "Facebook & Instagram", why: "Publish and schedule posts, and answer DMs in one inbox.", time: "2 minutes", state: st(social), detail: social.map((a) => a.name).join(", "), href: social.length ? "/app/channels" : "/api/oauth/meta/start", cta: social.length ? "Manage" : "Continue with Facebook", icon: <ChannelIcon channel="facebook" className="h-5 w-5" /> },
    { key: "youtube", name: "YouTube", why: "Upload and schedule videos and Shorts.", time: "1 minute", state: st(of("youtube")), detail: of("youtube").map((a) => a.name).join(", "), href: of("youtube").length ? "/app/channels#youtube" : "/api/oauth/google/start?for=youtube", cta: of("youtube").length ? "Manage" : "Sign in with Google", icon: <ChannelIcon channel="youtube" className="h-5 w-5" />, optional: true },
  ];
  const core = tools.filter((t) => !t.optional);
  const done = core.filter((t) => t.state === "done").length;
  const next = tools.find((t) => t.state !== "done");
  return (
    <>
      <PageHeader title="Connect your tools" sub="Each one takes a few minutes and a single sign-in — no codes or technical settings. Connect what you use; skip the rest." />
      <section className="card mb-5 grid gap-3 p-5" data-testid="connect-progress">
        <div className="flex items-center justify-between text-[14px]"><b>{done} of {core.length} connected</b>{next && <Link href={next.href} className="inline-flex items-center gap-1 font-medium text-lime-800 underline underline-offset-2">Next: {next.name} <ArrowRight className="h-3.5 w-3.5" /></Link>}</div>
        <div className="h-2 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-lime-500 transition-all" style={{ width: `${Math.round((done / core.length) * 100)}%` }} /></div>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {tools.map((t) => (
          <section key={t.key} className="card flex flex-col gap-3 p-5" data-testid={`tool-${t.key}`}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-ink">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-[16px] font-semibold tracking-tight">{t.name}</h2><Badge s={t.state} />{t.optional && <span className="text-[12px] text-stone-400">optional</span>}</div>
                <p className="mt-1 text-[13px] text-stone-600">{t.why}</p>
                {t.detail && <p className="mt-1 truncate text-[12px] text-stone-500">{t.detail}</p>}
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[12px] text-stone-500"><Clock className="h-3.5 w-3.5" /> {t.time}</span>
              <a href={t.href} className={`${t.state === "done" ? "btn-ghost" : "btn-primary"} h-9 px-4 text-[13px]`}>{t.cta}</a>
            </div>
          </section>
        ))}
      </div>
      <p className="mt-5 text-[13px] text-stone-500">Stuck? <Link href="/contact" className="underline">Message us</Link> — we&apos;ll get you connected on a quick call, free.</p>
    </>
  );
}
