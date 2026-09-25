// Simple generic channel glyphs (not official logos).
export function ChannelIcon({ channel, className = "h-4 w-4" }: { channel: string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (channel === "whatsapp")
    return <svg {...common}><path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12Z" /><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 1.8.8-.4 1.6c-3.3.4-7-3.3-6.6-6.6l1.6-.4.8 1.8Z" /></svg>;
  if (channel === "instagram")
    return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" /></svg>;
  if (channel === "messenger" || channel === "facebook")
    return <svg {...common}><path d="M12 3.5c-4.7 0-8.5 3.5-8.5 7.9 0 2.5 1.2 4.7 3.2 6.1v3l2.9-1.6c.8.2 1.6.3 2.4.3 4.7 0 8.5-3.5 8.5-7.8S16.7 3.5 12 3.5Z" /><path d="m7.5 13.5 3-3 2 2 4-3.5" /></svg>;
  return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6 8.5 7 8.5-7" /></svg>;
}

export const CHANNEL_LABEL: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", facebook: "Facebook" };
export const CHANNEL_TINT: Record<string, string> = { email: "bg-mist text-stone-700", whatsapp: "bg-emerald-50 text-emerald-700", instagram: "bg-fuchsia-50 text-fuchsia-700", messenger: "bg-sky-50 text-sky-700", facebook: "bg-sky-50 text-sky-700" };
