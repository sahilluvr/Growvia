import { Compass, PenLine, Send, Search, Handshake, BarChart3 } from "lucide-react";
import { SpotlightGroup, Words } from "./motion";
import { Reveal } from "./Reveal";

const AGENTS = [
  {
    icon: Compass,
    name: "Strategist",
    role: "Decides what to do next",
    body: "Builds your growth plan from your business, customers and goal, then sets the week's priorities.",
    sample: { label: "This week's focus", lines: ["Win back lapsed customers", "Promote the weekday offer", "Fix the two top SEO issues"] },
  },
  {
    icon: PenLine,
    name: "Creator",
    role: "Makes everything, in your voice",
    body: "Emails, campaigns, captions and on-brand images in your voice — you review before anything goes out.",
    sample: { label: "Ready for review", lines: ["5 posts with images", "3-email welcome campaign", "New page titles for SEO"] },
  },
  {
    icon: Send,
    name: "Distributor",
    role: "Shows up where customers are",
    body: "Publishes to Facebook and Instagram and sends email and WhatsApp on your schedule.",
    sample: { label: "Scheduled", lines: ["Instagram · Tue 7:30 pm", "Email · Wed 10:00 am", "WhatsApp broadcast · Fri"] },
  },
  {
    icon: Search,
    name: "Lead Finder",
    role: "Catches every enquiry",
    body: "Website forms, WhatsApp, Instagram and Messenger, bookings and CSV imports — all in one pipeline, with where each lead came from.",
    sample: { label: "New this week", lines: ["Website form · Instagram bio", "WhatsApp chat", "Booked a call"] },
  },
  {
    icon: Handshake,
    name: "Closer",
    role: "Turns leads into customers",
    body: "Sends the instant reply, follows up politely until they answer, and lets them book a time with you.",
    sample: { label: "Conversations", lines: ["Auto-reply sent", "Follow-up stopped: they replied", "Meeting booked for Thu"] },
  },
  {
    icon: BarChart3,
    name: "Analyst",
    role: "Learns and improves",
    body: "Tracks Google rankings, AI-search visibility and email results, and sends a clear weekly summary.",
    sample: { label: "This week", lines: ["SEO score up 7 points", "2 keywords entered the top 10", "Mentioned by Gemini for 3 of 8 questions"] },
  },
];

export function Team() {
  return (
    <section id="team" className="scroll-mt-16 border-b border-line bg-white py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <span className="eyebrow">Your AI growth team</span>
            <h2 className="h-section mt-5"><Words text="Six specialists." /><br /><Words text="One goal: more customers." delay={180} /></h2>
          </div>
          <p className="lead max-w-lg lg:justify-self-end">
            The work of a strategist, copywriter, social manager, SEO specialist and sales assistant — coordinated in one
            system, sized for a small business or a lean agency.
          </p>
        </Reveal>

        <SpotlightGroup className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a, i) => {
            const I = a.icon;
            return (
              <Reveal key={a.name} delay={(i % 3) * 80} className="spot group flex flex-col bg-white p-7 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="icon-pop grid h-10 w-10 place-items-center rounded-xl border border-line bg-paper transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-lime">
                    <I className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight">{a.name}</h3>
                    <p className="text-[13px] text-stone-500">{a.role}</p>
                  </div>
                </div>
                <p className="mt-5 text-[15px] leading-relaxed text-stone-500">{a.body}</p>
                <div className="mt-6 rounded-xl border border-line bg-paper p-4 transition-colors group-hover:bg-white">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400">{a.sample.label}</div>
                  <ul className="mt-2.5 grid gap-1.5">
                    {a.sample.lines.map((l) => (
                      <li key={l} className="flex items-center gap-2 text-[13px] text-stone-600">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-500" /> {l}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </SpotlightGroup>
      </div>
    </section>
  );
}
