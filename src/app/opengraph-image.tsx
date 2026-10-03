import { ogCard, OG_SIZE } from "@/lib/site/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Growvia — your AI growth team";

export default function Image() {
  return ogCard("Your AI growth team.", "SEO & AI search, email, social posts, WhatsApp, website forms and one inbox — in one place.");
}
