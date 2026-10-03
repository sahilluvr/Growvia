"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ExternalLink, PartyPopper, X, AlertTriangle, CalendarClock, Sparkles, Send } from "lucide-react";
import { ChannelIcon } from "@/components/icons/Brand";

/* ─────────────────────────── Types ─────────────────────────── */

export type ToastLink = { label: string; href: string; external?: boolean };
export type Toast = { id?: string; tone?: "success" | "error" | "info" | "scheduled"; title: string; body?: string; links?: ToastLink[]; provider?: string | null; ms?: number };
export type Celebration = { key: string; title: string; body: string; count?: number; links?: ToastLink[] };
type Note = { id: string; kind: string; title: string; body: string | null; url: string | null; provider: string | null; celebrate: string | null; read_at: string | null; created_at: string };

type Ctx = { toast: (t: Toast) => void; celebrate: (c: Celebration) => void; markCelebrated: (key: string) => void; items: Note[]; unread: number; setItems: React.Dispatch<React.SetStateAction<Note[]>>; setUnread: React.Dispatch<React.SetStateAction<number>> };
const NotifyCtx = createContext<Ctx>({ toast: () => {}, celebrate: () => {}, markCelebrated: () => {}, items: [], unread: 0, setItems: () => {}, setUnread: () => {} });
export const useNotify = () => useContext(NotifyCtx);

/** Things this tab just showed itself (e.g. right after "Publish now") shouldn't pop up again from the bell. */
let quietUntil = 0;
export const quietBell = (ms = 20_000) => { quietUntil = Date.now() + ms; if (typeof window !== "undefined") window.dispatchEvent(new Event("gv:notifications")); };

const seenKey = (k: string) => `gv_celebrated_${k}`;
const wasCelebrated = (k: string) => { try { return localStorage.getItem(seenKey(k)) === "1"; } catch { return false; } };
const setCelebrated = (k: string) => { try { localStorage.setItem(seenKey(k), "1"); } catch { /* private mode */ } };

