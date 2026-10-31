import { PRICE_TEXT } from "@/lib/billing/catalog";
import Link from "next/link";
import { Logo } from "./Logo";
import { FEATURES } from "@/lib/site/features";

const COLS: [string, [string, string][]][] = [
  ["Product", FEATURES.slice(0, 5).map((f) => [f.name, `/features/${f.slug}`])],
  ["More", [...FEATURES.slice(5).map((f) => [f.name, `/features/${f.slug}`] as [string, string]), ["All features", "/features"]]],
  ["Growvia", [["How it works", "/#how"], ["Pricing", "/#pricing"], ["Blog", "/blog"], ["For dentists", "/blog/ai-marketing-for-dentists"], ["For lawyers", "/blog/ai-marketing-for-lawyers"], ["US local guides", "/local-marketing"], ["FAQ", "/#faq"], ["Sign in", "/login"], ["Start free", "/signup"]]],
  ["Company", [["About", "/about"], ["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds & cancellation", "/refunds"], ["Shipping & delivery", "/shipping"]]],
];

export function Footer() {
  return (
    <footer className="pb-10 pt-16">
      <div className="container-x">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-stone-500">Your AI growth team — SEO and AI search, email, social, WhatsApp, forms and one inbox for every lead.</p>
          </div>
          {COLS.map(([h, items]) => (
            <div key={h}>
              <p className="text-[13px] font-medium">{h}</p>
              <ul className="mt-4 grid gap-2.5">
                {items.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("mailto:") ? <a href={href} className="text-[14px] text-stone-500 transition-colors hover:text-ink">{label}</a>
                      : <Link href={href} className="text-[14px] text-stone-500 transition-colors hover:text-ink">{label}</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-[13px] text-stone-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Growvia. All rights reserved.</p>
          <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime-500" /> {PRICE_TEXT.all}</p>
        </div>
      </div>
    </footer>
  );
}
