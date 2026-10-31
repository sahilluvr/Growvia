import { describe, it, expect, beforeAll, vi } from "vitest";

/* v078 — Site security: checks, scoring, priorities and alerts, against fake network answers. */
vi.mock("@/lib/seo/crawl", () => ({ fetchPage: async () => ({}), safeHost: async () => true }));
vi.mock("@/lib/health/dns", () => ({ lookup: async () => [] }));
vi.mock("@/lib/notify", () => ({ notify: async () => ({ ok: true }) }));
vi.mock("@/lib/billing/plan", () => ({ planFor: async () => ({ pro: true }) }));

type S = typeof import("@/lib/security/scan");
type St = typeof import("@/lib/security/store");
let S: S, St: St;
beforeAll(async () => { S = await import("@/lib/security/scan"); St = await import("@/lib/security/store"); });

const NOW = Date.parse("2026-10-28T00:00:00Z");
const day = 86_400_000;
type Page = { status: number; body?: string; headers?: Record<string, string>; url?: string; cookies?: string[] };
function deps(pages: Record<string, Page>, o: Partial<{ cert: { validTo: string; authorized: boolean } | null; dns: Record<string, string[]>; rdap: { expires: string; statuses: string[] } | null; sb: boolean | null }> = {}) {
  return {
    fetch: async (url: string) => {
      const p = pages[url] ?? { status: 404, body: "not found" };
      const h = new Headers(p.headers ?? {});
      if (p.cookies) (h as Headers & { getSetCookie?: () => string[] }).getSetCookie = () => p.cookies!;
      return { url: p.url ?? url, status: p.status, chain: [], headers: h, body: p.body ?? "", ms: 1, bytes: 1 };
    },
    tls: async () => (o.cert === undefined ? { validTo: new Date(NOW + 80 * day).toISOString(), issuer: "Let's Encrypt", authorized: true } : o.cert ? { ...o.cert, issuer: "X" } : null),
    dns: async (name: string, type: string) => o.dns?.[`${type}:${name}`] ?? [],
    rdap: async () => (o.rdap === undefined ? { expires: new Date(NOW + 300 * day).toISOString(), statuses: ["client transfer prohibited"] } : o.rdap),
    safeBrowsing: o.sb === undefined ? null : async () => o.sb!,
    now: () => NOW,
  };
}
const GOOD_HEADERS = { "strict-transport-security": "max-age=31536000; includeSubDomains", "content-security-policy": "default-src 'self'; frame-ancestors 'self'", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", "permissions-policy": "camera=()", server: "nginx" };

describe("site security scan", () => {
  it("a well-configured site scores A", async () => {
    const r = await S.scanSite("example.com", deps({
      "https://example.com/": { status: 200, body: "<html><script src='/app.js'></script></html>", headers: GOOD_HEADERS },
      "http://example.com/": { status: 200, url: "https://example.com/", body: "" },
      "https://example.com/.well-known/security.txt": { status: 200, body: "Contact: mailto:sec@example.com" },
    }, { dns: { "TXT:example.com": ["v=spf1 include:_spf.google.com -all"], "TXT:_dmarc.example.com": ["v=DMARC1; p=reject"], "CAA:example.com": ['0 issue "letsencrypt.org"'], "DS:example.com": ["2371 13 2 ABC"] } }) as never);
    expect(r.grade).toBe("A");
    expect(r.score).toBe(100);
    expect(S.priorities(r)).toHaveLength(0);
  });

  it("finds the real problems, caps the score for critical ones and orders the fixes", async () => {
    const r = await S.scanSite("https://www.shop.example/", deps({
      "https://www.shop.example/": { status: 200, body: `<html><meta name="generator" content="WordPress 6.1"><img src="http://cdn.old/x.png"><form action="http://www.shop.example/send"></form><div class="wp-content"></div></html>`, headers: { server: "Apache/2.4.1", "x-powered-by": "PHP/7.4" }, cookies: ["sid=1; Path=/"] },
      "http://www.shop.example/": { status: 200, body: "plain" },
      "https://www.shop.example/.git/HEAD": { status: 200, body: "ref: refs/heads/main\n" },
      "https://www.shop.example/.env": { status: 200, body: "<html>soft 404</html>" },
    }, { cert: { validTo: new Date(NOW + 5 * day).toISOString(), authorized: true }, rdap: { expires: new Date(NOW + 20 * day).toISOString(), statuses: [] }, sb: false }) as never);
    expect(r.platform).toBe("wordpress");
    expect(r.domain).toBe("shop.example");
    const st = (id: string) => r.checks.find((c) => c.id === id)?.status;
    expect(st("exposed")).toBe("fail");                 // .git exposed; the soft-404 .env is NOT reported
    expect(r.checks.find((c) => c.id === "exposed")!.detail).not.toMatch(/\.env/);
    expect(st("redirect")).toBe("fail");
    expect(st("cert")).toBe("fail");                    // 5 days left
    expect(st("domain_expiry")).toBe("fail");           // 20 days left
    expect(st("domain_lock")).toBe("warn");
    expect(st("forms")).toBe("fail");
    expect(st("mixed")).toBe("warn");
    expect(st("versions")).toBe("warn");
    expect(st("cookies")).toBe("warn");
    expect(st("dmarc")).toBe("fail");                  // no DMARC record
    expect(st("spf")).toBe("fail");
    expect(r.score).toBeLessThanOrEqual(49);
    expect(r.grade).toBe("F");
    const order = S.priorities(r).map((c) => c.id);
    expect(order[0]).toBe("exposed");                  // critical failure first
    expect(order.indexOf("referrer")).toBeGreaterThan(order.indexOf("redirect"));
    // WordPress-specific guidance
    expect(r.checks.find((c) => c.id === "hsts")!.steps!.join(" ")).toMatch(/WordPress/);
  });

  it("an unreachable https site fails hard", async () => {
    const r = await S.scanSite("down.example", deps({}, { cert: null }) as never);
    expect(r.checks.find((c) => c.id === "https")!.status).toBe("fail");
    expect(r.score).toBeLessThanOrEqual(49);
  });

  it("Google Safe Browsing flag is critical", async () => {
    const r = await S.scanSite("bad.example", deps({ "https://bad.example/": { status: 200, body: "", headers: GOOD_HEADERS }, "http://bad.example/": { status: 301, url: "https://bad.example/" } }, { sb: true }) as never);
    expect(r.checks.find((c) => c.id === "safebrowsing")!.status).toBe("fail");
    expect(r.score).toBeLessThanOrEqual(49);
  });

  it("helpers: site normalising, registrable domain, grades", () => {
    expect(S.normalizeSite("Example.com/about")).toEqual({ url: "https://example.com/", host: "example.com", domain: "example.com" });
    expect(S.normalizeSite("localhost")).toBeNull();
    expect(S.regDomain("www.shop.co.uk")).toBe("shop.co.uk");
    expect([95, 85, 70, 55, 10].map(S.gradeOf)).toEqual(["A", "B", "C", "D", "F"]);
  });

  it("alerts only for what matters", async () => {
    const base = await S.scanSite("example.com", deps({ "https://example.com/": { status: 200, body: "", headers: GOOD_HEADERS }, "http://example.com/": { status: 301, url: "https://example.com/" } }) as never);
    expect(St.alertsFor(base, base)).toEqual([]);
    const worse = { ...base, score: base.score - 15, checks: base.checks.map((c) => (c.id === "cert" ? { ...c, status: "fail" as const, title: "Security certificate valid for 5 more days" } : c)) };
    const a = St.alertsFor(worse, base);
    expect(a.some((x) => /certificate/.test(x))).toBe(true);
    expect(a.some((x) => /dropped/.test(x))).toBe(true);
  });
});
