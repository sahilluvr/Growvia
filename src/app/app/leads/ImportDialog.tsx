"use client";
import { useState, useTransition } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { importLeadsAction } from "@/app/email-actions";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Notice, inputCls } from "@/components/ui/Form";

/** Small RFC-4180 CSV parser (quotes, commas and newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";" && !t.slice(0, 500).includes(",")) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const MAP: [keyof Row, RegExp][] = [
  ["email", /^e-?mail/i], ["phone", /phone|mobile|whatsapp|tel/i], ["company", /company|organi[sz]ation|business|account/i],
  ["tags", /tags?|labels?|segment/i], ["notes", /notes?|comments?|message/i], ["value", /value|amount|deal/i],
  ["first", /^first/i], ["last", /^last|surname/i], ["name", /name|contact/i],
];
type Row = { name?: string; email?: string; phone?: string; company?: string; tags?: string; notes?: string; value?: string; first?: string; last?: string };

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [state, setState] = useState<{ error?: string; message?: string; ok?: boolean }>();
  const [pending, start] = useTransition();
  const onFile = async (f: File) => {
    const grid = parseCsv(await f.text());
    if (grid.length < 2) return setState({ error: "The file needs a header row and at least one lead." });
    const header = grid[0].map((h) => h.trim());
    const idx: Partial<Record<keyof Row, number>> = {};
    header.forEach((h, i) => { const m = MAP.find(([k, re]) => re.test(h) && idx[k] === undefined); if (m) idx[m[0]] = i; });
    if (idx.email === undefined && idx.name === undefined && idx.first === undefined) return setState({ error: "Couldn't find a Name or Email column. Add a header row like: name,email,phone,company,tags" });
    const out = grid.slice(1).map((r) => {
      const g = (k: keyof Row) => (idx[k] !== undefined ? (r[idx[k]!] ?? "").trim() : "");
      return { name: g("name") || [g("first"), g("last")].filter(Boolean).join(" "), email: g("email"), phone: g("phone"), company: g("company"), tags: g("tags"), notes: g("notes"), value: g("value") };
    });
    setCols(Object.keys(idx));
    setRows(out);
    setState(undefined);
    setTag(f.name.replace(/\.csv$/i, "").slice(0, 40));
  };
  return (
    <Dialog title="Import leads from CSV" onClose={onClose} wide>
      <div className="grid gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-8 text-center hover:border-ink">
          <FileUp className="h-7 w-7 text-stone-400" />
          <span className="text-[14px] font-medium">Choose a .csv file</span>
          <span className="text-[12px] text-stone-500">Export from Excel, Google Sheets, your CRM or Shopify. Columns like name, email, phone, company, tags are detected automatically.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {rows.length > 0 && (
          <>
            <p className="text-[14px]"><b>{rows.length}</b> rows found · detected: {cols.filter((c) => c !== "first" && c !== "last").join(", ") || "name"}</p>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-paper text-stone-500"><tr>{["Name", "Email", "Phone", "Company", "Tags"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-line">{[r.name, r.email, r.phone, r.company, r.tags].map((v, j) => <td key={j} className="max-w-[160px] truncate px-3 py-2">{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <Field label="Tag everyone in this import" hint="optional — handy for targeting a campaign"><input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} maxLength={40} /></Field>
          </>
        )}
        <Notice state={state} />
        <div className="flex gap-2">
          <button disabled={!rows.length || pending || state?.ok} onClick={() => start(async () => { const r = await importLeadsAction(rows.map(({ first: _f, last: _l, ...x }) => x), tag); setState(r ?? undefined); })} className="btn-primary h-10 px-5 text-[14px] disabled:opacity-50">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Import {rows.length || ""} leads
          </button>
          <button onClick={onClose} className="btn-ghost h-10 px-4 text-[14px]">{state?.ok ? "Done" : "Cancel"}</button>
        </div>
        <p className="text-[12px] text-stone-400">Only import people who agreed to hear from you (customers, enquiries, event sign-ups). Duplicates by email are skipped.</p>
      </div>
    </Dialog>
  );
}
