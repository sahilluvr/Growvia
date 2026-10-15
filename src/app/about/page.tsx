import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SitePage, JsonLd } from "@/components/site/SitePage";
import { CONTACT_EMAIL, SITE } from "@/lib/site/features";
import { PRICES } from "@/lib/billing/catalog";

export const metadata: Metadata = {
  title: "About Growvia: who we are and why we built it",
  description: "Growvia is built in Mohali, India by a team that ships software for small businesses. Why we made an AI growth team, what we believe and how to reach us.",
  alternates: { canonical: "/about" },
};

const BELIEFS: [string, string][] = [
  ["Owners want the next step done, not more data.", "A restaurant or clinic owner doesn't need another keyword report. They need “fix these three things this week” and the email, post or fix drafted for them."],
  ["Getting found is only half of it.", "Ranking on Google Maps or being named by ChatGPT only matters if the lead is captured, answered fast and followed up. So Growvia connects audit → form → campaign → inbox → result."],
  ["Be honest about what software can do.", "We label AI-written content, never post or send without your approval, never fake reviews or engagement, and say plainly when a specialist tool does a job better than we do."],
  ["Price it for real small businesses.", `A free plan forever, and paid plans from $${PRICES.pro.month} a month with unlimited team members — because most owners can't pay $100+ per tool.`],
];

const FAQ: [string, string][] = [
  ["Who is behind Growvia?", "Growvia was founded by Sahil Aggarwal, who leads delivery and operations at RedBlink Technologies, a software company in Mohali, Punjab. The same team builds and supports Growvia."],
  ["Where is Growvia based?", "Mohali, Punjab, India. We work with businesses in the US, India, the UAE, Africa and beyond, and our guides are written for those markets."],
  ["Is Growvia a marketing agency?", "No. Growvia is software: an AI growth team you run yourself. Agencies use it too, to manage many client accounts from one place."],
  ["How do I contact the team?", `Write to ${CONTACT_EMAIL} or use the contact form. A real person replies within one business day.`],
];

export default function About() {
  return (
    <SitePage>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "AboutPage", name: "About Growvia", url: `${SITE}/about`, mainEntity: { "@type": "Organization", name: "Growvia", url: SITE, logo: `${SITE}/icon.svg`, email: CONTACT_EMAIL, foundingLocation: { "@type": "Place", name: "Mohali, Punjab, India" }, founder: { "@type": "Person", name: "Sahil Aggarwal" } } },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      ]} />
      <article className="container-x max-w-3xl py-16 sm:py-24">
        <span className="eyebrow">About</span>
        <h1 className="mt-4 text-[38px] font-semibold leading-[1.05] tracking-tightest sm:text-[52px]">The marketing team a small business can&apos;t afford to hire</h1>
        <div className="mt-8 grid gap-5 text-[17px] leading-[1.75] text-stone-700">
          <p>Growvia started with a question we kept hearing. Our team builds software for small businesses and startups, and almost every client eventually asks the same thing once their product or website is live: <i>&ldquo;Now how do we get customers?&rdquo;</i></p>
          <p>We watched owners stitch together six or eight tools — one for SEO, one for email, one for social posts, a form builder, a CRM, WhatsApp on a phone — each built for a marketer they don&apos;t have. They paid agencies they couldn&apos;t measure and still didn&apos;t know what to do next.</p>
          <p>At the same time, two things changed. Customers started asking ChatGPT, Gemini and Perplexity for recommendations, not just Google — and almost no small business knew whether AI recommends them. And AI finally became good enough to do the work itself: the audit, the emails, the posts and the follow-ups, not just another dashboard.</p>
          <p>So we built Growvia: one app that tells a business owner, in plain English, what to fix — and then helps do it. SEO and AI-search visibility, emails from your own mailbox, social posts and video ads, website forms and one inbox for every lead.</p>
        </div>

        <h2 className="mt-14 text-[26px] font-semibold tracking-tight">Who we are</h2>
        <div className="mt-4 grid gap-5 text-[17px] leading-[1.75] text-stone-700">
          <p>Growvia was founded by <b>Sahil Aggarwal</b>, who leads delivery and operations at RedBlink Technologies in Mohali, Punjab — scoping, estimating and shipping software for small businesses and startups. The team also works on CodeConductor.AI, so building with AI is our day job, not a trend we&apos;re chasing.</p>
          <p>We sit next to the exact customers Growvia is for, and we use it for our own sites and clients. Every feature has to pass one test: would a busy owner with no marketer actually use it this week?</p>
        </div>

        <h2 className="mt-14 text-[26px] font-semibold tracking-tight">What we believe</h2>
        <div className="mt-5 grid gap-4">
          {BELIEFS.map(([h, p]) => (
            <section key={h} className="card p-5">
              <h3 className="text-[17px] font-semibold tracking-tight">{h}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">{p}</p>
            </section>
          ))}
        </div>

        <h2 className="mt-14 text-[26px] font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-4 grid gap-5">
          {FAQ.map(([q, a]) => (
            <section key={q}>
              <h3 className="text-[17px] font-semibold tracking-tight">{q}</h3>
              <p className="mt-1 text-[16px] leading-relaxed text-stone-600">{a}</p>
            </section>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary h-11 px-5">Start free <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/contact" className="btn-ghost h-11 px-5">Contact us</Link>
          <Link href="/blog" className="btn-ghost h-11 px-5">Read our guides</Link>
        </div>
      </article>
    </SitePage>
  );
}
