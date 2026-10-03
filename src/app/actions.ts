"use server";

import { waitUntil } from "@vercel/functions";
import { findGmailTwin, storedEmailFor } from "@/lib/server/gmail";
import { guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo, siteOrigin } from "@/lib/data";
import { checkLimit } from "@/lib/billing/plan";
import { supabaseServer } from "@/lib/data/supabase";
import { buildCampaign, buildPlan, GOALS } from "@/lib/engine";
import { SEGMENTS } from "@/lib/plans";
import type { BusinessInput, ContentStatus, LeadInput, Stage } from "@/lib/data/types";
import { headers } from "next/headers";
import { CAPTCHA_MODE, verifyCaptcha } from "@/lib/captcha";
import { sendTo, p as para } from "@/lib/notify";

export type FormState = { error?: string; ok?: boolean; message?: string; data?: Record<string, unknown> } | undefined;

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const safeNext = (n: string, d: string) => (n.startsWith("/") && !n.startsWith("//") ? n : d);

/** Bot check for auth forms. Returns the token to hand to Supabase when Supabase does the checking. */
async function human(f: FormData): Promise<{ error?: string; token?: string }> {
  const token = str(f, "captcha", 4000);
  if (CAPTCHA_MODE === "supabase") return { token: token || undefined };
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const v = await verifyCaptcha(token, ip);
  return v.ok ? {} : { error: v.error };
}

async function authed() {
  const r = repo();
  // Warm the business lookup in parallel — most actions need it next.
  const [user] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  return r;
}

/* ───────────── Auth ───────────── */

export async function signUpAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => signUpActionImpl(s, f));
}
async function signUpActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const name = str(f, "name", 80);
  const email = str(f, "email", 254).toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const h = await human(f);
  if (h.error) return { error: h.error };
  const twin = await findGmailTwin(email).catch(() => null);
  if (twin) return { error: `You already have a Growvia account with this Gmail (saved as ${twin.email}). Sign in instead — Gmail treats dots as the same address.` };
  const next = safeNext(str(f, "next"), "/onboarding");
  const res = await repo().signUp({ email, password, name, redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`, captchaToken: h.token });
  if (!res.ok) return { error: res.error };
  if (res.needsConfirmation) return { ok: true, message: `We sent a confirmation link to ${email}. Click it to activate your account.` };
  redirect(next);
}

export async function signInAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => signInActionImpl(s, f));
}
async function signInActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email", 254).toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { error: "Enter your email and password." };
  const h = await human(f);
  if (h.error) return { error: h.error };
  // Same Gmail typed with/without dots (or a +tag) still finds the account.
  const res = await repo().signIn({ email: await storedEmailFor(email).catch(() => email), password, captchaToken: h.token });
  if (!res.ok) return { error: res.error };
  redirect(safeNext(str(f, "next"), "/app"));
}

export async function forgotAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => forgotActionImpl(s, f));
}
async function forgotActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email", 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  const h = await human(f);
  if (h.error) return { error: h.error };
  const r = repo();
  const res = await r.requestPasswordReset(await storedEmailFor(email).catch(() => email), `${siteOrigin()}/auth/callback?next=/reset`, h.token);
  if (!res.ok) return { error: res.error };
  return {
    ok: true,
    message: `If an account exists for ${email}, a reset link is on its way.`,
  };
}

export async function resetPasswordAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => resetPasswordActionImpl(s, f));
}
async function resetPasswordActionImpl(_: FormState, f: FormData): Promise<FormState> {
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

export async function onboardingAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => onboardingActionImpl(s, f));
}
async function onboardingActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const input = readBusiness(f);
  if (typeof input === "string") return { error: input };
  if (f.get("new_project") === "1") {
    const me = await r.getUser();
    if (me) {
      const gate = await checkLimit(me.id, "projects", 1);
      if (!gate.ok) return { error: gate.error };
    }
    const { workspaces } = await r.listWorkspaces();
    const ws = workspaces.find((w) => w.id === str(f, "workspace_id", 64)) ?? workspaces[0] ?? (await r.createWorkspace("My workspace"));
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
  if (f.get("new_project") !== "1") {
    const user = await r.getUser();
    const b = await r.getBusiness();
    if (user && b) {
      // Send in the background so the welcome email never slows down (or breaks) the redirect.
      waitUntil(sendTo({
        ownerId: user.id, businessId: b.id, type: "welcome", to: user.email, dedupe: user.id,
        subject: `Welcome to Growvia, ${user.name.split(" ")[0]} — your growth plan is ready`,
        title: `Your growth plan for ${input.name} is ready`,
        body: para(`Hi ${user.name.split(" ")[0]}, your AI growth team has built a plan with ${plan.opportunities.length} opportunities and drafted your first campaign, “${first.name}”.`) +
          para("<b>Your first 3 steps:</b><br>1. Review and approve this week's content.<br>2. Add your website under <b>SEO & AI search</b> to see how Google and ChatGPT see you.<br>3. Put your lead form on your website so enquiries land in Leads automatically."),
        cta: { label: "Open Growvia", url: `${siteOrigin()}/app` },
      }).catch(() => null));
    }
  }
  // Picked a paid plan on the pricing page: finish at checkout with that plan selected.
  const chosen = str(f, "chosen_plan", 10);
  if (["pro", "growth", "agency"].includes(chosen)) redirect(`/app/billing?plan=${chosen}&interval=${str(f, "chosen_interval", 5) === "year" ? "year" : "month"}&welcome=1#upgrade`);
  redirect("/app?welcome=1");
}

export async function updateBusinessAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => updateBusinessActionImpl(s, f));
}
async function updateBusinessActionImpl(_: FormState, f: FormData): Promise<FormState> {
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

export async function updateProfileAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => updateProfileActionImpl(s, f));
}
async function updateProfileActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const r = await authed();
  const name = str(f, "name", 80);
  if (!name) return { error: "Please enter your name." };
  const res = await r.updateProfile(name);
  if (!res.ok) return { error: res.error };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => changePasswordActionImpl(s, f));
}
async function changePasswordActionImpl(_: FormState, f: FormData): Promise<FormState> {
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

export async function saveContentAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => saveContentActionImpl(s, f));
}
async function saveContentActionImpl(_: FormState, f: FormData): Promise<FormState> {
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

export async function setContentStatusAction(id: string, status: ContentStatus, title: string, _when?: string) {
  const r = await authed();
  // Scheduling goes through scheduleContentAction, which checks the channel is really connected.
  if (status === "scheduled") return;
  const scheduled_at = status === "published" ? new Date().toISOString() : null;
  const verb = { draft: "Moved back to draft", approved: "Approved", scheduled: "Scheduled", published: "Marked as posted" }[status];
  // Leaving "scheduled" cancels the queued auto-post so it can't go out later by surprise.
  await supabaseServer().from("social_posts").delete().eq("content_item_id", id).in("status", ["scheduled", "draft"]);
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

export async function saveLeadAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => saveLeadActionImpl(s, f));
}
async function saveLeadActionImpl(_: FormState, f: FormData): Promise<FormState> {
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

export async function publicLeadAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => publicLeadActionImpl(s, f));
}
async function publicLeadActionImpl(_: FormState, f: FormData): Promise<FormState> {
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
