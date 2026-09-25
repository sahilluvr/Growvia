"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { repo, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { adminClient } from "@/lib/server/admin";
import { credsOf, sendMail } from "@/lib/email/transport";
import { buildEmail } from "@/lib/email/render";
import { ics, isOpenSlot } from "@/lib/booking";
import type { BookingPage, Mailbox } from "@/lib/email/types";
import type { FormState } from "./actions";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function saveBookingPageAction(_: FormState, f: FormData): Promise<FormState> {
  const r = repo();
  const user = await r.getUser();
  if (!user) redirect("/login");
  const db = supabaseServer();
  const slug = str(f, "slug", 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  if (slug.length < 3) return { error: "Choose a link name of at least 3 letters (e.g. bellas-trattoria)." };
  const start = Number(f.get("start_hour")), end = Number(f.get("end_hour"));
  if (!(end > start)) return { error: "Your available hours must end after they start." };
  const days = f.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
  if (!days.length) return { error: "Pick at least one day." };
  const row = {
    owner_id: user.id, slug, title: str(f, "title", 80) || "Book a call", description: str(f, "description", 500) || null,
    duration: [15, 20, 30, 45, 60, 90].includes(Number(f.get("duration"))) ? Number(f.get("duration")) : 30,
    days, start_hour: start, end_hour: end, timezone: str(f, "timezone", 60) || "Asia/Kolkata",
    location: str(f, "location", 300) || null, active: f.get("active") === "on",
  };
  const { error } = await db.from("booking_pages").upsert(row, { onConflict: "owner_id" });
  if (error) return { error: error.message.includes("slug") || error.code === "23505" ? "That link name is taken — try another." : error.message };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Booking page saved." };
}

export async function cancelBookingAction(id: string) {
  const r = repo();
  const user = await r.getUser();
  if (!user) redirect("/login");
  const db = supabaseServer();
  const { data: b } = await db.from("bookings").update({ status: "cancelled" }).eq("id", id).select("*").single();
  if (b) {
    const [{ data: mb }, { data: page }] = await Promise.all([
      db.from("mailboxes").select("*").order("created_at").limit(1).maybeSingle<Mailbox>(),
      db.from("booking_pages").select("*").maybeSingle<BookingPage>(),
    ]);
    if (mb && page) {
      const when = new Date(b.start_at).toLocaleString("en-US", { timeZone: page.timezone, dateStyle: "full", timeStyle: "short" });
      const { text, html } = buildEmail({ body: `Hi ${b.name.split(" ")[0]},\n\nOur call on ${when} has been cancelled. Sorry for the change — reply to this email to find a new time.\n\n${mb.from_name}`, messageId: crypto.randomUUID(), siteUrl: siteOrigin(), track: false, unsubscribe: false });
      const cal = ics({ uid: b.id, start: new Date(b.start_at), end: new Date(b.end_at), title: page.title, description: "Cancelled", location: page.location, organizer: { name: mb.from_name, email: mb.from_email }, attendee: { name: b.name, email: b.email }, cancel: true });
      await sendMail(credsOf(mb), { from: { name: mb.from_name, address: mb.from_email }, to: b.email, subject: `Cancelled: ${page.title}`, text, html, messageId: `<${crypto.randomUUID()}@${mb.from_email.split("@")[1]}>`, attachments: [{ filename: "cancel.ics", content: cal, contentType: "text/calendar; method=CANCEL" }] }).catch(() => {});
    }
  }
  revalidatePath("/app", "layout");
}

/** Public: someone books a slot on /book/[slug]. */
export async function createBookingAction(_: FormState, f: FormData): Promise<FormState> {
  const db = adminClient();
  if (!db) return { error: "Booking isn't available right now. Please contact the business directly." };
  const slug = str(f, "slug", 40);
  const start = str(f, "start", 40);
  const name = str(f, "name", 120);
  const email = str(f, "email", 200).toLowerCase();
  const notes = str(f, "notes", 1000);
  if (str(f, "website_hp")) return { ok: true };
  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email." };
  const { data: page } = await db.from("booking_pages").select("*").eq("slug", slug).eq("active", true).maybeSingle<BookingPage>();
  if (!page) return { error: "This booking page isn't available." };
  const { data: taken } = await db.from("bookings").select("start_at, end_at").eq("owner_id", page.owner_id).eq("status", "confirmed").gte("end_at", new Date().toISOString());
  if (!isOpenSlot(page, taken ?? [], start)) return { error: "Sorry — that time was just taken. Please pick another." };
  const s = new Date(start), e = new Date(s.getTime() + page.duration * 60_000);

  // Find or create the lead.
  const { data: biz } = await db.from("businesses").select("id, name").eq("owner_id", page.owner_id).maybeSingle();
  let { data: lead } = await db.from("leads").select("id, stage").eq("owner_id", page.owner_id).ilike("email", email).limit(1).maybeSingle();
  if (!lead && biz) {
    const { data: created } = await db.from("leads").insert({ owner_id: page.owner_id, business_id: biz.id, name, email, source: "booking page", stage: "qualified", notes: notes || null }).select("id, stage").single();
    lead = created;
  } else if (lead && ["new", "contacted"].includes(lead.stage)) {
    await db.from("leads").update({ stage: "qualified" }).eq("id", lead.id);
  }
  const { data: booking, error } = await db.from("bookings").insert({ owner_id: page.owner_id, lead_id: lead?.id ?? null, name, email, notes: notes || null, start_at: s.toISOString(), end_at: e.toISOString() }).select("id").single();
  if (error || !booking) return { error: "Couldn't book that time. Please try again." };
  const when = s.toLocaleString("en-US", { timeZone: page.timezone, dateStyle: "full", timeStyle: "short" });
  await db.from("activity").insert({ owner_id: page.owner_id, agent: "Closer", text: `${name} booked “${page.title}” for ${when}.`, tag: "Meeting" });

  // Confirmation emails with a calendar invite (if a mailbox is connected).
  const { data: mb } = await db.from("mailboxes").select("*").eq("owner_id", page.owner_id).order("created_at").limit(1).maybeSingle<Mailbox>();
  if (mb) {
    const cal = ics({ uid: booking.id, start: s, end: e, title: `${page.title} — ${biz?.name ?? mb.from_name}`, description: notes || page.description || "", location: page.location, organizer: { name: mb.from_name, email: mb.from_email }, attendee: { name, email } });
    const creds = credsOf(mb);
    const domain = mb.from_email.split("@")[1];
    const guest = buildEmail({ body: `Hi ${name.split(" ")[0]},\n\nYou're booked: **${page.title}** on ${when} (${page.timezone}).${page.location ? `\n\nWhere: ${page.location}` : ""}\n\nThe calendar invite is attached. Need to change it? Just reply to this email.\n\n${mb.from_name}${biz?.name ? `\n${biz.name}` : ""}`, messageId: crypto.randomUUID(), siteUrl: siteOrigin(), track: false, unsubscribe: false });
    const host = buildEmail({ body: `New booking: **${name}** (${email})\n\n${page.title} — ${when}\n\n${notes ? `Notes: ${notes}\n\n` : ""}It's in your Growvia Meetings page.`, messageId: crypto.randomUUID(), siteUrl: siteOrigin(), track: false, unsubscribe: false });
    await Promise.all([
      sendMail(creds, { from: { name: mb.from_name, address: mb.from_email }, to: email, subject: `Confirmed: ${page.title} on ${s.toLocaleDateString("en-US", { timeZone: page.timezone, month: "short", day: "numeric" })}`, text: guest.text, html: guest.html, messageId: `<${crypto.randomUUID()}@${domain}>`, attachments: [{ filename: "invite.ics", content: cal, contentType: "text/calendar; method=REQUEST" }] }).catch(() => {}),
      sendMail(creds, { from: { name: "Growvia", address: mb.from_email }, to: mb.from_email, subject: `New booking: ${name} — ${when}`, text: host.text, html: host.html, messageId: `<${crypto.randomUUID()}@${domain}>`, attachments: [{ filename: "invite.ics", content: cal, contentType: "text/calendar; method=REQUEST" }] }).catch(() => {}),
    ]);
  }
  return { ok: true, message: when };
}
