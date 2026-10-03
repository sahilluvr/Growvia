import "server-only";
import { lookup, txt } from "./dns";

/* Domain setup checks (MX, SPF, DKIM, DMARC), blocklists, and "where do I change DNS?" detection. */

export type Provider = "google" | "microsoft" | "zoho" | "other";
export type CheckStatus = "ok" | "warn" | "bad" | "unknown";
export type Rec = { type: "TXT" | "CNAME" | "MX"; host: string; value: string; priority?: number };
export type Check = { id: "mx" | "spf" | "dkim" | "dmarc" | "blocklist"; status: CheckStatus; title: string; detail: string; found?: string[]; add?: Rec[]; steps?: string[] };
export type DnsHost = { name: string; url: string | null; hint: string };
export type DomainReport = { domain: string; free: boolean; provider: Provider; dnsHost: DnsHost | null; checks: Check[]; score: number; at: string };

const FREE = /^(gmail|googlemail|yahoo|ymail|rocketmail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|rediffmail|gmx|yandex|mail|zohomail)\.(com|in|co\.in|me|co\.uk|net|ch)$/i;
export const isFreeDomain = (d: string) => FREE.test(d);
export const domainOf = (email: string) => (email.split("@")[1] ?? "").toLowerCase().trim();
export const cleanDomain = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
export const validDomain = (d: string) => /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(d) && d.length <= 253;

export function providerOf(smtpHost: string | null | undefined, mx: string[] = []): Provider {
  const s = `${smtpHost ?? ""} ${mx.join(" ")}`.toLowerCase();
  if (/google|gmail/.test(s)) return "google";
  if (/outlook|office365|microsoft|protection\.outlook/.test(s)) return "microsoft";
  if (/zoho/.test(s)) return "zoho";
  return "other";
}
export const PROVIDER_LABEL: Record<Provider, string> = { google: "Google Workspace", microsoft: "Microsoft 365", zoho: "Zoho Mail", other: "your email host" };
const SPF_INCLUDE: Record<Provider, string | null> = { google: "_spf.google.com", microsoft: "spf.protection.outlook.com", zoho: "zohomail.in", other: null };
const SPF_MATCH: Record<Provider, RegExp> = { google: /_spf\.google\.com/, microsoft: /spf\.protection\.outlook\.com/, zoho: /zoho(mail)?\.(in|com|eu)/, other: /./ };
const DKIM_SELECTORS: Record<Provider, string[]> = {
  google: ["google"], microsoft: ["selector1", "selector2"], zoho: ["zmail", "zoho"], other: [],
};
const COMMON_SELECTORS = ["default", "dkim", "mail", "k1", "s1", "s2", "resend", "smtp", "x", "hs1"];
const DKIM_STEPS: Record<Provider, string[]> = {
  google: ["Open admin.google.com → Apps → Google Workspace → Gmail → Authenticate email.", "Click “Generate new record” (2048-bit, prefix “google”).", "Add the TXT record it shows (host google._domainkey) at your DNS provider.", "Back in Google Admin click “Start authentication”."],
  microsoft: ["Open security.microsoft.com → Email & collaboration → Policies → Email authentication settings → DKIM.", "Pick your domain; Microsoft shows two CNAME records (selector1._domainkey and selector2._domainkey).", "Add both CNAMEs at your DNS provider, then switch DKIM “Enabled”."],
  zoho: ["Open mailadmin.zoho.in → Domains → your domain → Email configuration → DKIM.", "Add a selector (e.g. “zmail”) and copy the TXT value.", "Add it at your DNS provider as zmail._domainkey, then click Verify in Zoho."],
  other: ["In your email host's panel (cPanel, Hostinger, GoDaddy email…) look for “DKIM” or “Email authentication” and turn it on.", "Add the TXT or CNAME record it gives you at your DNS provider."],
};
const MX_STEPS: Record<Provider, string[]> = {
  google: ["Add the MX record: host @, value smtp.google.com, priority 1 (Google's current single-record setup)."],
  microsoft: ["In the Microsoft 365 admin center → Settings → Domains → your domain → DNS records, copy the MX value (…mail.protection.outlook.com) and add it."],
  zoho: ["Add MX records mx.zoho.in (10), mx2.zoho.in (20), mx3.zoho.in (50)."],
  other: ["Your email host gives you MX records — without them, replies and bounce notices can't reach you."],
};

