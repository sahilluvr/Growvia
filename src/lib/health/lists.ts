import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookup } from "./dns";
import { normalizePhone } from "../meta/graph";

/* Contact-list hygiene: catch addresses and numbers that will bounce or fail BEFORE a campaign sends to them. */

type Db = SupabaseClient;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISPOSABLE = new Set(["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "getnada.com", "sharklasers.com", "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com", "tempinbox.com", "spamgourmet.com", "mailnesia.com", "moakt.com", "tempr.email", "burnermail.io", "inboxkitten.com"]);
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmal.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.co": "hotmail.com", "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com",
  "outlok.com": "outlook.com", "outlook.co": "outlook.com", "rediffmail.co": "rediffmail.com", "redifmail.com": "rediffmail.com", "yahoo.co.i": "yahoo.co.in", "icloud.co": "icloud.com",
};
const ROLE = /^(info|admin|support|sales|contact|hello|office|noreply|no-reply|webmaster|billing|accounts|hr|careers|team)@/i;
const KNOWN_OK = /^(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|rediffmail|protonmail|zoho|aol)\.(com|in|co\.in)$/;

export type EmailListResult = { checked: number; invalid: number; risky: number; typosFixed: number; role: number; domainsChecked: number; examples: { email: string; why: string }[] };

export async function cleanEmailList(db: Db, businessId: string, deadline = Date.now() + 40_000): Promise<EmailListResult> {
  const { data: leads } = await db.from("leads").select("id, email, email_status").eq("business_id", businessId).not("email", "is", null).neq("email_status", "bounced").limit(20000);
  const rows = (leads ?? []).filter((l) => l.email);
  const out: EmailListResult = { checked: rows.length, invalid: 0, risky: 0, typosFixed: 0, role: 0, domainsChecked: 0, examples: [] };
  const domains = new Map<string, boolean | null>(); // true = can receive mail
  const need = [...new Set(rows.map((l) => (l.email as string).toLowerCase().split("@")[1]).filter((d) => d && !KNOWN_OK.test(d) && !TYPOS[d]))];
  for (let i = 0; i < need.length && Date.now() < deadline; i += 12) {
    await Promise.all(need.slice(i, i + 12).map(async (d) => {
      const mx = await lookup(d, "MX").catch(() => null);
      if (mx === null) return domains.set(d, null);
      if (mx.length) return domains.set(d, true);
      const a = await lookup(d, "A").catch(() => null); // no MX but an A record can still receive mail
      domains.set(d, a === null ? null : a.length > 0);
    }));
    out.domainsChecked = Math.min(need.length, i + 12);
  }
  const updates: { id: string; patch: Record<string, string> }[] = [];
  for (const l of rows) {
    let email = (l.email as string).trim().toLowerCase();
    const [, dom] = email.split("@");
    if (dom && TYPOS[dom]) { email = email.replace(/@.*$/, `@${TYPOS[dom]}`); updates.push({ id: l.id, patch: { email, email_status: "ok" } }); out.typosFixed++; continue; }
    if (ROLE.test(email)) out.role++;
    let status = "ok", why = "";
    if (!EMAIL.test(email)) { status = "invalid"; why = "not a valid email format"; }
    else if (DISPOSABLE.has(dom)) { status = "risky"; why = "temporary (disposable) address"; }
    else if (domains.get(dom) === false) { status = "invalid"; why = `${dom} has no mail server`; }
    if (status === "invalid") out.invalid++;
    if (status === "risky") out.risky++;
    if (why && out.examples.length < 8) out.examples.push({ email, why });
    if (status !== (l.email_status ?? "ok")) updates.push({ id: l.id, patch: { email_status: status } });
  }
  for (let i = 0; i < updates.length; i += 25) await Promise.all(updates.slice(i, i + 25).map((u) => db.from("leads").update(u.patch).eq("id", u.id)));
  // Stop active campaign emails to addresses that can't receive them.
  const bad = updates.filter((u) => u.patch.email_status === "invalid").map((u) => u.id);
  for (let i = 0; i < bad.length; i += 200) await db.from("enrollments").update({ status: "bounced", last_error: "Address can't receive email" }).in("lead_id", bad.slice(i, i + 200)).eq("status", "active");
  return out;
}

export type PhoneListResult = { withPhone: number; fixed: number; invalid: number; duplicates: number; optedIn: number; examples: { phone: string; why: string }[] };

export async function cleanPhones(db: Db, businessId: string, country = "91"): Promise<PhoneListResult> {
  const { data: leads } = await db.from("leads").select("id, phone, wa_id, wa_opt_in").eq("business_id", businessId).not("phone", "is", null).limit(20000);
  const out: PhoneListResult = { withPhone: 0, fixed: 0, invalid: 0, duplicates: 0, optedIn: 0, examples: [] };
  const seen = new Map<string, number>();
  const updates: { id: string; wa_id: string }[] = [];
  for (const l of leads ?? []) {
    if (!l.phone?.trim()) continue;
    out.withPhone++;
    if (l.wa_opt_in) out.optedIn++;
    const n = normalizePhone(l.phone, country);
    if (!n) { out.invalid++; if (out.examples.length < 8) out.examples.push({ phone: l.phone, why: "not a valid mobile number" }); continue; }
    if (/^91/.test(n) && !/^91[6-9]\d{9}$/.test(n)) { out.invalid++; if (out.examples.length < 8) out.examples.push({ phone: l.phone, why: "Indian mobile numbers are 10 digits starting 6–9" }); continue; }
    seen.set(n, (seen.get(n) ?? 0) + 1);
    if (l.wa_id !== n) { updates.push({ id: l.id, wa_id: n }); out.fixed++; }
  }
  out.duplicates = [...seen.values()].filter((c) => c > 1).reduce((s, c) => s + c - 1, 0);
  for (let i = 0; i < updates.length; i += 25) await Promise.all(updates.slice(i, i + 25).map((u) => db.from("leads").update({ wa_id: u.wa_id }).eq("id", u.id)));
  return out;
}
