import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const title = "Growvia — Your AI Growth Team";
const description =
  "Give Growvia your business. Growvia helps you find your customers — creating campaigns, finding opportunities, generating leads, and helping turn them into revenue.";

export const metadata: Metadata = {
  metadataBase: new URL("https://growvia.ai"),
  title: { default: title, template: "%s · Growvia" },
  description,
  keywords: ["AI marketing", "AI growth", "small business marketing", "lead generation", "AI growth team"],
  openGraph: { title, description, type: "website", siteName: "Growvia" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = { themeColor: "#0B0D0C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
