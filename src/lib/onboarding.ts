import "server-only";
import { repo, siteOrigin } from "@/lib/data";
import { buildCampaign, buildPlan } from "@/lib/engine";
import type { BusinessInput } from "@/lib/data/types";
import { sendTo, p as para } from "@/lib/notify";
import { afterReply } from "@/lib/server/host";
import { startFirstReport } from "@/lib/first-report";

/** Saves the business, builds the plan + first campaign, sends the welcome email and starts the Growth Report.
 *  Returns where to send the user next. Shared by the onboarding form and the one-step sign-up. */
export async function completeOnboarding(r: ReturnType<typeof repo>, input: BusinessInput, o: { newProject?: boolean; workspaceId?: string; plan?: string; interval?: string } = {}): Promise<string> {
  if (o.newProject) {
    const { workspaces } = await r.listWorkspaces();
    const ws = workspaces.find((w) => w.id === o.workspaceId) ?? workspaces[0] ?? (await r.createWorkspace("My workspace"));
    await r.createBusiness(input, ws.id); // also switches to it
  } else {
    await r.saveBusiness(input);
  }
  const plan = buildPlan(input);
  const first = buildCampaign(input, plan.opportunities[0]);
  await Promise.all([
    r.savePlan(plan),
    r.createCampaign({ name: first.name, objective: first.objective, channels: first.channels }, first.items),
    r.addActivity([
      { agent: "Strategist", text: `Built your growth plan — ${plan.opportunities.length} opportunities found.`, tag: "Plan ready" },
      { agent: "Creator", text: `Drafted ${first.items.length} pieces for “${first.name}”. Ready for your review.`, tag: "Content" },
    ]),
  ]);
  const user = await r.getUser();
  const biz = await r.getBusiness();
  if (!o.newProject && user && biz) {
    await afterReply(sendTo({
      ownerId: user.id, businessId: biz.id, type: "welcome", to: user.email, dedupe: user.id,
      subject: `Welcome to Growvia, ${user.name.split(" ")[0]} — your Growth Report is on its way`,
      title: `Your Growth Report for ${input.name} is being prepared`,
      body: para(`Hi ${user.name.split(" ")[0]}, Growvia is checking how Google and AI assistants see ${input.name}, measuring your website speed and writing your action plan.`) +
        para("<b>What to do next:</b><br>1. Open your Growth Report and fix your quickest wins.<br>2. Connect your tools (email, Google Business, social) from the checklist on Home.<br>3. Put your lead form on your website so enquiries land in Leads automatically."),
      cta: { label: "Open your Growth Report", url: `${siteOrigin()}/app/report` },
    }).catch(() => null));
  }
  const started = user && biz ? await startFirstReport(biz as never, user.id).catch(() => false) : false;
  const planQ = ["pro", "growth", "agency"].includes(o.plan ?? "") ? `&plan=${o.plan}&interval=${o.interval === "year" ? "year" : "month"}` : "";
  if (started || biz?.website) return `/app/report?welcome=1${planQ}`;
  if (planQ) return `/app/billing?welcome=1${planQ}#upgrade`;
  return "/app?welcome=1";
}
