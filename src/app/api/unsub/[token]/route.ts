import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/server/unsub";

// One-click unsubscribe (RFC 8058) from Gmail/Outlook, and the confirm button on /u/[token].
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const r = await unsubscribe(params.token);
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) return NextResponse.redirect(new URL(`/u/${params.token}?done=${r.ok ? 1 : 0}`, req.url), { status: 303 });
  return NextResponse.json({ ok: r.ok });
}
