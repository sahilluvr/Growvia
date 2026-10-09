import Link from "next/link";
import type { Metadata } from "next";
import { Globe, Plus } from "lucide-react";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { SEGMENTS } from "@/lib/plans";
import { NewWorkspace, ProjectMenu, SwitchButton, WorkspaceTitle } from "./client";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const db = supabaseServer();
  const [{ r, business }, { data: audits }, { data: leads }] = await Promise.all([
    requireBusiness(),
    db.from("seo_audits").select("business_id, score, created_at").eq("status", "done").order("created_at", { ascending: false }).limit(500),
    db.from("leads").select("business_id").limit(5000),
  ]);
  const { workspaces, projects } = await r.listWorkspaces();
  const score = (id: string) => audits?.find((a) => a.business_id === id)?.score ?? null;
  const leadCount = (id: string) => (leads ?? []).filter((l) => l.business_id === id).length;
  return (
    <>
      <PageHeader title="Projects" sub="Workspaces keep each client or brand separate. Every project is a website/business with its own leads, campaigns, SEO and plan." />
      <div className="grid gap-8">
        {workspaces.map((w) => (
          <section key={w.id}>
            <WorkspaceTitle id={w.id} name={w.name} canDelete={workspaces.length > 1 && !projects.some((p) => p.workspace_id === w.id)} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.filter((p) => p.workspace_id === w.id).map((p) => {
                const s = score(p.id);
                return (
                  <div key={p.id} className={`card flex flex-col gap-3 p-4 ${p.id === business.id ? "ring-2 ring-ink" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-tight">{p.name}</p>
                        <p className="truncate text-[12px] text-stone-500">{SEGMENTS.find((x) => x.id === p.segment)?.label}{p.city ? ` · ${p.city}` : ""}</p>
                      </div>
                      <ProjectMenu id={p.id} name={p.name} workspaceId={w.id} workspaces={workspaces.map((x) => ({ id: x.id, name: x.name }))} />
                    </div>
                    <p className="flex items-center gap-1.5 truncate text-[13px] text-stone-600"><Globe className="h-3.5 w-3.5 shrink-0" />{p.website ? p.website.replace(/^https?:\/\//, "") : <span className="text-stone-400">No website yet</span>}</p>
                    <div className="flex gap-4 text-[12px] text-stone-500">
                      <span><b className="text-[15px] font-semibold text-ink tabular-nums">{s ?? "—"}</b> SEO score</span>
                      <span><b className="text-[15px] font-semibold text-ink tabular-nums">{leadCount(p.id)}</b> leads</span>
                    </div>
                    <div className="mt-auto flex gap-2">
                      {p.id === business.id ? <span className="rounded-full bg-lime/25 px-3 py-1.5 text-[12px] font-medium text-lime-800">Current project</span> : <SwitchButton id={p.id} />}
                      <SwitchButton id={p.id} to="/app/seo" label="SEO" ghost />
                    </div>
                  </div>
                );
              })}
              <Link href={`/onboarding?new=1&ws=${w.id}`} className="card flex min-h-[150px] flex-col items-center justify-center gap-2 border-dashed p-4 text-[14px] text-stone-500 hover:border-ink hover:text-ink">
                <Plus className="h-5 w-5" /> Add project
              </Link>
            </div>
          </section>
        ))}
        <NewWorkspace />
      </div>
    </>
  );
}