/* ─────────────────────────── Provider ─────────────────────────── */

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(Toast & { id: string })[]>([]);
  const [party, setParty] = useState<Celebration | null>(null);
  const toast = useCallback((t: Toast) => {
    const id = t.id ?? Math.random().toString(36).slice(2);
    setToasts((xs) => [...xs.filter((x) => x.id !== id), { ...t, id }].slice(-4));
  }, []);
  const dismiss = useCallback((id: string) => setToasts((xs) => xs.filter((x) => x.id !== id)), []);
  const celebrate = useCallback((c: Celebration) => { if (wasCelebrated(c.key)) return; setCelebrated(c.key); setParty(c); }, []);
  // One poller for the whole app (the bell appears twice: sidebar on desktop, header on phones).
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const known = useRef<Set<string> | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const j = (await r.json()) as { items: Note[]; unread: number };
    setItems(j.items); setUnread(j.unread);
    const first = known.current === null;
    const seen = known.current ?? new Set<string>();
    let fresh = false;
    for (const n of [...j.items].reverse()) {
      if (!first && !seen.has(n.id) && (n.kind === "post_live" || n.kind === "post_failed" || n.kind === "milestone")) fresh = true;
      if (n.celebrate && !n.read_at && !wasCelebrated(n.celebrate)) {
        celebrate({ key: n.celebrate, title: n.title, body: n.body ?? "", links: n.url?.startsWith("http") ? [{ label: "See the post", href: n.url, external: true }] : [] });
      } else if (!first && !seen.has(n.id) && !n.read_at && Date.now() > quietUntil) {
        toast({ id: n.id, tone: toneOf(n.kind), title: n.title, body: n.body ?? undefined, provider: n.provider, links: n.url ? [{ label: n.url.startsWith("http") ? "See the post" : "Open", href: n.url, external: n.url.startsWith("http") }] : [] });
      }
      seen.add(n.id);
    }
    known.current = seen;
    // A scheduled post just went out: refresh the page so its status flips to "published" without a reload.
    if (fresh) router.refresh();
  }, [celebrate, toast, router]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [load]);
  // Let other parts of the app ask for an immediate refresh (e.g. right after publishing).
  useEffect(() => { const on = () => load(); addEventListener("gv:notifications", on); return () => removeEventListener("gv:notifications", on); }, [load]);
  return (
    <NotifyCtx.Provider value={{ toast, celebrate, markCelebrated: setCelebrated, items, unread, setItems, setUnread }}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 lg:bottom-6 lg:right-6" aria-live="polite">
        {toasts.map((t) => <ToastCard key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
      </div>
      {party && <CelebrationModal c={party} onClose={() => setParty(null)} />}
    </NotifyCtx.Provider>
  );
}

const TONE = {
  success: { ring: "border-lime-300", icon: <Check className="h-4 w-4" />, chip: "bg-lime text-ink", bar: "bg-lime-500" },
  scheduled: { ring: "border-amber-200", icon: <CalendarClock className="h-4 w-4" />, chip: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
  error: { ring: "border-red-200", icon: <AlertTriangle className="h-4 w-4" />, chip: "bg-red-100 text-red-700", bar: "bg-red-400" },
  info: { ring: "border-line", icon: <Sparkles className="h-4 w-4" />, chip: "bg-ink text-lime", bar: "bg-ink" },
};

function ToastCard({ t, onClose }: { t: Toast & { id: string }; onClose: () => void }) {
  const ms = t.ms ?? (t.tone === "error" ? 12_000 : 8_000);
  const [hover, setHover] = useState(false);
  useEffect(() => { if (hover) return; const id = setTimeout(onClose, ms); return () => clearTimeout(id); }, [hover, ms, onClose]);
  const tone = TONE[t.tone ?? "info"];
  return (
    <div role="status" data-testid="toast" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={`pointer-events-auto relative w-full max-w-sm animate-toastIn overflow-hidden rounded-2xl border bg-white p-3.5 pr-10 shadow-frame ${tone.ring}`}>
      <div className="flex gap-3">
        <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone.chip}`}>
          {tone.icon}
          {t.provider && <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow"><ChannelIcon channel={t.provider} className="h-2.5 w-2.5" /></span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-5 tracking-tight">{t.title}</p>
          {t.body && <p className="mt-0.5 text-[13px] leading-5 text-stone-600">{t.body}</p>}
          {!!t.links?.length && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {t.links.map((l) => l.external
                ? <a key={l.href + l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium underline decoration-lime decoration-2 underline-offset-4">{l.label} <ExternalLink className="h-3 w-3" /></a>
                : <Link key={l.href + l.label} href={l.href} onClick={onClose} className="text-[13px] font-medium underline decoration-lime decoration-2 underline-offset-4">{l.label}</Link>)}
            </div>
          )}
        </div>
      </div>
      <button type="button" onClick={onClose} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-stone-400 hover:bg-mist hover:text-ink" aria-label="Dismiss"><X className="h-4 w-4" /></button>
      <span className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${tone.bar}`} style={{ animation: hover ? "none" : `gv-shrink ${ms}ms linear forwards` }} />
    </div>
  );
}

/* ─────────────────────────── Celebration ─────────────────────────── */

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d")!; const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    resize(); addEventListener("resize", resize);
    const colors = ["#C5F23A", "#A8DA16", "#0B0D0C", "#F7F7F3", "#FFB020", "#5B8CFF", "#FF5C8A"];
    const parts = Array.from({ length: 180 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return { x: (fromLeft ? 0.1 : 0.9) * c.width, y: c.height * 0.75, vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9) * dpr, vy: -(10 + Math.random() * 12) * dpr, r: (4 + Math.random() * 5) * dpr, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, color: colors[i % colors.length], shape: i % 3 };
    });
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      const age = now - start;
      for (const p of parts) {
        p.vy += 0.32 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 4200); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      if (age < 4300) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[91] h-full w-full" aria-hidden />;
}

