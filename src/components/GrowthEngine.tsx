"use client";
import { useEffect, useState } from "react";
import {
  LayoutGrid, Target, Megaphone, Users, LineChart, Compass, PenLine, Send, Search, Handshake, BarChart3, ArrowUpRight,
} from "lucide-react";

type Item = { agent: string; icon: React.ElementType; text: string; tag: string };

const FEED: Item[] = [
  { agent: "Strategist", icon: Compass, text: "Spotted demand for office catering within 3 km — building a campaign.", tag: "Opportunity" },
  { agent: "Creator", icon: PenLine, text: "Drafted 5 posts + a Google offer for the weekend pasta night.", tag: "Content" },
  { agent: "Distributor", icon: Send, text: "Published to Instagram, Google Business and the email list.", tag: "Live" },
  { agent: "Lead Finder", icon: Search, text: "Found 14 local offices ordering team lunches. Added to pipeline.", tag: "+14 leads" },
  { agent: "Closer", icon: Handshake, text: "Replied to 6 enquiries and booked 3 catering tastings.", tag: "3 booked" },
  { agent: "Analyst", icon: BarChart3, text: "Reels outperform photos 2.4×. Shifting next week's mix.", tag: "Learning" },
  { agent: "Creator", icon: PenLine, text: "Wrote a reply-to-review template in your voice. 4 reviews answered.", tag: "Reputation" },
  { agent: "Lead Finder", icon: Search, text: "Detected 9 new wedding planners in the area. Outreach queued.", tag: "+9 leads" },
];

const WEEKS = [12, 14, 13, 15, 14, 19, 24, 28, 33, 37, 44, 48];

function Chart() {
  const w = 520, h = 170, pad = 8;
  const max = 52;
  const pts = WEEKS.map((v, i) => [pad + (i * (w - pad * 2)) / (WEEKS.length - 1), h - pad - (v / max) * (h - pad * 2)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`;
  const startX = pts[4][0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Weekly leads rising after Growvia started">
      <defs>
        <linearGradient id="ga" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#C5F23A" stopOpacity="0.35" />
          <stop offset="1" stopColor="#C5F23A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="rgba(255,255,255,0.06)" />
      ))}
      <line x1={startX} x2={startX} y1="6" y2={h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" />
      <path d={area} fill="url(#ga)" />
      <path d={d} fill="none" stroke="#C5F23A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" className="animate-draw" style={{ strokeDashoffset: 1 }} vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#C5F23A" />
    </svg>
  );
}

export function GrowthEngine() {
  const [tick, setTick] = useState(3);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, []);
  const visible = Array.from({ length: 4 }, (_, i) => ({ ...FEED[(tick - i + FEED.length * 100) % FEED.length], key: tick - i }));
  const leads = 48 + Math.max(0, tick - 3) * 2;

  return (
    <div className="relative rounded-[22px] bg-ink p-1.5 shadow-frame">
      {/* window bar */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 font-mono text-[11px] text-white/50">
          app.growvia.ai / bellas-trattoria
        </div>
        <span className="hidden rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/40 sm:block">
          Sample workspace
        </span>
      </div>

      <div className="grid grid-cols-12 gap-1.5 rounded-[18px] bg-ink-800 p-1.5 text-white">
        {/* sidebar */}
        <aside className="col-span-2 hidden flex-col gap-1 rounded-2xl bg-ink-900/60 p-3 lg:flex">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E8603C] text-[12px] font-semibold">B</span>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium">Bella&apos;s Trattoria</div>
              <div className="text-[10px] text-white/40">Restaurant · Austin</div>
            </div>
          </div>
          {[
            [LayoutGrid, "Overview", true],
            [Target, "Growth plan"],
            [Megaphone, "Campaigns"],
            [Users, "Leads"],
            [LineChart, "Insights"],
          ].map(([Icon, label, active]) => {
            const I = Icon as React.ElementType;
            return (
              <div key={label as string} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] ${active ? "bg-white/10 text-white" : "text-white/50"}`}>
                <I className="h-3.5 w-3.5" /> {label as string}
              </div>
            );
          })}
          <div className="mt-auto rounded-xl border border-lime/20 bg-lime/10 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-lime">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime" /> Team active
            </div>
            <div className="mt-1 text-[10px] leading-snug text-white/50">6 agents working on this week&apos;s plan</div>
          </div>
        </aside>

        {/* main */}
        <div className="col-span-12 flex flex-col gap-1.5 md:col-span-7 lg:col-span-6">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ["New leads", leads.toString(), "+32%"],
              ["Customers won", "17", "+41%"],
              ["Revenue influenced", "$8,420", "+26%"],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-2xl bg-ink-900/60 p-3 sm:p-4">
                <div className="truncate text-[10px] text-white/45 sm:text-[11px]">{k}</div>
                <div className="mt-1 text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{v}</div>
                <div className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-lime sm:text-[11px]">
                  <ArrowUpRight className="h-3 w-3" /> {d}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-1 flex-col rounded-2xl bg-ink-900/60 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[12px] font-medium">Leads per week</div>
                <div className="text-[10px] text-white/40">Last 12 weeks</div>
              </div>
              <div className="font-mono text-[10px] text-white/40">▲ Growvia started · wk 5</div>
            </div>
            <div className="mt-3 h-[140px] sm:h-[170px]">
              <Chart />
            </div>
          </div>
        </div>

        {/* live feed */}
        <div className="col-span-12 rounded-2xl bg-ink-900/60 p-4 md:col-span-5 lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[12px] font-medium">Your AI team, right now</div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-lime">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime" /> Live
            </span>
          </div>
          <ul className="flex flex-col gap-1.5" aria-live="polite">
            {visible.map((it, i) => {
              const I = it.icon;
              return (
                <li
                  key={it.key}
                  className={`rounded-xl border border-white/5 bg-white/[0.03] p-3 ${i === 0 ? "animate-feedIn" : ""}`}
                  style={{ opacity: 1 - i * 0.18 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/80">
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-lime/15 text-lime">
                        <I className="h-3 w-3" />
                      </span>
                      {it.agent}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">{it.tag}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-white/60">{it.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
