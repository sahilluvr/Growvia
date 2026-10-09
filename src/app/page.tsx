import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { HowItWorks } from "@/components/HowItWorks";
import { Team } from "@/components/Team";
import { Features } from "@/components/Features";
import { PlanBuilder } from "@/components/PlanBuilder";
import { Compare } from "@/components/Compare";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";

// The homepage owns its canonical (it used to live in the root layout and leak onto other pages).
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <div className="cv-auto"><Problem /></div>
        <div className="cv-auto"><Features /></div>
        <div className="cv-auto"><HowItWorks /></div>
        <div className="cv-auto"><Team /></div>
        <div className="cv-auto"><PlanBuilder /></div>
        <div className="cv-auto"><Compare /></div>
        <div className="cv-auto"><Pricing /></div>
        <div className="cv-auto"><Faq /></div>
        <div className="cv-auto"><FinalCta /></div>
      </main>
      <div className="cv-auto"><Footer /></div>
    </>
  );
}
