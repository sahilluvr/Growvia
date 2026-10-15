import "server-only";

// Growvia's own emails (reports, alerts, invites) via Resend — free 3,000/month at resend.com.
const KEY = process.env.RESEND_API_KEY?.trim() || "";
const FROM = process.env.EMAIL_FROM?.trim() || "Growvia <onboarding@resend.dev>";
// Replies to Growvia's own emails (welcome, invites, alerts) go to the team inbox unless an email sets its own.
const REPLY_TO = (process.env.EMAIL_REPLY_TO || process.env.CONTACT_EMAIL || "team.usegrowvia@gmail.com").trim();
const BASE = (process.env.RESEND_BASE?.trim() || "https://api.resend.com").replace(/\/$/, "");
export const systemMailReady = Boolean(KEY);

export async function sendSystemEmail(m: { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string; fromName?: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!KEY) return { ok: false, error: "Email sending isn't set up — add RESEND_API_KEY (and EMAIL_FROM) in the server's environment variables." };
  try {
    const r = await fetch(`${BASE}/emails`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: m.fromName ? withName(FROM, m.fromName) : FROM, to: Array.isArray(m.to) ? m.to : [m.to], subject: m.subject, html: m.html, text: m.text, ...((m.replyTo || REPLY_TO) ? { reply_to: m.replyTo || REPLY_TO } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("resend send failed", r.status, d?.message);
      const msg = String(d?.message ?? "");
      // Customers see these in "Recent Growvia emails" — keep them plain.
      if (/invalid .?to|to.*(invalid|format)|recipient/i.test(msg)) return { ok: false, error: "Not sent — the email address looks invalid." };
      if (r.status === 429) return { ok: false, error: "Not sent — too many emails at once. It will be retried." };
      if (/domain.*(verif|not)/i.test(msg)) return { ok: false, error: "Not sent — the sending domain isn't verified yet." };
      return { ok: false, error: "Not sent — the email service rejected it." };
    }
    return { ok: true, id: d.id };
  } catch {
    return { ok: false, error: "Not sent — couldn't reach the email service. It will be retried." };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
export { esc };

/** Simple, email-client-safe layout used by every system email. */
export function layout({ title, preheader, body, cta }: { title: string; preheader?: string; body: string; cta?: { label: string; url: string } }) {
  return `<!doctype html><html><body style="margin:0;background:#F7F7F3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0B0D0C">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 16px;font-size:18px;font-weight:700;letter-spacing:-.02em">growvia</td></tr>
<tr><td style="background:#fff;border:1px solid #E4E4DE;border-radius:16px;padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-.02em">${esc(title)}</h1>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#0B0D0C;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;font-size:14px">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;color:#6E736D">Sent by Growvia. You get this because it's switched on in your project's SEO settings.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Same sending address, different display name ("Bella's Trattoria <hello@usegrowvia.com>"). */
function withName(from: string, name: string) {
  const addr = /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
  const clean = name.replace(/["<>\r\n]/g, "").trim().slice(0, 60);
  return clean ? `"${clean}" <${addr}>` : from;
}
