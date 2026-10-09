import "server-only";
import { lookup } from "../health/dns";

/* Works out which AWS region the Supabase database runs in (its IP vs Amazon's published IP ranges),
   and which Vercel region to pick so every database round trip stays local. */

export const AWS_TO_VERCEL: Record<string, { vercel: string; city: string }> = {
  "ap-south-1": { vercel: "bom1", city: "Mumbai" }, "ap-southeast-1": { vercel: "sin1", city: "Singapore" }, "ap-southeast-2": { vercel: "syd1", city: "Sydney" },
  "ap-northeast-1": { vercel: "hnd1", city: "Tokyo" }, "ap-northeast-2": { vercel: "icn1", city: "Seoul" }, "ap-northeast-3": { vercel: "kix1", city: "Osaka" },
  "us-east-1": { vercel: "iad1", city: "Washington, D.C." }, "us-east-2": { vercel: "cle1", city: "Cleveland" }, "us-west-1": { vercel: "sfo1", city: "San Francisco" }, "us-west-2": { vercel: "pdx1", city: "Portland" },
  "ca-central-1": { vercel: "yul1", city: "Montréal" }, "sa-east-1": { vercel: "gru1", city: "São Paulo" },
  "eu-west-1": { vercel: "dub1", city: "Dublin" }, "eu-west-2": { vercel: "lhr1", city: "London" }, "eu-west-3": { vercel: "cdg1", city: "Paris" }, "eu-central-1": { vercel: "fra1", city: "Frankfurt" }, "eu-central-2": { vercel: "fra1", city: "Zurich → Frankfurt" }, "eu-north-1": { vercel: "arn1", city: "Stockholm" },
  "me-central-1": { vercel: "dxb1", city: "Dubai" }, "af-south-1": { vercel: "cpt1", city: "Cape Town" },
};
const VERCEL_TO_AWS: Record<string, string> = Object.fromEntries(Object.entries(AWS_TO_VERCEL).map(([a, v]) => [v.vercel, a]));
export const vercelRegionName = (r: string) => (VERCEL_TO_AWS[r] ? `${AWS_TO_VERCEL[VERCEL_TO_AWS[r]].city} (${r})` : r);

type Ranges = { v4: { net: number; bits: number; region: string }[]; v6: { net: bigint; bits: number; region: string }[] };
let ranges: Promise<Ranges | null> | null = null;
const ip4 = (s: string) => s.split(".").reduce((a, o) => a * 256 + Number(o), 0);
function ip6(s: string): bigint {
  const [head, tail = ""] = s.split("::");
  const h = head ? head.split(":") : [], t = tail ? tail.split(":") : [];
  const parts = s.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  return parts.reduce((a, p) => (a << 16n) + BigInt(parseInt(p || "0", 16)), 0n);
}
function loadRanges() {
  ranges ??= fetch(process.env.AWS_IP_RANGES_URL?.trim() || "https://ip-ranges.amazonaws.com/ip-ranges.json", { cache: "no-store", signal: AbortSignal.timeout(10000) })
    .then((r) => r.json())
    .then((d: { prefixes: { ip_prefix: string; region: string }[]; ipv6_prefixes: { ipv6_prefix: string; region: string }[] }) => ({
      v4: d.prefixes.filter((p) => p.region !== "GLOBAL").map((p) => { const [n, b] = p.ip_prefix.split("/"); return { net: ip4(n), bits: Number(b), region: p.region }; }),
      v6: d.ipv6_prefixes.filter((p) => p.region !== "GLOBAL").map((p) => { const [n, b] = p.ipv6_prefix.split("/"); return { net: ip6(n), bits: Number(b), region: p.region }; }),
    }))
    .catch(() => { ranges = null; return null; });
  return ranges;
}

/** e.g. { aws: "ap-southeast-1", city: "Singapore", vercel: "sin1" } — null when it can't tell. */
export async function supabaseRegion(supabaseUrl: string) {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(supabaseUrl)?.[1];
  if (!ref) return null;
  const [r, v6, v4] = await Promise.all([loadRanges(), lookup(`db.${ref}.supabase.co`, "AAAA").catch(() => []), lookup(`db.${ref}.supabase.co`, "A").catch(() => [])]);
  if (!r) return null;
  let best: { region: string; bits: number } | null = null;
  for (const a of v6.filter((x) => x.includes(":"))) {
    const n = ip6(a);
    for (const p of r.v6) if ((!best || p.bits > best.bits) && n >> BigInt(128 - p.bits) === p.net >> BigInt(128 - p.bits)) best = { region: p.region, bits: p.bits };
  }
  for (const a of v4.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x))) {
    const n = ip4(a);
    for (const p of r.v4) if ((!best || p.bits > best.bits) && Math.floor(n / 2 ** (32 - p.bits)) === Math.floor(p.net / 2 ** (32 - p.bits))) best = { region: p.region, bits: p.bits };
  }
  if (!best) return null;
  const m = AWS_TO_VERCEL[best.region];
  return { aws: best.region, city: m?.city ?? best.region, vercel: m?.vercel ?? null };
}

/** Legacy JWT secret → every page has to ask Supabase Auth over the network to check the login. */
export async function authKeyMode(supabaseUrl: string, anonKey: string): Promise<"signing-keys" | "legacy-secret" | "unknown"> {
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, { headers: { apikey: anonKey }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return "unknown";
    const d = await r.json() as { keys?: { alg?: string; kty?: string }[] };
    return (d.keys ?? []).some((k) => k.kty === "EC" || k.kty === "RSA" || /^(ES|RS)/.test(k.alg ?? "")) ? "signing-keys" : "legacy-secret";
  } catch { return "unknown"; }
}
