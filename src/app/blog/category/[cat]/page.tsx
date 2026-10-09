import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SitePage, JsonLd } from "@/components/site/SitePage";
import { SITE } from "@/lib/site/features";
import { categories, categorySlug, livePosts, readingMinutes } from "@/lib/blog";
import { CATEGORY_INTROS } from "@/lib/blog/category-intros";
import { metaDescription } from "@/lib/site/seo-text";

export const revalidate = 3600;
export function generateStaticParams() { return categories().map((c) => ({ cat: categorySlug(c) })); }
const find = (slug: string) => categories().find((c) => categorySlug(c) === slug);

export function generateMetadata({ params }: { params: { cat: string } }): Metadata {
  const c = find(params.cat);
  if (!c) return {};
  const n = livePosts().filter((p) => p.category === c).length;
  return { ...(n < 3 ? { robots: { index: false, follow: true } } : {}), title: `${c} marketing guides`, description: metaDescription(CATEGORY_INTROS[c] ?? `Practical ${c.toLowerCase()} guides from Growvia: step-by-step playbooks for small businesses, local service firms and agencies.`), alternates: { canonical: `/blog/category/${params.cat}` } };
}

export default function CategoryPage({ params }: { params: { cat: string } }) {
  const c = find(params.cat);
  if (!c) notFound();
  const posts = livePosts().filter((p) => p.category === c);
  return (
    <SitePage>
      <JsonLd data={[{ "@context": "https://schema.org", "@type": "CollectionPage", name: `${c} guides`, url: `${SITE}/blog/category/${params.cat}`, hasPart: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/blog/${p.slug}` })) }]} />
      <section className="container-x py-16 sm:py-20">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> All guides</Link>
        <h1 className="mt-5 text-[36px] font-semibold tracking-tightest sm:text-[48px]">{c} guides</h1>
        <p className="lead mt-4 max-w-2xl">{CATEGORY_INTROS[c] ?? "Plain English, real examples, steps you can do this week."}</p>
        <p className="mt-3 text-[14px] text-stone-500">{posts.length} in-depth guide{posts.length === 1 ? "" : "s"} · updated regularly · written by the Growvia team</p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group card flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-stone-400">
              <h2 className="text-[20px] font-semibold tracking-tight">{p.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{p.description}</p>
              <span className="mt-auto flex items-center justify-between pt-5 text-[13px] text-stone-500">{readingMinutes(p.body)} min read <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>
    </SitePage>
  );
}
