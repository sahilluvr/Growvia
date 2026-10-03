export const maxDuration = 60; // building the plan + first campaign can take a while on a cold start
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/data";
import Link from "next/link";
import { Wizard } from "./Wizard";
import { checkLimit } from "@/lib/billing/plan";
import { LIMITS, PRICES } from "@/lib/billing/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set up your growth engine" };

export default async function OnboardingPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { r, user } = await requireUser();
  if (searchParams.new) {
    const { workspaces } = await r.listWorkspaces();
    const ws = workspaces.find((w) => w.id === searchParams.ws) ?? workspaces[0];
    if (!ws) redirect("/onboarding");
    // Say so up front instead of after the whole form.
    const gate = await checkLimit(user.id, "projects", 1);
    if (!gate.ok) return (
      <main className="grid min-h-screen place-items-center bg-paper px-4">
        <div className="card grid max-w-md gap-4 p-7 text-center" data-testid="project-limit">
          <h1 className="text-[22px] font-semibold tracking-tight">Add more businesses with a paid plan</h1>
          <p className="text-[14px] text-stone-600">{gate.error}</p>
          <p className="text-[13px] text-stone-500">Pro covers {LIMITS.pro.projects} projects for ${PRICES.pro.month}/month, Growth {LIMITS.growth.projects} for ${PRICES.growth.month} and Agency {LIMITS.agency.projects} for ${PRICES.agency.month} — perfect for more locations, brands or client sites. Any plan starts the moment you pay.</p>
          <div className="flex justify-center gap-2"><Link href="/app/billing?plan=pro#upgrade" className="btn-primary h-10 px-4 text-[14px]">See plans</Link><Link href="/app" className="btn-ghost h-10 px-4 text-[14px]">Back</Link></div>
        </div>
      </main>
    );
    return <Wizard userName={user.name.split(" ")[0]} initial={{ name: "", segment: "", city: "", website: searchParams.website ?? "" }} newProject={{ workspaceId: ws.id, workspaceName: ws.name }} />;
  }
  const b = await r.getBusiness();
  const chosen = ["pro", "growth", "agency"].includes(searchParams.plan ?? "") ? { plan: searchParams.plan!, interval: searchParams.interval === "year" ? "year" : "month" } : null;
  if (b?.plan) redirect(chosen ? `/app/billing?plan=${chosen.plan}&interval=${chosen.interval}#upgrade` : "/app");
  return (
    <Wizard
      userName={user.name.split(" ")[0]}
      initial={{
        name: b?.name ?? searchParams.name ?? "",
        segment: b?.segment ?? searchParams.segment ?? "",
        city: b?.city ?? searchParams.city ?? "",
        website: b?.website ?? searchParams.website ?? "",
      }}
      chosen={chosen}
    />
  );
}
