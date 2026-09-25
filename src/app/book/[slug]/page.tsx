import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminClient } from "@/lib/server/admin";
import { openSlots } from "@/lib/booking";
import { LogoMark } from "@/components/Logo";
import { BookingForm } from "./BookingForm";
import type { BookingPage } from "@/lib/email/types";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const db = adminClient();
  if (!db || !/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { data: page } = await db.from("booking_pages").select("*").eq("slug", slug).eq("active", true).maybeSingle<BookingPage>();
  if (!page) return null;
  const [{ data: taken }, { data: biz }] = await Promise.all([
    db.from("bookings").select("start_at, end_at").eq("owner_id", page.owner_id).eq("status", "confirmed").gte("end_at", new Date().toISOString()),
    db.from("businesses").select("name, city").eq("owner_id", page.owner_id).maybeSingle(),
  ]);
  return { page, days: openSlots(page, taken ?? []), biz };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await load(params.slug);
  return { title: d ? `${d.page.title} · ${d.biz?.name ?? ""}` : "Book a call", robots: { index: false } };
}

export default async function BookPage({ params }: { params: { slug: string } }) {
  const d = await load(params.slug);
  if (!d) notFound();
  const { page, days, biz } = d;
  return (
    <main className="min-h-dvh bg-paper px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="card grid overflow-hidden md:grid-cols-[260px_1fr]">
          <aside className="border-b border-line bg-ink p-6 text-white md:border-b-0 md:border-r">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-lg font-semibold text-lime">{(biz?.name ?? "B").slice(0, 1)}</span>
            <p className="mt-4 text-[13px] text-white/60">{biz?.name}</p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{page.title}</h1>
            <p className="mt-3 text-[14px] text-white/70">{page.duration} minutes{page.location ? ` · ${/^https?:/.test(page.location) ? "Video call" : page.location}` : ""}</p>
            {page.description && <p className="mt-3 text-[14px] leading-relaxed text-white/70">{page.description}</p>}
            <p className="mt-6 text-[12px] text-white/40">Times shown in {page.timezone}</p>
          </aside>
          <div className="p-6"><BookingForm slug={page.slug} days={days} /></div>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-stone-400"><LogoMark className="h-4 w-4" /> Scheduling by Growvia</p>
      </div>
    </main>
  );
}
