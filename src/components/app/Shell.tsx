"use client";
import { LIMITS, PRICES } from "@/lib/billing/catalog";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Target, Megaphone, CalendarDays, Users, Settings, LogOut, Menu, X, Inbox, Mail, CalendarClock, MessageCircle, Send, Plug, Search, ClipboardList, ChevronsUpDown, Check, Plus, FolderKanban, Clapperboard, MapPin, ChevronDown, Globe2, CreditCard, Swords, ShieldCheck } from "lucide-react";
import { switchProjectAction } from "@/app/project-actions";
import { JobsProvider } from "./Jobs";
import { NotifyProvider, NotificationBell } from "./Notify";
import { Logo } from "@/components/Logo";
import { SEGMENTS } from "@/lib/plans";
import type { AppUser } from "@/lib/data/types";

type Item = { href: string; label: string; icon: React.ElementType; also?: string[]; keys?: string };
type Group = { id: string; label: string; icon: React.ElementType; items: Item[] };

/** Everyday pages stay visible; the rest live in groups that open one at a time, so the menu never needs scrolling. */
const CORE: Item[] = [
  { href: "/app", label: "Overview", icon: LayoutGrid, keys: "home dashboard" },
  { href: "/app/inbox", label: "Inbox", icon: Inbox, keys: "messages replies chat" },
  { href: "/app/leads", label: "Leads", icon: Users, keys: "contacts customers pipeline crm import" },
];
const GROUPS: Group[] = [
  { id: "website", label: "Website & local", icon: Globe2, items: [
    { href: "/app/seo", label: "SEO & AI search", icon: Search, keys: "google rankings keywords audit geo chatgpt search console" },
    { href: "/app/local", label: "Google Business", icon: MapPin, keys: "gmb maps reviews local business profile" },
    { href: "/app/competitors", label: "Competitors", icon: Swords, keys: "rivals compare benchmark reviews maps" },
    { href: "/app/forms", label: "Website forms", icon: ClipboardList, keys: "form embed lead capture" },
  ] },
  { id: "outreach", label: "Outreach", icon: Mail, items: [
    { href: "/app/email", label: "Email", icon: Mail, also: ["/app/templates"], keys: "campaigns sequences newsletter broadcast mailbox" },
    { href: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle, keys: "broadcast templates contacts" },
    { href: "/app/meetings", label: "Meetings", icon: CalendarClock, keys: "booking calendar appointments" },
    { href: "/app/health", label: "Sending health", icon: ShieldCheck, keys: "deliverability spam warm up warmup bounce domain dns spf dkim dmarc blocklist whatsapp quality" },
  ] },
  { id: "social", label: "Social & ads", icon: Megaphone, items: [
    { href: "/app/publish", label: "Publish", icon: Send, keys: "post instagram facebook youtube schedule" },
    { href: "/app/ads", label: "Ad studio", icon: Clapperboard, keys: "video ads copy avatar" },
    { href: "/app/campaigns", label: "Social campaigns", icon: Megaphone, keys: "campaign" },
    { href: "/app/content", label: "Content library", icon: CalendarDays, keys: "calendar drafts scheduled planned" },
  ] },
  { id: "setup", label: "Setup", icon: Settings, items: [
    { href: "/app/plan", label: "Growth plan", icon: Target, keys: "strategy" },
    { href: "/app/projects", label: "Projects", icon: FolderKanban, keys: "workspaces clients" },
    { href: "/app/integrations", label: "Connect tools", icon: Plug, keys: "connect setup integrations email gmail google search console website form install" },
    { href: "/app/channels", label: "Channels", icon: Plug, keys: "connect accounts integrations facebook instagram youtube whatsapp" },
    { href: "/app/settings", label: "Settings", icon: Settings, keys: "team invite notifications profile" },
  ] },
];
// Billing lives in the plan card at the bottom of the sidebar, and in quick search.
const ALL: (Item & { group?: string })[] = [...CORE, ...GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), { href: "/app/billing", label: "Plan & billing", icon: CreditCard, keys: "upgrade pro subscription invoice payment", group: "Setup" }];

