"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [["/admin", "Overview"], ["/admin/users", "Users"], ["/admin/websites", "Websites"], ["/admin/finance", "Finance"], ["/admin/system", "System"]] as const;
export function AdminNav() {
  const p = usePathname();
  const on = (h: string) => (h === "/admin" ? p === "/admin" : p.startsWith(h));
  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Admin">
      {LINKS.map(([h, l]) => <Link key={h} href={h} aria-current={on(h) ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-[14px] ${on(h) ? "bg-ink text-white" : "text-stone-600 hover:bg-mist"}`}>{l}</Link>)}
    </nav>
  );
}
