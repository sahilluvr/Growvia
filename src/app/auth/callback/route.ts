import { NextResponse } from "next/server";
import { isSupabase } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";

// Handles links from Supabase emails (confirm signup, reset password).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (isSupabase && code) {
    const { error } = await supabaseServer().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
