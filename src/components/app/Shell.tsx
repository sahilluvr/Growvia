"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Target, Megaphone, CalendarDays, Users, Settings, LogOut, Menu, X, Inbox, Mail, CalendarClock, FileText, MessageCircle, Send, Plug } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SEGMENTS } from "@/lib/plans";
import type { AppUser } from "@/lib/data/types";

const NAV: { href: string; label: string; icon: React.ElementType; group?: string }[] = [
  { href: "/app", label: "Overview", icon: LayoutGrid },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/email", label: "Email campaigns", icon: Mail, group: "Outreach" },
  { href: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/app/meetings", label: "Meetings", icon: CalendarClock },
  { href: "/app/templates", label: "Templates", icon: FileText },
  { href: "/app/publish", label: "Publish", icon: Send, group: "Social" },
  { href: "/app/campaigns", label: "Social campaigns", icon: Megaphone },
  { href: "/app/content", label: "Content library", icon: CalendarDays },
  { href: "/app/plan", label: "Growth plan", icon: Target, group: "Setup" },
  { href: "/app/channels", label: "Channels", icon: Plug },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

type Props = {
  user: AppUser;
  business: { name: string; segment: string; city: string | null };
  newLeads: number;
  unread: number;
  mode: "supabase";
  children: React.ReactNode;
};

export function Shell({ user, business, newLeads, unread, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const seg = SEGMENTS.find((s) => s.id === business.segment)?.label ?? "";
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="App">
      {NAV.map(({ href, label, icon: I, group }) => (
        <div key={href} className="contents">
        {group && <p className="mt-4 px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400">{group}</p>}
        <Link href={href} prefetch aria-current={active(href) ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors ${active(href) ? "bg-ink text-white" : "text-stone-600 hover:bg-mist hover:text-ink"}`}>
          <I className={`h-4 w-4 ${active(href) ? "text-lime" : ""}`} /> {label}
          {(href === "/app/leads" ? newLeads : href === "/app/inbox" ? unread : 0) > 0 && (
            <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${active(href) ? "bg-lime text-ink" : "bg-ink text-white"}`}>{href === "/app/leads" ? newLeads : unread}</span>
          )}
        </Link>
        </div>
      ))}
      <div className="mt-auto grid gap-3 pt-6">

        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-lime">{user.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{user.name}</div>
            <div className="truncate text-[12px] text-stone-500">{user.email}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-mist hover:text-ink" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  const bizCard = (
    <div className="mb-5 rounded-xl border border-line bg-white p-3">
      <div className="truncate text-[14px] font-semibold tracking-tight">{business.name}</div>
      <div className="truncate text-[12px] text-stone-500">{seg}{business.city ? ` · ${business.city}` : ""}</div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-lime-700">
        <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime-500" /> AI team active
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Link href="/app" className="mb-6 px-1"><Logo /></Link>
        {bizCard}
        {nav}
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
        <Link href="/app"><Logo /></Link>
        <button onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-full" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col overflow-y-auto bg-paper px-4 py-5 lg:hidden">
          {bizCard}
          {nav}
        </div>
      )}

      <div className="lg:pl-[248px]">
        <main className="mx-auto w-full max-w-[1160px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