const HOSTS: [RegExp, string, (d: string) => string | null][] = [
  [/ns\.cloudflare\.com$/, "Cloudflare", () => "https://dash.cloudflare.com/"],
  [/domaincontrol\.com$/, "GoDaddy", (d) => `https://dcc.godaddy.com/control/portfolio/${d}/settings?tab=dns`],
  [/registrar-servers\.com$/, "Namecheap", (d) => `https://ap.www.namecheap.com/Domains/DomainControlPanel/${d}/advancedns`],
  [/(dns-parking\.com|hostinger)/, "Hostinger", (d) => `https://hpanel.hostinger.com/domain/${d}/dns`],
  [/(googledomains\.com|squarespacedns|squarespace)/, "Squarespace (Google Domains)", (d) => `https://account.squarespace.com/domains/managed/${d}/dns/dns-settings`],
  [/vercel-dns\.com$/, "Vercel", () => "https://vercel.com/dashboard/domains"],
  [/awsdns/, "Amazon Route 53", () => "https://console.aws.amazon.com/route53/v2/hostedzones"],
  [/(bigrock|resellerclub|mydomainpanel)/, "BigRock / ResellerClub", () => "https://manage.bigrock.in/"],
  [/(hostgator|websitewelcome)/, "HostGator", () => "https://portal.hostgator.com/"],
  [/bluehost/, "Bluehost", () => "https://my.bluehost.com/"],
  [/wixdns\.net$/, "Wix", () => "https://manage.wix.com/account/domains"],
  [/(digitalocean)/, "DigitalOcean", () => "https://cloud.digitalocean.com/networking/domains"],
  [/(zoho)/, "Zoho", () => "https://domains.zoho.in/"],
  [/(nsone|dnsimple|dnsmadeeasy)/, "your DNS provider", () => null],
];

async function dnsHost(domain: string): Promise<DnsHost | null> {
  const ns = await lookup(domain, "NS").catch(() => []);
  if (!ns.length) return null;
  for (const [re, name, url] of HOSTS) if (ns.some((n) => re.test(n.toLowerCase()))) return { name, url: url(domain), hint: `Your DNS is managed at ${name}. Open DNS settings there and add the records below.` };
  return { name: ns[0].split(".").slice(-2).join("."), url: null, hint: `Your DNS is managed at ${ns[0].split(".").slice(-2).join(".")} (from your nameservers). Add the records below there.` };
}

/** Is this name on common spam blocklists? Public DNS resolvers are refused by some lists → "couldn't check". */
async function listed(q: string, list: string): Promise<boolean | null> {
  const a = await lookup(`${q}.${list}`, "A").catch(() => null);
  if (a === null) return null;
  if (!a.length) return false;
  if (a.some((x) => /^127\.255\.255\./.test(x)) || (/uribl|surbl/.test(list) && a.includes("127.0.0.1"))) return null; // query refused
  return a.some((x) => /^127\.0\.[0-9]+\.[0-9]+$/.test(x));
}

export async function blocklists(domain: string, ips: string[] = []) {
  const lists = ["dbl.spamhaus.org", "multi.surbl.org", "multi.uribl.com"];
  const ipLists = ["zen.spamhaus.org", "bl.spamcop.net", "psbl.surriel.com"];
  const tasks: Promise<{ list: string; on: boolean | null }>[] = [
    ...lists.map(async (l) => ({ list: l, on: await listed(domain, l) })),
    ...ips.slice(0, 2).flatMap((ip) => ipLists.map(async (l) => ({ list: `${l} (${ip})`, on: await listed(ip.split(".").reverse().join("."), l) }))),
  ];
  const r = await Promise.all(tasks);
  return { on: r.filter((x) => x.on === true).map((x) => x.list), checked: r.filter((x) => x.on !== null).length, total: r.length };
}

