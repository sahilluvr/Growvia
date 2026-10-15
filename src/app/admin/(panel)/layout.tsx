import Link from "next/link";
import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { requireAdmin, ADMIN_EMAIL } from "@/lib/admin/auth";
import { adminLogoutAction } from "@/app/admin-actions";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Growvia" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  requireAdmin();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2"><Logo /><span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-lime">Admin</span></Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3 text-[13px] text-stone-500">
            <span className="hidden sm:inline">{ADMIN_EMAIL}</span>
            <form action={adminLogoutAction}><button className="btn-ghost h-9 px-3 text-[13px]" data-testid="admin-logout"><LogOut className="h-4 w-4" /> Log out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
