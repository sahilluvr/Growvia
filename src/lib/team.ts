import "server-only";
import { supabaseServer } from "./data/supabase";

export type Role = "owner" | "admin" | "member" | "viewer";
export const ROLES: { id: Exclude<Role, "owner">; label: string; desc: string }[] = [
  { id: "admin", label: "Admin", desc: "Everything, including team, settings and connections" },
  { id: "member", label: "Member", desc: "Work on leads, campaigns, inbox, SEO and posts" },
  { id: "viewer", label: "Viewer", desc: "Read-only — see dashboards and reports" },
];

/** Your role in the account that owns the current project. */
export async function myRole(ownerId: string, userId: string): Promise<Role> {
  if (ownerId === userId) return "owner";
  const { data } = await supabaseServer().from("team_members").select("role").eq("owner_id", ownerId).eq("user_id", userId).eq("status", "active").maybeSingle();
  return (data?.role as Role) ?? "viewer";
}
export const canManage = (r: Role) => r === "owner" || r === "admin";
export const canWrite = (r: Role) => r !== "viewer";
