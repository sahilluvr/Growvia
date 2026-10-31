import "server-only";
import { adminClient } from "@/lib/server/admin";

/*
 * Admin "Emails from Growvia: off" switch. Every Growvia email goes through sendSystemEmail, which drops
 * recipients listed in email_blocks. Supabase Auth emails (sign-in, password reset) don't go through it, so they keep working.
 */

/** One spelling per inbox: lower-case, and Gmail without dots / +tags (googlemail = gmail). */
export function normEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const [local, domain] = e.split("@");
  if (!local || !domain) return e;
  if (domain === "gmail.com" || domain === "googlemail.com") return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  return e;
}

type Db = ReturnType<typeof adminClient>;

/** Which of these addresses must not get Growvia emails. Fails open (sends) if the table isn't there yet. */
export async function blockedAmong(emails: string[], db: Db = adminClient()): Promise<Set<string>> {
  const out = new Set<string>();
  if (!db || !emails.length) return out;
  const norm = [...new Set(emails.map(normEmail))];
  const { data, error } = await db.from("email_blocks").select("email").in("email", norm);
  if (error || !data) return out;
  const hit = new Set((data as { email: string }[]).map((r) => r.email));
  for (const e of emails) if (hit.has(normEmail(e))) out.add(e);
  return out;
}
