import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Phone, Globe2, Navigation, Eye, Star, AlertTriangle, CheckCircle2, Circle, MessageCircle } from "lucide-react";
import { withProject, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { LineChart, BarList } from "@/components/charts/LineChart";
import { CopyButton } from "@/components/app/bits";
import { timeAgo } from "@/lib/format";
import { gscReady } from "@/lib/google/gsc";
import { mapsProvider, mapsReady } from "@/lib/local/maps";
import type { LocalState } from "@/lib/local/sync";
import { AddLocalKeywords, CheckRanks, DescriptionWriter, DisconnectLocal, LocationPicker, ReloadLocations, RemoveLocalKeyword, ReviewReply, SyncLocal } from "./client";

export const metadata: Metadata = { title: "Google Business" };

const TABS = [["overview", "Overview"], ["reviews", "Reviews"], ["rankings", "Maps rankings"], ["profile", "Profile check"]] as const;
const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const sum = (rows: Record<string, number | string>[], k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const delta = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

type Daily = { day: string; search_views: number; maps_views: number; calls: number; website: number; directions: number; messages: number; bookings: number };
type Review = { id: string; reviewer: string; photo: string | null; rating: number; comment: string; reply: string | null; created_at: string };

export default async function LocalPage({ searchParams }: { searchParams: { tab?: string; google_error?: string; connected?: string; pick?: string } }) {
  const db = supabaseServer();
  const tab = TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab! : "overview";
  const { business, data: [{ data: row }, { data: daily }, { data: kw }, { data: reviews }, { data: lkws }, { data: ranks }] } = await withProject((id) => Promise.all([
    db.from("businesses").select("local_state, segment, city").eq("id", id).maybeSingle(),
    db.from("gbp_daily").select("*").eq("business_id", id).gte("day", ago(120)).order("day"),
    db.from("gbp_keywords").select("month, keyword, impressions, below").eq("business_id", id).order("month", { ascending: false }).limit(400),
    db.from("gbp_reviews").select("id, reviewer, photo, rating, comment, reply, created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(tab === "reviews" ? 200 : 30),
    db.from("local_keywords").select("id, keyword").eq("business_id", id).order("created_at"),
    db.from("local_ranks").select("keyword_id, day, position, rating, reviews, top").eq("business_id", id).gte("day", ago(120)).order("day"),
  ]));
  const st = (row?.local_state ?? {}) as LocalState;
  const connected = Boolean(st.google);
  const loc = st.location;
  const p = st.profile;
  const d = (daily ?? []) as Daily[];
  const last28 = d.filter((x) => x.day >= ago(30)), prev28 = d.filter((x) => x.day < ago(30) && x.day >= ago(58));
  const views = (rows: Daily[]) => sum(rows, "search_views") + sum(rows, "maps_views");
  const rv = (reviews ?? []) as Review[];
  const months = [...new Set((kw ?? []).map((k) => k.month))];
  const terms = (kw ?? []).filter((k) => k.month === months[0]).sort((a, b) => b.impressions - a.impressions);
  const prevTerms = new Map((kw ?? []).filter((k) => k.month === months[1]).map((k) => [k.keyword, k.impressions]));
  const city = row?.city ?? business.city ?? "";
  const cat = (p?.category ?? row?.segment ?? business.segment ?? "").toLowerCase();
  const suggestions = [...new Set([`${cat} near me`, city && `${cat} in ${city.toLowerCase()}`, city && `best ${cat} ${city.toLowerCase()}`, ...terms.slice(0, 5).map((t) => t.keyword)])].filter((s): s is string => Boolean(s && s.trim().length > 3) && !(lkws ?? []).some((k) => k.keyword === s)).slice(0, 6);
  const reviewLink = p?.newReviewUri ?? (loc?.placeId ? `https://search.google.com/local/writereview?placeid=${loc.placeId}` : null);
  const apiBlocked = st.sync_error_kind === "not_approved" || (connected && !loc && /approv|switched on|isn't switched/i.test(st.locations_error ?? ""));

  return (
    <>
      <PageHeader title="Google Business Profile" sub={loc ? `${loc.title}${loc.address ? ` · ${loc.address}` : ""}${st.synced_at ? ` · updated ${timeAgo(st.synced_at)}` : ""}` : `How ${business.name} shows up on Google Search and Maps — calls, directions, reviews and local rankings.`}>
        {loc && <SyncLocal />}
      </PageHeader>

      {searchParams.google_error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{searchParams.google_error === "setup" ? "Google sign-in isn't set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel." : searchParams.google_error}</p>}
      {searchParams.connected === "1" && loc && <p className="mb-4 rounded-xl bg-lime/20 px-4 py-3 text-[14px] text-lime-900">Connected {loc.title}. Click “Refresh from Google” if the numbers below are empty.</p>}
      {st.sync_error && loc && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{st.sync_error}{st.sync_error_kind === "auth" && <> <a href="/api/oauth/google/start?for=gbp" className="font-medium underline">Reconnect</a></>}{apiBlocked && <> Map rankings below still work.</>}</div>
        </div>
      )}

      {!connected || !loc ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card grid content-start gap-3 p-6">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><MapPin className="h-5 w-5" /></span><div><h2 className="text-[17px] font-semibold tracking-tight">Connect your Business Profile</h2><p className="text-[14px] text-stone-500">See searches and Maps views, calls, website clicks and direction requests; read and reply to reviews; post updates; and get a profile check.</p></div></div>
            {!connected ? (
              <div><a href="/api/oauth/google/start?for=gbp" className={`btn-primary h-10 px-4 text-[14px] ${gscReady ? "" : "pointer-events-none opacity-50"}`}>Sign in with Google</a></div>
            ) : (
              <>
                <p className="text-[13px] text-stone-600">Signed in as <b>{st.google!.email ?? "your Google account"}</b>.</p>
                {st.locations?.length ? <><p className="text-[14px] font-medium">Which location should {business.name} track?</p><LocationPicker locations={st.locations} /></> : (
                  <div className="grid gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900"><p>{st.locations_error ?? "No locations found yet."}</p><div className="flex flex-wrap gap-2"><ReloadLocations /><a href="/api/oauth/google/start?for=gbp" className={`${/permission/i.test(st.locations_error ?? "") ? "btn-primary" : "btn-ghost"} h-9 px-3.5 text-[13px]`}>{/permission/i.test(st.locations_error ?? "") ? "Reconnect" : "Use another Google account"}</a></div></div>
                )}
                <div><DisconnectLocal /></div>
              </>
            )}
            {!gscReady && <p className="rounded-xl bg-mist p-3 text-[13px] text-stone-600">Admin: add <code className="font-mono">GOOGLE_CLIENT_ID</code> and <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in Vercel (the same ones used for Search Console).</p>}
            <details className="rounded-xl bg-mist p-3 text-[13px] text-stone-700">
              <summary className="cursor-pointer font-medium text-ink">Admin: one-time Google setup for Business Profile</summary>
              <ol className="mt-2 grid list-decimal gap-1 pl-5">
                <li>Google Cloud → APIs &amp; Services → Library: enable <b>My Business Account Management API</b>, <b>My Business Business Information API</b>, <b>Business Profile Performance API</b> and <b>Google My Business API</b>.</li>
                <li>Request access (free) at <b>developers.google.com/my-business/content/prereqs</b> → “Request access”, using the same project. Google usually approves in a few days; until then the numbers stay empty.</li>
                <li>OAuth consent screen → add the scope <code className="font-mono">business.manage</code>. The redirect URI stays <code className="font-mono">{siteOrigin()}/api/oauth/google/callback</code>.</li>
              </ol>
            </details>
          </section>
          <RankingsCard lkws={lkws ?? []} ranks={ranks ?? []} suggestions={suggestions} compact />
        </div>
      ) : (
        <>
          <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Google Business sections">
            {TABS.map(([k, l]) => (
              <Link key={k} href={`/app/local?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14px] ${tab === k ? "border-ink font-medium text-ink" : "border-transparent text-stone-500 hover:text-ink"}`}>
                {l}{k === "reviews" && (p?.unanswered ?? 0) > 0 ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] tabular-nums text-amber-800">{p!.unanswered}</span> : null}
              </Link>
            ))}
          </nav>

          {tab === "overview" && (
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {([["Profile views", Eye, views(last28), views(prev28)], ["Calls", Phone, sum(last28, "calls"), sum(prev28, "calls")], ["Website clicks", Globe2, sum(last28, "website"), sum(prev28, "website")], ["Directions", Navigation, sum(last28, "directions"), sum(prev28, "directions")], ["Chats & bookings", MessageCircle, sum(last28, "messages") + sum(last28, "bookings"), sum(prev28, "messages") + sum(prev28, "bookings")]] as const).map(([label, I, now, before]) => {
                  const ch = delta(now, before);
                  return (
                    <div key={label} className="card p-4">
                      <div className="flex items-center gap-1.5 text-[12px] text-stone-500"><I className="h-3.5 w-3.5" /> {label}</div>
                      <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight">{now.toLocaleString("en-IN")}</div>
                      <div className={`text-[12px] ${ch == null ? "text-stone-400" : ch >= 0 ? "text-lime-700" : "text-red-600"}`}>{ch == null ? "last 30 days" : `${ch >= 0 ? "+" : ""}${ch}% vs previous 30`}</div>
                    </div>
                  );
                })}
              </div>
              <section className="card p-5">
                <h3 className="mb-3 text-[15px] font-semibold">Views &amp; actions per day</h3>
                <LineChart title="Business Profile views and actions" labels={d.map((x) => x.day)} empty={apiBlocked ? "Waiting for Google to approve API access" : "No data yet — click Refresh from Google"}
                  series={[{ name: "Search views", values: d.map((x) => x.search_views) }, { name: "Maps views", values: d.map((x) => x.maps_views) }, { name: "Calls + clicks + directions", values: d.map((x) => x.calls + x.website + x.directions) }]} />
                <p className="mt-2 text-[12px] text-stone-500">Google reports these with a 2–3 day delay.</p>
              </section>
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="card p-5">
                  <h3 className="text-[15px] font-semibold">What people searched to find you</h3>
                  <p className="mb-3 text-[12px] text-stone-500">{months[0] ? new Date(`${months[0]}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : "Last month"} · Google Search &amp; Maps</p>
                  {terms.length ? <BarList rows={terms.slice(0, 12).map((t) => ({ label: `${t.keyword}${prevTerms.has(t.keyword) ? "" : " · new"}`, value: t.impressions }))} /> : <p className="text-[14px] text-stone-500">No search terms yet.</p>}
                  {terms.some((t) => t.below) && <p className="mt-2 text-[12px] text-stone-400">Small numbers are shown by Google as “fewer than 15”.</p>}
                </section>
                <section className="card grid content-start gap-3 p-5">
                  <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold">Profile strength</h3><Link href="/app/local?tab=profile" className="text-[13px] text-stone-500 hover:text-ink">Details →</Link></div>
                  {st.audit ? <div className="flex items-end gap-2"><span className="text-[40px] font-semibold leading-none tabular-nums">{st.audit.score}</span><span className="pb-1 text-[14px] text-stone-500">/ 100</span></div> : <p className="text-[14px] text-stone-500">Refresh to run the profile check.</p>}
                  {st.audit && <ul className="grid gap-1.5 text-[13px]">{st.audit.items.filter((i) => !i.ok).slice(0, 4).map((i) => <li key={i.id} className="flex gap-2"><Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {i.label}</li>)}</ul>}
                  <div className="mt-1 flex items-center gap-4 border-t border-line pt-3 text-[14px]">
                    <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> <b>{p?.rating ?? "–"}</b></span>
                    <span>{p?.reviews ?? 0} reviews</span>
                    {(p?.unanswered ?? 0) > 0 && <Link href="/app/local?tab=reviews" className="text-amber-700 underline">{p!.unanswered} to reply</Link>}
                  </div>
                </section>
              </div>
              <RankingsCard lkws={lkws ?? []} ranks={ranks ?? []} suggestions={suggestions} compact />
            </div>
          )}

          {tab === "reviews" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <section className="card overflow-hidden">
                <ul className="divide-y divide-line">
                  {rv.map((r) => (
                    <li key={r.id} className="p-4" data-testid="review">
                      <div className="flex items-center gap-2">
                        {r.photo ? <img src={r.photo} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-mist text-[13px]">{r.reviewer[0]}</span>}
                        <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium">{r.reviewer}</p><p className="text-[12px] text-stone-500"><span className="text-amber-500">{"★".repeat(r.rating)}<span className="text-stone-300">{"★".repeat(5 - r.rating)}</span></span> · {timeAgo(r.created_at)}</p></div>
                        {!r.reply && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">No reply</span>}
                      </div>
                      {r.comment && <p className="mt-2 whitespace-pre-line text-[14px] text-stone-700">{r.comment}</p>}
                      {r.reply ? <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-[13px] text-stone-600"><b className="text-ink">Your reply:</b> {r.reply}</p> : <ReviewReply id={r.id} canReply={!apiBlocked} />}
                    </li>
                  ))}
                  {!rv.length && <li className="p-6 text-center text-[14px] text-stone-500">{apiBlocked ? "Reviews appear here once Google approves API access." : "No reviews yet — share your review link to get the first ones."}</li>}
                </ul>
              </section>
              <aside className="grid content-start gap-3">
                <section className="card grid gap-2 p-4">
                  <h3 className="text-[15px] font-semibold">Get more reviews</h3>
                  <p className="text-[13px] text-stone-500">Send happy customers straight to your review form.</p>
                  {reviewLink ? (
                    <>
                      <code className="truncate rounded bg-mist px-2 py-1 font-mono text-[12px]">{reviewLink}</code>
                      <div className="flex flex-wrap gap-2">
                        <CopyButton text={reviewLink} className="h-8" />
                        <a href={`https://wa.me/?text=${encodeURIComponent(`Thanks for choosing ${business.name}! Would you leave us a quick Google review? It really helps: ${reviewLink}`)}`} target="_blank" rel="noopener" className="btn-ghost h-8 px-3 text-[12px]">Share on WhatsApp</a>
                      </div>
                    </>
                  ) : <p className="text-[12px] text-stone-400">Your link appears after the first refresh.</p>}
                </section>
                <section className="card p-4 text-[13px] text-stone-600">
                  <p className="font-medium text-ink">Reply to every review</p>
                  <p className="mt-1">Google and customers both notice. Growvia drafts a reply for you — edit it, then post. You&apos;ll get an email when a new review arrives (Settings → Notifications).</p>
                </section>
              </aside>
            </div>
          )}

          {tab === "rankings" && <RankingsCard lkws={lkws ?? []} ranks={ranks ?? []} suggestions={suggestions} />}

          {tab === "profile" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-3"><h3 className="text-[15px] font-semibold">Profile check</h3>{st.audit && <span className="text-[14px] font-semibold tabular-nums">{st.audit.score}/100</span>}</div>
                <ul className="divide-y divide-line">
                  {(st.audit?.items ?? []).map((i) => (
                    <li key={i.id} className="flex gap-3 px-5 py-3">
                      {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                      <div><p className="text-[14px] font-medium">{i.label}</p>{!i.ok && <p className="text-[13px] text-stone-500">{i.tip}</p>}</div>
                    </li>
                  ))}
                  {!st.audit && <li className="p-6 text-center text-[14px] text-stone-500">{apiBlocked ? "The check runs once Google approves API access." : "Click “Refresh from Google” to run the check."}</li>}
                </ul>
              </section>
              <aside className="grid content-start gap-3">
                <section className="card grid gap-2 p-4">
                  <h3 className="text-[15px] font-semibold">Description</h3>
                  <DescriptionWriter current={p?.description ?? ""} canApply={!apiBlocked} />
                </section>
                {p && (
                  <section className="card grid gap-1 p-4 text-[13px]">
                    <p><span className="text-stone-500">Category:</span> {p.category ?? "—"}{p.extraCategories ? ` +${p.extraCategories}` : ""}</p>
                    <p><span className="text-stone-500">Phone:</span> {p.phone ?? "—"}</p>
                    <p className="truncate"><span className="text-stone-500">Website:</span> {p.website ?? "—"}</p>
                    <p><span className="text-stone-500">Photos:</span> {p.photos ?? "—"}</p>
                    <p><span className="text-stone-500">Last post:</span> {p.lastPost ? timeAgo(p.lastPost) : "never"} · <Link href="/app/publish" className="underline">post an update</Link></p>
                    {p.mapsUri && <a href={p.mapsUri} target="_blank" rel="noopener" className="mt-1 text-[13px] underline">Open on Google Maps</a>}
                  </section>
                )}
                <div className="flex gap-2"><a href="/api/oauth/google/start?for=gbp" className="btn-ghost h-9 px-3.5 text-[13px]">Switch location / account</a><DisconnectLocal /></div>
              </aside>
            </div>
          )}
        </>
      )}
    </>
  );
}

type Rank = { keyword_id: string; day: string; position: number | null; rating: number | null; reviews: number | null; top: { position: number; title: string; rating: number | null; reviews: number | null; me?: boolean }[] };

function RankingsCard({ lkws, ranks, suggestions, compact = false }: { lkws: { id: string; keyword: string }[]; ranks: Rank[]; suggestions: string[]; compact?: boolean }) {
  const rs = ranks as Rank[];
  const days = [...new Set(rs.map((r) => r.day))].sort();
  const latest = (id: string) => rs.filter((r) => r.keyword_id === id).sort((a, b) => b.day.localeCompare(a.day));
  return (
    <section className="card grid content-start gap-4 p-5" id="rankings">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="text-[15px] font-semibold">Google Maps rankings</h3><p className="text-[13px] text-stone-500">Where you appear when locals search on Maps{mapsProvider ? ` · via ${mapsProvider}` : ""}. Checked weekly.</p></div>
        {lkws.length > 0 && mapsReady && <CheckRanks />}
      </div>
      {!mapsReady && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Admin: add a <b>SERPAPI_KEY</b> (serpapi.com, free tier available) or DataForSEO login in Vercel to check Maps positions. This works even without Business Profile API approval.</p>}
      {lkws.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[12px] text-stone-500"><tr><th className="py-2 pr-2 font-medium">Search</th><th className="px-2 py-2 text-right font-medium">Position</th><th className="px-2 py-2 text-right font-medium">Change</th>{!compact && <th className="px-2 py-2 font-medium">Top on Maps</th>}<th /></tr></thead>
            <tbody className="divide-y divide-line">
              {lkws.map((k) => {
                const [now, before] = latest(k.id);
                const ch = now?.position != null && before?.position != null ? before.position - now.position : null;
                return (
                  <tr key={k.id} data-testid="local-rank">
                    <td className="max-w-[220px] truncate py-2 pr-2">{k.keyword}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{!now ? <span className="text-stone-400">not checked</span> : now.position == null ? <span className="text-stone-400">not in top 20</span> : <b>#{now.position}</b>}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${ch == null || ch === 0 ? "text-stone-400" : ch > 0 ? "text-lime-700" : "text-red-600"}`}>{ch == null ? "–" : ch === 0 ? "=" : ch > 0 ? `▲${ch}` : `▼${-ch}`}</td>
                    {!compact && <td className="max-w-[280px] truncate px-2 py-2 text-stone-500">{(now?.top ?? []).slice(0, 3).map((t) => `${t.position}. ${t.title}${t.rating ? ` ${t.rating}★` : ""}`).join(" · ")}</td>}
                    <td className="py-2 text-right"><RemoveLocalKeyword id={k.id} label={k.keyword} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!compact && days.length > 1 && (
        <LineChart title="Maps positions over time" invert min={1} labels={days} series={lkws.slice(0, 8).map((k) => ({ name: k.keyword, values: days.map((dd) => rs.find((r) => r.keyword_id === k.id && r.day === dd)?.position ?? null) }))} />
      )}
      {(!compact || !lkws.length) && <AddLocalKeywords suggestions={suggestions} />}
    </section>
  );
}
