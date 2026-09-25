import "server-only";
import { adminClient } from "./admin";
import { verifyId } from "./crypto";

/** Marks the recipient of a message as unsubscribed and stops their campaigns. */
export async function unsubscribe(token: string): Promise<{ ok: boolean; email?: string; business?: string }> {
  const id = verifyId(token, "unsub");
  const db = adminClient();
  if (!id || !db) return { ok: false };
  const { data: m } = await db.from("messages").select("owner_id, lead_id, to_email").eq("id", id).maybeSingle();
  if (!m?.lead_id) return { ok: false };
  const { data: lead } = await db.from("leads").select("name, unsubscribed").eq("id", m.lead_id).maybeSingle();
  if (lead && !lead.unsubscribed) {
    await Promise.all([
      db.from("leads").update({ unsubscribed: true }).eq("id", m.lead_id),
      db.from("enrollments").update({ status: "unsubscribed" }).eq("lead_id", m.lead_id).eq("status", "active"),
      db.from("activity").insert({ owner_id: m.owner_id, agent: "Closer", text: `${lead.name} unsubscribed from your emails.`, tag: "Unsubscribed" }),
    ]);
  }
  const { data: b } = await db.from("businesses").select("name").eq("owner_id", m.owner_id).maybeSingle();
  return { ok: true, email: m.to_email ?? undefined, business: b?.name };
}
