import { metaDescription } from "@/lib/site/seo-text";
import type { Metadata } from "next";
import { CursorGlow, SpotlightGroup, Words } from "@/components/motion";
import { Reveal } from "@/components/Reveal";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Plus } from "lucide-react";
import { FEATURES, featureBySlug, SITE } from "@/lib/site/features";
import { FeatureIcon } from "@/components/site/FeatureIcon";
import { SitePage, JsonLd } from "@/components/site/SitePage";

export const dynamicParams = false;
export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

// Search titles (30–60 characters with " · Growvia") — the on-page heading stays the feature name.
const FEATURE_TITLES: Record<string, string> = {
  seo: "SEO audits and keyword rankings",
  "ai-search": "AI search visibility (GEO) tracking",
  email: "Email marketing from your own mailbox",
  inbox: "One inbox for email, WhatsApp and DMs",
  whatsapp: "WhatsApp Business broadcasts and chat",
  social: "AI social media posts and images",
  ads: "AI ad copy and short video ads",
  forms: "Website lead forms and lead tracking",
  meetings: "Online booking page for appointments",
  agencies: "Marketing software for teams and agencies",
};

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const f = featureBySlug(params.slug);
  if (!f) return {};
  return {
    title: FEATURE_TITLES[f.slug] ?? f.name,
    description: metaDescription(f.intro),
    keywords: f.keywords,
    alternates: { canonical: `/features/${f.slug}` },
    openGraph: { title: `${f.name} · Growvia`, description: f.short, type: "website", url: `/features/${f.slug}` },
  };
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  if (!f) notFound();
  const related = f.related.map(featureBySlug).filter(Boolean) as typeof FEATURES;
  return (
    <SitePage>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Growvia", item: SITE },
          { "@type": "ListItem", position: 2, name: "Features", item: `${SITE}/features` },
          { "@type": "ListItem", position: 3, name: f.name, item: `${SITE}/features/${f.slug}` },
        ] },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: f.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      ]} />

      <section className="relative overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-20">
        <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="container-x relative">
          <nav aria-label="Breadcrumb" className="text-[13px] text-stone-500"><Link href="/features" className="hover:text-ink">Features</Link> <span className="mx-1.5 text-stone-300">/</span> {f.name}</nav>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <span className="rise-in grid h-12 w-12 place-items-center rounded-xl bg-ink text-lime"><FeatureIcon icon={f.icon} /></span>
              <h1 style={{ animationDelay: "100ms" }} className="rise-in mt-6 text-[36px] font-semibold leading-[1.04] tracking-tightest sm:text-[52px]">{f.title}</h1>
              <p className="lead rise-in mt-6 max-w-2xl" style={{ animationDelay: "220ms" }}>{f.intro}</p>
              <div className="rise-in mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "320ms" }}>
                <Link href="/signup" className="btn-primary shine group h-12 px-6">Start Growing Free <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/features" className="btn-ghost h-12 px-6">All features</Link>
              </div>
              <p className="mt-4 text-[13px] text-stone-500">Free forever plan · 14-day Pro trial, no card</p>
            </div>
            <div className="rise-frame ring-glow rounded-[22px] bg-ink p-6 text-white shadow-frame sm:p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime">How it works</p>
              <ol className="mt-5 grid gap-4">
                {f.steps.map((s, i) => (
                  <li key={s} className="rise-in flex gap-4" style={{ animationDelay: `${700 + i * 160}ms` }}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 font-mono text-[12px] text-lime">{i + 1}</span>
                    <span className="pt-1 text-[15px] leading-snug text-white/80">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white py-20 sm:py-24">
        <div className="container-x">
          <h2 className="text-[28px] font-semibold tracking-tight sm:text-[36px]"><Words text="What you get" /></h2>
          <SpotlightGroup className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {f.points.map((p, i) => (
              <Reveal key={p.title} delay={(i % 3) * 90} className="spot bg-white p-7">
                <h3 className="text-[17px] font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-stone-500">{p.body}</p>
              </Reveal>
            ))}
          </SpotlightGroup>
          <div className="mt-8 rounded-2xl bg-paper p-6">
            <p className="text-[13px] font-medium">Inside the app</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {f.inApp.map((x) => <li key={x} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-stone-600"><Check className="h-3.5 w-3.5 text-lime-700" strokeWidth={3} /> {x}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-[28px] font-semibold tracking-tight sm:text-[36px]">Questions</h2>
            <p className="lead mt-4 max-w-sm">About {f.name} in Growvia.</p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {f.faq.map(([q, a]) => (
              <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium tracking-tight">
                  {q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-all group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-lime"><Plus className="h-4 w-4" /></span>
                </summary>
                <p className="mt-3 max-w-2xl pr-12 text-[15px] leading-relaxed text-stone-500">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-white py-16">
        <div className="container-x">
          <h2 className="text-[20px] font-semibold tracking-tight">Works well with</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/features/${r.slug}`} className="card group flex items-start gap-3 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-frame">
                <span className="icon-pop grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-paper"><FeatureIcon icon={r.icon} className="h-4 w-4" /></span>
                <span><span className="block text-[15px] font-semibold">{r.name}</span><span className="text-[13px] text-stone-500">{r.short}</span></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 sm:py-10">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-center text-white sm:py-20">
          <div className="aurora-1 pointer-events-none absolute bottom-[-200px] left-1/2 h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-lime/20 blur-[110px]" />
          <CursorGlow />
          <h2 className="relative text-[32px] font-semibold leading-tight tracking-tightest sm:text-[48px]"><Words text={`Try ${f.name} free.`} /></h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[16px] text-white/60">Set up in minutes. Everything else in Growvia is included.</p>
          <Link href="/signup" className="btn-lime shine group relative mx-auto mt-8 h-12 w-fit px-7">Start Growing Free <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </SitePage>
  );
}
