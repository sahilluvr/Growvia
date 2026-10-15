import "server-only";
import { adminClient } from "./admin";

/*
  Gmail ignores dots and "+tags" in the part before @, and googlemail.com is the same as gmail.com.
  So sahil.aggarwal@gmail.com, sahilaggarwal@gmail.com and SahilAggarwal+work@googlemail.com are one inbox.
  Supabase compares emails exactly, so we use these helpers to find "the same Gmail, typed differently".
*/
const GMAIL = /@(gmail|googlemail)\.com$/i;
export const isGmail = (email: string) => GMAIL.test(email.trim());
export function canonicalGmail(email: string) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain || !GMAIL.test(`@${domain}`)) return email.trim().toLowerCase();
  return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
}

/** Another account whose email is the same Gmail inbox but written differently. Needs the service-role key. */
export async function findGmailTwin(email: string, excludeId?: string): Promise<{ id: string; email: string } | null> {
  if (!isGmail(email)) return null;
  const db = adminClient();
  if (!db) return null;
  const base = canonicalGmail(email).split("@")[0];
  if (!base) return null;
  // ^s\.*a\.*h\.*i\.*l(\+[^@]*)?@(gmail|googlemail)\.com$ — matches any dot/+tag spelling of the same inbox.
  const rx = `^${base.split("").map((c) => c.replace(/[^a-z0-9]/g, "\\$&")).join("\\.*")}(\\+[^@]*)?@(gmail|googlemail)\\.com$`;
  const { data } = await db.from("profiles").select("id, email").filter("email", "imatch", rx).limit(5);
  const exact = email.trim().toLowerCase();
  return (data ?? []).find((p: { id: string; email: string | null }) => p.id !== excludeId && p.email && p.email.toLowerCase() !== exact) as { id: string; email: string } | undefined ?? null;
}

/** The email to actually use for a password sign-in or reset: the stored spelling if only a dot/+tag differs. */
export async function storedEmailFor(email: string) {
  if (!isGmail(email)) return email;
  const db = adminClient();
  if (!db) return email;
  const { data: exact } = await db.from("profiles").select("id").eq("email", email.trim().toLowerCase()).limit(1);
  if (exact?.length) return email;
  return (await findGmailTwin(email))?.email ?? email;
}
