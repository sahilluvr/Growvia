import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string; email?: string; error?: string } }) {
  return (
    <>
      <h1 className="text-[32px] font-semibold tracking-tightest">Welcome back</h1>
      <p className="mt-2 text-[15px] text-stone-500">Sign in to see what your AI growth team has been up to.</p>
      <div className="mt-8"><LoginForm next={searchParams.next ?? "/app"} email={searchParams.email ?? ""} linkError={searchParams.error === "link"} /></div>
      <p className="mt-6 text-center text-[14px] text-stone-500">New to Growvia? <Link href="/signup" className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">Start growing free</Link></p>
    </>
  );
}
