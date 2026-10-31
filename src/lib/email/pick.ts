import type { SupabaseClient } from "@supabase/supabase-js";
import type { Mailbox } from "./types";

type Box = Mailbox & { business_id?: string | null; health?: { paused?: boolean } | null };

/**
 * Which mailbox may email someone in this project. The rule that must never break:
 * a project's emails go out ONLY from a mailbox assigned to that project.
 *  - the chosen mailbox belongs to the project → use it
 *  - the project has its own mailbox(es)      → use one of those instead (never another project's)
 *  - only an unassigned (older) mailbox exists → use it, so nothing set up before v056 stops working
 *  - the chosen mailbox belongs to a DIFFERENT project and this one has none → refuse
 */
export async function mailboxForProject(db: SupabaseClient, businessId: string | null | undefined, chosen: Mailbox | null): Promise<{ ok: true; mailbox: Mailbox } | { ok: false; error: string }> {
  const c = chosen as Box | null;
  if (!businessId) return c ? { ok: true, mailbox: c } : { ok: false, error: "Connect a mailbox in Settings → Email sending first." };
  if (c && c.business_id === businessId) return { ok: true, mailbox: c };
  const { data } = await db.from("mailboxes").select("*").eq("business_id", businessId).order("created_at");
  const own = ((data ?? []) as Box[]).sort((a, b) => Number(Boolean(a.health?.paused)) - Number(Boolean(b.health?.paused)) || Number(a.status !== "connected") - Number(b.status !== "connected"));
  if (own.length) return { ok: true, mailbox: own[0] };
  if (c && !c.business_id) return { ok: true, mailbox: c };
  if (!c) {
    const { data: legacy } = await db.from("mailboxes").select("*").is("business_id", null).order("created_at").limit(1).maybeSingle<Mailbox>();
    if (legacy) return { ok: true, mailbox: legacy };
  }
  return { ok: false, error: "This project has no mailbox of its own yet — connect its email in Settings → Email sending. (Growvia never sends one project's emails from another project's address.)" };
}
