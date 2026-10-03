import { NextResponse } from "next/server";
import { repo } from "@/lib/data";

async function handle(req: Request) {
  await repo().signOut();
  const u = new URL(req.url);
  const next = u.searchParams.get("next") ?? "";
  const email = u.searchParams.get("email") ?? "";
  // Used by the invite page ("Sign out and continue as …"): go back to sign-in, keeping where to return to.
  const to = next.startsWith("/") && !next.startsWith("//") ? `/login?next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ""}` : "/login";
  return NextResponse.redirect(new URL(to, req.url), { status: 303 });
}
export const GET = handle;
export const POST = handle;
