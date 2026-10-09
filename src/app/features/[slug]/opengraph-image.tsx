import { ogCard, OG_SIZE } from "@/lib/site/og";
import { FEATURES, featureBySlug } from "@/lib/site/features";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Growvia feature";
export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export default function Image({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  return ogCard(f?.name ?? "Growvia", f?.short ?? "", "Growvia feature");
}
