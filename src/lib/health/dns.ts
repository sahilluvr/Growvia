import "server-only";

/* DNS lookups over HTTPS (works on Vercel and anywhere fetch works). Cloudflare first, Google as backup. */
const BASES = (process.env.DOH_BASE?.trim() ? [process.env.DOH_BASE.trim()] : ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"]).map((b) => b.replace(/\/$/, ""));
const TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 } as const;
export type RType = keyof typeof TYPES;
export class DnsError extends Error {}

/** Answers for one record type. [] = no such record. Throws DnsError only when every resolver failed. */
export async function lookup(name: string, type: RType): Promise<string[]> {
  let last: unknown;
  for (const base of BASES) {
    try {
      const r = await fetch(`${base}?${new URLSearchParams({ name, type })}`, { headers: { accept: "application/dns-json" }, cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new DnsError(`DNS ${r.status}`);
      const d = (await r.json()) as { Status: number; Answer?: { type: number; data: string }[] };
      if (d.Status === 3) return []; // NXDOMAIN
      if (d.Status !== 0) throw new DnsError(`DNS status ${d.Status}`);
      return (d.Answer ?? []).filter((a) => a.type === TYPES[type]).map((a) => (type === "TXT" ? a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "") : a.data.replace(/\.$/, "")));
    } catch (e) { last = e; }
  }
  throw last instanceof DnsError ? last : new DnsError("DNS lookup failed");
}

export const txt = (name: string) => lookup(name, "TXT").catch(() => null);
