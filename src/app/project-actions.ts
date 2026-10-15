"use server";
import { guard } from "@/lib/errors";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { PROJECT_COOKIE, supabaseServer } from "@/lib/data/supabase";

type FormState = { ok?: boolean; error?: string; message?: string } | undefined;
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const COOKIE = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 };

async function me() {
  const r = repo();
  const user = await r.getUser();
  if (!user) redirect("/login");
  return { r, user, db: supabaseServer() };
}

/** Switch the project you're working in. */
export async function switchProjectAction(id: string, to = "/app") {
  const { db } = await me();
  const { data } = await db.from("businesses").select("id").eq("id", id).maybeSingle();
  if (!data) return;
  cookies().set(PROJECT_COOKIE, id, COOKIE);
  revalidatePath("/", "layout");
  redirect(to.startsWith("/app") ? to : "/app");
}

export async function createWorkspaceAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => createWorkspaceActionImpl(s, f));
}
async function createWorkspaceActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const { r } = await me();
  const name = str(f, "name", 80);
  if (!name) return { error: "Name the workspace, e.g. a client's company name." };
  const ws = await r.createWorkspace(name);
  revalidatePath("/app", "layout");
  if (f.get("then") === "project") redirect(`/onboarding?new=1&ws=${ws.id}`);
  return { ok: true, message: `Workspace “${ws.name}” created. Add its first project.` };
}

export async function renameWorkspaceAction(id: string, name: string): Promise<FormState> {
  const { db } = await me();
  const n = name.trim().slice(0, 80);
  if (!n) return { error: "Name can't be empty." };
  await db.from("workspaces").update({ name: n }).eq("id", id);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteWorkspaceAction(id: string): Promise<FormState> {
  const { db } = await me();
  const [{ count: projects }, { count: all }] = await Promise.all([
    db.from("businesses").select("id", { count: "exact", head: true }).eq("workspace_id", id),
    db.from("workspaces").select("id", { count: "exact", head: true }),
  ]);
  if ((all ?? 0) <= 1) return { error: "You need at least one workspace." };
  if (projects) return { error: "Move or delete the projects in this workspace first." };
  await db.from("workspaces").delete().eq("id", id);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function moveProjectAction(id: string, workspaceId: string): Promise<FormState> {
  const { db } = await me();
  await db.from("businesses").update({ workspace_id: workspaceId }).eq("id", id);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Deletes a project and everything in it (leads, campaigns, audits). */
export async function deleteProjectAction(id: string, confirmName: string): Promise<FormState> {
  const { db } = await me();
  const [{ data: b }, { count }] = await Promise.all([
    db.from("businesses").select("id, name").eq("id", id).maybeSingle(),
    db.from("businesses").select("id", { count: "exact", head: true }),
  ]);
  if (!b) return { error: "Project not found." };
  if ((count ?? 0) <= 1) return { error: "This is your only project — create another one before deleting it." };
  if (confirmName.trim() !== b.name) return { error: `Type the project name “${b.name}” to confirm.` };
  await db.from("businesses").delete().eq("id", id);
  if (cookies().get(PROJECT_COOKIE)?.value === id) cookies().delete(PROJECT_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true, message: `Deleted ${b.name}.` };
}
