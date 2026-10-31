/* Which content channels Growvia can post to by itself, and what each one needs. Safe for client components. */

export type AutoRule = { provider: "instagram" | "facebook" | "youtube" | "gbp"; needs: "media" | "video" | null; connectLabel: string; connectHref: string };

export const AUTO_POST: Record<string, AutoRule> = {
  Instagram: { provider: "instagram", needs: "media", connectLabel: "Connect Instagram", connectHref: "/app/channels" },
  Facebook: { provider: "facebook", needs: null, connectLabel: "Connect Facebook", connectHref: "/app/channels" },
  YouTube: { provider: "youtube", needs: "video", connectLabel: "Connect YouTube", connectHref: "/app/channels" },
  "Google Business": { provider: "gbp", needs: null, connectLabel: "Connect Google Business Profile", connectHref: "/app/local" },
};

/** Where to send it instead, for channels that have their own tool in Growvia. */
export const OTHER_TOOL: Record<string, { label: string; href: string }> = {
  Email: { label: "Send with Email campaigns", href: "/app/email" },
  WhatsApp: { label: "Send as a WhatsApp broadcast", href: "/app/whatsapp" },
  "Meta Ads": { label: "Build it in Ads", href: "/app/ads" },
};

export type ConnectedAcc = { id: string; provider: string; name: string; username: string | null };
export type LinkedPost = { id: string; status: string; scheduled_at: string | null; names: string[]; error: string | null };

export const captionOf = (body: string) => body.replace(/^Caption:\s*/im, "").trim();
