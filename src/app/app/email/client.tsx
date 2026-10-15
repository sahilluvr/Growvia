"use client";
import { safe } from "@/lib/client/safe-action";
import { useState } from "react";
import { useFormState } from "react-dom";
import { Sparkles } from "lucide-react";
import { aiCampaignAction } from "@/app/email-actions";
import { Notice, Submit, inputCls, textareaCls } from "@/components/ui/Form";

const TONES = ["Friendly", "Professional", "Short & direct", "Persuasive", "Playful", "Formal"];

/** Describe the goal → Growvia writes the whole campaign, ready to review. */
export function AiCampaign({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, action] = useFormState(safe(aiCampaignAction), undefined);
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="card mb-3 flex w-full items-center gap-3 p-4 text-left transition-shadow hover:shadow-frame">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-lime/40"><Sparkles className="h-4 w-4" /></span>
      <span><span className="block text-[15px] font-semibold">Create a campaign with AI</span><span className="text-[13px] text-stone-500">Describe the goal — Growvia writes every email and the follow-up timing.</span></span>
    </button>
  );
  return (
    <form action={action} className="card mb-6 grid gap-3 p-5" data-testid="ai-campaign">
      <p className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles className="h-4 w-4" /> Create a campaign with AI</p>
      <label className="block"><span className="text-[13px] font-medium">What should this campaign achieve?</span>
        <textarea name="goal" required rows={2} maxLength={1000} className={`${textareaCls} mt-1.5`} placeholder="e.g. turn new website enquiries into booked consultation calls" /></label>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_160px]">
        <label className="block"><span className="text-[13px] font-medium">Who gets it? <span className="font-normal text-stone-400">optional</span></span>
          <input name="audience" maxLength={300} className={`${inputCls} mt-1.5`} placeholder="e.g. people who filled the website form" /></label>
        <label className="block"><span className="text-[13px] font-medium">Emails</span>
          <select name="steps" defaultValue="4" className={`${inputCls} mt-1.5`}>{[2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium">Tone</span>
          <select name="tone" className={`${inputCls} mt-1.5`}>{TONES.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      <Notice state={state?.error ? state : undefined} />
      <div className="flex gap-2">
        <Submit className="btn-primary h-10 px-5 text-[14px]" pendingText="Writing your campaign…">Write campaign</Submit>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost h-10 px-4 text-[14px]">Cancel</button>
      </div>
      <p className="text-[12px] text-stone-400">Nothing is sent yet — you&apos;ll review every email, choose who gets it, then launch.</p>
    </form>
  );
}
