import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { SUPABASE_URL as URL_, SUPABASE_KEY as KEY, setupMissing } from "@/lib/config";

const PROTECTED = ["/app", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const p0 = req.nextUrl.pathname;
  if (setupMissing && (PROTECTED.some((x) => p0 === x || p0.startsWith(x + "/")) || ["/login", "/signup", "/forgot", "/reset"].includes(p0))) {
    return NextResponse.redirect(new URL("/setup", req.url));
  }
  let res = NextResponse.next({ request: req });
  let signedIn = false;

  if (URL_ && KEY) {
    const sb = createServerClient(URL_, KEY, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    // Reads the session from the cookie (no network call) and refreshes it only when it has expired.
    // This only decides where to send the visitor — every page and action re-verifies the user on the
    // server, and the database enforces row-level security.
    try {
      const { data } = await sb.auth.getSession();
      signedIn = Boolean(data.session);
    } catch {
      signedIn = false; // Supabase unreachable — treat as signed out rather than crashing every page.
    }
  }

  const p = req.nextUrl.pathname;
  const redirectTo = (to: string) => {
    const r = NextResponse.redirect(new URL(to, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!signedIn && PROTECTED.some((x) => p === x || p.startsWith(x + "/"))) {
    return redirectTo(`/login?next=${encodeURIComponent(p)}`);
  }
  if (signedIn && AUTH_PAGES.includes(p)) return redirectTo("/app");
  return res;
}

export const config = {
  // Only routes that depend on sign-in state. The landing page and public lead forms skip middleware
  // entirely, so they are served straight from Vercel's CDN.
  matcher: ["/app/:path*", "/onboarding", "/login", "/signup", "/forgot", "/reset"],
};
