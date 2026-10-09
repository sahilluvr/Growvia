import type { Metadata } from "next";
import { SitePage } from "@/components/site/SitePage";
import { GrowviaForm } from "@/components/site/GrowviaForm";
import { CONTACT_EMAIL } from "@/lib/site/features";

export const metadata: Metadata = {
  title: "Contact Growvia: support, demos and agency plans",
  description: "Talk to the Growvia team — questions, demos, agency plans and support. We reply within one business day.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline">{CONTACT_EMAIL}</a>;
  return (
    <SitePage>
      <div className="container-x grid max-w-5xl gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_440px] lg:gap-16">
        <div>
          <h1 className="text-[36px] font-semibold tracking-tightest sm:text-[48px]">Talk to us</h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-stone-600">Questions, a quick demo, or help getting set up — send us a note and a real person replies within one business day.</p>
          <div className="mt-10 grid gap-6 text-[15px] leading-relaxed text-stone-600">
            <section>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">Support, billing and refunds</h2>
              <p className="mt-1">{mail} — please include the email on your Growvia account.</p>
            </section>
            <section>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">Agencies and partnerships</h2>
              <p className="mt-1">Use this form, &ldquo;Talk to us&rdquo; in the <a href="/#agency" className="text-ink underline">Agency plan</a>, or write to {mail}.</p>
            </section>
            <section>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">Where we are</h2>
              <p className="mt-1">Growvia is run from Mohali, Punjab, India.</p>
            </section>
          </div>
        </div>
        <section className="lg:col-span-2 grid gap-5 text-[15px] leading-relaxed text-stone-600 lg:order-last">
          <h2 className="text-[22px] font-semibold tracking-tight text-ink">Common questions</h2>
          {[
            ["How fast will I hear back?", "Within one business day, usually much sooner. We're based in Mohali, India (IST), and answer US messages in the evening our time, which is your morning."],
            ["Can I get a demo?", "Yes. Tell us your business and what you want to fix in the form, and we'll send a short walkthrough or book a call. Most people start with the free plan and see their first audit in minutes."],
            ["I have a billing or refund question.", "Email us from the address on your Growvia account. Plan changes and cancellations are also self-serve under Plan & billing, and our refund policy is on the refunds page."],
            ["I run an agency — can you help move my clients over?", "Yes. The Agency plan covers 75 client projects, and above that we set up custom limits. We'll help you import clients and set up workspaces."],
          ].map(([q, a]) => (<div key={q}><h3 className="text-[16px] font-semibold text-ink">{q}</h3><p className="mt-1">{a}</p></div>))}
        </section>
        <section id="form" className="scroll-mt-24 rounded-[20px] border border-line p-4 shadow-sm sm:p-5" aria-label="Contact form">
          <GrowviaForm />
        </section>
      </div>
    </SitePage>
  );
}
