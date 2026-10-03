export type Segment = {
  id: string;
  label: string;
  group: "Local business" | "Creator" | "Ecommerce" | "Startup" | "Agency";
  placeholder: string;
  customers: string[];
  opportunities: { title: string; pitch: string; why: string }[];
  campaign: { name: string; channels: string[]; pieces: string[] };
  goal: string;
  days: [string, string, string];
};

export const SEGMENTS: Segment[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    group: "Local business",
    placeholder: "Bella's Trattoria",
    customers: ["Families within 5 km on weekends", "Office teams ordering group lunches", "Couples looking for date-night spots"],
    opportunities: [
      { title: "Weekday lunch for offices", pitch: "Team lunches, sorted — fresh, fast and delivered to your office", why: "High-volume, repeat orders with low ad cost" },
      { title: "Fill slow Tuesday nights", pitch: "Tuesday just became the best night of the week", why: "Tables sit empty — a themed night converts regulars" },
      { title: "Turn reviews into bookings", pitch: "See why our guests keep coming back — and book your table", why: "Answering every review lifts local search ranking" },
    ],
    campaign: { name: "Pasta Tuesdays", channels: ["Instagram", "Google Business", "WhatsApp", "Email"], pieces: ["4 posts + 2 reels", "Google offer", "Regulars' SMS invite", "Office catering outreach"] },
    goal: "More booked tables and repeat visits",
    days: ["Profile, menu and reviews optimized", "First campaign live, catering leads flowing", "Weekly rhythm running on autopilot"],
  },
  {
    id: "dentist",
    label: "Dentist",
    group: "Local business",
    placeholder: "Brightside Dental",
    customers: ["New families moving into the area", "Adults overdue for a check-up", "People researching whitening and aligners"],
    opportunities: [
      { title: "Reactivate overdue patients", pitch: "It's been a while — your next check-up takes just 30 minutes", why: "Cheapest new appointment you'll ever get" },
      { title: "Own 'dentist near me'", pitch: "Friendly, modern dental care right around the corner", why: "Local search drives most new-patient calls" },
      { title: "Promote high-value treatments", pitch: "The smile you've always wanted, with a plan that fits your budget", why: "Aligners and implants carry the best margins" },
    ],
    campaign: { name: "Smile Season", channels: ["Google Business", "Email", "SMS", "Facebook"], pieces: ["Recall email + SMS sequence", "Whitening offer page", "3 educational posts", "Review request flow"] },
    goal: "More new-patient bookings each month",
    days: ["Recall list cleaned and messaged", "Treatment landing page and ads live", "Booking follow-ups fully automated"],
  },
  {
    id: "salon",
    label: "Salon",
    group: "Local business",
    placeholder: "Studio Nine Hair",
    customers: ["Clients due for a rebook", "Brides and event parties", "Locals searching for colour specialists"],
    opportunities: [
      { title: "Automatic rebooking", pitch: "Keep your look fresh — your next appointment is one tap away", why: "Most clients forget — reminders fill the chair" },
      { title: "Show your work", pitch: "Real clients, real transformations", why: "Before/after reels are your best salesperson" },
      { title: "Bridal packages", pitch: "Look and feel your best on the big day — for the whole bridal party", why: "One booking brings a whole party" },
    ],
    campaign: { name: "Fresh Season Colour", channels: ["Instagram", "TikTok", "SMS", "Google Business"], pieces: ["3 before/after reels", "Rebook SMS", "Bridal package page", "Stylist spotlight posts"] },
    goal: "A fuller book, week after week",
    days: ["Portfolio content engine running", "Rebook reminders live for all clients", "Bridal leads captured and followed up"],
  },
  {
    id: "gym",
    label: "Gym / Studio",
    group: "Local business",
    placeholder: "Forge Fitness",
    customers: ["New-year and new-season starters", "Lapsed members", "Busy professionals near the studio"],
    opportunities: [
      { title: "Free-trial to member", pitch: "Try your first class free and feel the difference", why: "Speed of follow-up decides conversion" },
      { title: "Win back lapsed members", pitch: "We miss you — come back and pick up right where you left off", why: "They already know you and trust you" },
      { title: "Referral challenge", pitch: "Bring a friend, and you both train free for a week", why: "Members bring friends when there's a reason" },
    ],
    campaign: { name: "30-Day Kickstart", channels: ["Instagram", "Meta Ads", "WhatsApp", "Email"], pieces: ["Trial landing page", "Ad set with 3 creatives", "Trial nurture sequence", "Member referral posts"] },
    goal: "More trials turned into memberships",
    days: ["Trial offer and page live", "Every trial followed up within minutes", "Referral loop and win-backs running"],
  },
  {
    id: "realestate",
    label: "Real estate agent",
    group: "Local business",
    placeholder: "Harbor Realty",
    customers: ["First-time buyers researching neighbourhoods", "Homeowners curious about their value", "Relocating families"],
    opportunities: [
      { title: "Home valuation magnet", pitch: "Curious what your home is worth? Get a free, no-pressure valuation", why: "Every request is a potential listing" },
      { title: "Neighbourhood authority", pitch: "Everything you need to know before you move to the neighbourhood", why: "Local guides earn trust and search traffic" },
      { title: "Nurture long-cycle buyers", pitch: "Your home search, made simple — new listings every week", why: "Most buyers take months — stay top of mind" },
    ],
    campaign: { name: "What's My Home Worth?", channels: ["Facebook", "Instagram", "Email", "YouTube"], pieces: ["Valuation landing page", "Neighbourhood guide video", "Market update email", "Just-listed posts"] },
    goal: "More listing appointments and buyer leads",
    days: ["Valuation funnel live", "Weekly market content publishing", "Leads scored and nurtured to calls"],
  },
  {
    id: "creator",
    label: "Creator / Coach",
    group: "Creator",
    placeholder: "Maya Runs",
    customers: ["Followers who engage but haven't bought", "People searching your topic on YouTube", "Past clients ready for the next step"],
    opportunities: [
      { title: "Turn followers into an email list", pitch: "Grab the free starter guide and get results faster", why: "You own the list — not the algorithm" },
      { title: "Launch a signature offer", pitch: "The step-by-step program you've been asking for", why: "Your audience keeps asking the same question" },
      { title: "Repurpose every video", pitch: "Quick wins you can use today", why: "One long video becomes 15 pieces" },
    ],
    campaign: { name: "Free Starter Guide", channels: ["YouTube", "Instagram", "LinkedIn", "Email"], pieces: ["Lead magnet + opt-in page", "10 clips from 1 video", "5-email welcome series", "Discovery-call booking flow"] },
    goal: "A growing list that buys your offers",
    days: ["Lead magnet and opt-in live", "Repurposing engine publishing daily", "Offer launch sequence ready"],
  },
  {
    id: "ecommerce",
    label: "Shopify / DTC",
    group: "Ecommerce",
    placeholder: "Kindred Candles",
    customers: ["Gift shoppers before holidays", "First-time buyers who didn't return", "Lookalikes of your top customers"],
    opportunities: [
      { title: "Recover abandoned carts", pitch: "You left something behind — it's still waiting for you", why: "Revenue already on the table" },
      { title: "Second-purchase flow", pitch: "Loved your first order? Here's something just for you", why: "Repeat buyers are the real profit" },
      { title: "UGC-led ads", pitch: "Don't take our word for it — see what customers are saying", why: "Real customers outsell polished creative" },
    ],
    campaign: { name: "Gift Season Drop", channels: ["Meta Ads", "TikTok", "Email", "SMS"], pieces: ["Cart recovery flow", "3 UGC-style ads", "Gift guide landing page", "VIP early-access email"] },
    goal: "Higher repeat rate and profitable ad spend",
    days: ["Core email flows switched on", "Creative testing live on 2 channels", "Winning ads scaled, losers cut"],
  },
  {
    id: "saas",
    label: "SaaS / Startup",
    group: "Startup",
    placeholder: "Loopdesk",
    customers: ["Teams searching for your category", "Users of competing tools", "Founders in your niche communities"],
    opportunities: [
      { title: "Comparison pages", pitch: "Switch in minutes and get more done for less", why: "High-intent searchers are choosing right now" },
      { title: "Founder-led LinkedIn", pitch: "Here's what we've learned building this — and how it helps you", why: "Trust travels faster than ads early on" },
      { title: "Trial activation emails", pitch: "Get your first win in the next 10 minutes", why: "Most signups never see the aha moment" },
    ],
    campaign: { name: "Switch & Save", channels: ["LinkedIn", "Search", "Email", "Product Hunt"], pieces: ["3 'vs' comparison pages", "12 founder posts", "Trial onboarding sequence", "Outbound to 150 ICP accounts"] },
    goal: "More qualified trials and paid conversions",
    days: ["ICP and messaging defined", "SEO pages and LinkedIn cadence live", "Outbound + activation loop running"],
  },
  {
    id: "agency",
    label: "Agency",
    group: "Agency",
    placeholder: "Northpoint Digital",
    customers: ["Your clients' customers — across every account", "Prospects who need what you deliver", "Past clients due for upsell"],
    opportunities: [
      { title: "Run 10× the clients per strategist", pitch: "More growth for every client, without adding headcount", why: "Growvia handles execution per account" },
      { title: "White-label reporting", pitch: "Clear results reports your clients will actually read", why: "Clients see results, not busywork" },
      { title: "Productize your services", pitch: "Growth retainers with clear deliverables and faster results", why: "Package Growvia-powered retainers" },
    ],
    campaign: { name: "Multi-client rollout", channels: ["All client channels", "Client portal", "Email", "Slack"], pieces: ["Plan per client in minutes", "Approval workflows", "Branded weekly reports", "Agency lead-gen for yourself"] },
    goal: "More clients served, better margins",
    days: ["Clients onboarded, plans generated", "Approvals and publishing streamlined", "Reports automated, margins up"],
  },
];