function CelebrationModal({ c, onClose }: { c: Celebration; onClose: () => void }) {
  useEffect(() => { const on = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", on); return () => removeEventListener("keydown", on); }, [onClose]);
  const first = c.key === "first-post";
  return (
    <>
      <Confetti />
      <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/50 px-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-labelledby="party-title" data-testid="celebration">
        <div className="relative w-full max-w-md animate-popIn overflow-hidden rounded-3xl bg-white text-center shadow-frame">
          <div className="relative bg-ink px-6 pb-7 pt-9 text-white">
            <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden />
            <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime text-ink shadow-glow"><PartyPopper className="h-8 w-8" /></span>
            {c.count ? <p className="relative mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-lime">{first ? "Milestone unlocked" : `Milestone · ${c.count} posts`}</p> : null}
            <h2 id="party-title" className="relative mt-1.5 text-[26px] font-semibold leading-tight tracking-tight">{c.title}</h2>
          </div>
          <div className="grid gap-4 px-6 pb-6 pt-5">
            <p className="text-[15px] leading-relaxed text-stone-600">{c.body}</p>
            {!!c.links?.length && (
              <div className="grid gap-2">
                {c.links.map((l) => <a key={l.href} href={l.href} target={l.external ? "_blank" : undefined} rel="noreferrer" className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-[14px] font-medium hover:border-ink">{l.label} <ExternalLink className="h-4 w-4 text-stone-400" /></a>)}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/app/publish#compose" onClick={onClose} className="btn-primary h-11 flex-1 px-5 text-[14px]"><Send className="h-4 w-4 text-lime" /> {first ? "Schedule the next one" : "Keep going"}</Link>
              <button type="button" onClick={onClose} className="btn-ghost h-11 px-5 text-[14px]">Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── Bell ─────────────────────────── */

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now"; const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`; const d = Math.round(h / 24); return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};
const toneOf = (k: string): Toast["tone"] => (k === "post_failed" ? "error" : k === "post_scheduled" ? "scheduled" : k === "post_live" || k === "milestone" || k === "channel" ? "success" : "info");

/**
 * The notification bell. Polls every 30s (and when the tab regains focus); anything new while the app is open
 * pops up as a toast, and milestones (first post …) get their celebration once — even if it happened while away.
 */
export function NotificationBell({ align = "left" }: { align?: "left" | "right" }) {
  const { items, unread, setItems, setUnread } = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markAll = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() }))); setUnread(0);
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => null);
  };
  const openOne = async (n: Note) => {
    setOpen(false);
    if (!n.read_at) { setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))); setUnread((u) => Math.max(0, u - 1)); fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => null); }
    if (n.url?.startsWith("http")) window.open(n.url, "_blank", "noopener"); else if (n.url) router.push(n.url);
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="relative grid h-9 w-9 place-items-center rounded-full text-stone-600 hover:bg-mist hover:text-ink" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open} data-testid="bell">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-lime-500 px-1 text-center text-[10px] font-semibold leading-4 text-ink ring-2 ring-paper" data-testid="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className={`fixed inset-x-3 top-16 z-[60] overflow-hidden rounded-2xl border border-line bg-white shadow-frame lg:absolute lg:inset-x-auto lg:top-full lg:mt-2 lg:w-[380px] ${align === "right" ? "lg:right-0" : "lg:left-0"}`} role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[14px] font-semibold">Notifications</p>
            {unread > 0 && <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-[12px] text-stone-500 hover:text-ink"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openOne(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-mist ${n.read_at ? "" : "bg-lime/10"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${n.kind === "post_failed" ? "bg-red-100 text-red-700" : n.kind === "milestone" ? "bg-lime text-ink" : "bg-mist"}`}>
                    {n.kind === "milestone" ? <PartyPopper className="h-4 w-4" /> : n.kind === "post_failed" ? <AlertTriangle className="h-4 w-4" /> : n.kind === "post_scheduled" ? <CalendarClock className="h-4 w-4 text-amber-700" /> : n.provider ? <ChannelIcon channel={n.provider} className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-5">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-[12px] leading-5 text-stone-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-stone-400">{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-lime-500" aria-label="Unread" />}
                </button>
              </li>
            ))}
            {!items.length && (
              <li className="grid justify-items-center gap-2 px-6 py-10 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-mist"><Bell className="h-5 w-5 text-stone-400" /></span>
                <p className="text-[13px] font-medium">You&apos;re all caught up</p>
                <p className="text-[12px] text-stone-500">Posts going live, scheduled posts and anything that needs you will show up here.</p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
