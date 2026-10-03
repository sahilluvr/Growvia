import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { AdminUrl, UrlKind } from "@/lib/admin/data";
import { ago } from "../ui";

export const KIND: Record<UrlKind, { label: string; cls: string }> = {
  project: { label: "Project site", cls: "bg-ink text-white" },
  audit: { label: "SEO audit", cls: "bg-lime/30 text-lime-900" },
  competitor: { label: "Competitor", cls: "bg-amber-50 text-amber-800" },
  ad: { label: "Ad studio", cls: "bg-violet-50 text-violet-700" },
  search_console: { label: "Search Console", cls: "bg-sky-50 text-sky-700" },
};

const scoreCls = (s: number) => (s >= 80 ? "text-lime-700" : s >= 50 ? "text-amber-700" : "text-red-600");

export function UrlTable({ rows, users, showUser = true }: { rows: AdminUrl[]; users?: Map<string, { name: string; email: string }>; showUser?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[13px]" data-testid="admin-urls">
        <thead className="border-b border-line bg-mist/60 text-[12px] text-stone-500"><tr>
          <th className="px-4 py-2.5 font-medium">Website</th><th className="px-3 py-2.5 font-medium">Type</th><th className="px-3 py-2.5 font-medium">Result</th>
          <th className="px-3 py-2.5 font-medium">Project</th>{showUser && <th className="px-3 py-2.5 font-medium">User</th>}<th className="px-3 py-2.5 font-medium">When</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const u = users?.get(r.ownerId);
            const href = /^https?:\/\//i.test(r.url) ? r.url : `https://${r.url}`;
            return (
              <tr key={`${r.kind}-${r.url}-${r.at}-${i}`} className="border-b border-line/70 align-top last:border-0 hover:bg-mist/40">
                <td className="max-w-[360px] px-4 py-2.5">
                  <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium hover:underline">{r.host} <ExternalLink className="h-3 w-3 text-stone-400" /></a>
                  {r.url.replace(/^https?:\/\//, "").replace(/\/$/, "") !== r.host && <span className="block truncate text-[12px] text-stone-500" title={r.url}>{r.url}</span>}
                </td>
                <td className="px-3 py-2.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] ${KIND[r.kind].cls}`}>{KIND[r.kind].label}</span></td>
                <td className="px-3 py-2.5">
                  {r.kind === "audit" ? (
                    r.status === "done" && r.score != null ? <span><b className={`tabular-nums ${scoreCls(r.score)}`}>{r.score}/100</b>{r.issues != null && <span className="text-stone-500"> · {r.issues} issue{r.issues === 1 ? "" : "s"}</span>}</span>
                    : r.status === "failed" ? <span className="text-red-600" title={r.detail ?? ""}>Failed{r.detail ? ` — ${r.detail.slice(0, 60)}` : ""}</span>
                    : <span className="text-stone-500">{r.status ?? "—"}</span>
                  ) : <span className="text-stone-600">{r.detail ?? (r.status ? r.status : "—")}</span>}
                </td>
                <td className="px-3 py-2.5 text-stone-600">{r.project ?? "—"}</td>
                {showUser && <td className="px-3 py-2.5">{u ? <Link href={`/admin/users/${r.ownerId}`} className="hover:underline"><span className="block font-medium">{u.name}</span><span className="text-[12px] text-stone-500">{u.email}</span></Link> : <span className="text-stone-400">deleted user</span>}</td>}
                <td className="whitespace-nowrap px-3 py-2.5 text-stone-500">{ago(r.at)}</td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={showUser ? 6 : 5} className="px-4 py-8 text-center text-stone-500">No websites yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
