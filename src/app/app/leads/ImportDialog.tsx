"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Upload } from "lucide-react";
import { importLeadsAction } from "@/app/email-actions";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Notice, inputCls } from "@/components/ui/Form";

/** Small RFC-4180 CSV parser (quotes, commas and newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  const semi = !t.slice(0, 500).includes(",") && t.slice(0, 500).includes(";");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === "," || (c === ";" && semi) || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** vCard (.vcf) from iPhone, Android, Outlook or Google Contacts export. */
function parseVcf(text: string): Row[] {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const val = (lines: string[], key: RegExp) => { const l = lines.find((x) => key.test(x.split(":")[0])); return l ? l.slice(l.indexOf(":") + 1).replace(/\\,/g, ",").replace(/\\;/g, ";").trim() : ""; };
  return cards.map((c) => {
    const lines = c.split(/\r?\n/);
    const n = val(lines, /^N(;|$)/i).split(";");
    return {
      name: val(lines, /^FN(;|$)/i) || [n[1], n[0]].filter(Boolean).join(" "),
      email: val(lines, /^(item\d+\.)?EMAIL/i), phone: val(lines, /^(item\d+\.)?TEL/i), company: val(lines, /^ORG/i).split(";")[0],
      notes: val(lines, /^NOTE/i).slice(0, 500),
    };
  }).filter((r) => r.name || r.email || r.phone);
}

const MAP: [keyof Row, RegExp][] = [
  ["email", /^e-?mail/i], ["phone", /phone|mobile|whatsapp|tel|cell|contact no|number/i], ["company", /company|organi[sz]ation|business|account/i],
  ["tags", /tags?|labels?|segment|group/i], ["notes", /notes?|comments?|message/i], ["value", /value|amount|deal/i],
  ["first", /^first|given/i], ["last", /^last|surname|family/i], ["name", /name|contact/i],
];
export type Row = { name?: string; email?: string; phone?: string; company?: string; tags?: string; notes?: string; value?: string; first?: string; last?: string };

const digits = (p: string, cc: string) => {
  let d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = cc + d.slice(1); else if (d.length === 10) d = cc + d;
  return /^\d{8,15}$/.test(d) ? d : "";
};

