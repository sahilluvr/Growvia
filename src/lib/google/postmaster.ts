import "server-only";
import { gfetch } from "./api";

/* Gmail Postmaster Tools: Google's own view of your domain (reputation, spam rate, authentication) for mail sent to Gmail users. */
const BASE = (process.env.POSTMASTER_BASE?.trim() || "https://gmailpostmastertools.googleapis.com").replace(/\/$/, "");
const W = "Gmail Postmaster Tools";

export type PmDay = { day: string; reputation: string | null; spamRate: number | null; spf: number | null; dkim: number | null; dmarc: number | null; encrypted: number | null };

export async function pmDomains(access: string) {
  const r = await gfetch<{ domains?: { name: string; permission?: string }[] }>(access, `${BASE}/v1/domains`, { what: W });
  return (r.domains ?? []).map((d) => d.name.replace(/^domains\//, "").toLowerCase());
}

/** Last ~30 days. Google only has data on days you sent enough mail to Gmail users (roughly 100+/day). */
export async function pmStats(access: string, domain: string): Promise<PmDay[]> {
  type S = { name: string; domainReputation?: string; userReportedSpamRatio?: number; spfSuccessRatio?: number; dkimSuccessRatio?: number; dmarcSuccessRatio?: number; outboundEncryptionRatio?: number };
  const r = await gfetch<{ trafficStats?: S[] }>(access, `${BASE}/v1/domains/${encodeURIComponent(domain)}/trafficStats?pageSize=30`, { what: W });
  return (r.trafficStats ?? []).map((s) => {
    const d = s.name.split("/").pop() ?? "";
    return {
      day: /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d,
      reputation: s.domainReputation && s.domainReputation !== "REPUTATION_CATEGORY_UNSPECIFIED" ? s.domainReputation : null,
      spamRate: s.userReportedSpamRatio ?? null, spf: s.spfSuccessRatio ?? null, dkim: s.dkimSuccessRatio ?? null, dmarc: s.dmarcSuccessRatio ?? null, encrypted: s.outboundEncryptionRatio ?? null,
    };
  }).sort((a, b) => a.day.localeCompare(b.day));
}
