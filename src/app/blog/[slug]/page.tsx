import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SitePage, JsonLd } from "@/components/site/SitePage";
import { SITE } from "@/lib/site/features";
import { AUTHOR, livePosts, postBySlug, readingMinutes, relatedPosts, postsInHub, categorySlug } from "@/lib/blog";
import { hubById } from "@/lib/blog/hubs";
import { liveLocal, LOCAL_BASE } from "@/lib/local";
import { Markdown, headings, faqs } from "@/lib/blog/md";
import { PostMotion } from "@/components/blog/PostMotion";
import { metaDescription, seoTitle } from "@/lib/site/seo-text";

// Scheduled posts appear on their publish date without a redeploy.
export const revalidate = 3600;
export function generateStaticParams() {
  return livePosts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = postBySlug(params.slug);
  if (!p) return {};
  return {
    title: seoTitle(p.seo_title || p.title),
    description: metaDescription(p.meta_description || p.description),
    keywords: p.keywords,
    authors: [{ name: AUTHOR.name }],
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { title: p.seo_title || p.title, description: metaDescription(p.meta_description || p.description), type: "article", url: `/blog/${p.slug}`, publishedTime: p.published, modifiedTime: p.updated, authors: [AUTHOR.name] },
    twitter: { card: "summary_large_image", title: p.seo_title || p.title, description: metaDescription(p.meta_description || p.description) },
  };
}

const d = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function PostPage({ params }: { params: { slug: string } }) {
  const p = postBySlug(params.slug);
  if (!p) notFound();
  const toc = headings(p.body);
  const posts = livePosts();
  const more = relatedPosts(p, 4);
  const hub = hubById(p.hub);
  const isPillar = hub?.pillar === p.slug;
  const hubGuides = hub ? postsInHub(hub.id).filter((x) => x.slug !== p.slug) : [];
  const live = new Set([...posts.map((x) => x.slug), ...liveLocal().map((l) => `local:${l.slug}`)]);
  const locals = hub ? liveLocal() : [];
  const url = `${SITE}/blog/${p.slug}`;
  return (
    <SitePage>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.description, datePublished: p.published, dateModified: p.updated, mainEntityOfPage: url, url, keywords: p.keywords.join(", "), articleSection: p.category, wordCount: p.body.split(/\s+/).length,
          author: { "@type": "Person", name: AUTHOR.name, jobTitle: AUTHOR.role }, publisher: { "@type": "Organization", name: "Growvia", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/icon.svg` } }, image: `${SITE}/opengraph-image` },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Growvia", item: SITE },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
          ...(hub && !isPillar ? [{ "@type": "ListItem", position: 3, name: `Marketing for ${hub.who}`, item: `${SITE}/blog/${hub.pillar}` }] : []),
          { "@type": "ListItem", position: hub && !isPillar ? 4 : 3, name: p.title, item: url },
        ] },
        ...(faqs(p.body).length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs(p.body).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
      ]} />
      <article className="container-x py-12 sm:py-20">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> All guides</Link>
        <header className="mt-6 max-w-3xl">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime-800"><Link href={`/blog/category/${categorySlug(p.category)}`} className="hover:underline">{p.category}</Link>{hub && <> · <Link href={`/blog/${hub.pillar}`} className="hover:underline">{hub.name}</Link></>}</span>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-tightest sm:text-[48px]">{p.title}</h1>
          <p className="mt-5 text-[18px] leading-relaxed text-stone-600">{p.description}</p>
          <p className="mt-5 text-[14px] text-stone-500">By <b className="font-medium text-ink">{AUTHOR.name}</b>, {AUTHOR.role} · {d(p.published)}{p.updated !== p.published ? ` · updated ${d(p.updated)}` : ""} · {readingMinutes(p.body)} min read</p>
        </header>
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="max-w-3xl"><PostMotion>{hub && !isPillar && livePosts().some((x) => x.slug === hub.pillar) && (
            <Link href={`/blog/${hub.pillar}`} className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-line bg-mist/60 px-5 py-4 text-[15px] transition hover:border-stone-400" data-testid="hub-banner">
              <span><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500">Part of the guide</span><br /><b className="font-semibold text-ink">All-in-one AI growth marketing for {hub.who}</b></span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          )}
          <Markdown source={p.body} live={live} />
          {isPillar && hubGuides.length > 0 && (
            <section className="mt-12 rounded-3xl border border-line p-6 sm:p-8" data-testid="hub-guides">
              <h2 className="text-[22px] font-semibold tracking-tight">Every guide for {hub!.who}</h2>
              <ul className="mt-4 grid gap-2 text-[16px]">{hubGuides.map((g) => <li key={g.slug}><Link href={`/blog/${g.slug}`} className="text-ink underline decoration-lime decoration-2 underline-offset-4">{g.title}</Link></li>)}</ul>
            </section>
          )}
          {isPillar && locals.length > 0 && (
            <section className="mt-8 rounded-3xl border border-line p-6 sm:p-8" data-testid="hub-locals">
              <h2 className="text-[22px] font-semibold tracking-tight">Marketing {hub!.who} in your area</h2>
              <p className="mt-2 text-[15px] text-stone-600">Local playbooks for the biggest US markets — competition, seasons and state rules.</p>
              <div className="mt-4 flex flex-wrap gap-2">{locals.map((l) => <Link key={l.slug} href={`${LOCAL_BASE}/${l.slug}`} className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:border-ink">{l.metro}, {l.stateCode}</Link>)}</div>
            </section>
          )}</PostMotion></div>
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24 grid gap-2 border-l border-line pl-4 text-[13px]">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400">On this page</p>
              {toc.map((h) => <a key={h.id} href={`#${h.id}`} className="text-stone-500 hover:text-ink">{h.text}</a>)}
            </nav>
          </aside>
        </div>
        <section className="mt-16 max-w-3xl rounded-3xl bg-ink p-8 text-white sm:p-10">
          <h2 className="text-[24px] font-semibold tracking-tight">Put this into practice with Growvia</h2>
          <p className="mt-3 text-[15px] text-white/70">Audit your website, track Google rankings and AI mentions, send follow-ups and manage every lead and message in one place. Free forever plan, 14-day Pro trial, no card.</p>
          <Link href="/signup" className="btn-lime mt-6 inline-flex">Start growing free <ArrowRight className="h-4 w-4" /></Link>
        </section>
        <section className="mt-16">
          <h2 className="text-[20px] font-semibold tracking-tight">{hub ? `More guides for ${hub.who}` : "Related guides"}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {more.map((m) => (
              <Link key={m.slug} href={`/blog/${m.slug}`} className="card p-5 transition hover:border-stone-400">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-lime-800">{m.category}</span>
                <p className="mt-2 text-[16px] font-semibold leading-snug tracking-tight">{m.title}</p>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </SitePage>
  );
}
