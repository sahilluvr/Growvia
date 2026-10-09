"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, adminConfigured, checkCredentials, isAdmin, newSessionToken, sessionMaxAge } from "@/lib/admin/auth";
import { db, logAdmin } from "@/lib/admin/data";
import { rzp } from "@/lib/billing/razorpay";
import { PLAN_INFO, billingReady } from "@/lib/billing/config";
import { runIndexNow } from "@/lib/seo/indexnow";

type R = { ok?: boolean; error?: string; message?: string } | undefined;

/* ── Login / logout ── */
const tries = new Map<string, { n: number; at: number }>();
export async function adminLoginAction(_: R, f: FormData): Promise<R> {
  if (!adminConfigured) return { error: "The admin login isn't switched on yet: add ADMIN_PASSWORD (at least 8 characters) in Vercel → Environment Variables, then redeploy." };
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const t = tries.get(ip);
  if (t && t.n >= 5 && Date.now() - t.at < 10 * 60_000) return { error: "Too many attempts. Wait 10 minutes and try again." };
  await new Promise((r) => setTimeout(r, 400)); // slows down guessing
  const ok = checkCredentials(String(f.get("email") ?? ""), String(f.get("password") ?? ""));
  if (!ok) {
    tries.set(ip, { n: (t && Date.now() - t.at < 10 * 60_000 ? t.n : 0) + 1, at: Date.now() });
    return { error: "Wrong email or password." };
  }
  tries.delete(ip);
  cookies().set(ADMIN_COOKIE, newSessionToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: sessionMaxAge });
  await logAdmin("login", {}, { ip });
  redirect("/admin");
}

export async function adminLogoutAction() {
  cookies().set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0 });
  redirect("/admin/login");
}

/* ── User actions ── */
function guard(): R | null {
  return isAdmin() ? null : { error: "Your admin session expired — sign in again." };
}
const done = (id?: string) => { revalidatePath("/admin", "layout"); if (id) revalidatePath(`/admin/users/${id}`); };
async function emailOf(id: string) {
  const { data } = await db().auth.admin.getUserById(id);
  return data.user?.email ?? undefined;
}
async function upsertSub(id: string, patch: Record<string, unknown>) {
  const { error } = await db().from("subscriptions").upsert({ owner_id: id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
}

export async function setUserActiveAction(id: string, active: boolean): Promise<R> {
  const g = guard(); if (g) return g;
  const { error } = await db().auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" } as never);
  if (error) return { error: error.message };
  await logAdmin(active ? "user.activate" : "user.deactivate", { id, email: await emailOf(id) });
  done(id);
  return { ok: true, message: active ? "User activated — they can sign in again." : "User deactivated — they can't sign in (existing sessions end within the hour)." };
}

/** Pro, Growth or Agency without payment, forever or until a date. */
export async function grantPlanAction(id: string, plan: "pro" | "growth" | "agency", until: string | null, note = ""): Promise<R> {
  const g = guard(); if (g) return g;
  const end = until ? new Date(`${until}T23:59:59Z`) : null;
  if (end && (Number.isNaN(end.getTime()) || end.getTime() < Date.now())) return { error: "Pick an end date in the future (or leave it empty for no end date)." };
  const { data: cur } = await db().from("subscriptions").select("rzp_subscription_id, status").eq("owner_id", id).maybeSingle();
  if (cur?.rzp_subscription_id && ["active", "authenticated", "pending"].includes(cur.status)) {
    return { error: "This user has an active paid subscription. Cancel it first (Downgrade → cancel the Razorpay subscription), then give a plan." };
  }
  await upsertSub(id, { plan, status: "comp", comp_until: end?.toISOString() ?? null, admin_note: note.slice(0, 300) || null, rzp_subscription_id: null, cancel_at_period_end: false });
  await logAdmin(`plan.grant_${plan}`, { id, email: await emailOf(id) }, { until: end?.toISOString() ?? null, note });
  done(id);
  return { ok: true, message: `${PLAN_INFO[plan].name} switched on${end ? ` until ${end.toDateString()}` : " with no end date"}.` };
}

/** Back to Free: ends any trial / complimentary Pro; optionally cancels a paid Razorpay subscription right away. */
export async function downgradeAction(id: string, cancelPaid: boolean): Promise<R> {
  const g = guard(); if (g) return g;
  const { data: cur } = await db().from("subscriptions").select("rzp_subscription_id, status").eq("owner_id", id).maybeSingle();
  const paidLive = cur?.rzp_subscription_id && ["active", "authenticated", "pending"].includes(cur.status);
  if (paidLive && !cancelPaid) return { error: "This user is paying. Tick “Also cancel their Razorpay subscription” to downgrade them (refunds are done in Razorpay)." };
  if (paidLive && cancelPaid) {
    if (!billingReady()) return { error: "Razorpay keys aren't set, so the paid subscription can't be cancelled from here." };
    try { await rzp.cancel(cur!.rzp_subscription_id!, false); } catch (e) { return { error: `Razorpay couldn't cancel it: ${(e as Error).message}` }; }
  }
  await upsertSub(id, { plan: "free", status: paidLive ? "cancelled" : "none", comp_until: null, trial_end: new Date().toISOString(), cancel_at_period_end: false, current_end: paidLive ? new Date().toISOString() : null, cancelled_at: paidLive ? new Date().toISOString() : null });
  await logAdmin("plan.downgrade", { id, email: await emailOf(id) }, { cancelledPaid: Boolean(paidLive) });
  done(id);
  return { ok: true, message: paidLive ? "Downgraded to Free and the Razorpay subscription is cancelled. Refund in Razorpay if needed." : "Downgraded to Free." };
}

export async function extendTrialAction(id: string, days: number): Promise<R> {
  const g = guard(); if (g) return g;
  const n = Math.max(1, Math.min(365, Math.round(days)));
  const { data: cur } = await db().from("subscriptions").select("trial_end").eq("owner_id", id).maybeSingle();
  const from = Math.max(Date.now(), cur?.trial_end ? Date.parse(cur.trial_end) : 0);
  const trial_end = new Date(from + n * 86400_000).toISOString();
  await upsertSub(id, { trial_end });
  await logAdmin("trial.extend", { id, email: await emailOf(id) }, { days: n, trial_end });
  done(id);
  return { ok: true, message: `Trial now ends ${new Date(trial_end).toDateString()}.` };
}

export async function resendConfirmAction(id: string): Promise<R> {
  const g = guard(); if (g) return g;
  const email = await emailOf(id);
  if (!email) return { error: "User not found." };
  const { error } = await db().auth.admin.updateUserById(id, { email_confirm: true } as never);
  if (error) return { error: error.message };
  await logAdmin("user.confirm_email", { id, email });
  done(id);
  return { ok: true, message: "Email marked as confirmed — they can sign in now." };
}

/** Sends every public page to Bing & co. via IndexNow right now (normally automatic after each deploy). */
export async function indexNowAllAction(): Promise<R> {
  const g = guard(); if (g) return g;
  try {
    const r = await runIndexNow(db(), { force: true });
    if ("skipped" in r) return { error: `Not sent: ${r.skipped}.` };
    await logAdmin("seo.indexnow", {}, { sent: r.sent });
    revalidatePath("/admin");
    return { ok: true, message: `Sent ${r.sent} pages to Bing, Yandex and other IndexNow search engines.` };
  } catch (e) { return { error: e instanceof Error ? e.message : "IndexNow failed — try again later." }; }
}
