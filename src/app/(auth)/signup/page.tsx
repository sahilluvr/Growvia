import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY, captchaOn } from "@/lib/captcha";

export const metadata: Metadata = { title: "Create your free Growvia account", description: "Start free: your AI growth plan, SEO audit and AI-search check in about two minutes. No card needed; 14 days of Pro included.", robots: { index: false, follow: true } };

export default function SignupPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  // Carry over anything entered on the landing page into onboarding.
  const carry = new URLSearchParams();
  for (const k of ["segment", "name", "city", "website", "plan", "interval"]) if (searchParams[k]) carry.set(k, searchParams[k]!);
  const invite = searchParams.next?.startsWith("/invite/") ? searchParams.next : null;
  const next = invite ?? `/onboarding${carry.size ? `?${carry}` : ""}`;
  return (
    <>
      <h1 className="text-[32px] font-semibold tracking-tightest">{invite ? "Join your team on Growvia" : "Meet your AI growth team"}</h1>
      <p className="mt-2 text-[15px] text-stone-500">{invite ? "Create your account with the email you were invited on." : "Create your account — your growth plan is about 2 minutes away."}</p>
      <div className="mt-8"><GoogleButton from="signup" next={next} email={searchParams.email} error={searchParams.gerror} /></div>
      <div className="mt-4"><SignupForm email={searchParams.email ?? ""} next={next} captcha={captchaOn ? { siteKey: TURNSTILE_SITE_KEY, script: TURNSTILE_SCRIPT } : null} /></div>
      <p className="mt-6 text-center text-[14px] text-stone-500">Already have an account? <Link href={invite ? `/login?next=${encodeURIComponent(invite)}` : "/login"} className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">Sign in</Link></p>
    </>
  );
}
