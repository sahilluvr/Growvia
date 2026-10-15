import "server-only";
import type { Check, Rec } from "./domain";

/* Finding a domain to buy (availability via RDAP, the public registry lookup) and one-click DNS fixes on Cloudflare. */

const RDAP = (process.env.RDAP_BASE?.trim() || "https://rdap.org").replace(/\/$/, "");
const CF = (process.env.CLOUDFLARE_API_BASE?.trim() || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");

export type DomainIdea = { domain: string; available: boolean | null; buy: { name: string; url: string }[] };

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, "");

export function ideasFor(name: string, city?: string | null, segment?: string | null) {
  const base = slug(name).slice(0, 40), c = slug(city ?? "").slice(0, 20), words = name.toLowerCase().replace(/[^a-z0-9 ]+/g, "").split(/\s+/).filter(Boolean);
  const short = words.length > 1 ? words.map((w) => w[0]).join("") + slug(words.at(-1)!) : "";
  const seg = slug((segment ?? "").split(/[ /&]/)[0]).slice(0, 12);
  const names = [base, c && `${base}${c}`, `get${base}`, `${base}hq`, short && short.length >= 5 && short, seg && !base.includes(seg) && `${base}${seg}`].filter(Boolean) as string[];
  const tlds = [".com", ".in", ".co.in", ".co"];
  const out: string[] = [];
  for (const n of [...new Set(names)]) for (const t of tlds) { if (n.length >= 3) out.push(`${n}${t}`); }
  // Most useful first: exact .com / .in, then variants.
  return out.sort((a, b) => (a.startsWith(base + ".") ? 0 : 1) - (b.startsWith(base + ".") ? 0 : 1)).slice(0, 12);
}

export const buyLinks = (d: string) => [
  { name: "Namecheap", url: `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(d)}` },
  { name: "GoDaddy", url: `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(d)}` },
  { name: "Cloudflare", url: `https://domains.cloudflare.com/?domain=${encodeURIComponent(d)}` },
];

/** RDAP: 404 = not registered (very likely available), 200 = taken. null = couldn't tell. */
export async function available(domain: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${RDAP}/domain/${encodeURIComponent(domain)}`, { headers: { accept: "application/rdap+json" }, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (r.status === 404) return true;
    if (r.ok) return false;
    return null;
  } catch { return null; }
}

export async function checkIdeas(domains: string[]): Promise<DomainIdea[]> {
  const r = await Promise.all(domains.map(async (d) => ({ domain: d, available: await available(d), buy: buyLinks(d) })));
  return r.sort((a, b) => Number(b.available === true) - Number(a.available === true));
}

/** Adds/replaces the SPF, DMARC and MX records Growvia recommends, using a Cloudflare API token (used once, never stored). */
export async function cloudflareFix(domain: string, token: string, checks: Check[]) {
  const h = { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" };
  const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const r = await fetch(`${CF}${path}`, { ...init, headers: h, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) {
      const m = d.errors?.[0]?.message ?? `Cloudflare error ${r.status}`;
      throw new Error(/auth|token|permission/i.test(m) || r.status === 403 || r.status === 401 ? "Cloudflare didn't accept that token. Create one with “Edit zone DNS” permission for this domain." : m);
    }
    return d.result as T;
  };
  const zones = await api<{ id: string; name: string }[]>(`/zones?name=${encodeURIComponent(domain)}`);
  if (!zones.length) throw new Error(`${domain} isn't in this Cloudflare account.`);
  const zone = zones[0].id;
  const existing = await api<{ id: string; type: string; name: string; content: string }[]>(`/zones/${zone}/dns_records?per_page=200`);
  const fqdn = (host: string) => (host === "@" ? domain : `${host}.${domain}`);
  const done: string[] = [];
  for (const c of checks) {
    if (c.status !== "bad" || !c.add?.length || c.id === "dkim" || c.id === "blocklist") continue;
    for (const rec of c.add as Rec[]) {
      const name = fqdn(rec.host);
      const same = existing.filter((e) => e.type === rec.type && e.name === name && (c.id === "spf" ? /v=spf1/i.test(e.content.replace(/"/g, "")) : c.id === "dmarc" ? /v=DMARC1/i.test(e.content.replace(/"/g, "")) : true));
      const body = JSON.stringify({ type: rec.type, name, content: rec.value, ttl: 1, ...(rec.priority != null ? { priority: rec.priority } : {}) });
      if (same.length) {
        await api(`/zones/${zone}/dns_records/${same[0].id}`, { method: "PUT", body });
        for (const extra of same.slice(1)) await api(`/zones/${zone}/dns_records/${extra.id}`, { method: "DELETE" });
      } else await api(`/zones/${zone}/dns_records`, { method: "POST", body });
      done.push(`${c.id.toUpperCase()} (${rec.type} ${rec.host})`);
    }
  }
  return done;
}
