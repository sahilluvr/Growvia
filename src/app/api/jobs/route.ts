import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/data/supabase";

export const dynamic = "force-dynamic";

/** Your background tasks: running ones plus recently finished ones you haven't seen yet. Polled by the app. */
export async function GET() {
  const db = supabaseServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ jobs: [] }, { status: 401 });
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await db.from("jobs").select("id, kind, title, link, status, message, result, seen, params, business_id, created_at, finished_at")
    .eq("user_id", auth.user.id).gt("created_at", since).or("status.in.(queued,running),seen.eq.false").order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ jobs: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

/** Marks finished tasks as seen (after the pop-up). */
export async function POST(req: Request) {
  const db = supabaseServer();
  const { ids } = await req.json().catch(() => ({ ids: [] }));
  const list = (Array.isArray(ids) ? ids : []).filter((x: unknown) => typeof x === "string").slice(0, 50);
  if (list.length) await db.from("jobs").update({ seen: true }).in("id", list).in("status", ["done", "failed"]);
  return NextResponse.json({ ok: true });
}
