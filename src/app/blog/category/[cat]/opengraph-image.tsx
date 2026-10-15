import { ogCard, OG_SIZE } from "@/lib/site/og";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Growvia blog";
export default function Image() {
  return ogCard("Guides by topic.", "Local SEO, AI search, email, WhatsApp and industry playbooks for dentists, lawyers, clinics, contractors and more.", "Growvia blog");
}
