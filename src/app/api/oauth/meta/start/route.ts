import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { repo, siteOrigin } from "@/lib/data";
import { signId } from "@/lib/server/crypto";
import { metaLoginReady, oauthDialogUrl } from "@/lib/meta/graph";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await repo().getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/app/channels", req.url));
  if (!metaLoginReady) return NextResponse.redirect(new URL("/app/channels?error=setup", req.url));
  const nonce = randomBytes(12).toString("base64url");
  const state = signId(`${user.id}~${nonce}`, "meta-oauth");
  const res = NextResponse.redirect(oauthDialogUrl(`${siteOrigin()}/api/oauth/meta/callback`, state));
  res.cookies.set("gv_oauth", nonce, { httpOnly: true, sameSite: "lax", secure: siteOrigin().startsWith("https"), path: "/", maxAge: 600 });
  return res;
}
