import { ogCard, OG_SIZE } from "@/lib/site/og";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Growvia US local marketing guides";
export default function Image() {
  return ogCard("Local marketing for 25 big US markets.", "Los Angeles, Houston, Chicago, Phoenix, Miami, New York and more — competition, seasons and state rules.", "US local playbooks");
}
