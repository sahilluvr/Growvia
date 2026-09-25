"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo, siteOrigin } from "@/lib/data";
import { buildCampaign, buildPlan, GOALS } from "@/lib/engine";
import { SEGMENTS } from "@/lib/plans";
import type { BusinessInput, ContentStatus, LeadInput, Stage } from "@/lib/data/types";

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined;

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const safeNext = (n: string, d: string) => (n.startsWith("/") && !n.startsWith("//") ? n : d);

async function authed() {
  const r = repo();
  // Warm the business lookup in parallel — most actions need it next.
  const [user] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return r;
}

/* ───────────── Auth ───────────── */

export async function signUpAction(_: FormState, f: FormData): Promise<FormState> {
  const name = str(f, "name", 80);
  const email = str(f, "email", 254).toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const res = await repo().signUp({ email, password, name, redirectTo: `${siteOrigin()}/auth/callback?next=/onboarding` });
  if (!res.ok) return { error: res.error };
  if (res.needsConfirmation) return { ok: true, message: `We sent a confirmation link to ${email}. Click it to activate your account.` };
  redirect(safeNext(str(f, "next"), "/onboarding"));
}

export async function signInAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email", 254).toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { error: "Enter your email and password." };
  const res = await repo().signIn({ email, password });
  if (!res.ok) return { error: res.error };
  redirect(safeNext(str(f, "next"), "/app"));
}

export async function forgotAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email", 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  const r = repo();
  const res = await r.requestPasswordReset(email, `${siteOrigin()}/auth/callback?next=/reset`);
  if (!res.ok) return { error: res.error };
  return {
    ok: true,
    message: `If an account exists for ${email}, a reset link is on its way.`,
  };
}

export async function resetPasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== String(f.get("confirm") ?? "")) return { error: "Passwords don't match." };
  const r = await authed();
  const res = await r.updatePassword(password);
  if (!res.ok) return { error: res.error };
  redirect("/app?toast=password");
}

/* ───────────── Onboarding & business ───────────── */

function readBusiness(f: FormData): BusinessInput | string {
  const name = str(f, "name", 80);
  const segment = str(f, "segment", 40);
  if (!name) return "Please enter your business name.";
  if (!SEGMENTS.some((s) => s.id === segment)) return "Please choose your business type.";
  let website = str(f, "website", 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  const goal = str(f, "goal", 80);
  return {
    name,
    segment,
    website: website || null,
    city: str(f, "city", 60) || null,
    goal: GOALS.includes(goal) ? goal : goal || null,
    audience: str(f, "audience", 160) || null,
    offer: str(f, "offer", 160) || null,
    voice: str(f, "voice", 20) || "Friendly",
    channels: f.getAll("channels").map(String).filter(Boolean).slice(0, 10),
  };
}

export async function onboardingAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const input = readBusiness(f);
  if (typeof input === "string") return { error: input };
  await r.saveBusiness(input);
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
  redirect("/app?welcome=1");
}

export async function updateBusinessAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const input = readBusiness(f);
  if (typeof input === "string") return { error: input };
  await r.saveBusiness(input);
  if (f.get("rebuild") === "on") {
    await r.savePlan(buildPlan(input));
    await r.addActivity({ agent: "Strategist", text: "Rebuilt your growth plan with your updated business details.", tag: "Plan updated" });
  }
  revalidatePath("/app", "layout");
  return { ok: true, message: "Business details saved." };
}

export async function updateProfileAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const name = str(f, "name", 80);
  if (!name) return { error: "Please enter your name." };
  const res = await r.updateProfile(name);
  if (!res.ok) return { error: res.error };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== String(f.get("confirm") ?? "")) return { error: "Passwords don't match." };
  const res = await r.updatePassword(password);
  return res.ok ? { ok: true, message: "Password changed." } : { error: res.error };
}

/* ───────────── Plan ───────────── */

export async function regeneratePlanAction() {
  const r = await authed();
  const b = await r.getBusiness();
  if (!b) redirect("/onboarding");
  await Promise.all([r.savePlan(buildPlan(b)), r.addActivity({ agent: "Analyst", text: "Refreshed your growth plan and weekly priorities.", tag: "Plan updated" })]);
  revalidatePath("/app", "layout");
}

export async function togglePriorityAction(index: number) {
  const r = await authed();
  const b = await r.getBusiness();
  if (!b?.plan) return;
  const p = b.plan.priorities[index];
  if (!p) return;
  p.done = !p.done;
  await Promise.all([r.savePlan(b.plan), p.done ? r.addActivity({ agent: p.agent, text: `Completed: ${p.title}`, tag: "Done" }) : null]);
  revalidatePath("/app", "layout");
}

/* ───────────── Campaigns & content ───────────── */

export async function createCampaignAction(oppId: string) {
  const r = await authed();
  const b = await r.getBusiness();
  if (!b?.plan) redirect("/onboarding");
  const opp = b.plan.opportunities.find((o) => o.id === oppId) ?? b.plan.opportunities[0];
  const c = buildCampaign(b, opp);
  const [created] = await Promise.all([
    r.createCampaign({ name: c.name, objective: c.objective, channels: c.channels }, c.items),
    r.addActivity({ agent: "Creator", text: `Drafted ${c.items.length} pieces for “${c.name}”.`, tag: "Content" }),
  ]);
  revalidatePath("/app", "layout");
  redirect(`/app/campaigns/${created.id}`);
}

