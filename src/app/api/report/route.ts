import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { growthSnapshot } from "@/lib/growth";

export const dynamic = "force-dynamic";

/** Live Growth Report data for the signed-in project (polled while the first analysis runs). */
export async function GET() {
  const { business } = await requireBusiness();
  const snap = await growthSnapshot(supabaseServer(), business as never);
  return NextResponse.json(snap, { headers: { "Cache-Control": "no-store" } });
}
