import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { CONTACT_EMAIL, SITE } from "@/lib/site/features";
import { PAID_PLANS, PLAN_INFO, PRICES } from "@/lib/billing/catalog";

const title = "Growvia — Your AI Growth Team";
const description =
  "Growvia is your AI growth team: SEO and AI-search visibility, emails, social posts, website forms, WhatsApp and one inbox. Free plan, paid from $19.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: title, template: "%s · Growvia" },
  description,
  keywords: ["AI marketing", "AI growth team", "small business marketing", "AI SEO", "GEO", "AI search visibility", "email marketing", "WhatsApp Business", "lead generation", "agency marketing software"],
  openGraph: { title, description, type: "website", siteName: "Growvia" },
  applicationName: "Growvia",
  twitter: { card: "summary_large_image", title, description },
  // Optional: Search Console "HTML tag" verification (the DNS method is recommended instead).
  // Bing Webmaster Tools ownership (msvalidate.01) — not a secret; BING_SITE_VERIFICATION overrides it.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION?.trim() ? { google: process.env.GOOGLE_SITE_VERIFICATION.trim() } : {}),
    other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION?.trim() || "0CBBE27BF5BDF03DBE7C6C5D405AF6B5" },
  },
};

// Tells Google the site's name and logo (shown next to results once Google recrawls — usually days to a few weeks).
const ORG_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE}/#org`, name: "Growvia", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/logo.png`, width: 512, height: 512 }, email: CONTACT_EMAIL, founder: { "@type": "Person", name: "Sahil Aggarwal" } },
    { "@type": "SoftwareApplication", "@id": `${SITE}/#app`, name: "Growvia", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: SITE, publisher: { "@id": `${SITE}/#org` },
      description: "AI growth marketing app: SEO and AI-search visibility, email campaigns, social posts, website forms, WhatsApp and one inbox.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        ...PAID_PLANS.map((t) => ({ "@type": "Offer", name: PLAN_INFO[t].name, price: String(PRICES[t].month), priceCurrency: "USD", priceSpecification: { "@type": "UnitPriceSpecification", price: PRICES[t].month, priceCurrency: "USD", unitCode: "MON" } })),
      ] },
    { "@type": "WebSite", "@id": `${SITE}/#site`, name: "Growvia", alternateName: "Growvia — AI Growth Team", url: SITE, publisher: { "@id": `${SITE}/#org` } },
  ],
};

export const viewport: Viewport = { themeColor: "#0B0D0C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <head>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
