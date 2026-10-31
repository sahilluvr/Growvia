"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { adminClient } from "@/lib/server/admin";
import { planFor, monthStart } from "@/lib/billing/plan";
import { writeSequence } from "@/lib/ai/write";
import { importLeadsAction } from "./email-actions";
import { FINDER_ALLOWANCE, FinderError, MONTHLY_REQUESTS, enrich, finderReady, searchPlaces, suggestions, type Candidate } from "@/lib/leadfinder";

/* Lead finder (v074): pick who + where + how many → Google Maps businesses → contact emails from their websites →
   add as leads → AI writes a 3-email campaign for them → the user reviews it and presses Launch. */

export type FindJob = { id: string; what: string; where: string; wanted: number; status: "enriching" | "done"; results: Candidate[]; saved: number; etaSeconds: number };
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return { user, business, owner: (business as { owner_id?: string } | null)?.owner_id ?? user.id };
}
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const toJob = (j: Record<string, unknown>): FindJob => {
  const results = (j.results ?? []) as Candidate[];
  const pending = results.filter((c) => c.status === "pending").length;
  return { id: String(j.id), what: String(j.what), where: String(j.where), wanted: Number(j.wanted), status: j.status as FindJob["status"], results, saved: Number(j.saved ?? 0), etaSeconds: pending ? Math.ceil(pending / 5) * 4 : 0 };
};

async function usedThisMonth(owner: string) {
  const db = adminClient();
  if (!db) return { mine: 0, all: 0 };
  const since = monthStart();
  const [mine, all] = await Promise.all([
    db.from("lead_finds").select("found").eq("owner_id", owner).gte("created_at", since),
    db.from("lead_finds").select("requests").gte("created_at", since),
  ]);
  return {
    mine: ((mine.data ?? []) as { found: number }[]).reduce((s, r) => s + (r.found || 0), 0),
    all: ((all.data ?? []) as { requests: number }[]).reduce((s, r) => s + (r.requests || 0), 0),
  };
}

/** What the finder page needs: on/off, allowance, suggestions, default area, last search. */
export async function finderStatusAction(): Promise<{ ready: boolean; allowance: number; used: number; suggestions: string[]; area: string; planLabel: string; last: FindJob | null }> {
  const { business, owner } = await me();
  const plan = await planFor(owner);
  const allowance = FINDER_ALLOWANCE[plan.plan] ?? FINDER_ALLOWANCE.free;
  const u = await usedThisMonth(owner).catch(() => ({ mine: 0, all: 0 }));
  const db = adminClient();
  const { data: last } = db && business ? await db.from("lead_finds").select("*").eq("owner_id", owner).eq("business_id", business.id).order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  return {
    ready: finderReady() && Boolean(db), allowance, used: u.mine, suggestions: suggestions(business?.segment), area: business?.city ?? "", planLabel: plan.label,
    last: last && (last as { saved?: number }).saved === 0 && Date.now() - Date.parse(String((last as { created_at: string }).created_at)) < 6 * 3600_000 ? toJob(last) : null,
  };
}

