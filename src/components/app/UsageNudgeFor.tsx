import { planFor, usageFor } from "@/lib/billing/plan";
import { UsageNudge } from "./UsageNudge";

/** Loads the account owner's plan + usage and shows the 80% / 100% nudge (renders nothing when all is fine). */
export async function UsageNudgeFor({ ownerId }: { ownerId: string }) {
  try {
    const [plan, usage] = await Promise.all([planFor(ownerId), usageFor(ownerId)]);
    if (plan.source === "agency") return null;
    return <div className="mb-6"><UsageNudge plan={plan} usage={usage} /></div>;
  } catch { return null; }
}
