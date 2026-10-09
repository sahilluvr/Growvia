import type { Metadata } from "next";
import { requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { CopyButton } from "@/components/app/bits";
import { GRAPH_VERSION, META_APP_ID, META_VERIFY_TOKEN, META_WA_CONFIG_ID, metaLoginReady, waEmbeddedReady } from "@/lib/meta/graph";
import { SUPABASE_SERVICE_KEY } from "@/lib/config";
import { ChannelIcon } from "@/components/icons/Brand";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ConnectWhatsApp, AccountRow } from "./client";
import { gscReady } from "@/lib/google/gsc";

export const metadata: Metadata = { title: "Channels" };

export default async function ChannelsPage({ searchParams }: { searchParams: { connected?: string; fb?: string; ig?: string; igwhy?: string; error?: string; google_error?: string } }) {
  const db = supabaseServer();
  const [, { data: accounts }] = await Promise.all([
    requireBusiness(),
    db.from("channel_accounts").select("id, provider, external_id, name, username, picture, phone_display, waba_id, page_id, status, last_error, meta, created_at").order("created_at"),
  ]);
  const site = siteOrigin();
  const list = accounts ?? [];
  const wa = list.filter((a) => a.provider === "whatsapp");
  const social = list.filter((a) => a.provider === "facebook" || a.provider === "instagram");
  const yt = list.filter((a) => a.provider === "youtube");
  const gbp = list.filter((a) => a.provider === "gbp");
  return (
    <>
      <PageHeader title="Channels" sub="Connect WhatsApp, Facebook, Instagram, YouTube and Google Business once — then chat, publish and schedule from Growvia." />
      {searchParams.connected && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-lime-500/40 bg-lime/15 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between" data-testid="connected-banner">
          <p className="flex items-start gap-2 text-[14px] text-lime-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{searchParams.fb ? <>Connected <b>{searchParams.fb} Facebook Page{searchParams.fb === "1" ? "" : "s"}</b>{Number(searchParams.ig) > 0 ? <> and <b>{searchParams.ig} Instagram account{searchParams.ig === "1" ? "" : "s"}</b></> : null}.</> : <>Connected {searchParams.connected} account{searchParams.connected === "1" ? "" : "s"}.</>} {searchParams.igwhy ? "Instagram still needs one step — see below." : "You're ready to publish."}</span>
          </p>
          <Link href="/app/publish#compose" className="btn-primary h-9 shrink-0 px-4 text-[13px]">Create your first post <ArrowRight className="h-4 w-4" /></Link>
        </div>
      )}
      {searchParams.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{searchParams.error === "setup" ? "Facebook & Instagram login isn't switched on yet. Admin: add META_APP_ID and META_APP_SECRET in Vercel (and META_LOGIN_CONFIG_ID for a “Facebook Login for Business” app), then redeploy — see the setup box at the bottom of this page." : searchParams.error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ChannelIcon channel="whatsapp" className="h-5 w-5" /></span>
            <div><h2 className="text-[17px] font-semibold tracking-tight">WhatsApp Business</h2><p className="text-[13px] text-stone-500">Chat with customers, send broadcasts, track delivered &amp; read.</p></div>
          </div>
          <div className="mt-4 grid gap-2">{wa.map((a) => <AccountRow key={a.id} a={a} />)}</div>
          <div className="mt-4"><ConnectWhatsApp first={!wa.length} oneClick={waEmbeddedReady ? { appId: META_APP_ID, configId: META_WA_CONFIG_ID, version: GRAPH_VERSION } : null} /></div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><ChannelIcon channel="facebook" className="h-5 w-5" /></span>
            <span className="-ml-5 mt-5 grid h-7 w-7 place-items-center rounded-lg border-2 border-white bg-fuchsia-50 text-fuchsia-700"><ChannelIcon channel="instagram" className="h-4 w-4" /></span>
            <div><h2 className="text-[17px] font-semibold tracking-tight">Facebook &amp; Instagram</h2><p className="text-[13px] text-stone-500">Publish &amp; schedule posts and reels, answer DMs and Messenger.</p></div>
          </div>
          <div className="mt-4 grid gap-2">{social.map((a) => <AccountRow key={a.id} a={a} />)}</div>
          <a href="/api/oauth/meta/start" data-testid="fb-connect" className="btn mt-4 h-11 w-full bg-[#1877F2] px-5 text-[14px] text-white hover:opacity-90 sm:w-auto">
            <ChannelIcon channel="facebook" className="h-4 w-4" /> {social.length ? "Reconnect / add Pages" : "Continue with Facebook"}
          </a>
          {!metaLoginReady && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900" data-testid="fb-setup-note">Facebook &amp; Instagram need a one-time setup by the Growvia admin first (the Meta app keys). Until then this button explains what&apos;s missing.</p>}
          {social.some((a) => a.provider === "facebook") && !social.some((a) => a.provider === "instagram") ? (
            <InstagramHelp why={searchParams.igwhy === "declined" ? "declined" : "notlinked"} />
          ) : (
            <p className="mt-2 text-[12px] text-stone-500">Instagram must be a Professional (Business or Creator) account linked to your Facebook Page. Facebook will ask which Pages and Instagram accounts to allow — pick them all.</p>
          )}
        </section>
      </div>

      {searchParams.google_error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{searchParams.google_error === "setup" ? "Google sign-in isn't set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel." : searchParams.google_error}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6" id="youtube">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-700"><ChannelIcon channel="youtube" className="h-5 w-5" /></span>
            <div><h2 className="text-[17px] font-semibold tracking-tight">YouTube</h2><p className="text-[13px] text-stone-500">Upload and schedule videos and Shorts from Publish.</p></div>
          </div>
          <div className="mt-4 grid gap-2">{yt.map((a) => <AccountRow key={a.id} a={a} />)}</div>
          <a href="/api/oauth/google/start?for=youtube" className={`btn mt-4 h-11 w-full bg-[#FF0000] px-5 text-[14px] text-white hover:opacity-90 sm:w-auto ${gscReady ? "" : "pointer-events-none opacity-50"}`}><ChannelIcon channel="youtube" className="h-4 w-4" /> {yt.length ? "Reconnect / add channel" : "Connect YouTube"}</a>
          <p className="mt-2 text-[12px] text-stone-500">Sign in with the Google account that owns the channel. Until Growvia&apos;s Google app passes YouTube&apos;s review, uploads may be set to private by YouTube — you can make them public in YouTube Studio.</p>
        </section>
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ChannelIcon channel="gbp" className="h-5 w-5" /></span>
            <div><h2 className="text-[17px] font-semibold tracking-tight">Google Business Profile</h2><p className="text-[13px] text-stone-500">Track calls, directions, reviews and Maps rankings; post updates.</p></div>
          </div>
          <div className="mt-4 grid gap-2">{gbp.map((a) => <AccountRow key={a.id} a={a} />)}</div>
          <a href="/app/local" className="btn-primary mt-4 h-11 w-full px-5 text-[14px] sm:w-auto">{gbp.length ? "Open Google Business" : "Set up Google Business"}</a>
        </section>
      </div>

      {(!waEmbeddedReady || !metaLoginReady) && <details className="card mt-4 p-5 sm:p-6" open={!metaLoginReady && searchParams.error === "setup"}>
        <summary className="cursor-pointer text-[13px] text-stone-500">For the Growvia admin: one-time Meta setup</summary>
        <h2 className="mt-3 text-[16px] font-semibold tracking-tight">One-time Meta setup {metaLoginReady ? <span className="ml-2 rounded-full bg-lime/25 px-2 py-0.5 text-[12px] font-medium text-lime-800">App connected</span> : <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-700">Needed</span>}</h2>
        <ol className="mt-3 grid gap-2 text-[14px] text-stone-600">
          <li><b>1.</b> Go to developers.facebook.com → <b>My Apps → Create app</b> → type <b>Business</b>. Add products: <b>WhatsApp</b>, <b>Facebook Login for Business</b>, <b>Messenger</b>, <b>Instagram</b>.</li>
          <li><b>2.</b> In Vercel add <code className="rounded bg-mist px-1 font-mono text-[12px]">META_APP_ID</code>, <code className="rounded bg-mist px-1 font-mono text-[12px]">META_APP_SECRET</code> (App settings → Basic) and <code className="rounded bg-mist px-1 font-mono text-[12px]">META_VERIFY_TOKEN</code> (optional — Growvia generates one for you), then redeploy.</li>
          <li><b>2b.</b> If your app uses <b>Facebook Login for Business</b>: Configurations → <b>Create configuration</b> (User access token) with these permissions: <span className="font-mono text-[12px]">pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_metadata, pages_messaging, instagram_basic, instagram_content_publish, instagram_manage_messages, instagram_manage_comments, business_management</span>. Copy its <b>Configuration ID</b> into <code className="rounded bg-mist px-1 font-mono text-[12px]">META_LOGIN_CONFIG_ID</code>.</li>
          <li><b>3.</b> Facebook Login for Business → Settings → <b>Valid OAuth Redirect URIs</b>:
            <div className="mt-1 flex items-center gap-2"><code className="truncate rounded bg-mist px-2 py-1 font-mono text-[12px]">{site}/api/oauth/meta/callback</code><CopyButton text={`${site}/api/oauth/meta/callback`} /></div></li>
          <li><b>4.</b> Webhooks (WhatsApp → Configuration, and Messenger/Instagram → Webhooks): Callback URL and Verify token below. Subscribe to <b>messages</b>.
            <div className="mt-1 flex items-center gap-2"><code className="truncate rounded bg-mist px-2 py-1 font-mono text-[12px]">{site}/api/webhooks/meta</code><CopyButton text={`${site}/api/webhooks/meta`} /></div>
            <div className="mt-1 flex items-center gap-2 text-[13px]">Verify token: {META_VERIFY_TOKEN ? <><code className="rounded bg-mist px-2 py-1 font-mono text-[12px]">{META_VERIFY_TOKEN.slice(0, 3)}••••••</code><CopyButton text={META_VERIFY_TOKEN} /></> : <span className="text-amber-700">set META_VERIFY_TOKEN in Vercel</span>}</div></li>
          <li><b>5.</b> While your app is in Development mode, add yourself and each client as app <b>Testers</b> (App roles). Submit for App Review when you&apos;re ready to open it to the public.</li>
        </ol>
        {!SUPABASE_SERVICE_KEY && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">Incoming messages need <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel.</p>}
      </details>}
    </>
  );
}

/** Shown when Facebook is connected but no Instagram came with it: exactly what to fix, then one click to retry. */
function InstagramHelp({ why }: { why: "declined" | "notlinked" }) {
  const steps = why === "declined"
    ? [
        ["Click “Connect Instagram” below", "Meta opens the same window as before."],
        ["Choose “Edit settings” (or “Edit previous settings”)", "Tick your Instagram account and your Facebook Page, and keep every permission switched on."],
        ["Save — you'll come straight back here", "Your Instagram appears above, ready to post Reels, photos and carousels."],
      ]
    : [
        ["Make Instagram a professional account (free)", "Instagram app → Settings → Account type and tools → Switch to professional account → Business or Creator."],
        ["Link it to your Facebook Page", "Facebook → your Page → Settings → Linked accounts → Instagram → Connect account. (Or Meta Business Suite → Settings → Instagram accounts.)"],
        ["Click “Connect Instagram” below", "In Meta's window tick your Page and your Instagram account, keep every permission on. Done in under a minute."],
      ];
  return (
    <div id="instagram" className="mt-4 scroll-mt-6 rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-amber-50/60 p-4" data-testid="ig-help">
      <p className="flex items-center gap-2 text-[14px] font-semibold"><ChannelIcon channel="instagram" className="h-4 w-4" /> {why === "declined" ? "Instagram wasn't allowed in Meta's window" : "Instagram isn't linked to your Page yet"}</p>
      <p className="mt-1 text-[13px] text-stone-600">{why === "declined" ? "Your Page is connected, but Instagram access was switched off when you approved Growvia." : "Your Facebook Page is connected. Meta only lets apps post to Instagram accounts that are professional and linked to a Page — three quick steps:"}</p>
      <ol className="mt-3 grid gap-2.5">
        {steps.map(([h, d], i) => (
          <li key={h} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[12px] font-semibold shadow-sm">{i + 1}</span>
            <span className="text-[13px]"><b className="font-medium">{h}</b><span className="block text-stone-600">{d}</span></span>
          </li>
        ))}
      </ol>
      <a href="/api/oauth/meta/start" className="btn mt-4 h-10 bg-gradient-to-r from-fuchsia-600 to-orange-500 px-4 text-[14px] text-white hover:opacity-90" data-testid="ig-connect"><ChannelIcon channel="instagram" className="h-4 w-4" /> Connect Instagram</a>
    </div>
  );
}
