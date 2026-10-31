import "server-only";
import { lookup } from "@/lib/health/dns";
import type { MailboxPresetKey } from "./types";

/** Well-known free mail domains. */
const BY_DOMAIN: Record<string, MailboxPresetKey | "outlook_personal"> = {
  "gmail.com": "gmail", "googlemail.com": "gmail",
  "outlook.com": "outlook_personal", "hotmail.com": "outlook_personal", "live.com": "outlook_personal", "msn.com": "outlook_personal", "outlook.in": "outlook_personal", "hotmail.co.uk": "outlook_personal",
  "yahoo.com": "yahoo", "yahoo.in": "yahoo", "yahoo.co.in": "yahoo", "yahoo.co.uk": "yahoo", "ymail.com": "yahoo",
  "icloud.com": "icloud", "me.com": "icloud", "mac.com": "icloud",
  "zoho.com": "zoho", "zohomail.com": "zoho", "zoho.in": "zoho_in", "zohomail.in": "zoho_in",
};
/** Mail servers (MX) → who hosts a business domain's email. */
const BY_MX: [RegExp, MailboxPresetKey][] = [
  [/(^|\.)google(mail)?\.com$|aspmx/i, "gmail"],
  [/protection\.outlook\.com$|outlook\.com$/i, "outlook"],
  [/zoho\.in$/i, "zoho_in"],
  [/zoho\.(com|eu)$|zohomail/i, "zoho"],
  [/secureserver\.net$/i, "godaddy"],
  [/hostinger\.(com|in)$/i, "hostinger"],
  [/titan\.email$/i, "titan"],
  [/privateemail\.com$|registrar-servers\.com$/i, "namecheap"],
  [/yahoodns\.net$/i, "yahoo"],
];

export type Detected = { preset: MailboxPresetKey | null; note?: string; personalOutlook?: boolean };

export async function detectProvider(email: string): Promise<Detected> {
  const domain = email.trim().toLowerCase().split("@")[1]?.replace(/\.$/, "");
  if (!domain || !domain.includes(".")) return { preset: null };
  const known = BY_DOMAIN[domain];
  if (known === "outlook_personal") return { preset: "outlook", personalOutlook: true, note: "Personal Outlook.com / Hotmail addresses can't be connected with a password any more (Microsoft's rule). Use your business email, Gmail or Zoho instead." };
  if (known) return { preset: known };
  const mx = await lookup(domain, "MX").catch(() => [] as string[]);
  const hosts = mx.map((r) => r.split(/\s+/).pop() ?? r).map((h) => h.replace(/\.$/, ""));
  for (const h of hosts) for (const [re, key] of BY_MX) if (re.test(h)) return { preset: key, note: `Your email for ${domain} is hosted by ${key === "gmail" ? "Google Workspace" : key === "outlook" ? "Microsoft 365" : key.replace("_in", " (India)")} — we've filled in the settings.` };
  return { preset: hosts.length ? "custom" : null, note: hosts.length ? `We couldn't recognise ${domain}'s email host automatically — pick it below, or choose Other.` : undefined };
}
