"use server";
import { dbErr, guard } from "@/lib/errors";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo, siteOrigin } from "@/lib/data";
import { PROJECT_COOKIE, supabaseServer } from "@/lib/data/supabase";
import { canManage, myRole } from "@/lib/team";
import { esc, p, sendTo } from "@/lib/notify";

type FormState = { ok?: boolean; error?: string; message?: string } | undefined;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function manager() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  const role = await myRole(business.owner_id, user.id);
  return { user, business, role, db: supabaseServer(), ownerId: business.owner_id };
}
const done = () => revalidatePath("/app/settings");

async function sendInvite(ownerId: string, inviter: string, account: string, email: string, token: string, role: string) {
  const url = `${siteOrigin()}/invite/${token}`;
  return sendTo({ ownerId, type: "invite", to: email, subject: `${inviter} invited you to ${account} on Growvia`, title: `Join ${account} on Growvia`,
    body: p(`${esc(inviter)} has invited you to work together on Growvia as <b>${esc(role)}</b> — leads, email, WhatsApp, social posts and SEO in one place.`) + p("Use this email address when you sign up or sign in. The link stays valid until you accept it."),
    cta: { label: "Accept invitation", url } });
}

export async function inviteMemberAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => inviteMemberActionImpl(s, f));
}
async function inviteMemberActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { user, business, role, db, ownerId } = await manager();
  if (!canManage(role)) return { error: "Only the owner or an admin can invite people." };
  const emails = String(f.get("emails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  if (!emails.length) return { error: "Enter at least one email." };
  const bad = emails.find((e) => !EMAIL_RE.test(e));
  if (bad) return { error: `“${bad}” isn't a valid email.` };
  if (emails.includes(user.email.toLowerCase())) return { error: "You're already on the team." };
  const newRole = ["admin", "member", "viewer"].includes(String(f.get("role"))) ? String(f.get("role")) : "member";
  if (newRole === "admin" && role !== "owner") return { error: "Only the owner can add admins." };
  const scope = String(f.get("scope") ?? "all");
  const ws = scope === "all" ? null : f.getAll("workspaces").map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (ws && !ws.length) return { error: "Pick at least one workspace, or choose “All workspaces”." };
  const { data: acct } = await db.from("profiles").select("name").eq("id", ownerId).maybeSingle();
  const account = `${acct?.name ?? business.name}'s Growvia`;
  const sent: string[] = [];
  const failed: string[] = [];
  for (const email of emails) {
    const token = randomBytes(18).toString("base64url");
    const { error } = await db.from("team_members").upsert({ owner_id: ownerId, email, role: newRole, workspace_ids: ws, status: "invited", invite_token: token, invited_by: user.id }, { onConflict: "owner_id,email" });
    if (error) { failed.push(`${email} (${dbErr(error)})`); continue; }
    const r = await sendInvite(ownerId, user.name, account, email, token, newRole);
    (r.ok ? sent : failed).push(r.ok ? email : `${email} (email not sent: ${"error" in r ? r.error : ""} — copy the link from the list instead)`);
  }
  done();
  return failed.length ? { ok: sent.length > 0, error: `Couldn't email: ${failed.join("; ")}`, message: sent.length ? `Invited ${sent.join(", ")}.` : undefined } : { ok: true, message: `Invitation sent to ${sent.join(", ")}.` };
}

export async function updateMemberAction(id: string, patch: { role?: string; workspace_ids?: string[] | null }): Promise<FormState> {
  const { role, db } = await manager();
  if (!canManage(role)) return { error: "Only the owner or an admin can change the team." };
  if (patch.role && !["admin", "member", "viewer"].includes(patch.role)) return { error: "Unknown role." };
  if (patch.role === "admin" && role !== "owner") return { error: "Only the owner can make someone an admin." };
  await db.from("team_members").update(patch).eq("id", id);
  done();
  return { ok: true };
}

export async function removeMemberAction(id: string): Promise<FormState> {
  const { role, db, user } = await manager();
  const { data: m } = await db.from("team_members").select("user_id, role").eq("id", id).maybeSingle();
  if (!m) return { error: "Not found." };
  if (m.user_id !== user.id && !canManage(role)) return { error: "Only the owner or an admin can remove people." };
  if (m.role === "admin" && role !== "owner" && m.user_id !== user.id) return { error: "Only the owner can remove an admin." };
  await db.from("team_members").delete().eq("id", id);
  done();
  return { ok: true };
}

export async function resendInviteAction(id: string): Promise<FormState> {
  const { user, business, role, db, ownerId } = await manager();
  if (!canManage(role)) return { error: "Only the owner or an admin can resend invites." };
  const token = randomBytes(18).toString("base64url");
  const { data: m } = await db.from("team_members").update({ invite_token: token }).eq("id", id).eq("status", "invited").select("email, role").maybeSingle();
  if (!m) return { error: "Invite not found." };
  const r = await sendInvite(ownerId, user.name, `${business.name}'s Growvia`, m.email, token, m.role);
  done();
  return r.ok ? { ok: true, message: `Sent again to ${m.email}.` } : { error: "error" in r ? r.error : "Couldn't send." };
}

/** Accepts an invite for the signed-in person (email must match) and opens the team's first project. */
export async function acceptInviteAction(token: string): Promise<FormState> {
  const r = repo();
  const user = await r.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const db = supabaseServer();
  const { data, error } = await db.rpc("accept_invite", { tok: token });
  if (error) return { error: /accept_invite/.test(error.message) ? "Invitations need the latest database update — ask the account owner to run supabase/schema.sql again." : dbErr(error) };
  if (data === "not_found") return { error: "This invitation was already accepted, cancelled or replaced by a newer link. Ask for the latest invite link." };
  if (data === "wrong_email") return { error: `This invitation is for a different email. You're signed in as ${user.email} — sign out and sign in with the invited email.` };
  const { data: mem } = await db.from("team_members").select("owner_id").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: biz } = mem ? await db.from("businesses").select("id").eq("owner_id", mem.owner_id).order("created_at").limit(1).maybeSingle() : { data: null };
  if (biz) cookies().set(PROJECT_COOKIE, biz.id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  redirect("/app?joined=1");
}
