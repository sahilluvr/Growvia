import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site/features";

// Marketing pages are open to search engines and AI assistants; the app, APIs and private links are not.
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/app", "/api/", "/onboarding", "/invite/", "/r/", "/u/", "/embed/", "/f/", "/book/", "/setup", "/auth/"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
