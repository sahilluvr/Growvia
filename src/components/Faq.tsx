import { LIMITS, PRICE_TEXT, TRIAL_DAYS } from "@/lib/billing/catalog";
import { Plus } from "lucide-react";
import { Words } from "./motion";
import { Reveal } from "./Reveal";
import { CONTACT_EMAIL } from "@/lib/site/features";
import { JsonLd } from "@/components/site/SitePage";

const FAQS = [
  ["Is Growvia just another AI content generator?", "No. Writing is one part. Growvia also audits your website for Google and AI search, tracks your rankings and AI mentions, publishes posts, sends emails and follow-ups, captures leads from your website and WhatsApp, and keeps every conversation in one inbox."],
  ["I'm not a marketer. Will I know what to do?", "That's the point. Growvia builds your plan, explains every SEO issue in plain English with the exact fix, and gives you ready-to-use emails, posts and images. You approve what goes out."],
  ["What is AI search visibility (GEO)?", "More people now ask ChatGPT, Gemini or Perplexity for recommendations. Growvia asks those assistants the questions your customers ask, shows whether you're recommended or cited, who is recommended instead, and what to change."],
  ["Which channels does Growvia work with?", "Today: any email mailbox (Gmail, Outlook, Zoho, SMTP/IMAP), WhatsApp Business (official Cloud API), Facebook Pages and Messenger, Instagram professional accounts, Google Search Console, Google PageSpeed, and website forms on any site. More networks are on the roadmap."],
  ["Will it sound like my business?", "Growvia writes from what you tell it about your business, customers and brand voice. You can edit everything before it's sent or posted."],
  ["Do I stay in control?", "Yes. Nothing is sent to your leads or posted without you choosing it. Emails respect sending hours and daily limits, stop automatically when someone replies, and include an unsubscribe link."],
  ["Is this for agencies too?", "Yes. Create a workspace per client, invite your team as Admins, Members or Viewers, limit someone to one client's workspace, and send clients SEO and AI-visibility reports automatically."],
  ["Is my data safe?", "Each account's data is separated by database-level security rules, connection tokens are encrypted, and teammates only see the workspaces you give them. You can export your leads as CSV at any time."],
  ["What does it cost?", `Free forever for one business: SEO audits, AI experts, reports, leads and inbox, with starter limits. ${PRICE_TEXT.pro}. Pro covers ${LIMITS.pro.projects} projects, Growth ${LIMITS.growth.projects} and Agency ${LIMITS.agency.projects}, each with higher limits — and any plan starts the moment you pay. Every new account gets ${TRIAL_DAYS} days of Pro free, no card needed.`],
  ["What happens when I hit a limit?", `Nothing breaks and nothing is deleted. At 80% you get a heads-up; at 100% you just can't add more until you upgrade (or the month resets for monthly limits). Upgrades start instantly and the unused days of your old plan are refunded. Moving to a smaller plan starts when your paid period ends. Need more than ${LIMITS.agency.projects} projects? Talk to us about custom limits.`],
  ["Can I pay from India or in another currency?", "Prices are in US dollars. Outside India, you pay in US dollars with PayPal — one payment for a month or a year, no auto-renewal, and we email you before it ends. In India, you pay in rupees (UPI, cards, netbanking) at that day's exchange rate, renewing automatically. Payments are handled securely by Razorpay."],
  ["Can I cancel anytime?", "Yes — from Plan & billing in your account, in two clicks. You keep your plan until the end of the period you paid for, and nothing is deleted when you move back to Free."],
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-line bg-white py-24 sm:py-32">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <span className="eyebrow">FAQ</span>
          <h2 className="h-section mt-5"><Words text="Questions," /><br /><Words text="answered." delay={150} /></h2>
          <p className="lead mt-5 max-w-sm">Something else on your mind? <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline decoration-lime decoration-2 underline-offset-4">{CONTACT_EMAIL}</a></p>
        </Reveal>
        <Reveal className="divide-y divide-line border-y border-line">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium tracking-tight">
                <h3 className="text-[17px] font-medium tracking-tight">{q}</h3>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-all group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-lime">
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="faq-a mt-3 max-w-2xl pr-12 text-[15px] leading-relaxed text-stone-500">{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
