"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { adminClient } from "@/lib/server/admin";
import { canScan, scanAndSave } from "@/lib/security/store";

type R = { ok: true; message: string } | { ok: false; error: string };

/** "Scan now" on the Security health page. */
export async function runSecurityScanAction(): Promise<R> {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  const db = adminClient();
  if (!db) return { ok: false, error: "Security scans aren't available right now." };
  if (!business.website) return { ok: false, error: "Add your website address in Settings first, then scan." };
  const owner = business.owner_id ?? user.id;
  const allowed = await canScan(db, owner, business.id);
  if (!allowed.ok) return allowed;
  try {
    const { report, prev } = await scanAndSave(db, { id: business.id, owner_id: owner, website: business.website, name: business.name });
    revalidatePath("/app/security"); revalidatePath("/app");
    const delta = prev ? report.score - prev.score : 0;
    return { ok: true, message: `Scan complete: ${report.score}/100 (grade ${report.grade})${prev && delta ? `, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since last time` : ""}.` };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { ok: false, error: m && m.length < 140 && !/relation|column|schema/i.test(m) ? m : /relation|site_security/i.test(m) ? "Security health needs a one-time database update (schema-v078.sql)." : "The scan didn't finish — please try again in a minute." };
  }
}
