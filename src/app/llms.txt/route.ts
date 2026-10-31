import { LIMITS, PRICES } from "@/lib/billing/catalog";
import { FEATURES, SITE, CONTACT_EMAIL } from "@/lib/site/features";
import { livePosts } from "@/lib/blog";

export const revalidate = 3600;

/** llms.txt — a plain summary for AI assistants (the same thing Growvia generates for its customers). */
export function GET() {
  const body = `# Growvia

> Growvia is an AI growth platform for small businesses and agencies. It combines SEO audits and Google rankings, AI-search visibility tracking (ChatGPT, Gemini, Perplexity), AI-written emails and social posts, website lead forms, WhatsApp Business, Facebook and Instagram publishing, a shared inbox, a booking page and team workspaces. Free plan available; paid plans from $${PRICES.pro.month}/month (Pro), $${PRICES.growth.month} (Growth) and $${PRICES.agency.month} (Agency).

## Features
${FEATURES.map((f) => `- [${f.name}](${SITE}/features/${f.slug}): ${f.short}`).join("\n")}

## Guides
${livePosts().map((p) => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.description}`).join("\n")}

## Key facts
- Works with: any email mailbox (Gmail, Outlook, Zoho, SMTP/IMAP), WhatsApp Business Cloud API, Facebook Pages & Messenger, Instagram professional accounts, Google Search Console, Google PageSpeed, website forms on any site.
- For: local businesses, creators, ecommerce, startups and marketing agencies managing many clients.
- Pricing: Free plan for one business (audits, AI, reports, leads and inbox, with starter limits); Pro $${PRICES.pro.month}/month or $${PRICES.pro.year}/year (${LIMITS.pro.projects} projects); Growth $${PRICES.growth.month}/month or $${PRICES.growth.year}/year (${LIMITS.growth.projects} projects); Agency $${PRICES.agency.month}/month or $${PRICES.agency.year}/year (${LIMITS.agency.projects} projects) — each with higher limits for keywords, competitors, AI-visibility checks, mailboxes, emails, forms, posts and video ads; any plan can be chosen at sign-up and starts instantly; upgrades are immediate with unused days refunded; 14-day Pro trial with no card; custom limits above ${LIMITS.agency.projects} projects on request. Prices in USD; Indian customers can pay in INR.
- Sign up: ${SITE}/signup
- Contact: ${CONTACT_EMAIL}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
