// Starter content so nobody faces a blank page. Everything is editable.

const byGroup: Record<string, string> = {
  restaurant: "local", dentist: "local", salon: "local", gym: "local", realestate: "local",
  creator: "creator", ecommerce: "ecommerce", saas: "saas", agency: "agency",
};

export function starterTemplates(segment: string) {
  const g = byGroup[segment] ?? "local";
  const common = [
    {
      name: "Welcome a new lead", category: "Welcome",
      subject: "Thanks for getting in touch, {{first_name}}",
      body: `Hi {{first_name}},\n\nThanks for reaching out to {{business_name}} — great to hear from you.\n\nWhat's the best way I can help? Just reply to this email, or grab a time that suits you here: {{booking_link|reply and I'll send a few times}}\n\nTalk soon,\n{{sender_name}}`,
    },
    {
      name: "Follow-up (no reply)", category: "Follow-up",
      subject: "Quick follow-up",
      body: `Hi {{first_name}},\n\nJust bumping this up in case it got buried. Is this still something you're interested in?\n\nA one-line reply is perfect.\n\n{{sender_name}}`,
    },
    {
      name: "Book a call", category: "Meetings",
      subject: "15 minutes this week?",
      body: `Hi {{first_name}},\n\nWould a quick 15-minute call help? You can pick any time that works for you here:\n\n{{booking_link|reply with a couple of times that suit you}}\n\nNo prep needed — I'll come with ideas.\n\n{{sender_name}}\n{{business_name}}`,
    },
    {
      name: "Ask for a review", category: "Reputation",
      subject: "Could you do us a small favour, {{first_name}}?",
      body: `Hi {{first_name}},\n\nThank you for choosing {{business_name}}. If you have a minute, a short review would mean the world to a small business like ours.\n\nThanks so much,\n{{sender_name}}`,
    },
  ];
  const specific: Record<string, { name: string; category: string; subject: string; body: string }[]> = {
    local: [
      { name: "Win back past customers", category: "Win-back", subject: "We miss you, {{first_name}}", body: `Hi {{first_name}},\n\nIt's been a while since we saw you at {{business_name}}, and we'd love to welcome you back.\n\nReply to this email and we'll set you up with something special on your next visit.\n\nSee you soon,\n{{sender_name}}` },
      { name: "Seasonal offer", category: "Promotion", subject: "Something special this month at {{business_name}}", body: `Hi {{first_name}},\n\nThis month only, we're running a special for our favourite people in {{city|town}}.\n\nWant me to save you a spot? Just reply YES.\n\n{{sender_name}}` },
    ],
    creator: [
      { name: "Lead magnet delivery", category: "Welcome", subject: "Here's your free guide 🎁", body: `Hi {{first_name}},\n\nAs promised — here's your guide. Start with page 3, it's the quickest win.\n\nOver the next few days I'll send a couple of short emails with the exact steps I use. Hit reply anytime with questions — I read every one.\n\n{{sender_name}}` },
      { name: "Offer launch", category: "Promotion", subject: "Doors are open", body: `Hi {{first_name}},\n\nThe program you've been asking about is open. It's the step-by-step version of everything I share for free — with feedback from me.\n\nReply "IN" and I'll send the details.\n\n{{sender_name}}` },
    ],
    ecommerce: [
      { name: "Abandoned cart", category: "Recovery", subject: "You left something behind", body: `Hi {{first_name}},\n\nYour cart at {{business_name}} is still waiting — and it's still in stock.\n\nAny questions before you check out? Just reply.\n\n{{sender_name}}` },
      { name: "Second purchase", category: "Retention", subject: "A little thank-you, {{first_name}}", body: `Hi {{first_name}},\n\nThanks again for your first order. Here's something just for returning customers — reply and I'll send your code.\n\n{{sender_name}}` },
    ],
    saas: [
      { name: "Cold intro (B2B)", category: "Outreach", subject: "Quick idea for {{company|your team}}", body: `Hi {{first_name}},\n\nI noticed {{company|your team}} is growing fast. Teams like yours usually lose hours every week to this — we built {{business_name}} to fix exactly that.\n\nWorth a 15-minute look? {{booking_link|Happy to send a few times.}}\n\n{{sender_name}}` },
      { name: "Trial check-in", category: "Activation", subject: "How's it going so far?", body: `Hi {{first_name}},\n\nYou signed up a few days ago — what's the one thing you'd like {{business_name}} to do for you? Reply and I'll set it up with you.\n\n{{sender_name}}` },
    ],
    agency: [
      { name: "Agency outreach", category: "Outreach", subject: "More leads for {{company|your business}} this month", body: `Hi {{first_name}},\n\nWe help businesses like {{company|yours}} get more customers without adding headcount. Happy to share a free growth plan tailored to you.\n\nWant it? {{booking_link|Reply and I'll send it over.}}\n\n{{sender_name}}\n{{business_name}}` },
      { name: "Monthly client update", category: "Clients", subject: "Your results this month", body: `Hi {{first_name}},\n\nHere's a quick look at what we did this month and what's next. Reply with any questions.\n\n{{sender_name}}` },
    ],
  };
  return [...common, ...(specific[g] ?? [])];
}

/** A 3-email starter campaign. Empty subject = reply in the same email thread. */
export function starterSequence(segment: string) {
  const t = starterTemplates(segment);
  const first = t.find((x) => x.category === "Outreach" || x.category === "Win-back" || x.category === "Welcome")!;
  return [
    { wait_days: 0, subject: first.subject, body: first.body },
    { wait_days: 3, subject: "", body: `Hi {{first_name}},\n\nJust following up on my note below — would this be helpful for you?\n\n{{sender_name}}` },
    { wait_days: 4, subject: "", body: `Hi {{first_name}},\n\nI don't want to crowd your inbox, so this is my last note for now. If the timing's better later, just reply and I'll pick it up from there.\n\nAll the best,\n{{sender_name}}` },
  ];
}
