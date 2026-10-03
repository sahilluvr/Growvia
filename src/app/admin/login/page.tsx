import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { isAdmin, adminConfigured } from "@/lib/admin/auth";
import { AdminLoginForm } from "./form";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLogin() {
  if (isAdmin()) redirect("/admin");
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4">
      <main className="card grid w-full max-w-sm gap-5 p-8">
        <div><Logo /></div>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-1 text-[14px] text-stone-500">Owner dashboard — users, plans and revenue.</p>
        </div>
        {!adminConfigured && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">Locked: add <code>ADMIN_PASSWORD</code> in Vercel → Environment Variables, then redeploy.</p>}
        <AdminLoginForm />
      </main>
    </div>
  );
}
