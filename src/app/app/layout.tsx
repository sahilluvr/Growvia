import { early, projectIdNow, repo, requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { Shell } from "@/components/app/Shell";
import { myRole } from "@/lib/team";
import { planFor, planForProject } from "@/lib/billing/plan";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const countP = early(repo().countLeads("new"));
  const unreadP = early(Promise.resolve(supabaseServer().from("threads").select("id", { count: "exact", head: true }).eq("unread", true)).then((r) => r.count ?? 0));
  const listP = early(repo().listWorkspaces());
  // Everything the sidebar needs starts at once, in the same round trip as the login check.
  const pid = projectIdNow();
  const planP = early(pid ? planForProject(pid).catch(() => null) : Promise.resolve(null));
  const { user, business, r } = await requireBusiness();
  const [newLeads, unread, list, role, plan] = await Promise.all([countP, unreadP, listP, business.owner_id === user.id ? "owner" : myRole(business.owner_id, user.id), planP.then((p) => p ?? planFor(business.owner_id)).catch(() => null)]);
  const projects = { current: business.id, workspaces: list.workspaces.map((w) => ({ id: w.id, name: w.name })), projects: list.projects.map((p) => ({ id: p.id, name: p.name, workspace_id: p.workspace_id, website: p.website })) };
  return (
    <Shell user={user} business={{ name: business.name, segment: business.segment, city: business.city }} projects={projects} newLeads={newLeads} unread={unread} mode={r.mode} plan={plan ? { label: plan.label, source: plan.source, trialDaysLeft: plan.trialDaysLeft, mine: business.owner_id === user.id, paymentIssue: plan.paymentIssue } : undefined}>
      {role === "viewer" && <p role="status" className="mb-4 rounded-xl border border-line bg-mist px-4 py-2.5 text-[13px] text-stone-600"><b className="text-ink">View-only access.</b> You can see everything in this project, but changes are turned off. Ask the owner for Member access to edit.</p>}
      {children}
    </Shell>
  );
}
