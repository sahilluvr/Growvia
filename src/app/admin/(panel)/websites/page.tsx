import Link from "next/link";
import { loadUrls, loadUsers, type UrlKind } from "@/lib/admin/data";
import { Stat } from "../ui";
import { KIND, UrlTable } from "./UrlTable";

export const metadata = { title: "Websites" };

const FILTERS: [string, string][] = [["all", "All"], ["project", "Project sites"], ["audit", "SEO audits"], ["competitor", "Competitors"], ["ad", "Ad studio"], ["search_console", "Search Console"]];

/** Every website people added or had Growvia evaluate, by user. */
export default async function AdminWebsites({ searchParams }: { searchParams: { q?: string; t?: string; view?: string } }) {
  const [rows, users] = await Promise.all([loadUrls(), loadUsers()]);
  const byId = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const t = (searchParams.t ?? "all") as UrlKind | "all";
  const view = searchParams.view === "domains" ? "domains" : "all";
  const list = rows.filter((r) => (t === "all" || r.kind === t) && (!q || `${r.url} ${r.project ?? ""} ${byId.get(r.ownerId)?.email ?? ""} ${byId.get(r.ownerId)?.name ?? ""}`.toLowerCase().includes(q)));
  const weekAgo = Date.now() - 7 * 86400_000;
  const audits = rows.filter((r) => r.kind === "audit");
  const done = audits.filter((a) => a.status === "done" && a.score != null);
  const avg = done.length ? Math.round(done.reduce((s, a) => s + (a.score ?? 0), 0) / done.length) : null;
  const domains = new Map<string, { host: string; kinds: Set<UrlKind>; users: Set<string>; audits: number; best: number | null; last: string }>();
  for (const r of list) {
    const d = domains.get(r.host) ?? { host: r.host, kinds: new Set(), users: new Set(), audits: 0, best: null, last: r.at };
    d.kinds.add(r.kind); d.users.add(r.ownerId);
    if (r.kind === "audit") { d.audits++; if (r.score != null) d.best = Math.max(d.best ?? 0, r.score); }
    if (r.at > d.last) d.last = r.at;
    domains.set(r.host, d);
  }
  const link = (patch: Record<string, string>) => `/admin/websites?${new URLSearchParams({ ...(q ? { q } : {}), t, view, ...patch })}`;
  const csv = `data:text/csv;charset=utf-8,${encodeURIComponent(["url,host,type,result,project,user_name,user_email,date", ...list.map((r) => [r.url, r.host, KIND[r.kind].label, r.kind === "audit" ? (r.score != null ? `${r.score}/100` : r.status ?? "") : r.detail ?? "", r.project ?? "", byId.get(r.ownerId)?.name ?? "", byId.get(r.ownerId)?.email ?? "", r.at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"))}`;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Websites <span className="text-stone-400">({list.length})</span></h1>
          <p className="text-[14px] text-stone-500">Every URL users added or had Growvia evaluate — project sites, SEO audits, competitors, Ad studio pages and Search Console properties.</p>
        </div>
        <a href={csv} download="growvia-websites.csv" className="btn-ghost h-9 px-3 text-[13px]">Export CSV</a>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Unique domains" value={new Set(rows.map((r) => r.host)).size} sub={(() => { const n = new Set(rows.map((r) => r.ownerId)).size; return `${n} user${n === 1 ? "" : "s"}`; })()} />
        <Stat label="SEO audits" value={audits.length} sub={`${audits.filter((a) => Date.parse(a.at) > weekAgo).length} this week`} />
        <Stat label="Average audit score" value={avg != null ? `${avg}/100` : "—"} tone={avg == null ? undefined : avg >= 80 ? "good" : avg >= 50 ? "warn" : "bad"} sub={`${audits.filter((a) => a.status === "failed").length} failed`} />
        <Stat label="Competitors tracked" value={rows.filter((r) => r.kind === "competitor").length} sub={`${rows.filter((r) => r.kind === "ad").length} Ad studio pages`} />
      </div>
      <form className="flex flex-wrap gap-2" action="/admin/websites">
        <input name="q" defaultValue={q} placeholder="Search URL, project or user" className="h-10 w-full max-w-sm rounded-xl border border-line bg-white px-3 text-[14px]" aria-label="Search websites" />
        <input type="hidden" name="t" value={t} /><input type="hidden" name="view" value={view} />
        <button className="btn-primary h-10 px-4 text-[14px]">Search</button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, l]) => <Link key={k} href={link({ t: k })} className={`rounded-full border px-3 py-1 text-[13px] ${t === k ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600"}`}>{l}</Link>)}
        <span className="mx-1 self-center text-stone-300">|</span>
        {[["all", "Every entry"], ["domains", "Group by domain"]].map(([k, l]) => <Link key={k} href={link({ view: k })} className={`rounded-full px-3 py-1 text-[13px] ${view === k ? "bg-mist font-medium" : "text-stone-500"}`}>{l}</Link>)}
      </div>
      {view === "all" ? <UrlTable rows={list.slice(0, 1000)} users={byId} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]" data-testid="admin-domains">
            <thead className="border-b border-line bg-mist/60 text-[12px] text-stone-500"><tr><th className="px-4 py-2.5 font-medium">Domain</th><th className="px-3 py-2.5 font-medium">Seen as</th><th className="px-3 py-2.5 text-right font-medium">Users</th><th className="px-3 py-2.5 text-right font-medium">Audits</th><th className="px-3 py-2.5 text-right font-medium">Best score</th></tr></thead>
            <tbody>
              {[...domains.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 1000).map((d) => (
                <tr key={d.host} className="border-b border-line/70 last:border-0 hover:bg-mist/40">
                  <td className="px-4 py-2.5"><Link href={link({ q: d.host, view: "all" })} className="font-medium hover:underline">{d.host}</Link></td>
                  <td className="px-3 py-2.5"><span className="flex flex-wrap gap-1">{[...d.kinds].map((k) => <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] ${KIND[k].cls}`}>{KIND[k].label}</span>)}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.users.size}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.audits}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.best != null ? `${d.best}/100` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > 1000 && <p className="text-[12px] text-stone-500">Showing the newest 1,000 — search or filter to narrow down, or export the CSV for everything.</p>}
    </div>
  );
}
