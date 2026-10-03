import "server-only";
import { gfetch } from "./api";

const PEOPLE = (process.env.PEOPLE_BASE?.trim() || "https://people.googleapis.com").replace(/\/$/, "");
export type ContactRow = { name: string; email: string; phone: string; company: string };

/** Everyone in the user's Google Contacts (up to 5,000), flattened to name/email/phone/company. */
export async function googleContacts(access: string, max = 5000): Promise<ContactRow[]> {
  type P = { names?: { displayName?: string }[]; emailAddresses?: { value?: string }[]; phoneNumbers?: { value?: string; canonicalForm?: string }[]; organizations?: { name?: string }[] };
  const out: ContactRow[] = [];
  let token = "";
  do {
    const q = new URLSearchParams({ personFields: "names,emailAddresses,phoneNumbers,organizations", pageSize: "1000", sortOrder: "LAST_MODIFIED_DESCENDING", ...(token ? { pageToken: token } : {}) });
    const r = await gfetch<{ connections?: P[]; nextPageToken?: string }>(access, `${PEOPLE}/v1/people/me/connections?${q}`, { what: "Google Contacts" });
    for (const p of r.connections ?? []) {
      const phone = p.phoneNumbers?.[0]?.canonicalForm || p.phoneNumbers?.[0]?.value || "";
      const email = p.emailAddresses?.[0]?.value ?? "";
      const name = p.names?.[0]?.displayName || email.split("@")[0] || phone;
      if (name || phone || email) out.push({ name: name.slice(0, 120), email: email.slice(0, 200), phone: phone.slice(0, 40), company: (p.organizations?.[0]?.name ?? "").slice(0, 120) });
    }
    token = r.nextPageToken ?? "";
  } while (token && out.length < max);
  return out.slice(0, max);
}
