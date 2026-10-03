import { NextResponse } from "next/server";
import { supabaseServer, PROJECT_COOKIE } from "@/lib/data/supabase";

export const dynamic = "force-dynamic";

/** Remembers the current project in a cookie (first visit, or the remembered one was removed), then continues. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const to = u.searchParams.get("to") ?? "";
  const next = u.searchParams.get("next") ?? "/app";
  const safeNext = next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
  const res = NextResponse.redirect(new URL(safeNext, req.url));
  if (/^[0-9a-f-]{36}$/i.test(to)) {
    const { data } = await supabaseServer().from("businesses").select("id").eq("id", to).maybeSingle();
    if (data) res.cookies.set(PROJECT_COOKIE, to, { path: "/", httpOnly: true, sameSite: "lax", secure: u.protocol === "https:", maxAge: 60 * 60 * 24 * 365 });
  }
  // Don't try again for a minute if the browser won't keep the cookie (avoids a redirect loop).
  res.cookies.set("gv_pfix", "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 });
  return res;
}
