import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Start growing free" };

export default function SignupPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  // Carry over anything entered on the landing page into onboarding.
  const carry = new URLSearchParams();
  for (const k of ["segment", "name", "city", "website"]) if (searchParams[k]) carry.set(k, searchParams[k]!);
  const next = `/onboarding${carry.size ? `?${carry}` : ""}`;
  return (
    <>
      <h1 className="text-[32px] font-semibold tracking-tightest">Meet your AI growth team</h1>
      <p className="mt-2 text-[15px] text-stone-500">Create your account — your growth plan is about 2 minutes away.</p>
      <div className="mt-8"><SignupForm email={searchParams.email ?? ""} next={next} /></div>
      <p className="mt-6 text-center text-[14px] text-stone-500">Already have an account? <Link href="/login" className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">Sign in</Link></p>
    </>
  );
}
