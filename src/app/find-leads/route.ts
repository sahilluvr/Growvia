import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/server/origin";

/* Public "Find leads" forms (home page, blog posts) submit here with ?what=&where=.
   Signed-in visitors go straight to the finder (the sign-up page forwards them); new visitors sign up first. */
export function GET(req: Request) {
  const u = new URL(req.url);
  const clean = (k: string) => (u.searchParams.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const q = new URLSearchParams();
  if (clean("what")) q.set("what", clean("what"));
  if (clean("where")) q.set("where", clean("where"));
  const next = `/app/leads/find${q.size ? `?${q}` : ""}`;
  return NextResponse.redirect(new URL(`/signup?next=${encodeURIComponent(next)}`, publicOrigin(req)), 303);
}
