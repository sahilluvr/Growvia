import { Sparkles } from "lucide-react";

export function PageHeader({ title, sub, children, eyebrow = "Growvia AI" }: { title: string; sub?: string; children?: React.ReactNode; eyebrow?: string | null }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <span className="gv-chip-ai mb-2"><Sparkles className="gv-sparkle h-3 w-3" /> {eyebrow}</span>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tightest sm:text-[34px]">{title}</h1>
        <div className="gv-title-bar mt-2" aria-hidden />
        {sub && <p className="mt-2 text-[15px] text-stone-500">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
