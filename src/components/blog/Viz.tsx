import type { CSSProperties, ReactNode } from "react";

/*
  Animated visuals for blog posts. A post line like
    ::flow Title | Step one | Step two | Step three
  becomes one of these. They're plain server-rendered HTML (real text, readable by Google and screen readers);
  PostMotion adds the motion when they scroll into view, and everything shows fully without JavaScript
  or with "reduce motion" on.

  ::flow   Title | A | B | C                    a pipeline with a pulse running through it
  ::steps  Title | First | Second | Third       a numbered timeline that draws itself
  ::bars   Title | Label: $19 * | Label: $140   bars that grow to scale (* = highlight, optional "(note)" after the value)
  ::stats  Title | 250 | contacts on the free plan  (pairs: value, label)
  ::check  Title | Item | Item                  ticks that land one by one
  ::chat   Title | them: Hi | you: Hello        a short conversation, message by message
  ::stack  Title | Tool: $140 | Tool: $20 | => Growvia Pro: $19   many tools collapse into one
  ::scale  Title | Good: ≤ 2.5 s | Needs work: 2.5–4 s | Poor: > 4 s   a three-band meter
  ::funnel Title | Searches: 1,000 | Profile views: 320 | Calls: 45 | New patients: 14   a funnel that narrows stage by stage
  ::compare Title | Before: a; b; c | After: x; y; z     two columns side by side (the second is highlighted)
*/

type Inline = (t: string, k?: number) => ReactNode[];
const d = (i: number, base = 0, step = 110): CSSProperties => ({ ["--d" as string]: `${base + i * step}ms` });
const num = (s: string) => { const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };

/** Splits "₹1,500/mo" into prefix "₹", 1500 and suffix "/mo" for count-up numbers. */
function countParts(v: string) {
  const m = v.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m || /[a-z]/i.test(m[1]) || m[1].length > 3) return null; // "May 2027" stays as text
  const decimals = (m[2].split(".")[1] || "").length;
  return { pre: m[1], n: parseFloat(m[2].replace(/,/g, "")), post: m[3], decimals, comma: m[2].includes(",") };
}
function Count({ v }: { v: string }) {
  const p = countParts(v.trim());
  if (!p) return <>{v}</>;
  return <span data-count={p.n} data-pre={p.pre} data-post={p.post} data-dec={p.decimals} data-comma={p.comma ? 1 : 0}>{v}</span>;
}

function Frame({ kind, title, children, inl }: { kind: string; title: string; children: ReactNode; inl: Inline }) {
  return (
    <figure className={`viz viz-${kind} not-prose rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7`}>
      {title && <figcaption className="viz-title mb-5 flex items-center gap-2.5 text-[15px] font-semibold leading-snug tracking-tight text-ink"><span aria-hidden className="viz-pip h-2 w-2 shrink-0 rounded-full bg-lime-500" />{inl(title)}</figcaption>}
      {children}
    </figure>
  );
}

