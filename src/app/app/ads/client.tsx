"use client";
import { safe } from "@/lib/client/safe-action";
import { useFormState } from "react-dom";
import { Sparkles } from "lucide-react";
import { createAdAction } from "@/app/ad-actions";
import { Notice, Submit, inputCls } from "@/components/ui/Form";

const GOALS = ["Get more enquiries / leads", "Sell a product online", "Get bookings or appointments", "Promote an offer or event", "Grow brand awareness", "Get app or software sign-ups", "Hire people"];

export function NewAd({ website }: { website: string }) {
  const [state, action] = useFormState(safe(createAdAction), undefined);
  return (
    <form action={action} className="card grid gap-4 p-5 sm:p-6" data-testid="new-ad">
      <p className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles className="h-4 w-4" /> Create ads from a website</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="text-[13px] font-medium">Website or landing page</span>
          <input name="url" defaultValue={website} className={`${inputCls} mt-1.5`} placeholder="yourbusiness.com/offer" inputMode="url" /></label>
        <label className="block"><span className="text-[13px] font-medium">What should the ads do?</span>
          <select name="goal" className={`${inputCls} mt-1.5`}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium">What to promote <span className="font-normal text-stone-400">optional</span></span>
          <input name="offer" maxLength={300} className={`${inputCls} mt-1.5`} placeholder="e.g. weekend brunch, free consultation" /></label>
        <label className="block sm:col-span-2"><span className="text-[13px] font-medium">Who should see them <span className="font-normal text-stone-400">optional</span></span>
          <input name="audience" maxLength={300} className={`${inputCls} mt-1.5`} placeholder="e.g. families within 5 km, HR managers at startups" /></label>
      </div>
      <Notice state={state?.error ? state : undefined} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn-primary h-11 px-5 text-[14px]" pendingText="Reading the website and writing the brief…">Start</Submit>
        <p className="text-[12px] text-stone-500">Takes about 20 seconds. Nothing is published.</p>
      </div>
    </form>
  );
}