type ProjectsInfo = { current: string; workspaces: { id: string; name: string }[]; projects: { id: string; name: string; workspace_id: string | null; website: string | null }[] };

type Props = {
  user: AppUser;
  business: { name: string; segment: string; city: string | null };
  projects: ProjectsInfo;
  newLeads: number;
  unread: number;
  mode: "supabase";
  plan?: { label: string; source: string; trialDaysLeft: number; mine: boolean; paymentIssue: boolean };
  children: React.ReactNode;
};

/** Prefetch a page when the pointer heads for its link (hover/focus/touch): clicks feel instant without
    prefetching every sidebar page on every page view. Each page is fetched at most every 25 seconds. */
const warmed = new Map<string, number>();
function useWarm() {
  const router = useRouter();
  return (href: string) => {
    const t = warmed.get(href) ?? 0;
    if (Date.now() - t < 25_000) return;
    warmed.set(href, Date.now());
    router.prefetch(href);
  };
}

const isActive = (path: string, it: Item) => (it.href === "/app" ? path === "/app" : path.startsWith(it.href) || Boolean(it.also?.some((a) => path.startsWith(a))));

export function Shell({ user, business, projects, newLeads, unread, plan, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  useEffect(() => setOpen(false), [path]);
  // ⌘K / Ctrl+K opens quick search from anywhere.
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); } };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);
  const seg = SEGMENTS.find((s) => s.id === business.segment)?.label ?? "";
  const activeGroup = GROUPS.find((g) => g.items.some((i) => isActive(path, i)))?.id ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  useEffect(() => { if (activeGroup) setOpenGroup(activeGroup); }, [activeGroup]);
  const badge = (href: string) => (href === "/app/leads" ? newLeads : href === "/app/inbox" ? unread : 0);
  const warm = useWarm();
  const intent = (href: string) => ({ onMouseEnter: () => warm(href), onFocus: () => warm(href), onTouchStart: () => warm(href) });

  const link = (it: Item, sub = false) => {
    const on = isActive(path, it), n = badge(it.href), I = it.icon;
    return (
      <Link key={it.href} href={it.href} prefetch={false} {...intent(it.href)} aria-current={on ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[14px] leading-5 transition-colors ${sub ? "pl-9" : ""} ${on ? "bg-ink text-white" : "text-stone-600 hover:bg-mist hover:text-ink"}`}>
        {!sub && <I className={`h-4 w-4 shrink-0 ${on ? "text-lime" : ""}`} />} <span className="truncate">{it.label}</span>
        {n > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${on ? "bg-lime text-ink" : "bg-ink text-white"}`}>{n}</span>}
      </Link>
    );
  };

  const nav = (
    <nav className="grid gap-0.5" aria-label="App">
      <button type="button" onClick={() => setPalette(true)} className="mb-2 flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-[7px] text-[14px] text-stone-500 hover:border-stone-300 hover:text-ink" aria-label="Search pages">
        <Search className="h-4 w-4" /> Jump to…<kbd className="ml-auto hidden rounded border border-line bg-paper px-1.5 font-mono text-[10px] text-stone-400 lg:inline">⌘K</kbd>
      </button>
      {CORE.map((it) => link(it))}
      {GROUPS.map((g) => {
        const expanded = openGroup === g.id;
        const GI = g.icon;
        const hasActive = g.id === activeGroup;
        return (
          <div key={g.id} className="grid gap-0.5" data-group={g.id}>
            <button type="button" onClick={() => setOpenGroup(expanded ? null : g.id)} onMouseEnter={() => g.items.slice(0, 2).forEach((i) => warm(i.href))} aria-expanded={expanded} aria-controls={`nav-${g.id}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[14px] leading-5 transition-colors hover:bg-mist hover:text-ink ${hasActive && !expanded ? "font-medium text-ink" : "text-stone-600"}`}>
              <GI className="h-4 w-4 shrink-0" /> <span className="truncate">{g.label}</span>
              {hasActive && !expanded && <span className="h-1.5 w-1.5 rounded-full bg-lime-500" aria-hidden />}
              <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
            <div id={`nav-${g.id}`} className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="relative min-h-0">
                <span className="absolute bottom-1 left-[21px] top-1 w-px bg-line" aria-hidden />
                <div className="grid gap-0.5 py-0.5" ref={(el) => { if (el) { if (expanded) el.removeAttribute("inert"); else el.setAttribute("inert", ""); } }}>{g.items.map((it) => link(it, true))}</div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="grid gap-2 border-t border-line pt-3">
      {plan && <PlanCard plan={plan} active={path.startsWith("/app/billing")} />}
      <div className="flex items-center gap-2.5 px-1">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-lime">{user.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-4">{user.name}</div>
          <div className="truncate text-[12px] text-stone-500">{user.email}</div>
        </div>
        <form action="/auth/signout" method="post">
          <button className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-mist hover:text-ink" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );

  const bizCard = <ProjectSwitcher business={business} seg={seg} info={projects} path={path} />;
  const TABS: Item[] = [CORE[0], CORE[1], CORE[2], GROUPS[2].items[0]];

  return (
    <NotifyProvider>
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-line bg-paper lg:flex">
        <div className="px-4 pb-2 pt-4">
          <Link href="/app" className="mb-3 block px-1"><Logo /></Link>
          {bizCard}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 [scrollbar-width:thin]">{nav}</div>
        <div className="px-4 pb-4">{footer}</div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 lg:hidden">
        <Link href="/app"><Logo /></Link>
        <div className="flex items-center gap-1">
          <NotificationBell align="right" />
          <button onClick={() => setPalette(true)} className="grid h-10 w-10 place-items-center rounded-full" aria-label="Search pages"><Search className="h-5 w-5" /></button>
          <button onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-full" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-16 top-14 z-40 flex flex-col overflow-y-auto overscroll-contain bg-paper px-4 py-4 lg:hidden">
          {bizCard}
          {nav}
          <div className="mt-4">{footer}</div>
        </div>
      )}

      {/* Phones: the four places people use most, always one tap away. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Quick">
        {TABS.map((it) => {
          const on = isActive(path, it), I = it.icon, n = badge(it.href);
          return (
            <Link key={it.href} href={it.href} prefetch={false} {...intent(it.href)} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-medium text-ink" : "text-stone-500"}`}>
              <I className={`h-5 w-5 ${on ? "text-ink" : ""}`} />{it.label === "Overview" ? "Home" : it.label}
              {n > 0 && <span className="absolute right-[22%] top-2 min-w-[16px] rounded-full bg-lime-500 px-1 text-center text-[10px] font-semibold leading-4 text-ink">{n > 99 ? "99+" : n}</span>}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${open ? "font-medium text-ink" : "text-stone-500"}`}>
          <Menu className="h-5 w-5" /> More
        </button>
      </nav>

      <div className="pb-16 lg:pb-0 lg:pl-[248px]">
        {/* Desktop top bar: notifications live top-right, like every app people already know. */}
        <div className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-2 border-b border-line bg-paper/90 px-6 backdrop-blur lg:flex lg:px-10" data-testid="topbar">
          <NotificationBell align="right" />
        </div>
        <main className="mx-auto w-full max-w-[1160px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10"><JobsProvider>{children}</JobsProvider></main>
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
    </NotifyProvider>
  );
}

/** Quick search for every page (⌘K). Type a few letters — "gmb", "reviews", "invite" — then Enter. */
function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const hits = ALL.filter((it) => { const hay = `${it.label} ${it.group ?? ""} ${it.keys ?? ""}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
  useEffect(() => setSel(0), [q]);
  const go = (href: string) => { onClose(); router.push(href); };
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/40 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Jump to a page">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-frame">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-stone-400" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages — try “reviews”, “invite”, “youtube”…" aria-label="Search pages"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter" && hits[sel]) go(hits[sel].href);
            }}
            className="h-12 w-full bg-transparent text-[15px] outline-none" />
          <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-stone-400">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {hits.map((it, i) => {
            const I = it.icon;
            return (
              <li key={it.href} role="option" aria-selected={i === sel}>
                <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(it.href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] ${i === sel ? "bg-mist text-ink" : "text-stone-600"}`}>
                  <I className="h-4 w-4 shrink-0" /> <span className="flex-1">{it.label}</span>{it.group && <span className="text-[12px] text-stone-400">{it.group}</span>}
                </button>
              </li>
            );
          })}
          {!hits.length && <li className="px-3 py-6 text-center text-[14px] text-stone-500">No page matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}

