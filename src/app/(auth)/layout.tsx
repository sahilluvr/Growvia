import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" aria-label="Growvia home" className="self-start"><Logo /></Link>
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</main>
        <p className="text-center text-[12px] text-stone-400">© {new Date().getFullYear()} Growvia · <Link href="/#faq" className="hover:text-ink">Help</Link></p>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grid-bg-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-24 top-24 h-80 w-80 rounded-full bg-lime/25 blur-[100px]" />
        <span className="eyebrow-dark relative self-start"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime" /> Your AI growth team</span>
        <div className="relative">
          <h2 className="max-w-md text-[44px] font-semibold leading-[1.02] tracking-tightest">Give Growvia your business.<span className="block text-lime">Get customers back.</span></h2>
          <ul className="mt-8 grid gap-3 text-[15px] text-white/75">
            {["A growth plan built for your business in minutes", "Ready-to-post campaigns in your voice", "A lead inbox and pipeline that follows up", "Every action tied to real customers"].map((t) => (
              <li key={t} className="flex items-center gap-2.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-lime text-ink"><Check className="h-3 w-3" strokeWidth={3} /></span>{t}</li>
            ))}
          </ul>
        </div>
        <svg className="relative h-24 w-full" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 85 C 80 84, 140 78, 200 62 S 320 20, 400 6" fill="none" stroke="#C5F23A" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </aside>
    </div>
  );
}
