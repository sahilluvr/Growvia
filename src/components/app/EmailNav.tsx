"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/app/email", label: "Campaigns", match: (p: string) => p === "/app/email" || (/^\/app\/email\/[^/]+$/.test(p) && !p.endsWith("/compose")) },
  { href: "/app/email/compose", label: "Write & send", match: (p: string) => p.startsWith("/app/email/compose") },
  { href: "/app/templates", label: "Templates", match: (p: string) => p.startsWith("/app/templates") },
  { href: "/app/inbox?c=email", label: "Replies", match: (p: string, c: string | null) => p.startsWith("/app/inbox") && c === "email" },
  { href: "/app/settings?tab=email", label: "Mailboxes", match: () => false },
];

/** The email studio's tabs, shown on every email page. */
export function EmailNav() {
  const path = usePathname();
  const c = useSearchParams().get("c");
  return (
    <nav aria-label="Email studio" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
      {TABS.map((t) => {
        const on = t.match(path, c);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] transition-colors ${on ? "border-ink font-semibold text-ink" : "border-transparent text-stone-500 hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