/** Step 1: search Google Maps and create the job. Emails are found by stepFindAction, a few at a time. */
export async function startFindAction(input: { what: string; where: string; count: number }): Promise<R<{ job: FindJob }>> {
  try {
    const { business, owner } = await me();
    const db = adminClient();
    if (!business) return { ok: false, error: "Open a project first." };
    if (!finderReady() || !db) return { ok: false, error: "The lead finder isn't switched on yet — you can still import a list." };
    const what = clean(input.what, 80), where = clean(input.where, 80);
    const count = Math.min(50, Math.max(5, Math.round(Number(input.count) || 20)));
    if (what.length < 3) return { ok: false, error: "Tell us who to look for — for example “property managers”." };
    if (where.length < 2) return { ok: false, error: "Add an area — a city, neighbourhood or region." };
    const plan = await planFor(owner);
    const allowance = FINDER_ALLOWANCE[plan.plan] ?? FINDER_ALLOWANCE.free;
    const u = await usedThisMonth(owner);
    const left = allowance - u.mine;
    if (left <= 0) return { ok: false, error: `You've used all ${allowance} lead lookups on ${plan.label} this month. They reset on the 1st${plan.plan === "agency" ? "" : " — or upgrade for more"}.` };
    if (u.all + Math.ceil(Math.min(count, left) / 20) > MONTHLY_REQUESTS) return { ok: false, error: "The lead finder has reached its monthly limit — it resets on the 1st. You can still import a list." };
    const { places, requests } = await searchPlaces(what, where, Math.min(count, left));
    await db.from("lead_finds").delete().eq("owner_id", owner).lt("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
    const status = places.some((c) => c.status === "pending") ? "enriching" : "done";
    const { data, error } = await db.from("lead_finds").insert({ owner_id: owner, business_id: business.id, what, where, wanted: count, found: places.length, requests, status, results: places }).select("*").single();
    if (error || !data) return { ok: false, error: /lead_finds/.test(error?.message ?? "") ? "The lead finder needs a one-time database update (schema-v074.sql)." : "Couldn't start the search — try again." };
    if (!places.length) return { ok: false, error: `Google Maps found no open “${what}” in ${where}. Try a broader area or a different wording.` };
    return { ok: true, job: toJob(data) };
  } catch (e) {
    return { ok: false, error: e instanceof FinderError ? e.message : "Something went wrong starting the search — try again." };
  }
}

/** Step 2 (polled): checks the next few websites for a contact email. */
export async function stepFindAction(jobId: string): Promise<R<{ job: FindJob }>> {
  try {
    const { business, owner } = await me();
    const db = adminClient();
    if (!db || !business || !/^[0-9a-f-]{36}$/i.test(jobId)) return { ok: false, error: "Search not found." };
    const { data: j } = await db.from("lead_finds").select("*").eq("id", jobId).eq("owner_id", owner).maybeSingle();
    if (!j) return { ok: false, error: "Search not found." };
    const results = (j.results ?? []) as Candidate[];
    const todo = results.map((c, i) => ({ c, i })).filter((x) => x.c.status === "pending").slice(0, 5);
    if (todo.length) {
      const done = await Promise.all(todo.map((x) => enrich(x.c)));
      todo.forEach((x, k) => { results[x.i] = done[k]; });
    }
    const status = results.some((c) => c.status === "pending") ? "enriching" : "done";
    const { data } = await db.from("lead_finds").update({ results, status, updated_at: new Date().toISOString() }).eq("id", jobId).select("*").single();
    return { ok: true, job: toJob(data ?? { ...j, results, status }) };
  } catch {
    return { ok: false, error: "Lost connection while checking websites — it'll pick up where it left off." };
  }
}

/** Step 3: add the chosen businesses as leads, and (optionally) write a campaign for them. */
export async function saveFoundAction(jobId: string, ids: string[], withCampaign: boolean): Promise<R<{ message: string; sequenceId?: string }>> {
  try {
    const { business, owner } = await me();
    const db = adminClient();
    if (!db || !business) return { ok: false, error: "Open a project first." };
    const { data: j } = await db.from("lead_finds").select("*").eq("id", jobId).eq("owner_id", owner).maybeSingle();
    if (!j) return { ok: false, error: "Search not found." };
    const pick = new Set(ids);
    const chosen = ((j.results ?? []) as Candidate[]).filter((c) => pick.has(c.id) && (c.email || c.phone));
    if (!chosen.length) return { ok: false, error: "Tick at least one business with an email or phone number." };
    const tag = clean(`${j.what} ${j.where}`, 40).toLowerCase();
    const rows = chosen.map((c) => ({
      name: c.name, company: c.name, email: c.email ?? "", phone: c.phone ?? "",
      notes: [`Found with Lead finder (Google Maps)`, c.address, c.website, c.rating ? `${c.rating}★ (${c.reviews ?? 0} reviews)` : ""].filter(Boolean).join(" · "),
    }));
    const imp = await importLeadsAction(rows, tag);
    if (!imp?.ok) return { ok: false, error: imp?.error ?? "Couldn't add the leads." };
    await db.from("lead_finds").update({ saved: chosen.length }).eq("id", jobId);
    const withEmail = chosen.filter((c) => c.email).length;
    if (!withCampaign || !withEmail) { revalidatePath("/app", "layout"); return { ok: true, message: `${chosen.length} lead${chosen.length === 1 ? "" : "s"} added, tagged “${tag}”.` }; }
    const c = await campaignForTag(tag, j.what as string, j.where as string);
    return c.ok ? { ok: true, message: `${chosen.length} leads added and a campaign is ready.`, sequenceId: c.sequenceId } : { ok: true, message: `${chosen.length} leads added, tagged “${tag}”. ${c.error}` };
  } catch {
    return { ok: false, error: "Couldn't add the leads — try again." };
  }
}

/** For imported lists: write a campaign for everyone with this tag. */
export async function campaignForTagAction(tag: string, who: string): Promise<R<{ sequenceId: string }>> {
  return campaignForTag(clean(tag, 40).toLowerCase(), clean(who, 80) || "these contacts", "");
}

async function campaignForTag(tag: string, who: string, where: string): Promise<R<{ sequenceId: string }>> {
  const { user, business } = await me();
  if (!business) return { ok: false, error: "Open a project first." };
  const db = supabaseServer();
  const { data: leads } = await db.from("leads").select("id, email, unsubscribed, email_status").eq("business_id", business.id).contains("tags", [tag]).not("email", "is", null).limit(2000);
  const ok = (leads ?? []).filter((l) => l.email && !l.unsubscribed && l.email_status !== "bounced");
  if (!ok.length) return { ok: false, error: `Nobody tagged “${tag}” has a usable email.` };
  const audience = `${who}${where ? ` in ${where}` : ""}`;
  let plan;
  try {
    plan = await writeSequence(business, { goal: `Introduce ${business.name} to ${audience} — show how it can help their business, in a short, personal, non-salesy way — and invite them to a quick call or reply.`, audience, steps: 3, tone: "friendly" });
  } catch {
    return { ok: false, error: "We couldn't write the emails right now — open Email → New campaign to create one for this tag." };
  }
  const { data: mb } = await db.from("mailboxes").select("id").order("created_at").limit(1).maybeSingle();
  const { data: seq, error } = await db.from("sequences").insert({ name: `${plan.name}`.slice(0, 100), mailbox_id: mb?.id ?? null, stop_on_reply: true }).select("id").single();
  if (error || !seq) return { ok: false, error: "Couldn't save the campaign — try again." };
  await db.from("sequence_steps").insert(plan.steps.map((s, i) => ({ sequence_id: seq.id, position: i, wait_days: i === 0 ? 0 : s.delay_days, subject: s.subject, body: s.body })));
  for (let i = 0; i < ok.length; i += 500) {
    await db.from("enrollments").upsert(ok.slice(i, i + 500).map((l) => ({ owner_id: user.id, sequence_id: seq.id, lead_id: l.id })), { onConflict: "sequence_id,lead_id", ignoreDuplicates: true });
  }
  await db.from("activity").insert({ agent: "Lead Finder", text: `Found ${ok.length} ${audience} and wrote a ${plan.steps.length}-email campaign “${plan.name}”.`, tag: "Leads", business_id: business.id });
  revalidatePath("/app", "layout");
  return { ok: true, sequenceId: seq.id };
}

