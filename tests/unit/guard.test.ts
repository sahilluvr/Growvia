import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/data", () => ({ siteOrigin: () => "https://usegrowvia.com" }));
vi.mock("../../src/lib/data", () => ({ siteOrigin: () => "https://usegrowvia.com" }));
import { corsHeaders, hashKey, originAllowed, serverKeyOk, tooFast } from "@/lib/forms-guard";
import { fillSubject } from "@/lib/forms-model";

const req = (h: Record<string, string>) => new Request("https://usegrowvia.com/api/forms/x", { method: "POST", headers: h });
const locked = { allowed_origins: ["acme.com"] };

describe("origins and server key (P0.3)", () => {
  it("any site when the list is empty", () => { expect(originAllowed(req({ origin: "https://evil.com" }), { allowed_origins: [] })).toBe(true); });
  it("blocks non-listed origins, allows listed + subdomains + Growvia pages", () => {
    expect(originAllowed(req({ origin: "https://evil.com" }), locked)).toBe(false);
    expect(originAllowed(req({ origin: "https://www.acme.com" }), locked)).toBe(true);
    expect(originAllowed(req({ origin: "https://shop.acme.com" }), locked)).toBe(true);
    expect(originAllowed(req({ origin: "https://usegrowvia.com" }), locked)).toBe(true);
    expect(originAllowed(req({}), locked)).toBe(false);
  });
  it("server key bypass only with the right key", () => {
    const form = { server_key_hash: hashKey("gvf_secret") };
    expect(serverKeyOk(req({ authorization: "Bearer gvf_secret" }), form)).toBe(true);
    expect(serverKeyOk(req({ authorization: "Bearer wrong" }), form)).toBe(false);
    expect(serverKeyOk(req({}), form)).toBe(false);
  });
  it("CORS echoes allowed origins, * when open", () => {
    expect(corsHeaders(req({ origin: "https://x.com" }), { allowed_origins: [] })["Access-Control-Allow-Origin"]).toBe("*");
    expect(corsHeaders(req({ origin: "https://acme.com" }), locked)["Access-Control-Allow-Origin"]).toBe("https://acme.com");
    expect(corsHeaders(req({ origin: "https://evil.com" }), locked)["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("spam + alerts", () => {
  it("minimum time to submit", () => {
    const s = { spam: { ip_limit: 5, email_limit: 3, window_min: 10, min_seconds: 3 } };
    expect(tooFast(Date.now() - 500, s)).toBe(true);
    expect(tooFast(Date.now() - 5000, s)).toBe(false);
    expect(tooFast(undefined, s)).toBe(false); // old snippets
  });
  it("subject template variables (P1.12)", () => {
    expect(fillSubject("New lead: {name} – {company}", { name: "Alex", company: "Acme" })).toBe("New lead: Alex – Acme");
    expect(fillSubject("New lead: {name} – {company} ({form})", { name: "Alex", company: "", form: "" })).toBe("New lead: Alex");
  });
});