export async function setCampaignStatusAction(id: string, status: "active" | "completed" | "draft") {
  const r = await authed();
  await r.updateCampaign(id, { status });
  revalidatePath("/app", "layout");
}

export async function deleteCampaignAction(id: string) {
  const r = await authed();
  await r.deleteCampaign(id);
  revalidatePath("/app", "layout");
  redirect("/app/campaigns");
}

export async function saveContentAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const id = str(f, "id", 64);
  const title = str(f, "title", 200);
  const body = String(f.get("body") ?? "").slice(0, 5000);
  if (!title || !body.trim()) return { error: "Title and text can't be empty." };
  await r.updateContent(id, { title, body });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Saved" };
}

const AGENT_FOR: Record<ContentStatus, string> = { draft: "Creator", approved: "Creator", scheduled: "Distributor", published: "Distributor" };

export async function setContentStatusAction(id: string, status: ContentStatus, title: string, when?: string) {
  const r = await authed();
  let scheduled_at: string | null = null;
  if (status === "scheduled") {
    const d = when ? new Date(when) : new Date(Date.now() + 24 * 3600 * 1000);
    scheduled_at = isNaN(d.getTime()) ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : d.toISOString();
  }
  if (status === "published") scheduled_at = new Date().toISOString();
  const verb = { draft: "Moved back to draft", approved: "Approved", scheduled: "Scheduled", published: "Published" }[status];
  await Promise.all([
    r.updateContent(id, { status, scheduled_at }),
    r.addActivity({ agent: AGENT_FOR[status], text: `${verb}: ${title}`, tag: status === "published" ? "Live" : status }),
  ]);
  revalidatePath("/app", "layout");
}

export async function approveAllAction(campaignId: string) {
  const r = await authed();
  const c = await r.getCampaign(campaignId);
  if (!c) return;
  const drafts = c.items.filter((i) => i.status === "draft");
  await Promise.all([
    ...drafts.map((i) => r.updateContent(i.id, { status: "approved" })),
    drafts.length ? r.addActivity({ agent: "Creator", text: `Approved ${drafts.length} pieces in “${c.campaign.name}”.`, tag: "approved" }) : null,
  ]);
  revalidatePath("/app", "layout");
}

/* ───────────── Leads ───────────── */

const STAGES: Stage[] = ["new", "contacted", "qualified", "won", "lost"];

function readLead(f: FormData): LeadInput | string {
  const name = str(f, "name", 120);
  if (!name) return "Please enter the lead's name.";
  const email = str(f, "email", 200);
  if (email && !EMAIL_RE.test(email)) return "That email doesn't look right.";
  const stage = str(f, "stage", 20) as Stage;
  const value = Number(str(f, "value", 20) || 0);
  return {
    name,
    email: email || null,
    phone: str(f, "phone", 40) || null,
    company: str(f, "company", 120) || null,
    source: str(f, "source", 40) || "manual",
    stage: STAGES.includes(stage) ? stage : "new",
    value: Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : 0,
    notes: str(f, "notes", 2000) || null,
    wa_opt_in: f.get("wa_opt_in") === "on",
  };
}

export async function saveLeadAction(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const input = readLead(f);
  if (typeof input === "string") return { error: input };
  const id = str(f, "id", 64);
  if (id) {
    await r.updateLead(id, input);
  } else {
    await Promise.all([r.createLead(input), r.addActivity({ agent: "Lead Finder", text: `Added lead: ${input.name}`, tag: "+1 lead" })]);
  }
  revalidatePath("/app", "layout");
  return { ok: true, message: id ? "Lead updated." : "Lead added." };
}

export async function setLeadStageAction(id: string, stage: Stage, name: string) {
  const r = await authed();
  if (!STAGES.includes(stage)) return;
  await Promise.all([
    r.updateLead(id, { stage }),
    stage === "won" ? r.addActivity({ agent: "Closer", text: `Won a customer: ${name} 🎉`, tag: "Won" })
      : stage === "contacted" ? r.addActivity({ agent: "Closer", text: `Reached out to ${name}.`, tag: "Contacted" }) : null,
  ]);
  revalidatePath("/app", "layout");
}

export async function deleteLeadAction(id: string) {
  const r = await authed();
  await r.deleteLead(id);
  revalidatePath("/app", "layout");
}

/* ───────────── Public lead form ───────────── */

export async function publicLeadAction(_: FormState, f: FormData): Promise<FormState> {
  const bid = str(f, "bid", 64);
  const name = str(f, "name", 120);
  const email = str(f, "email", 200);
  const phone = str(f, "phone", 40);
  if (str(f, "website_hp")) return { ok: true }; // honeypot
  if (!name) return { error: "Please enter your name." };
  if (!email && !phone) return { error: "Please add an email or phone number so we can reply." };
  if (email && !EMAIL_RE.test(email)) return { error: "That email doesn't look right." };
  const ok = await repo().submitPublicLead(bid, { name, email, phone, message: str(f, "message", 2000) });
  return ok ? { ok: true } : { error: "Sorry, something went wrong. Please try again." };
}
