import "server-only";
import { ADMIN_EMAIL } from "@/lib/admin/auth";

/** The Growvia owner (not a customer). Only they see setup instructions, server settings and env names. */
export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const extra = (process.env.PLATFORM_ADMINS || "team.usegrowvia@gmail.com").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return e === ADMIN_EMAIL || extra.includes(e);
}

/** For pages that don't already have the user. */
export async function viewerIsPlatformAdmin(): Promise<boolean> {
  try {
    const { requireUser } = await import("@/lib/data");
    const { user } = await requireUser();
    return isPlatformAdmin(user.email);
  } catch { return false; }
}
