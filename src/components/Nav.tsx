"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#team", label: "AI team" },
  { href: "#plan", label: "Who it's for" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open ? "border-b border-line bg-paper/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between" aria-label="Main">
        <a href="#top" aria-label="Growvia home">
          <Logo />
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-3.5 py-2 text-[14px] text-stone-600 transition-colors hover:bg-mist hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="px-3 py-2 text-[14px] text-stone-600 hover:text-ink">Sign in</Link>
          <Link href="/signup" className="btn-primary h-10 px-4 text-[14px]">
            Start Growing Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <button
          className="-mr-2 grid h-10 w-10 place-items-center rounded-full md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {open && (
        <div className="container-x h-[calc(100dvh-4rem)] pb-8 pt-4 md:hidden">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block border-b border-line py-4 text-2xl font-medium tracking-tight">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <Link href="/login" className="btn-ghost mt-8 w-full">Sign in</Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary mt-3 w-full">
            Start Growing Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </header>
  );
}
