import Link from "next/link";
import { SpotlightGroup, Words } from "./motion";
import { ArrowUpRight } from "lucide-react";
import { FEATURES } from "@/lib/site/features";
import { FeatureIcon } from "./site/FeatureIcon";
import { Reveal } from "./Reveal";

/** Everything that's in the product today — each card links to its own page. */
export function Features() {
  return (
    <section id="features" className="scroll-mt-16 border-y border-line bg-white py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <span className="eyebrow">What&apos;s inside</span>
            <h2 className="h-section mt-5"><Words text="One place for the work" /><br /><Words text="that brings customers." delay={200} /></h2>
          </div>
          <p className="lead max-w-lg lg:justify-self-end">
            SEO and AI search, email, WhatsApp, social posts, ads and video, website forms, bookings and a shared inbox — connected, so every lead and every result lives in one system.
          </p>
        </Reveal>
        <SpotlightGroup className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.slug} delay={(i % 5) * 60} className="bg-white">
              <Link href={`/features/${f.slug}`} className="spot group flex h-full flex-col bg-white p-6 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="icon-pop grid h-10 w-10 place-items-center rounded-xl border border-line bg-paper transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-lime">
                    <FeatureIcon icon={f.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-stone-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </div>
                <h3 className="mt-6 text-[18px] font-semibold tracking-tight">{f.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-stone-500">{f.short}</p>
              </Link>
            </Reveal>
          ))}
        </SpotlightGroup>
      </div>
    </section>
  );
}
