import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { siteOrigin } from "@/lib/data";
import { signId } from "@/lib/server/crypto";
import { GSI_COOKIE, googleSignInReady, googleSignInUrl, newNonce } from "@/lib/google/signin";

export const dynamic = "force-dynamic";

const safeNext = (n: string | null, fallback: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n.slice(0, 500) : fallback);

/** GET /auth/google?next=/onboarding&from=signup — sends the visitor to Google's account picker. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") === "signup" ? "signup" : "login";
  const next = safeNext(url.searchParams.get("next"), from === "signup" ? "/onboarding" : "/app");
  const back = `/${from}?gerror=setup${next !== "/app" ? `&next=${encodeURIComponent(next)}` : ""}`;
  if (!googleSignInReady) return NextResponse.redirect(new URL(back, url.origin));
  const csrf = randomBytes(12).toString("base64url");
  const nonce = newNonce();
  const state = signId(`${csrf}~${from}~${next}`, "google-signin");
  const email = url.searchParams.get("email")?.slice(0, 254) || undefined;
  const res = NextResponse.redirect(googleSignInUrl(`${siteOrigin()}/auth/google/callback`, state, nonce.hashed, email));
  res.cookies.set(GSI_COOKIE, `${csrf}.${nonce.raw}`, { httpOnly: true, sameSite: "lax", secure: siteOrigin().startsWith("https"), path: "/auth/google", maxAge: 600 });
  return res;
}
