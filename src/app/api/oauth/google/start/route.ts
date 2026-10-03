import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { repo, siteOrigin } from "@/lib/data";
import { signId } from "@/lib/server/crypto";
import { GOOGLE_PURPOSES, googleAuthUrl, gscReady, isPurpose } from "@/lib/google/gsc";

export const dynamic = "force-dynamic";

/**
 * Sends the user to Google for one purpose: Search Console (read), Business Profile (manage),
 * YouTube (upload) or Contacts (one-time read). ?for=gsc|gbp|youtube|contacts
 */
export async function GET(req: Request) {
  const want = new URL(req.url).searchParams.get("for");
  const purpose = isPurpose(want) ? want : "gsc";
  const back = GOOGLE_PURPOSES[purpose].back;
  const sep = back.includes("?") ? "&" : "?";
  const r = repo();
  const user = await r.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(back)}`, req.url));
  if (!gscReady) return NextResponse.redirect(new URL(`${back}${sep}${purpose === "gsc" ? "gsc_error" : "google_error"}=setup`, req.url));
  const b = await r.getBusiness();
  if (!b) return NextResponse.redirect(new URL("/onboarding", req.url));
  const nonce = randomBytes(12).toString("base64url");
  const state = signId(`${user.id}~${b.id}~${nonce}~${purpose}`, "google-oauth");
  const res = NextResponse.redirect(googleAuthUrl(`${siteOrigin()}/api/oauth/google/callback`, state, purpose));
  res.cookies.set("gv_goauth", nonce, { httpOnly: true, sameSite: "lax", secure: siteOrigin().startsWith("https"), path: "/", maxAge: 600 });
  return res;
}
