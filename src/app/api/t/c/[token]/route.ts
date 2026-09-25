import { NextResponse } from "next/server";
import { adminClient } from "@/lib/server/admin";
import { verifyId } from "@/lib/server/crypto";

export const dynamic = "force-dynamic";

// Click tracking: record, then send the reader on to the real link.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const url = new URL(req.url).searchParams.get("u") || "";
  let target: URL;
  try {
    target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) throw new Error();
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const id = verifyId(params.token, "track");
  const db = adminClient();
  if (id && db) {
    const { data: m } = await db.from("messages").select("clicked_at, click_count, opened_at, open_count").eq("id", id).maybeSingle();
    if (m) {
      const t = new Date().toISOString();
      await db.from("messages").update({
        click_count: (m.click_count ?? 0) + 1, clicked_at: m.clicked_at ?? t,
        opened_at: m.opened_at ?? t, open_count: Math.max(1, m.open_count ?? 0),
      }).eq("id", id);
    }
  }
  return NextResponse.redirect(target, 302);
}
