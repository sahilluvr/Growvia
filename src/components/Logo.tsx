export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0B0D0C" />
      <path d="M8 21.5l5-5 3.5 3L24 12" fill="none" stroke="#C5F23A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 12H24v5.5" fill="none" stroke="#C5F23A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={`h-7 w-7 ${dark ? "[&>rect]:fill-white/10" : ""}`} />
      <span className={`text-[19px] font-semibold tracking-[-0.04em] ${dark ? "text-white" : "text-ink"}`}>growvia</span>
    </span>
  );
}
