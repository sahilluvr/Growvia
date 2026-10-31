import type { Metadata } from "next";
import { SpotlightGroup, Words } from "@/components/motion";
import { Reveal } from "@/components/Reveal";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { FEATURES, CHANNELS_LIVE, SITE } from "@/lib/site/features";
import { FeatureIcon } from "@/components/site/FeatureIcon";
import { SitePage, JsonLd } from "@/components/site/SitePage";

export const metadata: Metadata = {
  title: "Features: SEO, AI search, email, social and leads",
  description: "Everything Growvia does: SEO audits and rankings, AI-search visibility, AI email and social posts, website forms, WhatsApp, one inbox, bookings and team workspaces.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <SitePage>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: "Growvia features", itemListElement: FEATURES.map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f.name, url: `${SITE}/features/${f.slug}` })) }} />
      <section className="relative overflow-hidden pb-16 pt-16 sm:pt-24">
        <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="container-x relative max-w-4xl text-center">
          <span className="eyebrow">Features</span>
          <h1 className="h-section mt-5"><Words text="Everything your growth needs, working together." /></h1>
          <p className="lead mx-auto mt-5 max-w-2xl">Each part is useful on its own. Together they share one pipeline of leads, one inbox and one picture of what&apos;s working.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary shine group h-12 px-6">Start Growing Free <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
      <section className="container-x pb-20">
        <SpotlightGroup className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.slug} delay={(i % 2) * 90}><Link href={`/features/${f.slug}`} className="card spot group flex h-full flex-col p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-frame">
              <div className="flex items-center justify-between">
                <span className="icon-pop grid h-11 w-11 place-items-center rounded-xl bg-ink text-lime"><FeatureIcon icon={f.icon} /></span>
                <ArrowUpRight className="h-4 w-4 text-stone-300 group-hover:text-ink" />
              </div>
              <h2 className="mt-6 text-[22px] font-semibold tracking-tight">{f.name}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-500">{f.short}</p>
              <ul className="mt-5 grid gap-1.5">
                {f.points.slice(0, 3).map((p) => (
                  <li key={p.title} className="flex items-start gap-2 text-[14px] text-stone-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-700" strokeWidth={2.5} /> {p.title}</li>
                ))}
              </ul>
            </Link></Reveal>
          ))}
        </SpotlightGroup>
      </section>
      <section className="border-t border-line bg-white py-16">
        <div className="container-x">
          <h2 className="text-[24px] font-semibold tracking-tight">Works with</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {CHANNELS_LIVE.map((c) => <span key={c} className="rounded-full border border-line bg-paper px-4 py-2 text-[14px] text-stone-600">{c}</span>)}
          </div>
        </div>
      </section>
    </SitePage>
  );
}
