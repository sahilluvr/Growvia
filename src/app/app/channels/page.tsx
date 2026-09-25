import type { Metadata } from "next";
import { requireBusiness, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { CopyButton } from "@/components/app/bits";
import { META_VERIFY_TOKEN, metaLoginReady } from "@/lib/meta/graph";
import { SUPABASE_SERVICE_KEY } from "@/lib/config";
import { ChannelIcon } from "@/components/icons/Brand";
import { ConnectWhatsApp, AccountRow } from "./client";

export const metadata: Metadata = { title: "Channels" };

export default async function ChannelsPage({ searchParams }: { searchParams: { connected?: string; error?: string } }) {
  const db = supabaseServer();
  const [, { data: accounts }] = await Promise.all([
    requireBusiness(),
    db.from("channel_accounts").select("id, provider, external_id, name, username, picture, phone_display, waba_id, page_id, status, last_error, meta, created_at").order("created_at"),
  ]);
  const site = siteOrigin();
  const list = accounts ?? [];
  const wa = list.filter((a) => a.provider === "whatsapp");
  const social = list.filter((a) => a.provider !== "whatsapp");
  return (
    <>
      <PageHeader title="Channels" sub="Connect WhatsApp, Facebook and Instagram once — then chat, publish and schedule from Growvia." />
      {searchParams.connected && <p className="mb-4 rounded-xl border border-lime-500/40 bg-lime/15 px-4 py-3 text-[14px] text-lime-800">Connected {searchParams.connected} account{searchParams.connected === "1" ? "" : "s"}.</p>}
      {searchParams.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{searchParams.error === "setup" ? "Facebook login isn't set up yet — add META_APP_ID and META_APP_SECRET (see the setup box below)." : searchParams.error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ChannelIcon channel="whatsapp" className="h-5 w-5" /></span>
            <div><h2 className="text-[17px] font-semibold tracking-tight">WhatsApp Business</h2><p className="text-[13px] text-stone-500">Chat with customers, send broadcasts, track delivered &amp; read.</p></div>
          </div>
          <div className="mt-4 grid gap-2">{wa.map((a) => <AccountRow key={a.id} a={a} />)}</div>
          <div className="mt-4"><ConnectWhatsApp first={!wa.length} /></div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><ChannelIcon channel="facebook" className="h-5 w-5" /></span>
            <span className="-ml-5 mt-5 grid h-7 w-7 place-items-center rounded-lg border-2 border-white bg-fuchsia-50 text-fuchsia-700"><ChannelIcon channel="instagram" className="h-4 w-4" /></span>
            <div><h2 className="text-[17px] font-semibold tracking-tight">Facebook &amp; Instagram</h2><p className="text-[13px] text-stone-500">Publish &amp; schedule posts and reels, answer DMs and Messenger.</p></div>
          </div>
          <div className="mt-4 grid gap-2">{social.map((a) => <AccountRow key={a.id} a={a} />)}</div>
          <a href="/api/oauth/meta/start" className={`btn mt-4 h-11 w-full bg-[#1877F2] px-5 text-[14px] text-white hover:opacity-90 sm:w-auto ${metaLoginReady ? "" : "pointer-events-none opacity-50"}`}>
            <ChannelIcon channel="facebook" className="h-4 w-4" /> {social.length ? "Reconnect / add Pages" : "Continue with Facebook"}
          </a>
          <p className="mt-2 text-[12px] text-stone-500">Instagram must be a Professional (Business or Creator) account linked to your Facebook Page. Facebook will ask which Pages to allow — pick them all.</p>
        </section>
      </div>

      <section className="card mt-4 p-5 sm:p-6">
        <h2 className="text-[16px] font-semibold tracking-tight">One-time Meta setup {metaLoginReady ? <span className="ml-2 rounded-full bg-lime/25 px-2 py-0.5 text-[12px] font-medium text-lime-800">App connected</span> : <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-700">Needed</span>}</h2>
        <ol className="mt-3 grid gap-2 text-[14px] text-stone-600">
          <li><b>1.</b> Go to developers.facebook.com → <b>My Apps → Create app</b> → type <b>Business</b>. Add products: <b>WhatsApp</b>, <b>Facebook Login for Business</b>, <b>Messenger</b>, <b>Instagram</b>.</li>
          <li><b>2.</b> In Vercel add <code className="rounded bg-mist px-1 font-mono text-[12px]">META_APP_ID</code>, <code className="rounded bg-mist px-1 font-mono text-[12px]">META_APP_SECRET</code> (App settings → Basic) and <code className="rounded bg-mist px-1 font-mono text-[12px]">META_VERIFY_TOKEN</code> (optional — Growvia generates one for you), then redeploy.</li>
          <li><b>3.</b> Facebook Login → Settings → <b>Valid OAuth Redirect URIs</b>:
            <div className="mt-1 flex items-center gap-2"><code className="truncate rounded bg-mist px-2 py-1 font-mono text-[12px]">{site}/api/oauth/meta/callback</code><CopyButton text={`${site}/api/oauth/meta/callback`} /></div></li>
          <li><b>4.</b> Webhooks (WhatsApp → Configuration, and Messenger/Instagram → Webhooks): Callback URL and Verify token below. Subscribe to <b>messages</b>.
            <div className="mt-1 flex items-center gap-2"><code className="truncate rounded bg-mist px-2 py-1 font-mono text-[12px]">{site}/api/webhooks/meta</code><CopyButton text={`${site}/api/webhooks/meta`} /></div>
            <div className="mt-1 flex items-center gap-2 text-[13px]">Verify token: {META_VERIFY_TOKEN ? <><code className="rounded bg-mist px-2 py-1 font-mono text-[12px]">{META_VERIFY_TOKEN.slice(0, 3)}••••••</code><CopyButton text={META_VERIFY_TOKEN} /></> : <span className="text-amber-700">set META_VERIFY_TOKEN in Vercel</span>}</div></li>
          <li><b>5.</b> While your app is in Development mode, add yourself and each client as app <b>Testers</b> (App roles). Submit for App Review when you&apos;re ready to open it to the public.</li>
        </ol>
        {!SUPABASE_SERVICE_KEY && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">Incoming messages need <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel.</p>}
      </section>
    </>
  );
}