function Flow({ items, inl }: { items: string[]; inl: Inline }) {
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-y-3">
      {items.map((t, i) => (
        <li key={i} className="flex flex-col items-stretch sm:flex-row sm:items-center">
          <span className="viz-node viz-in relative rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] font-medium leading-snug text-ink" style={d(i, 0, 160)}>
            <span className="mr-1.5 font-mono text-[11px] text-lime-800">{i + 1}</span>{inl(t, i)}
          </span>
          {i < items.length - 1 && (
            <span aria-hidden className="viz-link relative mx-auto h-6 w-[2px] overflow-hidden bg-line sm:mx-2 sm:h-[2px] sm:w-8" style={d(i, 120, 160)}>
              <span className="viz-pulse absolute rounded-full bg-lime-500" style={{ ["--p" as string]: `${i * 0.35}s` }} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Steps({ items, inl }: { items: string[]; inl: Inline }) {
  return (
    <ol className="relative grid gap-4 pl-11">
      <span aria-hidden className="viz-rail absolute bottom-3 left-[15px] top-3 w-[2px] origin-top bg-lime-500" />
      <span aria-hidden className="absolute bottom-3 left-[15px] top-3 -z-0 w-[2px] bg-line" />
      {items.map((t, i) => {
        const [head, ...rest] = t.split(" — ");
        return (
          <li key={i} className="viz-in relative" style={d(i, 150, 170)}>
            <span aria-hidden className="viz-dot absolute -left-11 top-0 grid h-8 w-8 place-items-center rounded-full border-2 border-lime-500 bg-white font-mono text-[12px] font-semibold text-ink" style={d(i, 150, 170)}>{i + 1}</span>
            <p className="pt-1 text-[15.5px] leading-snug text-stone-700"><span className="font-semibold text-ink">{inl(head, i)}</span>{rest.length ? <> — {inl(rest.join(" — "), i + 50)}</> : null}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Bars({ items, inl }: { items: string[]; inl: Inline }) {
  const rows = items.map((s) => {
    const hi = /\s\*$/.test(s);
    const clean = s.replace(/\s\*$/, "");
    const at = clean.lastIndexOf(": ");
    const label = at > 0 ? clean.slice(0, at) : clean;
    let value = at > 0 ? clean.slice(at + 2) : "";
    let note = "";
    const nm = value.match(/^(.*?)\s*\((.+)\)$/);
    if (nm) { value = nm[1]; note = nm[2]; }
    return { label, value, note, hi, n: num(value) };
  });
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <div className="grid gap-3.5">
      {rows.map((r, i) => (
        <div key={i} className="viz-in grid gap-1.5" style={d(i, 0, 120)}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className={r.hi ? "font-semibold text-ink" : "text-stone-600"}>{inl(r.label, i)}</span>
            <span className={`shrink-0 font-mono tabular-nums ${r.hi ? "font-semibold text-ink" : "text-stone-500"}`}><Count v={r.value} /></span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-mist">
            <div className={`viz-bar h-full rounded-full ${r.hi ? "bg-lime-500" : "bg-stone-400/70"}`} style={{ width: `${Math.max(2.5, (r.n / max) * 100)}%`, ...d(i, 150, 120) }} />
          </div>
          {r.note && <span className="text-[12.5px] text-stone-500">{inl(r.note, i + 90)}</span>}
        </div>
      ))}
    </div>
  );
}

function Stats({ items, inl }: { items: string[]; inl: Inline }) {
  const pairs: [string, string][] = [];
  for (let i = 0; i < items.length; i += 2) pairs.push([items[i], items[i + 1] || ""]);
  return (
    <dl className={`grid gap-3 ${pairs.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {pairs.map(([v, l], i) => (
        <div key={i} className="viz-in rounded-2xl bg-paper p-4" style={d(i, 0, 140)}>
          <dt className="sr-only">{l}</dt>
          <dd className="text-[30px] font-semibold leading-none tracking-tight text-ink tabular-nums"><Count v={v} /></dd>
          <dd className="mt-2 text-[13.5px] leading-snug text-stone-600">{inl(l, i)}</dd>
          <span aria-hidden className="viz-under mt-3 block h-[3px] w-10 origin-left rounded-full bg-lime-500" style={d(i, 300, 140)} />
        </div>
      ))}
    </dl>
  );
}

function Check({ items, inl }: { items: string[]; inl: Inline }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {items.map((t, i) => (
        <li key={i} className="viz-in flex items-start gap-3 rounded-xl border border-line px-3.5 py-3 text-[14.5px] leading-snug text-stone-700" style={d(i, 0, 90)}>
          <span aria-hidden className="viz-tick mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-500 text-ink" style={d(i, 200, 90)}>
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path className="viz-tickpath" pathLength={1} d="M3.5 8.5l3 3 6-7" style={d(i, 260, 90)} /></svg>
          </span>
          <span>{inl(t, i)}</span>
        </li>
      ))}
    </ul>
  );
}

function Chat({ items, inl }: { items: string[]; inl: Inline }) {
  const msgs = items.map((s) => { const m = s.match(/^(them|you|customer|business)\s*:\s*(.*)$/i); return m ? { me: /you|business/i.test(m[1]), t: m[2] } : { me: false, t: s }; });
  return (
    <div className="viz-phone mx-auto grid max-w-md gap-2 rounded-2xl bg-[#ECE5DD] p-3.5 sm:p-4">
      {msgs.map((m, i) => (
        <p key={i} className={`viz-in viz-msg max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug shadow-sm ${m.me ? "justify-self-end rounded-br-md bg-[#D9FDD3] text-ink" : "justify-self-start rounded-bl-md bg-white text-ink"}`} style={d(i, 100, 650)}>
          {inl(m.t, i)}
        </p>
      ))}
      <span aria-hidden className="viz-typing viz-in inline-flex w-fit gap-1 justify-self-start rounded-2xl rounded-bl-md bg-white px-3 py-2.5 shadow-sm" style={d(msgs.length, 100, 650)}>
        <i /><i /><i />
      </span>
    </div>
  );
}

function Stack({ items, inl }: { items: string[]; inl: Inline }) {
  const ix = items.findIndex((s) => s.startsWith("=>"));
  const tools = (ix >= 0 ? items.slice(0, ix) : items).map((s) => { const at = s.lastIndexOf(": "); return at > 0 ? { l: s.slice(0, at), v: s.slice(at + 2) } : { l: s, v: "" }; });
  const one = ix >= 0 ? items[ix].replace(/^=>\s*/, "") : "";
  const oneAt = one.lastIndexOf(": ");
  const total = tools.reduce((a, t) => a + num(t.v), 0);
  const cur = (tools.find((t) => t.v)?.v.match(/^[^\d]*/)?.[0] || "").trim();
  const per = tools.find((t) => t.v)?.v.match(/\/\w+$/)?.[0] || "";
  return (
    <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
      <div className="grid gap-2">
        {tools.map((t, i) => (
          <div key={i} className="viz-in viz-chip flex items-center justify-between gap-3 rounded-xl border border-dashed border-stone-400/60 bg-paper px-3.5 py-2.5 text-[14px]" style={d(i, 0, 110)}>
            <span className="text-stone-700">{inl(t.l, i)}</span><span className="font-mono tabular-nums text-stone-500">{t.v}</span>
          </div>
        ))}
        {total > 0 && (
          <div className="viz-in flex items-center justify-between px-1 pt-1 text-[14px] font-semibold text-ink" style={d(tools.length, 80, 110)}>
            <span>Together</span><span className="font-mono tabular-nums line-through decoration-stone-400 decoration-2"><Count v={`${cur}${Number.isInteger(total) ? total.toLocaleString("en-US") : total.toFixed(2)}${per}`} /></span>
          </div>
        )}
      </div>
      <span aria-hidden className="viz-arrow viz-in mx-auto grid h-11 w-11 rotate-90 place-items-center rounded-full bg-ink text-lime md:rotate-0" style={d(tools.length + 1, 150, 110)}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
      {one && (
        <div className="viz-in viz-one relative rounded-2xl bg-ink p-5 text-white" style={d(tools.length + 2, 200, 110)}>
          <p className="text-[13px] text-white/60">One tool instead</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight">{inl(oneAt > 0 ? one.slice(0, oneAt) : one)}</p>
          {oneAt > 0 && <p className="mt-2 inline-block rounded-full bg-lime px-3 py-1 font-mono text-[14px] font-semibold text-ink"><Count v={one.slice(oneAt + 2)} /></p>}
        </div>
      )}
    </div>
  );
}

function Scale({ items, inl }: { items: string[]; inl: Inline }) {
  const bands = items.slice(0, 3).map((s) => { const at = s.indexOf(": "); return at > 0 ? { l: s.slice(0, at), v: s.slice(at + 2) } : { l: s, v: "" }; });
  const tone = ["bg-[#2E9E5B]", "bg-[#F2A93B]", "bg-[#E2553F]"];
  return (
    <div>
      <div className="relative pt-7">
        <span aria-hidden className="viz-marker absolute top-0 grid -translate-x-1/2 justify-items-center" style={{ left: "16%" }}>
          <span className="rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-lime">goal</span>
          <span className="h-2 w-[2px] bg-ink" />
        </span>
        <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-full">
          {bands.map((b, i) => <span key={i} className={`viz-band h-3.5 ${tone[i]}`} style={d(i, 0, 140)} />)}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {bands.map((b, i) => (
          <div key={i} className="viz-in text-[13px] leading-snug" style={d(i, 200, 140)}>
            <p className="font-semibold text-ink">{inl(b.l, i)}</p><p className="font-mono text-[12.5px] text-stone-500">{inl(b.v, i + 10)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Funnel({ items, inl }: { items: string[]; inl: Inline }) {
  const rows = items.map((s) => { const at = s.lastIndexOf(": "); return at > 0 ? { l: s.slice(0, at), v: s.slice(at + 2) } : { l: s, v: "" }; });
  const max = Math.max(...rows.map((r) => num(r.v)), 1);
  return (
    <div className="grid gap-2">
      {rows.map((r, i) => {
        const w = 46 + 54 * Math.sqrt(Math.max(0, num(r.v)) / max); // sqrt scale keeps small stages readable
        const last = i === rows.length - 1;
        return (
          <div key={i} className="viz-in flex justify-center" style={d(i, 0, 160)}>
            <div className={`viz-bar flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-[14px] ${last ? "bg-ink text-white" : i === 0 ? "bg-lime/40 text-ink" : "bg-mist text-ink"}`} style={{ width: `${w}%`, transformOrigin: "center", ...d(i, 120, 160) }}>
              <span className="min-w-0 leading-snug">{inl(r.l, i)}</span>
              <span className={`shrink-0 font-mono font-semibold tabular-nums ${last ? "text-lime" : ""}`}><Count v={r.v} /></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Compare({ items, inl }: { items: string[]; inl: Inline }) {
  const cols = items.slice(0, 2).map((s) => { const at = s.indexOf(": "); return { h: at > 0 ? s.slice(0, at) : "", list: (at > 0 ? s.slice(at + 2) : s).split(/;\s*/).filter(Boolean) }; });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cols.map((c, i) => (
        <div key={i} className={`viz-in rounded-2xl p-4 ${i === 1 ? "bg-ink text-white" : "border border-line bg-mist/50"}`} style={d(i, 0, 220)}>
          <p className={`mb-2 font-mono text-[11px] uppercase tracking-[0.14em] ${i === 1 ? "text-lime" : "text-stone-500"}`}>{inl(c.h, i)}</p>
          <ul className="grid gap-1.5 text-[14px] leading-snug">
            {c.list.map((t, j) => (
              <li key={j} className="viz-in flex gap-2" style={d(j, 200 + i * 220, 90)}>
                <span aria-hidden className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${i === 1 ? "bg-lime" : "bg-stone-400"}`} />{inl(t, j + i * 20)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const KINDS: Record<string, (p: { items: string[]; inl: Inline }) => JSX.Element> = { flow: Flow, steps: Steps, bars: Bars, stats: Stats, check: Check, chat: Chat, stack: Stack, scale: Scale, funnel: Funnel, compare: Compare };
export const VIZ_KINDS = Object.keys(KINDS);

/** Parses one "::kind Title | a | b" line. Returns null if it isn't a known visual. */
export function parseViz(line: string) {
  const m = line.match(/^::([a-z]+)\s+(.*)$/);
  if (!m || !KINDS[m[1]]) return null;
  const [title, ...items] = m[2].split(/\s\|\s/).map((s) => s.trim());
  return { kind: m[1], title, items: items.filter(Boolean) };
}

export function Viz({ kind, title, items, inl }: { kind: string; title: string; items: string[]; inl: Inline }) {
  const Body = KINDS[kind];
  return <Frame kind={kind} title={title} inl={inl}><Body items={items} inl={inl} /></Frame>;
}
