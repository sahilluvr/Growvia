import { SEGMENTS } from "./plans";
import type { BusinessInput, GrowthPlan, NewContent, Opportunity } from "./data/types";

/**
 * Growvia's growth engine (rules-based v1).
 * Produces a plan and ready-to-edit campaign content from the business profile.
 * Swap the internals for an LLM call later — the inputs/outputs stay the same.
 */

export const ALL_CHANNELS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Google Business", "Email", "SMS", "WhatsApp", "Meta Ads"] as const;

export const GOALS = [
  "Get more customers",
  "Get more bookings / appointments",
  "Increase online sales",
  "Generate more leads",
  "Build my audience",
  "Win back past customers",
];

export function segmentOf(id: string) {
  return SEGMENTS.find((s) => s.id === id) ?? SEGMENTS[0];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const lc = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function localize(text: string, city?: string | null) {
  if (!city) return text;
  return text.replace("the area", city).replace("within 5 km", `in ${city}`).replace("near the studio", `in ${city}`);
}

export function defaultChannels(segmentId: string): string[] {
  const seg = segmentOf(segmentId);
  const known = seg.campaign.channels.filter((c) => (ALL_CHANNELS as readonly string[]).includes(c));
  return known.length ? known : ["Instagram", "Email", "Google Business"];
}

export function buildPlan(b: BusinessInput): GrowthPlan {
  const seg = segmentOf(b.segment);
  const channels = b.channels.length ? b.channels : defaultChannels(b.segment);
  const customers = [
    ...(b.audience ? [b.audience] : []),
    ...seg.customers.map((c) => localize(c, b.city)),
  ].slice(0, 4);
  const opportunities: Opportunity[] = seg.opportunities.map((o) => ({ id: slug(o.title), title: o.title, why: o.why, pitch: o.pitch }));
  if (b.offer) opportunities.unshift({ id: "hero-offer", title: `Promote “${b.offer}”`, why: "Your headline offer should be the first thing new customers see", pitch: b.offer });
  const goal = b.goal || seg.goal;
  const where = b.city ? ` in ${b.city}` : "";
  return {
    generatedAt: new Date().toISOString(),
    summary: `Reach ${lc(customers[0] ?? "your best customers")}${customers[0]?.includes(b.city ?? "\u0000") ? "" : where}, lead with ${opportunities[0].id === "hero-offer" ? `your offer — “${b.offer}”` : lc(opportunities[0].title)}, and show up every week on ${list(channels.slice(0, 3))} — to ${lc(goal)}.`,
    customers,
    opportunities: opportunities.slice(0, 4),
    priorities: [
      { agent: "Strategist", title: `Launch your first campaign: ${opportunities[0].title}` },
      { agent: "Creator", title: "Review and approve this week's content" },
      { agent: "Distributor", title: `Schedule posts on ${channels.slice(0, 2).join(" and ")}` },
      { agent: "Lead Finder", title: "Share your lead form link on your website and bio" },
      { agent: "Closer", title: "Reply to every new lead within 24 hours" },
    ],
    roadmap: seg.days.map((text, i) => ({ day: [1, 10, 30][i], text })),
    channels,
  };
}

type Tone = { hi: string; cta: string; sign: string };
function tone(voice?: string | null): Tone {
  switch (voice) {
    case "Professional":
      return { hi: "", cta: "Book your appointment today.", sign: "Kind regards" };
    case "Bold":
      return { hi: "Stop scrolling. ", cta: "Don't miss it — grab yours now.", sign: "See you soon" };
    case "Playful":
      return { hi: "Guess what? ", cta: "Come say hi — you'll love it.", sign: "Cheers" };
    default:
      return { hi: "", cta: "Tap the link to get started.", sign: "Warmly" };
  }
}

function piece(channel: string, n: number, ctx: { name: string; city: string; offer: string; opp: Opportunity; t: Tone; tag: string }): NewContent {
  const { name, city, offer, opp, t, tag } = ctx;
  const inCity = city ? ` in ${city}` : "";
  // Customer-facing message: the opportunity's pitch, backed by the business's offer when it differs.
  const pitch = opp.pitch || offer || `Something new at ${name}`;
  const extra = offer && offer !== pitch ? ` ${offer}.` : "";
  const cityTag = city ? ` #${slug(city).replace(/-/g, "")}` : "";
  switch (channel) {
    case "Instagram":
      return n === 0
        ? { channel, kind: "Post", title: `${opp.title} — feed post`, body: `${t.hi}${pitch} ✨\n\nAt ${name}${inCity}, we make it easy.${extra}\n\n${t.cta} Link in bio.\n\n#${tag}${cityTag} #supportlocal` }
        : { channel, kind: "Reel script", title: `${opp.title} — 20s reel`, body: `HOOK (0–3s): "${t.hi}Here's why people${inCity} keep coming back to ${name}."\nSHOT 2 (3–10s): Behind the scenes — the team, the space, the product.\nSHOT 3 (10–17s): Happy customer moment + on-screen text: "${pitch}"\nCTA (17–20s): "${t.cta}"\n\nCaption: ${pitch}.${extra} #${tag}${cityTag}` };
    case "Facebook":
      return { channel, kind: "Post", title: `${opp.title} — community post`, body: `${t.hi}Neighbours${inCity} — this one's for you.\n\n${pitch}.${extra}\n\nComment "INFO" and we'll send you the details. ${t.cta}\n\n— ${name}` };
    case "TikTok":
      return { channel, kind: "Video script", title: `${opp.title} — TikTok`, body: `On-screen text: "POV: you just found ${name}${inCity}"\nClip 1: Quick reveal of your best product or result.\nClip 2: Text card — "${pitch}"\nClip 3: Real customer reaction.\nVoiceover CTA: "${t.cta}"` };
    case "LinkedIn":
      return { channel, kind: "Post", title: `${opp.title} — founder post`, body: `${t.hi}${pitch}.\n\nAt ${name}, we kept hearing the same thing from customers — so we built around it.${extra}\n\nIf that sounds useful, comment or send me a message. Happy to help.` };
    case "YouTube":
      return { channel, kind: "Video outline", title: `${opp.title} — YouTube video`, body: `Title: "${pitch}"\n1. Hook — the problem your viewers face\n2. What most people get wrong\n3. How ${name} does it (walkthrough)\n4. ${offer ? `Offer: ${offer}` : "Invite viewers to get in touch"}\n5. CTA — link to your lead form in the description` };
    case "Google Business":
      return { channel, kind: "Offer update", title: `${opp.title} — Google update`, body: `${pitch} — at ${name}${inCity}.${extra}\nLimited availability this month.\nButton: "Book" / "Call now"` };
    case "Email":
      return { channel, kind: "Email", title: `Subject: ${pitch}`, body: `Hi {first_name},\n\n${t.hi}${pitch}.\n\n${offer ? `Here's what we've got for you: ${offer}.\n\n` : ""}${t.cta}\n\n${t.sign},\nThe ${name} team` };
    case "SMS":
      return { channel, kind: "SMS", title: `${opp.title} — SMS`, body: `${name}: ${pitch}.${extra} ${t.cta} Reply STOP to opt out.` };
    case "WhatsApp":
      return { channel, kind: "Broadcast", title: `${opp.title} — WhatsApp`, body: `Hi {first_name} 👋 It's ${name}. ${pitch}.${extra} Want us to save you a spot? Just reply YES.` };
    case "Meta Ads":
      return { channel, kind: "Ad", title: `${opp.title} — ad`, body: `Primary text: ${t.hi}${pitch}. ${name}${inCity} makes it easy.\nHeadline: ${offer || pitch}\nDescription: ${t.cta}\nTargeting: people${inCity} interested in ${tag}\nButton: Learn more` };
    default:
      return { channel, kind: "Post", title: `${opp.title} — ${channel}`, body: `${pitch} — at ${name}.${extra} ${t.cta}` };
  }
}

export function buildCampaign(b: BusinessInput, opp: Opportunity) {
  const channels = (b.channels.length ? b.channels : defaultChannels(b.segment)).slice(0, 4);
  const ctx = { name: b.name, city: b.city ?? "", offer: b.offer ?? "", opp, t: tone(b.voice), tag: slug(segmentOf(b.segment).label).replace(/-/g, "") };
  const items: NewContent[] = [];
  channels.forEach((ch) => {
    items.push(piece(ch, 0, ctx));
    if (ch === "Instagram") items.push(piece(ch, 1, ctx));
  });
  return { name: opp.title, objective: opp.why, channels, items };
}
