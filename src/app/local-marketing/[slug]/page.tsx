import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { SitePage, JsonLd } from "@/components/site/SitePage";
import { SITE } from "@/lib/site/features";
import { AUTHOR, livePosts, readingMinutes } from "@/lib/blog";
import { HUBS } from "@/lib/blog/hubs";
import { Markdown, headings, faqs } from "@/lib/blog/md";
import { PostMotion } from "@/components/blog/PostMotion";
import { metaDescription, seoTitle } from "@/lib/site/seo-text";
import { liveLocal, localBySlug, LOCAL_BASE } from "@/lib/local";

export const revalidate = 3600;
export function generateStaticParams() { return liveLocal().map((p) => ({ slug: p.slug })); }

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = localBySlug(params.slug);
  if (!p) return {};
  return {
    title: seoTitle(p.seo_title || p.title), description: metaDescription(p.meta_description || p.description), keywords: p.keywords, authors: [{ name: AUTHOR.name }],
    alternates: { canonical: `${LOCAL_BASE}/${p.slug}` },
    openGraph: { title: p.seo_title || p.title, description: metaDescription(p.meta_description || p.description), type: "article", url: `${LOCAL_BASE}/${p.slug}`, publishedTime: p.published, modifiedTime: p.updated },
    twitter: { card: "summary_large_image", title: p.seo_title || p.title, description: metaDescription(p.meta_description || p.description) },
  };
}
const d = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function LocalPageView({ params }: { params: { slug: string } }) {
  const p = localBySlug(params.slug);
  if (!p) notFound();
  const all = liveLocal();
  const posts = livePosts();
  const live = new Set([...posts.map((x) => x.slug), ...all.map((l) => `local:${l.slug}`)]);
  const nearby = [...all.filter((l) => l.slug !== p.slug && l.state === p.state), ...all.filter((l) => l.state !== p.state)].slice(0, 6);
  const hubs = HUBS.filter((h) => live.has(h.pillar));
  const toc = headings(p.body);
  const url = `${SITE}${LOCAL_BASE}/${p.slug}`;
  const f = faqs(p.body);
  return (
    <SitePage>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.description, datePublished: p.published, dateModified: p.updated, mainEntityOfPage: url, url, keywords: p.keywords.join(", "),
          about: { "@type": "AdministrativeArea", name: `${p.county}, ${p.state}` }, spatialCoverage: { "@type": "Place", name: `${p.county}, ${p.state}, United States` },
          author: { "@type": "Person", name: AUTHOR.name, jobTitle: AUTHOR.role }, publisher: { "@type": "Organization", name: "Growvia", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/icon.svg` } }, image: `${SITE}/opengraph-image` },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Growvia", item: SITE },
          { "@type": "ListItem", position: 2, name: "US local marketing", item: `${SITE}${LOCAL_BASE}` },
          { "@type": "ListItem", position: 3, name: `${p.metro}, ${p.stateCode}`, item: url },
        ] },
        ...(f.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: f.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) }] : []),
      ]} />
      <article className="container-x py-12 sm:py-20">
        <Link href={LOCAL_BASE} className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> All US markets</Link>
        <header className="mt-6 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-lime-800"><MapPin className="h-3.5 w-3.5" />{p.county} · {p.state}</span>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-tightest sm:text-[48px]">{p.title}</h1>
          <p className="mt-5 text-[18px] leading-relaxed text-stone-600">{p.description}</p>
          <p className="mt-5 text-[14px] text-stone-500">By <b className="font-medium text-ink">{AUTHOR.name}</b>, {AUTHOR.role} · {d(p.published)}{p.updated !== p.published ? ` · updated ${d(p.updated)}` : ""} · {readingMinutes(p.body)} min read</p>
        </header>
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="max-w-3xl"><PostMotion><Markdown source={p.body} live={live} /></PostMotion></div>
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24 grid gap-2 border-l border-line pl-4 text-[13px]">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400">On this page</p>
              {toc.map((h) => <a key={h.id} href={`#${h.id}`} className="text-stone-500 hover:text-ink">{h.text}</a>)}
            </nav>
          </aside>
        </div>
        <section className="mt-16 max-w-3xl rounded-3xl bg-ink p-8 text-white sm:p-10">
          <h2 className="text-[24px] font-semibold tracking-tight">Run this playbook in {p.metro} with Growvia</h2>
          <p className="mt-3 text-[15px] text-white/70">Audit your site, track your Google Maps and AI-search position against local competitors, follow up every lead, and see what brings customers in. Free forever plan, 14-day Pro trial, no card.</p>
          <Link href="/signup" className="btn-lime mt-6 inline-flex">Start growing free <ArrowRight className="h-4 w-4" /></Link>
        </section>
        {hubs.length > 0 && (
          <section className="mt-14 max-w-3xl" data-testid="local-hubs">
            <h2 className="text-[20px] font-semibold tracking-tight">Industry guides for {p.metro} businesses</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{hubs.map((h) => <Link key={h.id} href={`/blog/${h.pillar}`} className="card p-4 text-[15px] transition hover:border-stone-400"><b className="font-semibold">{h.name}</b><span className="mt-1 block text-[13px] text-stone-500">{h.blurb}</span></Link>)}</div>
          </section>
        )}
        <section className="mt-14">
          <h2 className="text-[20px] font-semibold tracking-tight">Other markets</h2>
          <div className="mt-4 flex flex-wrap gap-2">{nearby.map((l) => <Link key={l.slug} href={`${LOCAL_BASE}/${l.slug}`} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] hover:border-ink">{l.metro}, {l.stateCode}</Link>)}</div>
        </section>
      </article>
    </SitePage>
  );
}
