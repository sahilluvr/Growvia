import { redirect } from "next/navigation";
import { repo } from "@/lib/data";

/* Where "Analyse my business" (home page) lands for someone who's signed in:
   no project yet → set-up with the website filled in; same site → the dashboard (analysis + security run there);
   a different site → a new project with that website filled in. Nothing has to be typed twice. */
export const dynamic = "force-dynamic";
const host = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");

export default async function StartPage({ searchParams }: { searchParams: { website?: string } }) {
  const site = (searchParams.website ?? "").trim().slice(0, 200);
  const r = repo();
  const business = await r.getBusiness().catch(() => null);
  if (!business) redirect(`/onboarding${site ? `?website=${encodeURIComponent(site)}` : ""}`);
  if (!site || !business.website || host(business.website) === host(site)) redirect("/app");
  redirect(`/onboarding?new=1&website=${encodeURIComponent(site)}`);
}
