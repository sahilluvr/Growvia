import { NextResponse } from "next/server";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";

export const dynamic = "force-dynamic";

/** The bell: latest notifications + unread count. Works before the v044 table exists (returns an empty list). */
export async function GET() {
  const user = await repo().getUser().catch(() => null);
  if (!user) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });
  const db = supabaseServer();
  const [{ data, error }, { count }] = await Promise.all([
    db.from("app_notifications").select("id, kind, title, body, url, provider, celebrate, read_at, created_at").order("created_at", { ascending: false }).limit(30),
    db.from("app_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (error) return NextResponse.json({ items: [], unread: 0, setup: "v044" }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ items: data ?? [], unread: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}

/** Mark as read: { ids: [...] } or { all: true }. */
export async function POST(req: Request) {
  const user = await repo().getUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; all?: boolean };
  const db = supabaseServer();
  const now = new Date().toISOString();
  if (body.all) await db.from("app_notifications").update({ read_at: now }).is("read_at", null);
  else if (body.ids?.length) await db.from("app_notifications").update({ read_at: now }).in("id", body.ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)).slice(0, 100));
  return NextResponse.json({ ok: true });
}