/** The project picker at the top of the sidebar: every workspace and its projects, one click to switch. */
function ProjectSwitcher({ business, seg, info, path }: { business: Props["business"]; seg: string; info: ProjectsInfo; path: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const cur = info.workspaces.find((w) => info.projects.some((p) => p.id === info.current && p.workspace_id === w.id));
  // Stay on the same section when switching (detail pages belong to the old project, so go to their list).
  const section = path.split("/").slice(0, 3).join("/") || "/app";
  return (
    <div ref={ref} className="relative mb-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" aria-label="Switch project"
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-left hover:border-stone-300">
        <div className="min-w-0 flex-1">
          {cur && <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-stone-400">{cur.name}</div>}
          <div className="truncate text-[14px] font-semibold tracking-tight">{business.name}</div>
          <div className="truncate text-[12px] text-stone-500">{seg}{business.city ? ` · ${business.city}` : ""}</div>
        </div>
        <ChevronsUpDown className={`h-4 w-4 shrink-0 text-stone-400 ${pending ? "animate-pulse" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-[60dvh] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-frame" role="listbox">
          {info.workspaces.map((w) => (
            <div key={w.id} className="py-1">
              <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-stone-400">{w.name}</p>
              {info.projects.filter((p) => p.workspace_id === w.id).map((p) => (
                <button key={p.id} role="option" aria-selected={p.id === info.current} disabled={pending}
                  onClick={() => { setOpen(false); if (p.id !== info.current) start(() => switchProjectAction(p.id, section)); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-mist">
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span>{p.website && <span className="block truncate text-[11px] text-stone-500">{p.website.replace(/^https?:\/\//, "")}</span>}</span>
                  {p.id === info.current && <Check className="h-4 w-4 text-lime-600" />}
                </button>
              ))}
              <Link href={`/onboarding?new=1&ws=${w.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-stone-500 hover:bg-mist hover:text-ink"><Plus className="h-3.5 w-3.5" /> New project</Link>
            </div>
          ))}
          <div className="mt-1 border-t border-line pt-1.5">
            <Link href="/app/projects" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium hover:bg-mist"><FolderKanban className="h-4 w-4" /> Manage workspaces & projects</Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small plan status above the account card: Free/trial nudge to upgrade, Pro shows quietly. */
function PlanCard({ plan, active }: { plan: NonNullable<Props["plan"]>; active: boolean }) {
  if (plan.paymentIssue && plan.mine) return <Link href="/app/billing" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900" data-testid="plan-card"><b>Payment problem</b> — update your payment to keep {plan.label}.</Link>;
  if (plan.source === "free" || plan.source === "trial") {
    return (
      <Link href="/app/billing" aria-current={active ? "page" : undefined} className="group grid gap-1 rounded-xl border border-line bg-white p-3 text-[13px] transition hover:border-ink" data-testid="plan-card">
        <span className="flex items-center justify-between font-medium">{plan.source === "trial" ? "Pro trial" : "Free plan"}<span className="rounded-full bg-lime px-2 py-0.5 text-[11px] text-ink">{plan.mine ? "Upgrade" : "Plan"}</span></span>
        <span className="text-[12px] text-stone-500">{plan.source === "trial" ? `${plan.trialDaysLeft} day${plan.trialDaysLeft === 1 ? "" : "s"} left · then Free` : `Pro from $${PRICES.pro.month}/month — ${LIMITS.pro.projects} projects, more of everything`}</span>
      </Link>
    );
  }
  return <Link href="/app/billing" className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] text-stone-500 hover:bg-mist hover:text-ink" data-testid="plan-card">Plan <span className="font-medium text-ink">{plan.label}</span></Link>;
}
