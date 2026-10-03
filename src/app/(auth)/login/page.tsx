import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY, captchaOn } from "@/lib/captcha";

export const metadata: Metadata = { title: "Sign in to your Growvia account", description: "Sign in to Growvia to see your SEO, AI-search visibility, leads, inbox and campaigns.", robots: { index: false, follow: true } };

export default function LoginPage({ searchParams }: { searchParams: { next?: string; email?: string; error?: string; gerror?: string } }) {
  return (
    <>
      <h1 className="text-[32px] font-semibold tracking-tightest">Welcome back</h1>
      <p className="mt-2 text-[15px] text-stone-500">Sign in to see what your AI growth team has been up to.</p>
      <div className="mt-8"><GoogleButton from="login" next={searchParams.next} email={searchParams.email} error={searchParams.gerror} /></div>
      <div className="mt-4"><LoginForm next={searchParams.next ?? "/app"} email={searchParams.email ?? ""} linkError={searchParams.error === "link"} captcha={captchaOn ? { siteKey: TURNSTILE_SITE_KEY, script: TURNSTILE_SCRIPT } : null} /></div>
      <p className="mt-6 text-center text-[14px] text-stone-500">New to Growvia? <Link href={searchParams.next?.startsWith("/invite/") ? `/signup?next=${encodeURIComponent(searchParams.next)}${searchParams.email ? `&email=${encodeURIComponent(searchParams.email)}` : ""}` : "/signup"} className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">Start growing free</Link></p>
    </>
  );
}
