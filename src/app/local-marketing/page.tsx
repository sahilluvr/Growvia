import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin } from "lucide-react";
import { SitePage, JsonLd } from "@/components/site/SitePage";
import { SITE } from "@/lib/site/features";
import { liveLocal, LOCAL_BASE } from "@/lib/local";
import { HUBS } from "@/lib/blog/hubs";
import { livePosts } from "@/lib/blog";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Local marketing guides for the biggest US markets",
  description: "Local marketing playbooks for 25 big US counties, from Los Angeles and Houston to Chicago and Miami: competition, seasons, state rules and what works.",
  alternates: { canonical: LOCAL_BASE },
};

export default function LocalIndex() {
  const pages = liveLocal();
  const states = Array.from(new Set(pages.map((p) => p.state))).sort();
  const live = new Set(livePosts().map((p) => p.slug));
  return (
    <SitePage>
      <JsonLd data={[{ "@context": "https://schema.org", "@type": "CollectionPage", name: "US local marketing guides", url: `${SITE}${LOCAL_BASE}`, hasPart: pages.map((p) => ({ "@type": "Article", headline: p.title, url: `${SITE}${LOCAL_BASE}/${p.slug}` })) }]} />
      <section className="container-x py-16 sm:py-24">
        <span className="eyebrow">US markets</span>
        <h1 className="mt-4 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-tightest sm:text-[56px]">Local marketing playbooks for America&apos;s biggest markets</h1>
        <p className="lead mt-5 max-w-2xl">Every county is different: who searches, how crowded Google Maps is, which seasons drive calls, and which state rules apply to your ads and data. Pick your market.</p>
        <div className="mt-12 grid gap-10">
          {states.map((st) => (
            <div key={st}>
              <h2 className="text-[13px] font-mono uppercase tracking-[0.14em] text-stone-500">{st}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pages.filter((p) => p.state === st).map((p) => (
                  <Link key={p.slug} href={`${LOCAL_BASE}/${p.slug}`} className="group card p-5 transition hover:-translate-y-0.5 hover:border-stone-400" data-testid="local-card">
                    <p className="flex items-center gap-2 text-[17px] font-semibold tracking-tight"><MapPin className="h-4 w-4 text-lime-700" />{p.metro}</p>
                    <p className="mt-1 text-[14px] text-stone-500">{p.county}, {p.stateCode} · about {p.population} people</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium">Read the playbook <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-16 rounded-3xl border border-line p-6 sm:p-8">
          <h2 className="text-[22px] font-semibold tracking-tight">Guides by industry</h2>
          <div className="mt-4 flex flex-wrap gap-2">{HUBS.filter((h) => live.has(h.pillar)).map((h) => <Link key={h.id} href={`/blog/${h.pillar}`} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] hover:border-ink">Marketing for {h.who}</Link>)}</div>
        </div>
      </section>
    </SitePage>
  );
}
