import { adminClient } from "@/lib/server/admin";
import { verifyId } from "@/lib/server/crypto";

export const dynamic = "force-dynamic";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Open tracking pixel. Always returns the image; recording is best-effort.
export async function GET(_: Request, { params }: { params: { token: string } }) {
  const id = verifyId(params.token, "track");
  const db = adminClient();
  if (id && db) {
    const { data: m } = await db.from("messages").select("opened_at, open_count").eq("id", id).maybeSingle();
    if (m) await db.from("messages").update({ open_count: (m.open_count ?? 0) + 1, opened_at: m.opened_at ?? new Date().toISOString() }).eq("id", id);
  }
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
}
