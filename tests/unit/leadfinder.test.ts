import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { fakeDb } from "../integration/fakedb";

/* v074 — Lead finder: Google Maps search, website email discovery, allowance, save + campaign. */
process.env.GOOGLE_PLACES_API_KEY = "test-places-key";
const OWNER = "22222222-2222-4222-8222-222222222222";
const BIZ = "33333333-3333-4333-8333-333333333333";
let db = fakeDb();
const pages: Record<string, { status: number; body: string }> = {};
vi.mock("@/lib/server/admin", () => ({ adminClient: () => db }));
vi.mock("@/lib/data/supabase", () => ({ supabaseServer: () => db }));
vi.mock("@/lib/data", () => ({ repo: () => ({ getUser: async () => ({ id: OWNER, email: "o@x.com" }), getBusiness: async () => ({ id: BIZ, owner_id: OWNER, name: "FixIt Plumbing", segment: "agency", city: "Austin, TX" }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/billing/plan", () => ({ planFor: async () => ({ plan: "pro", label: "Pro" }), monthStart: () => new Date(Date.now() - 86_400_000).toISOString() }));
vi.mock("@/lib/seo/crawl", () => ({ fetchPage: async (url: string) => ({ url, ...(pages[url] ?? { status: 404, body: "" }) }) }));
vi.mock("@/lib/health/dns", () => ({ lookup: async (name: string) => (name === "nomail.com" ? [] : ["10 mx.example."]) }));
const imported: unknown[][] = [];
vi.mock("@/app/email-actions", () => ({ importLeadsAction: async (rows: { name: string; email: string; phone: string }[], tag: string) => {
  imported.push(rows);
  for (const r of rows) db.tables.leads.push({ id: `lead-${r.name}`, business_id: BIZ, email: r.email || null, tags: [tag], unsubscribed: false, email_status: null });
  return { ok: true, message: "ok" };
} }));
vi.mock("@/lib/ai/write", () => ({ writeSequence: async () => ({ name: "Hello property managers", steps: [{ subject: "a", body: "b", delay_days: 0 }, { subject: "c", body: "d", delay_days: 3 }, { subject: "e", body: "f", delay_days: 4 }] }) }));

type LF = typeof import("@/lib/leadfinder");
let L: LF;
beforeAll(async () => { L = await import("@/lib/leadfinder"); });

const place = (i: number, o: Record<string, unknown> = {}) => ({ id: `p${i}`, displayName: { text: `Biz ${i}` }, formattedAddress: `${i} Main St`, nationalPhoneNumber: `(512) 555-01${String(i).padStart(2, "0")}`, websiteUri: `https://biz${i}.com/`, rating: 4.5, userRatingCount: 10 + i, businessStatus: "OPERATIONAL", ...o });
let calls: { body: Record<string, unknown>; headers: Record<string, string> }[] = [];
function mapsReturns(pagesOfPlaces: Record<string, unknown>[][]) {
  calls = [];
  vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ body, headers: init.headers as Record<string, string> });
    const i = body.pageToken ? Number(body.pageToken) : 0;
    return new Response(JSON.stringify({ places: pagesOfPlaces[i] ?? [], ...(pagesOfPlaces[i + 1] ? { nextPageToken: String(i + 1) } : {}) }), { status: 200 });
  });
}

describe("website emails", () => {
  it("finds, cleans and ranks emails (same domain + role addresses first, junk dropped)", () => {
    const html = `<a href="mailto:Owner@Gmail.com">x</a> info&#64;biz1.com  logo@2x.png noreply@biz1.com office [at] biz1 [dot] com u@example.com`;
    expect(L.extractEmails(html, "www.biz1.com")).toEqual(["info@biz1.com", "office@biz1.com", "owner@gmail.com"]);
  });
  it("follows only same-site contact links", () => {
    const html = `<a href="/contact-us">c</a><a href="https://other.com/contact">o</a><a href="/about#team">a</a><a href="/pricing">p</a>`;
    expect(L.contactLinks(html, "https://biz1.com/")).toEqual(["https://biz1.com/contact-us", "https://biz1.com/about"]);
  });
  it("checks the home page, then a contact page, and verifies the domain takes email", async () => {
    pages["https://biz1.com/"] = { status: 200, body: `<a href="/contact">Contact</a>` };
    pages["https://biz1.com/contact"] = { status: 200, body: `Write to hello@biz1.com` };
    pages["https://biz2.com/"] = { status: 200, body: `no emails here` };
    pages["https://biz3.com/"] = { status: 200, body: `sales@nomail.com` };
    const base = { name: "", address: "", phone: null, rating: null, reviews: null, email: null, status: "pending" as const };
    expect(await L.enrich({ ...base, id: "1", website: "https://biz1.com/" })).toMatchObject({ email: "hello@biz1.com", status: "found" });
    expect(await L.enrich({ ...base, id: "2", website: "https://biz2.com/" })).toMatchObject({ email: null, status: "no_email" });
    expect(await L.enrich({ ...base, id: "3", website: "https://biz3.com/" })).toMatchObject({ status: "no_email" }); // no MX
    expect(await L.enrich({ ...base, id: "4", website: null })).toMatchObject({ status: "no_website" });
  });
});

describe("Google Maps search", () => {
  it("asks for only the fields it needs, skips closed businesses, pages up to the count", async () => {
    mapsReturns([Array.from({ length: 20 }, (_, i) => place(i, i === 3 ? { businessStatus: "CLOSED_PERMANENTLY" } : {})), Array.from({ length: 20 }, (_, i) => place(100 + i))]);
    const r = await L.searchPlaces("Property managers", "Austin, TX", 25);
    expect(r.places).toHaveLength(25);
    expect(r.requests).toBe(2);
    expect(r.places.some((p) => p.id === "p3")).toBe(false);
    expect(calls[0].body).toMatchObject({ textQuery: "Property managers in Austin, TX", pageSize: 20 });
    expect(calls[0].headers["X-Goog-FieldMask"]).toContain("places.websiteUri");
    expect(calls[0].headers["X-Goog-Api-Key"]).toBe("test-places-key");
  });
  it("turns Google errors into plain messages", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status: 429 }));
    await expect(L.searchPlaces("x y z", "Austin", 10)).rejects.toThrow(/allowance/);
  });
});

