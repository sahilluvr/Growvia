"use client";
import { useRef, useState } from "react";
import { inputCls, textareaCls } from "@/components/ui/Form";

export const VARS = [
  ["first_name", "First name"], ["name", "Full name"], ["company", "Company"], ["business_name", "Your business"],
  ["sender_name", "Your name"], ["booking_link", "Booking link"], ["city", "City"],
] as const;

const SAMPLE: Record<string, string> = { first_name: "Priya", name: "Priya Sharma", company: "Infosys", sender_name: "Sahil", booking_link: "https://growvia…/book/you", city: "Mohali" };

export function fill(text: string, extra: Record<string, string>) {
  const v = { ...SAMPLE, ...extra };
  return text.replace(/\{\{\s*([a-z_]+)\s*(?:\|\s*([^}]*))?\}\}/gi, (_, k: string, fb?: string) => v[k.toLowerCase()] || (fb ?? "").trim());
}

/** Subject + body fields with variable chips and a live preview. */
export function EmailEditor({ subject: s0, body: b0, subjectName = "subject", bodyName = "body", subjectPlaceholder, businessName, allowEmptySubject }: {
  subject: string; body: string; subjectName?: string; bodyName?: string; subjectPlaceholder?: string; businessName: string; allowEmptySubject?: boolean;
}) {
  const [subject, setSubject] = useState(s0);
  const [body, setBody] = useState(b0);
  const [preview, setPreview] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const insert = (k: string) => {
    const el = ta.current;
    const tag = `{{${k}}}`;
    if (!el) return setBody((b) => b + tag);
    const [a, z] = [el.selectionStart, el.selectionEnd];
    const next = body.slice(0, a) + tag + body.slice(z);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); });
  };
  return (
    <div className="grid gap-3">
      <input name={subjectName} value={subject} onChange={(e) => setSubject(e.target.value)} required={!allowEmptySubject} maxLength={200} className={inputCls} placeholder={subjectPlaceholder ?? "Subject line"} aria-label="Subject" />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-stone-400">Insert:</span>
        {VARS.map(([k, l]) => (
          <button type="button" key={k} onClick={() => insert(k)} className="rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] text-stone-600 hover:border-ink">{l}</button>
        ))}
        <button type="button" onClick={() => setPreview((p) => !p)} className="ml-auto rounded-full px-2.5 py-1 text-[12px] font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">{preview ? "Edit" : "Preview"}</button>
      </div>
      {preview ? (
        <div className="rounded-xl border border-line bg-paper p-4">
          <p className="text-[13px] text-stone-500">Subject: <b className="text-ink">{fill(subject, { business_name: businessName }) || "(same thread — Re: …)"}</b></p>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed">{fill(body, { business_name: businessName })}</p>
          <input type="hidden" name={bodyName} value={body} />
        </div>
      ) : (
        <textarea ref={ta} name={bodyName} value={body} onChange={(e) => setBody(e.target.value)} rows={10} required maxLength={10000} className={`${textareaCls} font-[inherit]`} placeholder="Hi {{first_name}}, …" />
      )}
      <p className="text-[12px] text-stone-400">Tip: {"{{company|your team}}"} uses “your team” when a lead has no company. Blank lines make paragraphs; links become clickable.</p>
    </div>
  );
}