export function ImportDialog({ onClose, initial, whatsapp = false }: { onClose: () => void; initial?: { id: string; label: string; rows: Row[] }; whatsapp?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial?.rows ?? []);
  const [source, setSource] = useState(initial?.label ?? "");
  const [cols, setCols] = useState<string[]>(initial ? ["name", "email", "phone", "company"] : []);
  const [tag, setTag] = useState(initial ? `google-contacts-${new Date().toISOString().slice(0, 10)}` : "");
  const [cc, setCc] = useState("91");
  const [optIn, setOptIn] = useState(false);
  const [onlyPhones, setOnlyPhones] = useState(whatsapp);
  const [state, setState] = useState<{ error?: string; message?: string; ok?: boolean }>();
  const [pending, start] = useTransition();

  const stats = useMemo(() => {
    const phones = rows.filter((r) => digits(r.phone ?? "", cc)).length;
    return { phones, emails: rows.filter((r) => /@/.test(r.email ?? "")).length };
  }, [rows, cc]);
  const usable = (r: Row) => Boolean(digits(r.phone ?? "", cc) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((r.email ?? "").trim()));
  const chosen = onlyPhones ? rows.filter((r) => digits(r.phone ?? "", cc)) : rows.filter(usable);

  const onFile = async (f: File) => {
    setState(undefined);
    const text = await f.text();
    let out: Row[];
    if (/\.vcf$/i.test(f.name) || /^\s*BEGIN:VCARD/i.test(text)) {
      out = parseVcf(text);
      setCols(["name", "email", "phone", "company"]);
      if (!out.length) return setState({ error: "No contacts found in that vCard file." });
    } else {
      const grid = parseCsv(text);
      if (grid.length < 2) return setState({ error: "The file needs a header row and at least one contact." });
      const header = grid[0].map((h) => h.trim());
      const idx: Partial<Record<keyof Row, number>> = {};
      header.forEach((h, i) => { const m = MAP.find(([k, re]) => re.test(h) && idx[k] === undefined); if (m) idx[m[0]] = i; });
      if (idx.email === undefined && idx.name === undefined && idx.first === undefined && idx.phone === undefined) return setState({ error: "Couldn't find a Name, Email or Phone column. Add a header row like: name,phone,email,company,tags" });
      out = grid.slice(1).map((r) => {
        const g = (k: keyof Row) => (idx[k] !== undefined ? (r[idx[k]!] ?? "").trim() : "");
        return { name: g("name") || [g("first"), g("last")].filter(Boolean).join(" "), email: g("email"), phone: g("phone"), company: g("company"), tags: g("tags"), notes: g("notes"), value: g("value") };
      });
      setCols(Object.keys(idx).filter((c) => c !== "first" && c !== "last"));
    }
    setRows(out);
    setSource(f.name);
    setTag(f.name.replace(/\.(csv|vcf|txt)$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40));
  };

  return (
    <Dialog title={whatsapp ? "Add WhatsApp contacts" : "Import contacts"} onClose={onClose} wide>
      <div className="grid gap-4">
        {!rows.length && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center hover:border-ink">
              <FileUp className="h-7 w-7 text-stone-400" />
              <span className="text-[14px] font-medium">Upload a file</span>
              <span className="text-[12px] text-stone-500">CSV from Excel / Google Sheets / your CRM, or a <b>.vcf</b> contacts export from your phone or Outlook.</span>
              <input type="file" accept=".csv,.vcf,.txt,text/csv,text/vcard,text/x-vcard" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} data-testid="import-file" />
            </label>
            <a href="/api/oauth/google/start?for=contacts" className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line p-6 text-center hover:border-ink">
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" /><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" /></svg>
              <span className="text-[14px] font-medium">Import from Google Contacts</span>
              <span className="text-[12px] text-stone-500">Sign in with the Gmail account whose contacts you want. Growvia reads them once — you pick what to import.</span>
            </a>
          </div>
        )}
        {rows.length > 0 && (
          <>
            <p className="text-[14px]"><b>{rows.length}</b> contacts from {source || "your file"}{rows.length - rows.filter(usable).length > 0 ? <span className="text-stone-500"> ({rows.length - rows.filter(usable).length} without a phone or email will be skipped)</span> : null} · <b>{stats.phones}</b> with a valid phone · <b>{stats.emails}</b> with email{cols.length ? <span className="text-stone-500"> · columns: {cols.join(", ")}</span> : null}</p>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-paper text-stone-500"><tr>{["Name", "Phone", "Email", "Company"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-line">{[r.name, r.phone, r.email, r.company].map((v, j) => <td key={j} className="max-w-[160px] truncate px-3 py-2">{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tag everyone in this import" hint="use it to pick them in a broadcast"><input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} maxLength={40} /></Field>
              <Field label="Country code for numbers without one" hint="e.g. 91 India, 1 US, 44 UK"><input value={cc} onChange={(e) => setCc(e.target.value.replace(/\D/g, "").slice(0, 4) || "91")} className={inputCls} inputMode="numeric" aria-label="Default country code" /></Field>
            </div>
            <label className="flex items-start gap-2 text-[13px] text-stone-700"><input type="checkbox" checked={onlyPhones} onChange={(e) => setOnlyPhones(e.target.checked)} className="mt-0.5" /> Only import contacts with a phone number ({stats.phones})</label>
            <label className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-[13px] text-emerald-950">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5" data-testid="optin" />
              <span><b>These people agreed to get WhatsApp messages from us</b> (they&apos;re customers, enquired, or opted in). WhatsApp bans numbers that message people who didn&apos;t agree — leave this unticked if you&apos;re not sure; you can still email them or opt people in later.</span>
            </label>
          </>
        )}
        <Notice state={state} />
        <div className="flex flex-wrap gap-2">
          {rows.length > 0 && (
            <button disabled={!chosen.length || pending || state?.ok} onClick={() => start(async () => {
              const r = await importLeadsAction(chosen.map(({ first: _f, last: _l, ...x }) => x), tag, { optIn, country: cc, importId: initial?.id });
              setState(r ?? undefined);
              if (r?.ok) router.refresh();
            })} className="btn-primary h-10 px-5 text-[14px] disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Import {chosen.length} contact{chosen.length === 1 ? "" : "s"}
            </button>
          )}
          {state?.ok && whatsapp && tag && <a href="/app/whatsapp" className="btn-ghost h-10 px-4 text-[14px]">Send a broadcast to “{tag}”</a>}
          {rows.length > 0 && !state?.ok && <button onClick={() => { setRows([]); setState(undefined); }} className="btn-ghost h-10 px-4 text-[14px]">Choose another file</button>}
          <button onClick={() => { if (initial) router.replace(location.pathname); onClose(); }} className="btn-ghost h-10 px-4 text-[14px]">{state?.ok ? "Done" : "Cancel"}</button>
        </div>
        <p className="text-[12px] text-stone-400">Duplicates (same email or phone) aren&apos;t added twice — existing leads get the tag{optIn ? " and WhatsApp opt-in" : ""} instead.</p>
      </div>
    </Dialog>
  );
}

/** Button + dialog, for pages outside Leads (e.g. WhatsApp). */
export function ImportContactsButton({ whatsapp = false, label = "Import contacts", className = "btn-ghost h-10 px-4 text-[14px]" }: { whatsapp?: boolean; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}><Upload className="h-4 w-4" /> {label}</button>
      {open && <ImportDialog whatsapp={whatsapp} onClose={() => setOpen(false)} />}
    </>
  );
}