describe("finder flow (actions)", () => {
  beforeEach(() => { db = fakeDb({ lead_finds: [], leads: [], sequences: [], sequence_steps: [], enrollments: [], mailboxes: [{ id: "mb1", created_at: "2026-01-01" }], activity: [] }); imported.length = 0; });
  const A = () => import("@/app/finder-actions");

  it("search → check websites → add leads → campaign with them enrolled", async () => {
    for (let i = 0; i < 6; i++) pages[`https://shop${i}.com/`] = { status: 200, body: i % 2 ? "nothing" : `info@shop${i}.com` };
    mapsReturns([Array.from({ length: 6 }, (_, i) => place(i, { websiteUri: i === 5 ? undefined : `https://shop${i}.com/` }))]);
    const a = await A();
    const s = await a.startFindAction({ what: "Property managers", where: "Austin, TX", count: 10 });
    if (!s.ok) throw new Error(s.error);
    expect(s.job.results).toHaveLength(6);
    let job = s.job;
    while (job.status === "enriching") { const r = await a.stepFindAction(job.id); expect(r.ok).toBe(true); if (r.ok) job = r.job; }
    expect(job.results.filter((c) => c.status === "found").map((c) => c.email).sort()).toEqual(["info@shop0.com", "info@shop2.com", "info@shop4.com"]);
    expect(job.results.find((c) => c.id === "p5")?.status).toBe("no_website");
    const saved = await a.saveFoundAction(job.id, job.results.filter((c) => c.email).map((c) => c.id), true);
    expect(saved).toMatchObject({ ok: true });
    expect(saved.ok && saved.sequenceId).toBeTruthy();
    expect(imported[0]).toHaveLength(3);
    expect((imported[0][0] as { notes: string }).notes).toMatch(/Lead finder/);
    expect(db.tables.sequence_steps).toHaveLength(3);
    expect(db.tables.enrollments).toHaveLength(3);
    expect(db.tables.sequences[0]).toMatchObject({ mailbox_id: "mb1" });
  });

  it("enforces the monthly allowance and validates input", async () => {
    const a = await A();
    expect(await a.startFindAction({ what: "x", where: "Austin", count: 10 })).toMatchObject({ ok: false });
    db.tables.lead_finds.push({ id: "old", owner_id: OWNER, found: 200, requests: 10, created_at: new Date().toISOString() });
    const r = await a.startFindAction({ what: "Property managers", where: "Austin", count: 10 });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toMatch(/used all 200/);
  });
});
