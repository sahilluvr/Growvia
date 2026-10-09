import { signId } from "../server/crypto";

export type Vars = Record<string, string | null | undefined>;

export const VARIABLES = [
  { key: "first_name", label: "First name" },
  { key: "name", label: "Full name" },
  { key: "company", label: "Company" },
  { key: "business_name", label: "Your business" },
  { key: "sender_name", label: "Your name" },
  { key: "booking_link", label: "Booking link" },
  { key: "city", label: "City" },
] as const;

/** Replace {{var}} and {{var|fallback}} placeholders. */
export function personalize(text: string, vars: Vars) {
  return text.replace(/\{\{\s*([a-z_]+)\s*(?:\|\s*([^}]*))?\}\}/gi, (_, k: string, fb?: string) => {
    const v = vars[k.toLowerCase()];
    return v && String(v).trim() ? String(v) : (fb ?? "").trim();
  });
}

export function leadVars(lead: { name: string; company?: string | null }, extra: Vars): Vars {
  const first = lead.name.trim().split(/\s+/)[0] || "there";
  return { first_name: first, name: lead.name, company: lead.company ?? "", ...extra };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text (with blank-line paragraphs, URLs, **bold**) → clean email HTML. */
export function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      let h = esc(p).replace(/\n/g, "<br>");
      h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      h = h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1">$1</a>');
      return `<p style="margin:0 0 14px">${h}</p>`;
    })
    .join("\n");
}

type Build = {
  body: string;
  signature?: string | null;
  messageId: string; // our DB id (uuid)
  siteUrl: string;
  track: boolean;
  unsubscribe: boolean;
};

/** Produces the final text + HTML with open/click tracking and an unsubscribe footer. */
export function buildEmail({ body, signature, messageId, siteUrl, track, unsubscribe }: Build) {
  const unsubTok = signId(messageId, "unsub");
  const unsubUrl = `${siteUrl}/u/${unsubTok}`; // page with a confirm button (safe from link scanners)
  const oneClickUrl = `${siteUrl}/api/unsub/${unsubTok}`; // RFC 8058 one-click POST from mail apps
  const sig = signature?.trim() ? `\n\n${signature.trim()}` : "";
  const text = `${body.trim()}${sig}${unsubscribe ? `\n\n—\nDon't want these emails? Unsubscribe: ${unsubUrl}` : ""}`;
  let html = textToHtml(body + sig);
  if (track) {
    const tok = signId(messageId, "track");
    html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url: string) => `href="${siteUrl}/api/t/c/${tok}?u=${encodeURIComponent(url.replace(/&amp;/g, "&"))}"`);
  }
  const footer = unsubscribe
    ? `<p style="margin:24px 0 0;font-size:12px;color:#888">Don't want these emails? <a href="${unsubUrl}" style="color:#888">Unsubscribe</a></p>`
    : "";
  const pixel = track ? `<img src="${siteUrl}/api/t/o/${signId(messageId, "track")}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : "";
  html = `<!doctype html><html><body style="margin:0;padding:0"><div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d1d1f;max-width:600px">${html}${footer}${pixel}</div></body></html>`;
  return { text, html, unsubUrl, oneClickUrl };
}
