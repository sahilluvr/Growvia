import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { fakeDb } from "../integration/fakedb";

/* v073 — admin "Emails from Growvia: off": blocked addresses never reach Resend; others still do. */
process.env.RESEND_API_KEY = "re_test";
let db = fakeDb();
vi.mock("@/lib/server/admin", () => ({ adminClient: () => db }));

type Sys = typeof import("@/lib/mail/system");
type Blk = typeof import("@/lib/mail/blocks");
let S: Sys, B: Blk;
let sent: string[][] = [];
beforeAll(async () => { S = await import("@/lib/mail/system"); B = await import("@/lib/mail/blocks"); });
beforeEach(() => {
  sent = [];
  db = fakeDb({ email_blocks: [{ email: "info@paulz.se", user_id: "u1" }, { email: "paulzstadtjanster@gmail.com", user_id: "u1" }] });
  vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => { sent.push(JSON.parse(String(init.body)).to); return new Response(JSON.stringify({ id: "em_1" }), { status: 200 }); });
});

describe("email blocks", () => {
  it("normalises addresses (case, Gmail dots and +tags)", () => {
    expect(B.normEmail(" Info@PaulZ.se ")).toBe("info@paulz.se");
    expect(B.normEmail("Paulz.Stadt.janster+work@googlemail.com")).toBe("paulzstadtjanster@gmail.com");
  });
  it("blocks the account email and the personal Gmail however it's written", async () => {
    for (const to of ["info@paulz.se", "INFO@paulz.se", "paulz.stadtjanster@gmail.com", "paulzstadtjanster+x@gmail.com"]) {
      const r = await S.sendSystemEmail({ to, subject: "Weekly report", html: "<p>hi</p>" });
      expect(r).toMatchObject({ ok: false, blocked: true });
    }
    expect(sent).toEqual([]);
  });
  it("still sends to everyone else, and drops only the blocked person from a group", async () => {
    expect(await S.sendSystemEmail({ to: "someone@else.com", subject: "x", html: "x" })).toMatchObject({ ok: true });
    await S.sendSystemEmail({ to: ["info@paulz.se", "teammate@paulz.se"], subject: "x", html: "x" });
    expect(sent).toEqual([["someone@else.com"], ["teammate@paulz.se"]]);
  });
  it("sends normally if the table doesn't exist yet (fails open)", async () => {
    db = null as never;
    expect(await S.sendSystemEmail({ to: "info@paulz.se", subject: "x", html: "x" })).toMatchObject({ ok: true });
  });
});
