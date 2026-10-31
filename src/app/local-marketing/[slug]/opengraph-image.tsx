import { ogCard, OG_SIZE } from "@/lib/site/og";
import { liveLocal, localBySlug } from "@/lib/local";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Growvia local marketing guide";
export const revalidate = 3600;
export function generateStaticParams() { return liveLocal().map((p) => ({ slug: p.slug })); }

export default function Image({ params }: { params: { slug: string } }) {
  const p = localBySlug(params.slug);
  return ogCard(p ? `Marketing in ${p.metro}` : "US local marketing", p ? `${p.county}, ${p.state} — local search, seasons and state rules, plus playbooks for dentists, lawyers and home services.` : "", "Local playbook");
}
