import type { MetadataRoute } from "next";
import { FEATURES, SITE } from "@/lib/site/features";
import { livePosts, indexableCategories, categorySlug } from "@/lib/blog";
import { liveLocal, LOCAL_BASE } from "@/lib/local";

export const revalidate = 3600;

// Bump when marketing pages (home, features, legal) change meaningfully.
const SITE_UPDATED = new Date("2026-10-07");

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = livePosts();
  const newest = (dates: string[]) => {
    const t = dates.map((d) => new Date(d).getTime()).filter(Number.isFinite);
    return t.length ? new Date(Math.max(...t)) : SITE_UPDATED;
  };
  const now = SITE_UPDATED;
  const blogUpdated = newest(posts.map((p) => p.updated));
  const localUpdated = newest(liveLocal().map((p) => p.updated));
  return [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/features`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...FEATURES.map((f) => ({ url: `${SITE}/features/${f.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE}/blog`, lastModified: blogUpdated, changeFrequency: "weekly", priority: 0.8 },
    ...posts.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: new Date(p.updated), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...indexableCategories().map((c) => ({ url: `${SITE}/blog/category/${categorySlug(c)}`, lastModified: blogUpdated, changeFrequency: "weekly" as const, priority: 0.5 })),
    { url: `${SITE}${LOCAL_BASE}`, lastModified: localUpdated, changeFrequency: "weekly" as const, priority: 0.7 },
    ...liveLocal().map((p) => ({ url: `${SITE}${LOCAL_BASE}/${p.slug}`, lastModified: new Date(p.updated), changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/refunds`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/shipping`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
