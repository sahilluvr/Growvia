import { ogCard, OG_SIZE } from "@/lib/site/og";
import { livePosts, postBySlug } from "@/lib/blog";
import { hubById } from "@/lib/blog/hubs";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Growvia guide";
export const revalidate = 3600;
export function generateStaticParams() { return livePosts().map((p) => ({ slug: p.slug })); }

export default function Image({ params }: { params: { slug: string } }) {
  const p = postBySlug(params.slug);
  const t = p?.seo_title || p?.title || "Growvia guides";
  return ogCard(t.length > 70 ? t.replace(/\s*\([^)]*\)\s*$/, "") : t, p ? (p.meta_description || p.description).slice(0, 150) : "", hubById(p?.hub)?.name ? `Guide · ${hubById(p?.hub)!.name}` : `Guide · ${p?.category ?? "Growvia"}`);
}
