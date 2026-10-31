import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SitePage, JsonLd } from "@/components/site/SitePage";
import { SITE } from "@/lib/site/features";
import { livePosts, readingMinutes, AUTHOR, categories, categorySlug } from "@/lib/blog";
import { HUBS } from "@/lib/blog/hubs";
import { liveLocal, LOCAL_BASE } from "@/lib/local";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Growth guides for small businesses",
  description: "Plain-English growth guides: local SEO, AI search, email, WhatsApp and playbooks for dentists, lawyers, clinics, contractors and agencies.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
  openGraph: { title: "Growvia Blog", description: "Practical growth guides for small businesses.", url: "/blog", type: "website" },
};

const d = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function BlogIndex() {
  const posts = livePosts();
  const live = new Set(posts.map((p) => p.slug));
  const hubs = HUBS.filter((h) => live.has(h.pillar));
  const locals = liveLocal();
  return (
    <SitePage>
      <JsonLd data={[{ "@context": "https://schema.org", "@type": "Blog", name: "Growvia Blog", url: `${SITE}/blog`, blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.published })) }]} />
      <section className="container-x py-16 sm:py-24">
        <span className="eyebrow">Blog</span>
        <h1 className="mt-4 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-tightest sm:text-[56px]">Practical growth guides for small businesses</h1>
        <p className="lead mt-5 max-w-2xl">No jargon, no fluff: how to get found on Google and AI assistants, land in the inbox, sell on WhatsApp and build a marketing routine you can keep.</p>
        {hubs.length > 0 && (
          <div className="mt-12" data-testid="blog-hubs">
            <h2 className="text-[13px] font-mono uppercase tracking-[0.14em] text-stone-500">Guides by industry</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hubs.map((h) => (
                <Link key={h.id} href={`/blog/${h.pillar}`} className="group card p-5 transition hover:-translate-y-0.5 hover:border-stone-400">
                  <p className="flex items-center justify-between text-[17px] font-semibold tracking-tight">{h.name}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-stone-600">{h.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="mt-10 flex flex-wrap gap-2" aria-label="Topics">
          {categories().map((c) => <Link key={c} href={`/blog/category/${categorySlug(c)}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] hover:border-ink">{c}</Link>)}
          {locals.length > 0 && <Link href={LOCAL_BASE} className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] text-white">US local marketing guides</Link>}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {posts.map((p, i) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className={`group card flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-stone-400 sm:p-8 ${i === 0 ? "md:col-span-2" : ""}`}>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime-800">{p.category}</span>
              <h2 className={`mt-3 font-semibold tracking-tight text-ink ${i === 0 ? "text-[26px] sm:text-[32px]" : "text-[21px]"}`}>{p.title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-stone-600">{p.description}</p>
              <span className="mt-auto flex items-center justify-between pt-6 text-[13px] text-stone-500">
                <span>{d(p.published)} · {readingMinutes(p.body)} min read · {AUTHOR.name}</span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </SitePage>
  );
}
