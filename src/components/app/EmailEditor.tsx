"use client";
import { useRef, useState, useTransition } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { inputCls, textareaCls } from "@/components/ui/Form";
import { aiWriteEmailAction } from "@/app/email-actions";

const TONES = ["Friendly", "Professional", "Short & direct", "Persuasive", "Playful", "Formal"];
type Opt = { subject: string; body: string; preheader?: string };
export type AiContext = { purpose?: string; leadId?: string; isFollowUp?: boolean };

/** “Write with AI”: brief → 3 options, or improve the current draft. */
function AiWriter({ ctx, current, onUse }: { ctx: AiContext; current: { subject: string; body: string }; onUse: (o: Opt) => void }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("Friendly");
  const [opts, setOpts] = useState<Opt[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = (improve: boolean) => start(async () => {
    setErr("");
    const r = await aiWriteEmailAction({ brief: improve ? "" : brief, tone, purpose: ctx.purpose, leadId: ctx.leadId, isFollowUp: ctx.isFollowUp, current });
    if (r.ok) setOpts(r.options); else setErr(r.error);
  });
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-lime/30 px-3 py-1.5 text-[13px] font-medium text-ink hover:border-ink">
      <Sparkles className="h-3.5 w-3.5" /> Write with AI
    </button>
  );
  return (
    <div className="rounded-2xl border border-line bg-paper p-3.5" data-testid="ai-writer">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Sparkles className="h-3.5 w-3.5" /> Write with AI</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close AI writer" className="rounded-full p-1 text-stone-400 hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={1500} aria-label="What should the email say?" className={`${textareaCls} mt-2 text-[14px]`}
        placeholder={ctx.isFollowUp ? "e.g. gentle nudge — share a quick customer result and ask for a 15-min call" : "e.g. invite past customers to our weekend offer, 20% off facials"} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone" className={`${inputCls} h-9 w-auto py-0 text-[13px]`}>
          {TONES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button type="button" disabled={pending || !brief.trim()} onClick={() => run(false)} className="btn-primary h-9 px-4 text-[13px] disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Write 3 options"}
        </button>
        {current.body.trim().length > 20 && (
          <button type="button" disabled={pending} onClick={() => run(true)} className="btn-ghost h-9 px-3 text-[13px]">Improve my draft</button>
        )}
      </div>
      {err && <p role="alert" className="mt-2 text-[13px] text-red-700">{err}</p>}
      {opts.length > 0 && (
        <div className="mt-3 grid gap-2">
          {opts.map((o, i) => (
            <div key={i} className="rounded-xl border border-line bg-white p-3">
              <p className="text-[13px] font-semibold">{o.subject || <span className="text-stone-400">(replies in the same thread)</span>}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-[13px] text-stone-600">{o.body}</p>
              <button type="button" onClick={() => { onUse(o); setOpts([]); setOpen(false); }} className="mt-2 rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-white">Use this</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
export function EmailEditor({ subject: s0, body: b0, subjectName = "subject", bodyName = "body", subjectPlaceholder, businessName, allowEmptySubject, ai = {} }: {
  subject: string; body: string; subjectName?: string; bodyName?: string; subjectPlaceholder?: string; businessName: string; allowEmptySubject?: boolean; ai?: AiContext | false;
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
      {ai && <AiWriter ctx={ai} current={{ subject, body }} onUse={(o) => { if (o.subject || !allowEmptySubject) setSubject(o.subject || subject); else setSubject(""); setBody(o.body); setPreview(false); }} />}
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
