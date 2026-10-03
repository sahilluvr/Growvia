import Link from "next/link";
import type { ReactNode } from "react";
import { Viz, parseViz } from "@/components/blog/Viz";

/* Tiny Markdown renderer for blog posts: ## / ### headings, paragraphs, - and 1. lists, > tips, | tables |, **bold**, *italic*, `code`, [links](url),
   plus animated visuals: a line like "::flow Title | A | B" (see components/blog/Viz.tsx for every kind). */

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inline(text: string, key = 0, live?: Set<string>): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k} className="font-semibold text-ink">{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={k} className="break-words rounded bg-mist px-1.5 py-0.5 font-mono text-[0.88em] text-ink [overflow-wrap:anywhere]">{m[4]}</code>);
    else if (m[5]) {
      const href = m[6];
      // A link to a post that isn't published yet reads as plain text until that day (no 404s).
      const blog = href.match(/^\/blog\/([^/#?]+)/);
      const loc = href.match(/^\/local-marketing\/([^/#?]+)/);
      if ((blog && live && !live.has(blog[1])) || (loc && live && !live.has(`local:${loc[1]}`))) { out.push(m[5]); last = re.lastIndex; continue; }
      out.push(href.startsWith("/") ? <Link key={k} href={href} className="text-ink underline decoration-lime decoration-2 underline-offset-4">{m[5]}</Link> : <a key={k} href={href} target="_blank" rel="noopener" className="text-ink underline decoration-lime decoration-2 underline-offset-4">{m[5]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function headings(md: string) {
  return md.split("\n").filter((l) => /^## /.test(l)).map((l) => { const t = l.slice(3).trim(); return { id: slugify(t), text: t }; });
}

export function wordCount(md: string) {
  return md.replace(/^::[a-z]+ .*$/gm, " ").replace(/[#>*`|\-]/g, " ").split(/\s+/).filter(Boolean).length;
}

export function Markdown({ source, live }: { source: string; live?: Set<string> }) {
  const inl = (t: string, k = 0) => inline(t, k, live);
  const lines = source.trim().split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("::")) {
      const v = parseViz(line.trim());
      if (v) { blocks.push(<Viz key={k++} {...v} inl={(t, n = 0) => inl(t, k * 100 + n)} />); i++; continue; }
    }
    if (line.startsWith("## ")) { const t = line.slice(3).trim(); blocks.push(<h2 key={k++} id={slugify(t)} className="scroll-mt-24 pt-6 text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">{inl(t)}</h2>); i++; continue; }
    if (line.startsWith("### ")) { blocks.push(<h3 key={k++} className="pt-2 text-[20px] font-semibold tracking-tight text-ink">{inl(line.slice(4).trim())}</h3>); i++; continue; }
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) buf.push(lines[i++].slice(2));
      blocks.push(<aside key={k++} className="rounded-2xl border border-lime-500/40 bg-lime/15 px-5 py-4 text-[16px] text-lime-950">{inl(buf.join(" "), k)}</aside>);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) { const r = lines[i++].split("|").slice(1, -1).map((c) => c.trim()); if (!r.every((c) => /^-+$/.test(c))) rows.push(r); }
      const [head, ...body] = rows;
      blocks.push(
        <div key={k++} className="rv post-table overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <thead className="bg-mist/70"><tr>{head.map((c, j) => <th key={j} className="px-4 py-2.5 font-semibold text-ink">{inl(c)}</th>)}</tr></thead>
            <tbody>{body.map((r, j) => <tr key={j} className="border-t border-line" style={{ ["--d" as string]: `${Math.min(j, 12) * 70}ms` }}>{r.map((c, x) => <td key={x} className="px-4 py-2.5 align-top">{inl(c, j * 10 + x)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) items.push(lines[i++].replace(/^(- |\d+\. )/, ""));
      const cls = "grid gap-2 pl-6 marker:text-stone-400";
      blocks.push(ordered ? <ol key={k++} className={`${cls} list-decimal`}>{items.map((t, j) => <li key={j}>{inl(t, j)}</li>)}</ol> : <ul key={k++} className={`${cls} list-disc`}>{items.map((t, j) => <li key={j}>{inl(t, j)}</li>)}</ul>);
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(## |### |> |\||- |\d+\. |::[a-z]+ )/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(<p key={k++}>{inl(buf.join(" "), k)}</p>);
  }
  return <div className="grid gap-5 text-[17px] leading-[1.75] text-stone-700">{blocks}</div>;
}

/** Q&As under a "## Frequently asked questions" heading (### question, then answer paragraphs) for FAQPage markup. */
export function faqs(md: string) {
  const at = md.search(/^## (Frequently asked questions|FAQs?)\s*$/im);
  if (at < 0) return [];
  const rest = md.slice(at).split("\n").slice(1);
  const out: { q: string; a: string }[] = [];
  for (const line of rest) {
    if (line.startsWith("## ")) break;
    if (line.startsWith("### ")) out.push({ q: line.slice(4).trim(), a: "" });
    else if (out.length && line.trim() && !line.startsWith("::")) out[out.length - 1].a += (out[out.length - 1].a ? " " : "") + line.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*`]/g, "").trim();
  }
  return out.filter((f) => f.a);
}
