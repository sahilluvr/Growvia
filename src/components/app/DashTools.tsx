"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Inbox, Lock, Mail, Search, Send, Sparkles, Users } from "lucide-react";

/* Dashboard (v079): every main tool in one clean grid. Each tile shows one live number and one next step.
   Tiles tilt toward the cursor; the security tile fills its ring and refreshes itself while a first check runs. */

export type ToolData = {
  leadsWeek: number; leadDays: number[]; campaigns: number; scheduled: number; drafts: number;
  seo: number | null; ai: number | null; security: { score: number; grade: string; delta: number | null; fixes: number } | null; securityRunning: boolean; hasWebsite: boolean;
};

function Tile({ href, icon: I, title, children, accent = false, testid }: { href: string; icon: typeof Users; title: string; children: React.ReactNode; accent?: boolean; testid?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });
  return (
    <Link ref={ref} href={href} data-testid={testid}
      onPointerMove={(e) => { const r = ref.current!.getBoundingClientRect(); setT({ x: ((e.clientY - r.top) / r.height - 0.5) * -6, y: ((e.clientX - r.left) / r.width - 0.5) * 6 }); }}
      onPointerLeave={() => setT({ x: 0, y: 0 })}
      style={{ transform: `perspective(700px) rotateX(${t.x}deg) rotateY(${t.y}deg)` }}
      className={`group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-3xl border p-4 transition-[transform,box-shadow,border-color] duration-200 hover:shadow-[0_18px_40px_-20px_rgba(11,13,12,.35)] sm:p-5 ${accent ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-stone-400"}`}>
      <span className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 ${accent ? "bg-lime/30 opacity-60" : "bg-lime/40 opacity-0 group-hover:opacity-70"}`} />
      <div className="relative flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${accent ? "bg-lime text-ink" : "bg-mist text-ink"}`}><I className="h-4 w-4" /></span>
        <ArrowUpRight className={`h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${accent ? "text-white/60" : "text-stone-400"}`} />
      </div>
      <div className="relative mt-3"><p className={`text-[13px] font-medium ${accent ? "text-white/70" : "text-stone-500"}`}>{title}</p>{children}</div>
    </Link>
  );
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return <div className="mt-2 flex h-7 items-end gap-[3px]" aria-hidden>{data.map((n, i) => <span key={i} className="w-full rounded-sm bg-lime transition-all duration-500 group-hover:bg-lime-500" style={{ height: `${Math.max(10, (n / max) * 100)}%`, opacity: 0.35 + (i / data.length) * 0.65 }} />)}</div>;
}

function MiniRing({ score, running }: { score: number | null; running?: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setV(score ?? 0)); return () => cancelAnimationFrame(id); }, [score]);
  const r = 20, c = 2 * Math.PI * r, col = (score ?? 0) >= 80 ? "#84cc16" : (score ?? 0) >= 65 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className={running ? "animate-spin [animation-duration:2.4s]" : ""} aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="#ecebe6" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={running ? "#C5F23A" : col} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${running ? c * 0.3 : (v / 100) * c} ${c}`} transform="rotate(-90 26 26)" style={{ transition: "stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
}

export function DashTools({ d }: { d: ToolData }) {
  const router = useRouter();
  // While the first security check runs in the background, refresh a few times to pick up the result.
  useEffect(() => {
    if (!d.securityRunning) return;
    let n = 0; const id = setInterval(() => { n++; router.refresh(); if (n >= 6) clearInterval(id); }, 12000);
    return () => clearInterval(id);
  }, [d.securityRunning, router]);
  const big = "mt-0.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums";
  return (
    <section className="mt-4" aria-label="Your growth tools">
      <div className="mb-3 flex items-end justify-between"><h2 className="text-[16px] font-semibold tracking-tight">Your growth tools</h2><span className="text-[12px] text-stone-500">Tap any tool to open it</span></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile href="/app/leads/find" icon={Sparkles} title="Find leads" accent testid="tile-find">
          <p className="mt-1 text-[15px] font-semibold leading-snug">Pick who &amp; where — we find them</p>
        </Tile>
        <Tile href="/app/leads" icon={Users} title="Leads this week" testid="tile-leads">
          <p className={big}>{d.leadsWeek}</p><Spark data={d.leadDays} />
        </Tile>
        <Tile href="/app/email" icon={Mail} title="Email campaigns" testid="tile-email">
          <p className={big}>{d.campaigns}</p><p className="mt-1 text-[12px] text-stone-500">{d.campaigns ? "running or ready" : "Write one with AI"}</p>
        </Tile>
        <Tile href="/app/seo" icon={Search} title="SEO & AI search" testid="tile-seo">
          <p className={big}>{d.seo ?? "—"}<span className="text-[14px] font-normal text-stone-400">{d.seo != null ? "/100" : ""}</span></p>
          <p className="mt-1 text-[12px] text-stone-500">{d.ai != null ? `AI visibility ${d.ai}` : d.hasWebsite ? "Run your audit" : "Add your website"}</p>
        </Tile>
        <Tile href="/app/security" icon={Lock} title="Security health" testid="tile-security">
          <div className="flex items-center gap-3">
            <MiniRing score={d.security?.score ?? null} running={d.securityRunning} />
            <div>{d.security ? <><p className="text-[22px] font-semibold leading-none">{d.security.grade}<span className="ml-1 text-[13px] font-normal text-stone-500">{d.security.score}</span></p><p className="mt-1 text-[12px] text-stone-500">{d.security.fixes ? `${d.security.fixes} to fix` : "All good"}{d.security.delta ? ` · ${d.security.delta > 0 ? "▲" : "▼"}${Math.abs(d.security.delta)}` : ""}</p></>
              : <p className="text-[12px] leading-snug text-stone-500">{d.securityRunning ? "Checking your site…" : d.hasWebsite ? "Run your first check" : "Add your website"}</p>}</div>
          </div>
        </Tile>
        <Tile href="/app/content" icon={Send} title="Social & content" testid="tile-content">
          <p className={big}>{d.scheduled}</p><p className="mt-1 text-[12px] text-stone-500">scheduled · {d.drafts} to review</p>
        </Tile>
      </div>
      <Link href="/app/inbox" className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-2.5 text-[13px] text-stone-500 transition hover:border-stone-400 hover:text-ink"><Inbox className="h-4 w-4" /> Replies from email, WhatsApp, Facebook and Instagram land in one inbox <ArrowUpRight className="ml-auto h-3.5 w-3.5" /></Link>
    </section>
  );
}
