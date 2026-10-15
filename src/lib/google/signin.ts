import "server-only";
import { createHash, randomBytes } from "crypto";
import { GOOGLE_CLIENT_ID, gscReady } from "./gsc";

/*
  "Continue with Google" for sign-in and sign-up.
  We run the Google OAuth step ourselves (so Google's screen says "continue to usegrowvia.com", not the
  Supabase URL), then hand Google's ID token to Supabase with signInWithIdToken. Supabase creates the
  account on first use, links it to an existing account with the same verified email, and sets the session.
*/
export const googleSignInReady = gscReady;
export const GSI_COOKIE = "gv_gsi";
const AUTH_BASE = (process.env.GOOGLE_AUTH_BASE?.trim() || "https://accounts.google.com").replace(/\/$/, "");

export function newNonce() {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hashed: createHash("sha256").update(raw).digest("hex") };
}

export function googleSignInUrl(redirectUri: string, state: string, hashedNonce: string, loginHint?: string) {
  const q = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code",
    scope: "openid email profile", access_type: "online", prompt: "select_account",
    include_granted_scopes: "false", state, nonce: hashedNonce,
  });
  if (loginHint) q.set("login_hint", loginHint);
  return `${AUTH_BASE}/o/oauth2/v2/auth?${q}`;
}

/** Turns Supabase / Google errors into something a person can act on. */
export function googleSignInError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("not enabled") || m.includes("unsupported provider")) return "setup";
  if (m.includes("audience") || m.includes("client id")) return "audience";
  if (m.includes("nonce")) return "expired";
  if (m.includes("banned")) return "banned";
  if (m.includes("signups not allowed") || m.includes("signup")) return "nosignup";
  return "failed";
}