function spfCheck(records: string[] | null, domain: string, provider: Provider): Check {
  if (records === null) return { id: "spf", status: "unknown", title: "SPF", detail: "Couldn't read DNS right now — try again in a minute." };
  const spf = records.filter((r) => /^v=spf1\b/i.test(r));
  const inc = SPF_INCLUDE[provider];
  if (!spf.length) {
    const value = `v=spf1 ${inc ? `include:${inc} ` : ""}~all`;
    return { id: "spf", status: "bad", title: "SPF missing", detail: `Nothing tells inboxes which servers may send email for ${domain}, so your emails look forged and often land in spam.`, add: [{ type: "TXT", host: "@", value }], steps: inc ? undefined : ["Ask your email host for their SPF “include” and add it before ~all."] };
  }
  if (spf.length > 1) return { id: "spf", status: "bad", title: "Two SPF records", detail: "Only one SPF record is allowed — with two, inboxes treat SPF as broken. Merge them into one.", found: spf, add: [{ type: "TXT", host: "@", value: mergeSpf(spf, inc) }], steps: ["Delete all the SPF TXT records at @, then add the single merged one below."] };
  const r = spf[0];
  if (/\+all\b/.test(r)) return { id: "spf", status: "bad", title: "SPF allows anyone", detail: "“+all” lets anyone send as you. Change it to “~all”.", found: spf, add: [{ type: "TXT", host: "@", value: r.replace(/\+all\b/, "~all") }] };
  const lookups = (r.match(/\b(include:|a\b|mx\b|ptr\b|exists:|redirect=)/g) ?? []).length;
  if (inc && !SPF_MATCH[provider].test(r)) return { id: "spf", status: "bad", title: `SPF doesn't include ${PROVIDER_LABEL[provider]}`, detail: `Your SPF record exists but doesn't allow ${PROVIDER_LABEL[provider]} to send for you.`, found: spf, add: [{ type: "TXT", host: "@", value: mergeSpf([r], inc) }], steps: ["Replace your current SPF TXT record at @ with this one."] };
  if (lookups > 10) return { id: "spf", status: "warn", title: "SPF has too many lookups", detail: `SPF allows at most 10 lookups; yours has about ${lookups}. Remove services you no longer use.`, found: spf };
  return { id: "spf", status: "ok", title: "SPF", detail: "Set up correctly.", found: spf };
}
function mergeSpf(spf: string[], inc: string | null) {
  const parts = new Set<string>();
  for (const r of spf) for (const t of r.split(/\s+/).slice(1)) if (!/^[~?+-]?all$/i.test(t)) parts.add(t);
  if (inc) parts.add(`include:${inc}`);
  return `v=spf1 ${[...parts].join(" ")} ~all`.replace(/\s+/g, " ");
}

