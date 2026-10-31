"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Bot, Globe2, MapPin, MessageSquareText, Star, User } from "lucide-react";

/* Customers now ask AI assistants who to pick. This plays a short, looping demo of that moment. */
const SCENES = [
  { q: "Who's the best family dentist in Austin?", you: "Bright Smile Dental", others: ["Lakeside Dental Care", "Austin Family Smiles"], why: "4.9★ from 380 reviews, clear prices and same-week appointments.", site: "brightsmile.example" },
  { q: "Recommend a cosy Italian restaurant in London for a date", you: "Trattoria Bella", others: ["Luca's Kitchen", "Nonna Rosa"], why: "Handmade pasta, a quiet candle-lit room and online booking.", site: "trattoriabella.example" },
  { q: "Best hair salon in Dubai Marina for balayage?", you: "Glow Studio", others: ["Marina Hair Lounge", "Salon Azure"], why: "Balayage specialists with before/after photos and 500+ five-star reviews.", site: "glowstudio.example" },
];

function useTyped(text: string, run: boolean, speed = 28) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) { setN(0); return; }
    setN(0);
    const id = setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), speed);
    return () => clearInterval(id);
  }, [text, run, speed]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

export function AiAnswerDemo() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"ask" | "think" | "answer" | "badge">("ask");
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const s = SCENES[i];
  const q = useTyped(s.q, visible, 32);
  const answer = `Here are the top picks. My #1 recommendation is ${s.you} — ${s.why} Also worth a look: ${s.others.join(" and ")}.`;
  const a = useTyped(answer, phase === "answer" || phase === "badge", 14);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (visible && phase === "ask" && q.done) { const t = setTimeout(() => setPhase("think"), 500); return () => clearTimeout(t); } }, [visible, phase, q.done]);
  useEffect(() => { if (phase === "think") { const t = setTimeout(() => setPhase("answer"), 1400); return () => clearTimeout(t); } }, [phase]);
  useEffect(() => { if (phase === "answer" && a.done) { const t = setTimeout(() => setPhase("badge"), 400); return () => clearTimeout(t); } }, [phase, a.done]);
  useEffect(() => { if (phase === "badge") { const t = setTimeout(() => { setPhase("ask"); setI((x) => (x + 1) % SCENES.length); }, 4200); return () => clearTimeout(t); } }, [phase]);

  const parts = a.shown.split(s.you);
  return (
    <section className="relative overflow-hidden py-24 sm:py-32" aria-labelledby="ai-answer-title">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_380px_at_80%_20%,rgba(143,211,255,.18),transparent_60%),radial-gradient(600px_360px_at_10%_80%,rgba(197,242,58,.16),transparent_60%)]" />
      <div className="container-x relative grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <span className="gv-chip-ai">The new search</span>
          <h2 id="ai-answer-title" className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">Customers now ask AI who to choose. <span className="gv-hero-word">Make sure it says you.</span></h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-stone-600">ChatGPT-style assistants, Gemini and Perplexity answer “who's the best…” questions millions of times a day. Growvia checks what they say about you, shows who they recommend instead, and tells you exactly what to change so you're the answer.</p>
          <ul className="mt-6 grid gap-2.5 text-[15px] text-stone-700">
            {["See which questions mention you — and which don't", "Find the competitors AI recommends instead", "Get the fixes that make assistants pick you"].map((t) => <li key={t} className="flex items-center gap-2.5"><BadgeCheck className="h-5 w-5 text-lime-700" /> {t}</li>)}
          </ul>
          <Link href="/signup" className="btn-primary mt-8 inline-flex h-12 px-6">Check my AI visibility free <ArrowRight className="h-4 w-4 text-lime" /></Link>
        </div>

        <div ref={box} className="relative">
          {/* Your signals feed the assistant */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2" aria-hidden>
            {[[Globe2, "Your website"], [MapPin, "Google profile"], [Star, "Reviews"], [MessageSquareText, "FAQs"]].map(([I, t], k) => { const Icon = I as React.ElementType; return <span key={String(t)} className={`gv-glass gv-float ${k % 3 === 1 ? "d2" : k % 3 === 2 ? "d3" : ""} flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium`}><Icon className="h-3.5 w-3.5 text-lime-700" />{String(t)}</span>; })}
          </div>
          <svg className="gv-neural mx-auto mb-2 block h-6 w-3/4" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
            {[30, 110, 190, 270].map((x) => <path key={x} d={`M${x} 0 C ${x} 14, 150 10, 150 24`} fill="none" stroke="url(#gvn)" strokeWidth="1.4" />)}
            <defs><linearGradient id="gvn" x1="0" x2="1"><stop offset="0" stopColor="#A8DA16" /><stop offset="1" stopColor="#7A5CF0" /></linearGradient></defs>
          </svg>
          <div className="gv-glass gv-glow-border rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="flex items-center gap-2 text-[13px] font-medium text-stone-600"><span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-lime-400 via-sky-400 to-violet-500"><Bot className="h-3.5 w-3.5 text-white" /></span> AI assistant</span>
              <span className="flex gap-1">{SCENES.map((_, k) => <span key={k} className={`h-1.5 w-5 rounded-full transition-colors ${k === i ? "bg-ink" : "bg-line"}`} />)}</span>
            </div>
            <div className="mt-4 grid min-h-[300px] content-start gap-4" aria-live="polite">
              <div className="flex items-start justify-end gap-2">
                <p className={`max-w-[85%] rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-[14px] text-white ${!q.done ? "gv-typing" : ""}`}>{q.shown || "\u00a0"}</p>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mist"><User className="h-3.5 w-3.5 text-stone-500" /></span>
              </div>
              {phase === "think" && (
                <div className="flex items-center gap-2 text-[13px] text-stone-500"><span className="flex gap-1">{[0, 1, 2].map((k) => <span key={k} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${k * 120}ms` }} />)}</span> Searching the web and reviews…</div>
              )}
              {(phase === "answer" || phase === "badge") && (
                <div className="flex items-start gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-lime-400 via-sky-400 to-violet-500"><Bot className="h-3.5 w-3.5 text-white" /></span>
                  <div className="min-w-0 max-w-[90%]">
                    <p className={`rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 text-[14px] leading-relaxed text-stone-700 ${!a.done ? "gv-typing" : ""}`}>
                      {parts[0]}{a.shown.includes(s.you) && <mark className="rounded bg-lime/50 px-1 font-semibold text-ink">{s.you}</mark>}{parts.slice(1).join(s.you)}
                    </p>
                    {a.done && <span className="gv-rise mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 font-mono text-[11px] text-stone-500"><Globe2 className="h-3 w-3" /> Source: {s.site}</span>}
                  </div>
                </div>
              )}
              {phase === "badge" && (
                <div className="gv-rise ml-9 flex w-fit items-center gap-2 rounded-xl bg-ink px-3.5 py-2.5 text-[13px] text-white shadow-lg">
                  <BadgeCheck className="h-4 w-4 text-lime" /> Recommended by AI <span className="text-white/50">· tracked by Growvia</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
