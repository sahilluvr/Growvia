import type { MetadataRoute } from "next";
import { FEATURES, SITE } from "@/lib/site/features";
import { livePosts, indexableCategories, categorySlug } from "@/lib/blog";
import { liveLocal, LOCAL_BASE } from "@/lib/local";

export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/features`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...FEATURES.map((f) => ({ url: `${SITE}/features/${f.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...livePosts().map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: new Date(p.updated), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...indexableCategories().map((c) => ({ url: `${SITE}/blog/category/${categorySlug(c)}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 })),
    { url: `${SITE}${LOCAL_BASE}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 },
    ...liveLocal().map((p) => ({ url: `${SITE}${LOCAL_BASE}/${p.slug}`, lastModified: new Date(p.updated), changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/refunds`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/shipping`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
