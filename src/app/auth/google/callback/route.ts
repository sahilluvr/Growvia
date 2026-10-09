import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSupabase, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { verifyId } from "@/lib/server/crypto";
import { exchangeGoogleCode } from "@/lib/google/gsc";
import { GSI_COOKIE, googleSignInError } from "@/lib/google/signin";
import { findGmailTwin, isGmail } from "@/lib/server/gmail";
import { adminClient } from "@/lib/server/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Google sends people back here after they pick an account. We trade the code for an ID token and sign them in with Supabase. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = verifyId(url.searchParams.get("state") ?? "", "google-signin");
  const [csrf, fromRaw, ...rest] = (state ?? "").split("~");
  const from = fromRaw === "signup" ? "signup" : "login";
  const next = rest.join("~") || (from === "signup" ? "/onboarding" : "/app");
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/${from}?gerror=${code}${next !== "/app" && next !== "/onboarding" ? `&next=${encodeURIComponent(next)}` : ""}`, url.origin));
    res.cookies.delete({ name: GSI_COOKIE, path: "/auth/google" });
    return res;
  };

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "cancelled" : "failed");
  const [cookieCsrf, rawNonce] = (cookies().get(GSI_COOKIE)?.value ?? "").split(".");
  if (!state || !csrf || csrf !== cookieCsrf || !rawNonce) return fail("expired");
  const code = url.searchParams.get("code");
  if (!code || !isSupabase) return fail("failed");

  try {
    const t = await exchangeGoogleCode(code, `${siteOrigin()}/auth/google/callback`);
    if (!t.idToken) return fail("failed");
    const sb = supabaseServer();
    const { data, error } = await sb.auth.signInWithIdToken({ provider: "google", token: t.idToken, nonce: rawNonce });
    if (error) { console.error("google sign-in:", error.message); return fail(googleSignInError(error.message)); }
    const merged = await mergeGmailTwin(sb, data.user, t.idToken, rawNonce);
    if (merged === "failed") return fail("dupe");
  } catch (e) {
    console.error("google sign-in:", e);
    return fail("failed");
  }
  // New accounts have no project yet — /app sends them to onboarding automatically.
  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.delete({ name: GSI_COOKIE, path: "/auth/google" });
  return res;
}

type SB = ReturnType<typeof supabaseServer>;
type U = { id: string; email?: string; created_at: string; identities?: unknown[] } | null;

/**
 * Someone signed up earlier as sahilaggarwal@gmail.com, and their Google account is sahil.aggarwal@gmail.com.
 * Supabase sees two different emails and just created a second, empty account. Google has proved they own that
 * inbox (dots don't matter in Gmail), so: remove the empty new account, move the old account to Google's spelling
 * (password sign-in with the old spelling keeps working — sign-in looks up the stored spelling), and sign in again,
 * which now links Google to the original account with all its data.
 */
async function mergeGmailTwin(sb: SB, user: U, idToken: string, nonce: string): Promise<"none" | "merged" | "failed"> {
  if (!user?.email || !isGmail(user.email)) return "none";
  const brandNew = Date.now() - new Date(user.created_at).getTime() < 3 * 60_000 && (user.identities?.length ?? 1) <= 1;
  if (!brandNew) return "none";
  const db = adminClient();
  if (!db) return "none";
  const twin = await findGmailTwin(user.email, user.id).catch(() => null);
  if (!twin) return "none";
  const { count } = await db.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  if (count) return "none"; // the new account already has a project — never delete real data
  try {
    await sb.auth.signOut({ scope: "local" });
    const del = await db.auth.admin.deleteUser(user.id);
    if (del.error) throw del.error;
    const upd = await db.auth.admin.updateUserById(twin.id, { email: user.email, email_confirm: true });
    if (upd.error) throw upd.error;
    const again = await sb.auth.signInWithIdToken({ provider: "google", token: idToken, nonce });
    if (again.error || again.data.user?.id !== twin.id) throw again.error ?? new Error("linked to the wrong account");
    return "merged";
  } catch (e) {
    console.error("gmail merge:", e);
    return "failed";
  }
}