function dmarcCheck(records: string[] | null, domain: string): Check {
  if (records === null) return { id: "dmarc", status: "unknown", title: "DMARC", detail: "Couldn't read DNS right now." };
  const d = records.filter((r) => /^v=DMARC1/i.test(r));
  const rec: Rec = { type: "TXT", host: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; adkim=r; aspf=r` };
  if (!d.length) return { id: "dmarc", status: "bad", title: "DMARC missing", detail: "Gmail and Yahoo require DMARC for bulk senders. Start with a safe “monitor only” policy.", add: [rec] };
  if (d.length > 1) return { id: "dmarc", status: "bad", title: "Two DMARC records", detail: "With two DMARC records, inboxes ignore both. Keep only one.", found: d, add: [{ ...rec, value: d[0] }], steps: ["Delete the extra _dmarc TXT record so only one remains."] };
  const p = /;\s*p=(\w+)/i.exec(d[0])?.[1]?.toLowerCase() ?? "none";
  return { id: "dmarc", status: "ok", title: "DMARC", detail: p === "none" ? "Monitoring mode (p=none). After 2–4 clean weeks you can move to p=quarantine for stronger protection." : `Protecting your domain (p=${p}).`, found: d };
}

/** Full domain check. `smtpHost` helps guess the provider; `sendIps` are checked on IP blocklists for your own mail servers. */
export async function checkDomain(domain: string, opts: { smtpHost?: string | null } = {}): Promise<DomainReport> {
  const at = new Date().toISOString();
  if (isFreeDomain(domain)) {
    return { domain, free: true, provider: providerOf(opts.smtpHost), dnsHost: null, at, score: 60, checks: [{ id: "spf", status: "warn", title: "Free email address", detail: `@${domain} is fine for one-to-one emails, but campaigns from a free address hit strict limits and land in spam more often. Use an address on your own domain (you@yourbusiness.com) for campaigns.` }] };
  }
  const [mx, rootTxt, dmarcTxt, host] = await Promise.all([lookup(domain, "MX").catch(() => null), txt(domain), txt(`_dmarc.${domain}`), dnsHost(domain)]);
  const provider = providerOf(opts.smtpHost, mx ?? []);
  const checks: Check[] = [];
  checks.push(mx === null ? { id: "mx", status: "unknown", title: "MX", detail: "Couldn't read DNS right now." }
    : mx.length ? { id: "mx", status: "ok", title: "MX (receiving mail)", detail: "Replies and bounce notices can reach you.", found: mx }
    : { id: "mx", status: "bad", title: "No MX records", detail: `${domain} can't receive email — replies and bounce notices are lost, and inboxes trust you less.`, steps: MX_STEPS[provider], ...(provider === "google" ? { add: [{ type: "MX" as const, host: "@", value: "smtp.google.com", priority: 1 }] } : {}) });
  checks.push(spfCheck(rootTxt, domain, provider));
  // DKIM: try the provider's selectors, then common ones.
  const selectors = [...DKIM_SELECTORS[provider], ...COMMON_SELECTORS];
  const dk = await Promise.all(selectors.map(async (s) => {
    const [t, c] = await Promise.all([txt(`${s}._domainkey.${domain}`), lookup(`${s}._domainkey.${domain}`, "CNAME").catch(() => [])]);
    return (t ?? []).some((x) => /v=DKIM1|k=rsa|p=/i.test(x)) || c.length ? s : null;
  }));
  const found = dk.filter(Boolean) as string[];
  checks.push(found.length ? { id: "dkim", status: "ok", title: "DKIM (email signature)", detail: `Signed with selector “${found[0]}”.`, found }
    : { id: "dkim", status: provider === "other" ? "warn" : "bad", title: "DKIM not found", detail: provider === "other" ? "We couldn't find a DKIM signature at common names. If your host uses a custom name it may still be fine — otherwise turn DKIM on." : `${PROVIDER_LABEL[provider]} isn't signing your emails yet. Signed email is far more likely to reach the inbox.`, steps: DKIM_STEPS[provider] });
  checks.push(dmarcCheck(dmarcTxt, domain));
  const ips = provider === "other" && opts.smtpHost ? await lookup(opts.smtpHost, "A").catch(() => []) : [];
  const bl = await blocklists(domain, ips);
  checks.push(bl.on.length ? { id: "blocklist", status: "bad", title: "On a spam blocklist", detail: `Listed on ${bl.on.join(", ")}. Emails with this domain are often rejected. Stop campaigns, fix the cause (bought lists, hacked site, spammy links), then request removal on the list's website.`, found: bl.on }
    : bl.checked ? { id: "blocklist", status: "ok", title: "Blocklists", detail: `Not listed (checked ${bl.checked} of ${bl.total} lists).` }
    : { id: "blocklist", status: "unknown", title: "Blocklists", detail: "Couldn't check blocklists right now." });
  const w = { ok: 1, warn: 0.5, bad: 0, unknown: 0.5 };
  const score = Math.round((checks.reduce((s, c) => s + w[c.status], 0) / checks.length) * 100);
  return { domain, free: false, provider, dnsHost: host, checks, score, at };
}
