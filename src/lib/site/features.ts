import { SITE_URL } from "../config";

/* Marketing-site content for each product area. Only describe what Growvia actually does today. */

export type Feature = {
  slug: string;
  name: string;
  icon: "search" | "sparkles" | "mail" | "inbox" | "whatsapp" | "image" | "form" | "calendar" | "users" | "clapper";
  short: string; // one line for cards
  title: string; // <title> / H1
  intro: string;
  keywords: string[];
  points: { title: string; body: string }[];
  steps: string[];
  inApp: string[]; // concrete things you'll see in the app
  faq: [string, string][];
  related: string[];
};

export const FEATURES: Feature[] = [
  {
    slug: "seo",
    name: "SEO audits & rankings",
    icon: "search",
    short: "Crawl your site, fix what matters, and track Google rankings over time.",
    title: "SEO audits, keyword rankings and reports — explained in plain English",
    intro: "Add your website and Growvia crawls it like Google does, scores it, tells you exactly what to fix first, and keeps checking every week so you can see your SEO improve over time.",
    keywords: ["SEO audit tool", "keyword rank tracker", "Search Console reports", "small business SEO", "SEO report for clients"],
    points: [
      { title: "A real site audit", body: "Up to 25 pages crawled: titles, descriptions, headings, broken links, redirects, canonicals, schema, images, sitemap and robots.txt — with every issue ranked by impact." },
      { title: "Speed & Core Web Vitals", body: "Google PageSpeed on mobile and desktop, including real-user Chrome data where Google has it." },
      { title: "Keyword rankings over time", body: "Connect Google Search Console and get 90 days of positions, clicks and impressions per keyword instantly, refreshed daily. Optional exact live positions via SerpApi or DataForSEO." },
      { title: "Keyword ideas that are close to winning", body: "Suggestions from your own Search Console data (\"almost on page 1\"), Google autocomplete and AI — track any of them in one click." },
      { title: "A panel of AI experts", body: "Technical SEO, content, AI search, local SEO and conversion specialists each grade your site and give prioritised fixes. Clearly labelled as AI." },
      { title: "Reports you can send", body: "Weekly, monthly or any date range, with charts for score, clicks, impressions and positions. Share a link, download a PDF, or email it automatically." },
    ],
    steps: ["Add your website", "Run the first audit (about a minute)", "Connect Search Console for rankings", "Fix the top items — Growvia re-checks on schedule and emails you when something changes"],
    inApp: ["SEO score trend chart", "Issues grouped by severity", "Ready-to-paste titles & descriptions", "robots.txt, llms.txt and JSON-LD schema generated for you", "Score-drop and new-critical-issue email alerts"],
    faq: [
      ["Do I need to know SEO?", "No. Every issue comes with what it means, why it matters and exactly what to change. The plan is ordered so you do the most valuable fixes first."],
      ["Where do the rankings come from?", "From your own Google Search Console — the most accurate source for your site, and free. If you want exact live positions for any keyword, you can add a SerpApi or DataForSEO key."],
      ["Can I send reports to clients?", "Yes. Every project has shareable report links, a PDF version and scheduled report emails to any address."],
    ],
    related: ["ai-search", "agencies", "forms"],
  },
  {
    slug: "ai-search",
    name: "AI search visibility (GEO)",
    icon: "sparkles",
    short: "See whether ChatGPT, Gemini and Perplexity recommend you — and how to get mentioned.",
    title: "AI search visibility: find out if ChatGPT, Gemini and Perplexity recommend your business",
    intro: "More customers now ask AI assistants instead of searching. Growvia asks those assistants the questions your customers ask, records who gets recommended, and shows you how to become the answer.",
    keywords: ["generative engine optimization", "GEO tool", "AI SEO", "ChatGPT visibility", "AI search tracking", "llms.txt generator"],
    points: [
      { title: "The questions your customers ask", body: "Add them yourself or let Growvia suggest realistic ones for your business and city." },
      { title: "Checked on real AI engines", body: "Google Gemini with live Google Search, plus Perplexity and ChatGPT with web search when you add their keys." },
      { title: "Mentioned, ranked, cited", body: "For every answer: were you mentioned, in what position, was your website cited, which competitors were named, and the sentiment." },
      { title: "Share of voice & trends", body: "Your share of AI recommendations against competitors, charted over time, plus the websites AI cites most in your market." },
      { title: "AI-readiness of every page", body: "Checks that AI crawlers (GPTBot, PerplexityBot, ClaudeBot, Google-Extended…) are allowed, and scores each page for how easy it is for AI to understand and quote." },
      { title: "Files AI assistants read", body: "Generates llms.txt, AI-friendly robots.txt rules and structured data for you to upload." },
    ],
    steps: ["Pick or accept suggested questions", "Growvia runs them on AI engines on your schedule", "See who gets recommended and why", "Apply the fixes and watch your share of voice move"],
    inApp: ["AI visibility trend chart", "Competitor mentions", "Cited sources", "Email alert when your AI visibility changes by 10+ points"],
    faq: [
      ["What is GEO?", "Generative Engine Optimisation — making your business the one AI assistants mention and link to. It builds on SEO but adds things like clear facts, FAQs, structured data and letting AI crawlers in."],
      ["Which AI engines are checked?", "Google Gemini (with Google Search grounding) is included. Perplexity and ChatGPT are checked too if you add their API keys."],
      ["Will this guarantee AI mentions?", "No tool can guarantee that. Growvia measures where you stand, shows what the recommended businesses have in common, and tracks whether your changes work."],
    ],
    related: ["seo", "agencies", "social"],
  },
  {
    slug: "email",
    name: "Email studio",
    icon: "mail",
    short: "AI-written emails and campaigns sent from your own mailbox, with replies in one inbox.",
    title: "Email marketing that writes itself — sent from your own mailbox",
    intro: "Connect Gmail, Outlook or any mailbox. Growvia writes the emails, sends them on your schedule, follows up automatically, and stops the moment someone replies.",
    keywords: ["AI email writer", "cold email follow up", "email sequences", "email marketing small business", "email campaigns from Gmail"],
    points: [
      { title: "Write with AI, everywhere", body: "Describe the email and get three different options, or let AI improve your draft. On a lead's page it uses what you know about them." },
      { title: "Whole campaigns in one step", body: "Describe the goal — Growvia writes every email in the sequence and the timing between them. You review, then launch." },
      { title: "One email to many people", body: "Send to one person, a tag, a pipeline stage or everyone — now or at a time you choose. Unsubscribed and bounced addresses are skipped automatically." },
      { title: "Follow-ups that stop on reply", body: "Sending days and hours, daily limits per mailbox, same-thread follow-ups, and automatic stop when a lead replies." },
      { title: "Personal at scale", body: "Merge fields with fallbacks ({{first_name}}, {{company|your team}}), your signature, a booking link, and a one-click unsubscribe in every email." },
      { title: "Know what worked", body: "Opens, clicks, replies and bounces per email and per step." },
    ],
    steps: ["Connect your mailbox (Gmail, Outlook, Zoho or any SMTP/IMAP)", "Write with AI or start from a template", "Choose who gets it and when", "Replies land in your Growvia inbox"],
    inApp: ["Campaigns · Write & send · Templates · Replies · Mailboxes", "Starter templates for your type of business", "Scheduled sends you can cancel", "Reply alerts by email"],
    faq: [
      ["Why send from my own mailbox?", "Emails from your real address land in inboxes more often, and replies come straight back to you. Growvia syncs those replies into your inbox and stops follow-ups automatically."],
      ["Is there a sending limit?", "You set a daily limit per mailbox to protect your reputation. Bigger sends go out automatically over the following days."],
      ["Can I unsubscribe people?", "Every email has an unsubscribe link, and unsubscribed or bounced leads are never emailed again unless you re-subscribe them."],
    ],
    related: ["inbox", "forms", "meetings"],
  },
  {
    slug: "inbox",
    name: "One inbox",
    icon: "inbox",
    short: "Email, WhatsApp, Instagram and Messenger conversations in one place.",
    title: "One inbox for email, WhatsApp, Instagram DMs and Facebook Messenger",
    intro: "Stop switching between apps. Every conversation with a lead — whichever channel they used — shows up in one inbox, linked to their lead record, so nobody gets forgotten.",
    keywords: ["shared inbox", "WhatsApp and Instagram inbox", "unified inbox small business", "Messenger inbox"],
    points: [
      { title: "Every channel", body: "Email replies, WhatsApp chats, Instagram DMs and Facebook Messenger, threaded and searchable." },
      { title: "Linked to the lead", body: "Each conversation is attached to the person in Leads, with their stage, tags, notes and history." },
      { title: "Reply from Growvia", body: "Answer on the same channel. WhatsApp's 24-hour window is handled for you — outside it Growvia offers your approved templates." },
      { title: "Never miss a reply", body: "Unread counts in the sidebar, plus an email alert to you and your team when a lead replies." },
    ],
    steps: ["Connect your mailbox, WhatsApp number and Facebook/Instagram", "Conversations start flowing in", "Reply, assign a stage, move on"],
    inApp: ["Channel filters", "Delivered/read ticks for WhatsApp", "Open/closed status", "Reply alerts for the team"],
    faq: [
      ["Do my teammates see the inbox?", "Yes — invite them as Members and they work in the same inbox. Viewers can read but not reply."],
      ["Which Instagram accounts work?", "Instagram professional (business or creator) accounts connected to a Facebook Page."],
    ],
    related: ["whatsapp", "email", "agencies"],
  },
  {
    slug: "whatsapp",
    name: "WhatsApp Business",
    icon: "whatsapp",
    short: "WhatsApp chats, approved templates and broadcasts to opted-in customers.",
    title: "WhatsApp Business messaging: chats, templates and broadcasts",
    intro: "Connect your WhatsApp Business number through Meta's official Cloud API. Chat with customers from Growvia, create message templates, and send broadcasts to people who opted in.",
    keywords: ["WhatsApp Business API", "WhatsApp broadcast", "WhatsApp templates", "WhatsApp CRM"],
    points: [
      { title: "Official Cloud API", body: "Uses Meta's WhatsApp Cloud API — no unofficial apps or phone emulation." },
      { title: "Template builder", body: "Create templates with variables, buttons and footers in Growvia and submit them to Meta. Status and rejection reasons sync back in plain English." },
      { title: "Broadcasts that respect consent", body: "Send approved templates to leads who agreed to WhatsApp messages. Opt-in is recorded on each lead and can come from your website form." },
      { title: "Live chats", body: "Incoming messages land in the shared inbox with delivered and read ticks." },
    ],
    steps: ["Connect your number (Meta Business account needed)", "Create or sync templates", "Chat and broadcast from Growvia"],
    inApp: ["Template status tracking", "Broadcast results per contact", "WhatsApp opt-in checkbox on forms"],
    faq: [
      ["Do I need Meta approval?", "WhatsApp Business numbers and templates are approved by Meta. Some accounts need Meta Business Verification before they can create templates — Growvia explains any restriction Meta applies."],
      ["Can I message anyone?", "You can reply freely within 24 hours of a customer's message. To start a conversation you need an approved template and the person's consent."],
    ],
    related: ["inbox", "forms", "social"],
  },
  {
    slug: "social",
    name: "AI social posts & images",
    icon: "image",
    short: "AI captions, on-brand images and a week of posts — published to Facebook & Instagram.",
    title: "AI social media posts and images, planned and published for you",
    intro: "Tell Growvia what the post is about and it writes the caption, hashtags and a matching image. Or ask it to plan the whole week. Publish to Facebook and Instagram now or on a schedule.",
    keywords: ["AI social media post generator", "AI Instagram captions", "social media image generator", "schedule Instagram posts", "social media planner"],
    points: [
      { title: "Captions in your voice", body: "Three different options with hashtags, written for the networks you post to and your business's tone." },
      { title: "On-brand images in seconds", body: "Bold, minimal, quote or photo layouts, six colour sets and four sizes (square, portrait, story, wide). Optionally with an AI-generated photo." },
      { title: "Plan a week in one click", body: "Growvia plans 3–7 posts across useful themes, with captions and images, at good times in your time zone — saved as drafts or scheduled." },
      { title: "Publish everywhere at once", body: "Facebook Pages and Instagram: photos, carousels, videos and text posts, now or scheduled. Download images to use anywhere else." },
    ],
    steps: ["Connect Facebook and Instagram (optional for drafts)", "Write with AI or plan the week", "Review, tweak and schedule"],
    inApp: ["Live post preview", "Drafts you can edit", "Scheduled queue with results and links", "Retry for failed posts"],
    faq: [
      ["Do the images use my photos?", "You can upload your own photos and videos, create branded designs, or add an AI-generated photo. You always see the image before anything is posted."],
      ["Which networks can it publish to?", "Facebook Pages and Instagram professional accounts today. For other networks, download the image and caption and post them yourself."],
    ],
    related: ["seo", "email", "agencies"],
  },
  {
    slug: "ads",
    name: "Ad studio: ad copy & video ads",
    icon: "clapper",
    short: "Paste a website — get Google, Meta, LinkedIn and X ad copy plus short video ads with AI voice.",
    title: "AI ad copy and short video ads, made from your website",
    intro: "Give Growvia a website or landing page. It reads it, writes a creative brief, then produces ready-to-run ad copy for every major platform and short video ads with an AI voice-over, an illustrated presenter and music — free, rendered right in your browser.",
    keywords: ["AI ad copy generator", "Google ads headlines generator", "Facebook ad copy", "AI video ad maker", "text to video ads", "AI voice over"],
    points: [
      { title: "Starts from your website", body: "Growvia reads the page, copies its photos and logo, and writes a brief — what you sell, who to target, selling points and the best call to action. You can edit it." },
      { title: "Ad copy that fits every limit", body: "Google Search (15 headlines, 4 descriptions, keywords, negatives, sitelinks), Facebook & Instagram, LinkedIn, X and display banners — trimmed to each platform's character limits, with live counters when you edit." },
      { title: "A story, scene by scene", body: "Pick 15–60 seconds, a format (9:16, 1:1, 16:9) and a style — problem → solution, offer, explainer, customer story or behind the scenes. Edit every line and choose a photo per scene." },
      { title: "30 AI voices", body: "Hear a sample, pick a voice, and Growvia records the voice-over. Scene timing follows the voice automatically." },
      { title: "Presenters that lip-sync", body: "Six original illustrated presenters, small in a corner or large on screen, with captions that highlight each spoken word." },
      { title: "Export and post", body: "Rendered in your browser with original background music. Download it, or send it straight to Publish as a Facebook/Instagram draft." },
    ],
    steps: ["Paste your website", "Write the ads and the video story", "Pick a voice, presenter and music", "Export — then download or post"],
    inApp: ["Google ad preview", "Meta ad previews with image designer", "Copy buttons for every ad", "Canvas preview with seek bar"],
    faq: [
      ["Is it really free?", "The Free plan includes 1 video a month with a small “Made with Growvia” mark; Pro includes 20 a month without it (Growth 60, Agency 200). Videos are rendered in your own browser, so there are no per-video rendering fees."],
      ["Are the presenters real people?", "No — they're original illustrated characters that move their lips to the voice-over. Realistic human avatars need a paid provider and may come later."],
      ["Which video formats do I get?", "MP4 in Chrome and Safari (ready for Facebook and Instagram), or WebM in browsers that can't record MP4 (fine for YouTube, LinkedIn and TikTok)."],
    ],
    related: ["social", "seo", "email"],
  },
  {
    slug: "forms",
    name: "Website forms & leads",
    icon: "form",
    short: "A form for every site that sends each enquiry into your pipeline, with instant replies.",
    title: "Website lead forms that send every enquiry into your pipeline",
    intro: "Build a contact form in Growvia and put it on any website — WordPress, Wix, Webflow, Shopify, Squarespace or plain HTML. Every enquiry becomes a lead, your team is alerted, and the visitor gets an instant reply.",
    keywords: ["website lead form", "embed contact form", "lead capture form", "simple CRM", "lead pipeline"],
    points: [
      { title: "Add it anywhere", body: "One script tag (the form resizes itself), an iframe, your own HTML form, or a hosted link for your bio." },
      { title: "Know where leads came from", body: "Each lead records the page, the referring site and the campaign's UTM tags, so you can see which posts and ads bring enquiries." },
      { title: "Instant follow-up", body: "An automatic reply to the visitor from your business, plus an email alert to you and your team." },
      { title: "Spam kept out", body: "Hidden bot traps, rate limits and an optional Cloudflare Turnstile check." },
      { title: "A pipeline that's simple", body: "New → Contacted → Qualified → Won/Lost, with deal values, tags, notes, CSV import/export and a timeline for every lead." },
    ],
    steps: ["Customise the fields and texts (or let AI write them)", "Copy the embed code onto your site", "Enquiries appear in Leads — reply by email or WhatsApp"],
    inApp: ["Board and list views", "Duplicate-safe (same email updates the lead)", "Bulk tag, stage, email or add to a campaign"],
    faq: [
      ["Will it slow my site down?", "No. The script is tiny and the form loads in a lightweight frame after your page."],
      ["Can each client site have its own form?", "Yes — every project can have as many forms as it needs, each feeding that project's leads."],
    ],
    related: ["email", "inbox", "meetings"],
  },
  {
    slug: "meetings",
    name: "Booking page",
    icon: "calendar",
    short: "A booking link that sends calendar invites and adds the person to Leads.",
    title: "A free booking page for calls, consultations and appointments",
    intro: "Share one link and let people pick a time that suits you. Growvia sends the calendar invite, adds them to Leads, and alerts your team.",
    keywords: ["free booking page", "appointment scheduling", "meeting booking link"],
    points: [
      { title: "Your hours, your rules", body: "Working days and hours, meeting length (15–90 minutes), location and time zone." },
      { title: "Invites that just work", body: "Calendar invites by email from your own mailbox." },
      { title: "Straight into your pipeline", body: "Every booking creates or updates a lead, so follow-up is never missed." },
      { title: "Works inside your emails", body: "Add {{booking_link}} to any email or campaign." },
    ],
    steps: ["Set your availability", "Share the link or put it in emails", "Bookings arrive with an alert"],
    inApp: ["Upcoming meetings", "Meeting-booked email alerts"],
    faq: [["Does it cost extra?", "No — it's part of Growvia."]],
    related: ["email", "forms", "inbox"],
  },
  {
    slug: "agencies",
    name: "Teams & agencies",
    icon: "users",
    short: "Workspaces per client, team roles, per-client access and automatic alerts.",
    title: "Growvia for agencies and teams: every client in one place",
    intro: "Run growth for many businesses from one account. Each client gets its own workspace and projects; your team gets exactly the access they need; reports and alerts go out automatically.",
    keywords: ["marketing agency software", "client workspaces", "SEO reports for agencies", "team roles marketing tool"],
    points: [
      { title: "Workspaces & projects", body: "A workspace per client, a project per brand or location, and a switcher to jump between them without losing your place." },
      { title: "Roles that make sense", body: "Admin (everything, including team and connections), Member (does the work) and Viewer (read-only dashboards and reports)." },
      { title: "Per-client access", body: "Give a freelancer or a client access to only their workspace — they won't see anyone else's leads or data." },
      { title: "Alerts for everyone", body: "New leads, replies, bookings, SEO changes, keyword moves, AI-visibility shifts and a Monday summary — each person picks what they receive." },
      { title: "Client-ready reports", body: "Shareable SEO and AI-visibility reports with charts, as links, PDFs or scheduled emails." },
    ],
    steps: ["Create a workspace per client", "Invite your team by email and set their access", "Run SEO, content, email and social for each client"],
    inApp: ["Settings split into project and account", "Invite, resend, change role or remove", "View-only banner for viewers"],
    faq: [
      ["Is each client's data separate?", "Yes. Access is enforced by the database itself (row-level security), not just hidden in the interface."],
      ["Can clients see their own results?", "Invite them as Viewers limited to their workspace, or send them report links and scheduled report emails."],
      ["How many clients can I manage?", "Free covers one business. Pro covers 10 projects (client sites or businesses), Growth 25 and Agency 75 — and above that we set up custom limits and volume pricing."],
    ],
    related: ["seo", "ai-search", "inbox"],
  },
];

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug);

export const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "team.usegrowvia@gmail.com";

export const CHANNELS_LIVE = ["Gmail, Outlook & any mailbox", "WhatsApp Business", "Instagram", "Facebook Pages & Messenger", "Google Search Console", "Google PageSpeed", "Gemini, ChatGPT & Perplexity", "Any website (forms)"];

/** Public site address for canonical links, sitemap and structured data. */
export const SITE = SITE_URL || "https://usegrowvia.com";
