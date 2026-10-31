import { describe, it, expect } from "vitest";
import { fakeDb } from "../integration/fakedb";
import { disposableEmail, submittedTooFast, signupRateLimited, logSignup, SIGNUP_LIMITS } from "@/lib/signup-guard";

describe("v072 sign-up bot checks", () => {
  it("blocks throwaway inboxes, including subdomains, and allows normal ones", () => {
    for (const e of ["a@mailinator.com", "x@YOPMAIL.com", "b@sub.guerrillamail.com", "c@1secmail.com"]) expect(disposableEmail(e)).toBe(true);
    for (const e of ["jane@gmail.com", "info@paulz.se", "me@company.co.uk", "x@mail.com"]) expect(disposableEmail(e)).toBe(false);
  });
  it("rejects instant, missing or forged form times", () => {
    const now = 1_000_000_000;
    expect(submittedTooFast("", now)).toBe(true);
    expect(submittedTooFast("abc", now)).toBe(true);
    expect(submittedTooFast(String(now - 500), now)).toBe(true);
    expect(submittedTooFast(String(now + 3_600_000), now)).toBe(true);
    expect(submittedTooFast(String(now - 8000), now)).toBe(false);
  });
  it("limits sign-ups per network per hour and per day", async () => {
    const db = fakeDb({ signup_log: [] }) as never;
    for (let i = 0; i < SIGNUP_LIMITS.hour; i++) {
      expect(await signupRateLimited(db, "ip1")).toBe(false);
      await logSignup(db, "ip1", `u${i}@gmail.com`);
    }
    expect(await signupRateLimited(db, "ip1")).toBe(true);
    expect(await signupRateLimited(db, "ip2")).toBe(false);   // other networks unaffected
    expect(await signupRateLimited(db, null)).toBe(false);    // unknown IP: don't block
    expect(await signupRateLimited(null, "ip1")).toBe(false); // no database: fail open
  });
});
