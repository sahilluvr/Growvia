import { Compass, PenLine, Send, Search, Handshake, BarChart3 } from "lucide-react";
import { Reveal } from "./Reveal";

const AGENTS = [
  {
    icon: Compass,
    name: "Strategist",
    role: "Decides what to do next",
    body: "Studies your market, competitors and customers, then sets the week's priorities.",
    sample: { label: "This week's focus", lines: ["Win back lapsed clients (38 people)", "Promote Tuesday availability", "Target new-mover households"] },
  },
  {
    icon: PenLine,
    name: "Creator",
    role: "Makes everything, in your voice",
    body: "Posts, reels scripts, emails, ads, offers and landing pages — on-brand, every time.",
    sample: { label: "Ready for review", lines: ["5 Instagram posts · 2 reels", "1 email · 'We miss you' offer", "Google Business update"] },
  },
  {
    icon: Send,
    name: "Distributor",
    role: "Shows up where customers are",
    body: "Publishes across social, search, email and messaging at the times your audience is active.",
    sample: { label: "Scheduled", lines: ["Instagram · Tue 7:30 pm", "Email · Wed 10:00 am", "Google · Thu 12:00 pm"] },
  },
  {
    icon: Search,
    name: "Lead Finder",
    role: "Finds people ready to buy",
    body: "Captures inbound interest and discovers new prospects that match your best customers.",
    sample: { label: "New this week", lines: ["23 inbound enquiries", "41 matching prospects", "12 marked high intent"] },
  },
  {
    icon: Handshake,
    name: "Closer",
    role: "Turns leads into customers",
    body: "Replies in minutes, follows up politely and books the call, appointment or order.",
    sample: { label: "Conversations", lines: ["Replied in avg. 2 min", "9 follow-ups sent", "5 appointments booked"] },
  },
  {
    icon: BarChart3,
    name: "Analyst",
    role: "Learns and improves",
    body: "Connects every action to revenue, explains what worked, and tunes next week's plan.",
    sample: { label: "Insight", lines: ["Offers beat discounts 3:1", "Evening posts win on reach", "Shift 20% budget to reels"] },
  },
];

export function Team() {
  return (
    <section id="team" className="scroll-mt-16 border-b border-line bg-white py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <span className="eyebrow">Your AI growth team</span>
            <h2 className="h-section mt-5">Six specialists.<br />One goal: more customers.</h2>
          </div>
          <p className="lead max-w-lg lg:justify-self-end">
            The work of a strategist, content team, media buyer, SDR and analyst — coordinated, always on, and priced
            for a business your size.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a, i) => {
            const I = a.icon;
            return (
              <Reveal key={a.name} delay={(i % 3) * 80} className="group flex flex-col bg-white p-7 transition-colors hover:bg-paper">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-paper transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-lime">
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
        </div>
      </div>
    </section>
  );
}
