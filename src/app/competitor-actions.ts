"use server";
import { guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { planFor, upgradeHint } from "@/lib/billing/plan";
import { PLAN_INFO } from "@/lib/billing/catalog";
import { MAX_COMPETITORS, hostOf, refreshSnapshots, syncSeoPrefs, type Biz } from "@/lib/competitors/core";

type FormState = { ok?: boolean; error?: string; message?: string; id?: string } | undefined;

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  const db = supabaseServer();
  const { data } = await db.from("businesses").select("id, owner_id, name, website, city, local_state").eq("id", business.id).single();
  return { db, user, biz: data as Biz };
}
const done = () => { revalidatePath("/app/competitors", "layout"); revalidatePath("/app/seo"); };

export async function addCompetitorAction(input: { name: string; website?: string | null; placeId?: string | null; source?: string }): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, user, biz } = await me();
    const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (name.length < 2) return { error: "Type the competitor's business name." };
    const website = hostOf(input.website ?? "") || null;
    if (input.website?.trim() && !website) return { error: "That website doesn't look right — try something like pizzapalace.in." };
    if (website && website === hostOf(biz.website)) return { error: "That's your own website." };
    const { count } = await db.from("competitors").select("id", { count: "exact", head: true }).eq("business_id", biz.id);
    const plan = await planFor(biz.owner_id ?? user.id);
    const cap = Math.min(MAX_COMPETITORS, plan.limits.competitors);
    if ((count ?? 0) >= cap) return { error: `Your ${PLAN_INFO[plan.plan].name} plan tracks ${cap} competitors per project. ${upgradeHint(plan.plan, "competitors")}` };
    const { data, error } = await db.from("competitors").insert({ business_id: biz.id, owner_id: user.id, name, website, place_id: input.placeId ?? null, source: ["maps", "google", "ai", "manual"].includes(input.source ?? "") ? input.source : "manual" }).select("id").single();
    if (error) return { error: error.code === "23505" ? `${name} is already on your list.` : "Couldn't save — run the latest schema.sql in Supabase." };
    await syncSeoPrefs(db, biz.id);
    // First numbers straight away (one Google Maps search), so the scorecard isn't empty.
    await refreshSnapshots(db, biz, Date.now() + 15_000).catch(() => null);
    done();
    return { ok: true, id: data.id, message: `Tracking ${name}.` };
  });
}

export async function addCompetitorFormAction(_: FormState, f: FormData): Promise<FormState> {
  return addCompetitorAction({ name: String(f.get("name") ?? ""), website: String(f.get("website") ?? ""), source: "manual" });
}

export async function updateCompetitorAction(id: string, patch: { name?: string; website?: string }): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, biz } = await me();
    const row: Record<string, string | null> = {};
    if (patch.name !== undefined) { const n = patch.name.trim().slice(0, 80); if (n.length < 2) return { error: "Name is too short." }; row.name = n; }
    if (patch.website !== undefined) { const w = hostOf(patch.website); if (patch.website.trim() && !w) return { error: "That website doesn't look right." }; row.website = w || null; }
    const { error } = await db.from("competitors").update(row).eq("id", id).eq("business_id", biz.id);
    if (error) return { error: error.code === "23505" ? "Another competitor already has that name." : "Couldn't save." };
    await syncSeoPrefs(db, biz.id);
    done();
    return { ok: true, message: "Saved." };
  });
}

export async function removeCompetitorAction(id: string): Promise<FormState> {
  const { db, biz } = await me();
  await db.from("competitors").delete().eq("id", id).eq("business_id", biz.id);
  await db.from("competitor_snapshots").delete().eq("business_id", biz.id).eq("subject", id);
  await syncSeoPrefs(db, biz.id);
  done();
  return { ok: true };
}

export async function refreshCompetitorsAction(): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, biz } = await me();
    const r = await refreshSnapshots(db, biz);
    done();
    if (!r.ok) return { error: r.error };
    return { ok: true, message: `Checked ${r.checked} on Google Maps — found ${r.found}.` };
  });
}
