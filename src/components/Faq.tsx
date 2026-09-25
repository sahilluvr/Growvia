import { Plus } from "lucide-react";
import { Reveal } from "./Reveal";

const FAQS = [
  ["Is Growvia just another AI content generator?", "No. Content is one step. Growvia understands your business, decides what to do, creates it, publishes it, finds and follows up with leads, tracks which actions turned into customers — then improves next week's plan based on what worked."],
  ["I'm not a marketer. Will I know what to do?", "You don't need to. Tell Growvia about your business and your goal. It builds the plan, explains it in plain language, and does the work. You simply approve what goes out — or let it run on autopilot."],
  ["Will it sound like my business?", "Yes. Growvia learns your voice from your website, past posts, reviews and a few examples you like. You can edit anything, and it learns from every change you make."],
  ["Which channels does Growvia work with?", "Instagram, Facebook, TikTok, LinkedIn, YouTube, Google Business Profile, email, SMS and WhatsApp — plus stores and tools like Shopify and your calendar or CRM. New integrations ship regularly."],
  ["Do I stay in control?", "Always. Choose approve-first mode and nothing publishes or sends without your OK. Set budgets, brand rules and topics to avoid. You can pause the team at any time."],
  ["How fast will I see results?", "Your growth plan is ready in minutes and your first campaign can go live the same day. Growth compounds: the loop learns from every cycle, so results typically build over the first weeks rather than arriving all at once."],
  ["Is this for agencies too?", "Yes. The Agency plan gives you a workspace per client, approval flows, white-label reports and team roles — so a small team can deliver growth for many more clients."],
  ["What does it cost to get started?", "Nothing. The Starter plan is free forever with no credit card. Paid plans include a 14-day free trial and you can cancel anytime."],
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-line bg-white py-24 sm:py-32">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <span className="eyebrow">FAQ</span>
          <h2 className="h-section mt-5">Questions,<br />answered.</h2>
          <p className="lead mt-5 max-w-sm">Something else on your mind? <a href="mailto:hello@growvia.ai" className="text-ink underline decoration-lime decoration-2 underline-offset-4">hello@growvia.ai</a></p>
        </Reveal>
        <Reveal className="divide-y divide-line border-y border-line">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium tracking-tight">
                {q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-all group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-lime">
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 max-w-2xl pr-12 text-[15px] leading-relaxed text-stone-500">{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
