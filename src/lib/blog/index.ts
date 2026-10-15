import { POSTS } from "./posts.generated";
import { wordCount } from "./md";
export type { Post } from "./types";
import type { Post } from "./types";
import { hubById } from "./hubs";
const hubPillar = (id: string) => hubById(id)?.pillar;

export const AUTHOR = { name: "Sahil Aggarwal", role: "Founder, Growvia" };
/** Today's date in India (YYYY-MM-DD) — posts go live on their publish date. */
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
/** Posts whose publish date has arrived, newest first. Future-dated posts stay hidden until their day. */
export const livePosts = () => POSTS.filter((p) => p.published <= todayIST()).sort((a, b) => b.published.localeCompare(a.published));
export const postBySlug = (slug: string) => livePosts().find((p) => p.slug === slug);
export const readingMinutes = (body: string) => Math.max(1, Math.round(wordCount(body) / 220));

/** Guides to read next: same industry hub first, then same category, then newest. */
export function relatedPosts(p: Post, n = 4) {
  const others = livePosts().filter((x) => x.slug !== p.slug);
  const score = (x: Post) => (p.hub && x.hub === p.hub ? 4 : 0) + (x.category === p.category ? 2 : 0) + (p.hub && x.slug === hubPillar(p.hub) ? 3 : 0);
  return others.map((x, i) => ({ x, s: score(x) - i / 1000 })).sort((a, b) => b.s - a.s).slice(0, n).map((r) => r.x);
}
export const postsInHub = (hub: string) => livePosts().filter((p) => p.hub === hub);
export const categorySlug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export const categories = () => Array.from(new Set(livePosts().map((p) => p.category))).sort();
/** Topics with enough guides to deserve their own search result (smaller ones stay browsable but noindex). */
export const indexableCategories = () => categories().filter((c) => livePosts().filter((p) => p.category === c).length >= 3);
