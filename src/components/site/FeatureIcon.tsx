import { Search, Sparkles, Mail, Inbox, MessageCircle, ImageIcon, ClipboardList, CalendarClock, Users, Clapperboard } from "lucide-react";
import type { Feature } from "@/lib/site/features";

const MAP = { search: Search, sparkles: Sparkles, mail: Mail, inbox: Inbox, whatsapp: MessageCircle, image: ImageIcon, form: ClipboardList, calendar: CalendarClock, users: Users, clapper: Clapperboard } as const;

export function FeatureIcon({ icon, className = "h-5 w-5" }: { icon: Feature["icon"]; className?: string }) {
  const I = MAP[icon];
  return <I className={className} aria-hidden="true" />;
}
