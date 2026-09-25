import type { BookingPage } from "./email/types";

/** Offset (ms) of `tz` from UTC at instant `t`. */
function tzOffset(t: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}

/** Wall-clock time in `tz` → UTC Date. */
export function zoned(y: number, m: number, d: number, h: number, min: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  return new Date(t);
}

function ymdIn(t: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(t).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}

export type Day = { key: string; label: string; slots: { start: string; label: string }[] };

/** Open slots for the next `daysAhead` days, excluding taken times and anything within the next hour. */
export function openSlots(page: BookingPage, taken: { start_at: string; end_at: string }[], daysAhead = 14): Day[] {
  const out: Day[] = [];
  const now = Date.now() + 60 * 60_000;
  const busy = taken.map((b) => [new Date(b.start_at).getTime(), new Date(b.end_at).getTime()]);
  const dur = page.duration * 60_000;
  for (let i = 0; i < daysAhead + 1; i++) {
    const base = ymdIn(new Date(Date.now() + i * 86_400_000), page.timezone);
    if (!page.days.includes(base.dow)) continue;
    const slots: Day["slots"] = [];
    for (let mins = page.start_hour * 60; mins + page.duration <= page.end_hour * 60; mins += page.duration) {
      const s = zoned(base.y, base.m, base.d, Math.floor(mins / 60), mins % 60, page.timezone).getTime();
      if (s < now) continue;
      if (busy.some(([a, b]) => s < b && s + dur > a)) continue;
      slots.push({ start: new Date(s).toISOString(), label: new Date(s).toLocaleTimeString("en-US", { timeZone: page.timezone, hour: "numeric", minute: "2-digit" }) });
    }
    if (slots.length) {
      const label = new Date(zoned(base.y, base.m, base.d, 12, 0, page.timezone)).toLocaleDateString("en-US", { timeZone: page.timezone, weekday: "short", month: "short", day: "numeric" });
      out.push({ key: `${base.y}-${base.m}-${base.d}`, label, slots });
    }
    if (out.length >= daysAhead) break;
  }
  return out;
}

export function isOpenSlot(page: BookingPage, taken: { start_at: string; end_at: string }[], startIso: string) {
  return openSlots(page, taken, 60).some((d) => d.slots.some((s) => s.start === startIso));
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function ics(o: { uid: string; start: Date; end: Date; title: string; description: string; location?: string | null; organizer: { name: string; email: string }; attendee: { name: string; email: string }; cancel?: boolean }) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Growvia//Booking//EN", `METHOD:${o.cancel ? "CANCEL" : "REQUEST"}`, "BEGIN:VEVENT",
    `UID:${o.uid}@growvia`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(o.start)}`, `DTEND:${icsDate(o.end)}`,
    `SUMMARY:${icsEsc(o.title)}`, `DESCRIPTION:${icsEsc(o.description)}`, o.location ? `LOCATION:${icsEsc(o.location)}` : "",
    `ORGANIZER;CN=${icsEsc(o.organizer.name)}:mailto:${o.organizer.email}`,
    `ATTENDEE;CN=${icsEsc(o.attendee.name)};RSVP=TRUE:mailto:${o.attendee.email}`,
    `STATUS:${o.cancel ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Australia/Sydney", "UTC"];
