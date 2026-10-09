import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";
import { CONTACT_EMAIL } from "@/lib/site/features";

export const metadata: Metadata = { title: "Privacy policy: how Growvia handles your data", description: "How Growvia collects, uses, stores and protects your data and your customers' data, which services we use, and how to ask for a copy or deletion.", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Privacy policy" updated="30 September 2026">
      <section><p>This policy explains what information Growvia collects, why, and the choices you have. Questions: {mail}.</p></section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Account details</b> — your name, email address and password (stored by our authentication provider; we never see your password).</li>
          <li><b>Business information</b> you enter — business name, website, city, offer, audience and goals.</li>
          <li><b>Your contacts and leads</b> — people you add, import, or who contact you through your Growvia forms, booking page, email, WhatsApp, Instagram or Messenger, and the messages exchanged with them.</li>
          <li><b>Connected accounts</b> — access tokens for services you connect (mailbox, Meta, Google Search Console). These are encrypted before they are stored.</li>
          <li><b>Website and SEO data</b> — public pages of websites you ask us to audit, Search Console data for sites you connect, and AI-assistant answers we collect for your chosen questions.</li>
          <li><b>Usage data</b> — basic logs needed to run and secure the service (for example IP address, browser and error logs). Website forms store a one-way hash of the visitor&apos;s IP only for spam limits.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To provide the features you use: audits, reports, emails, posts, messages, forms, bookings and notifications.</li>
          <li>To generate AI suggestions (emails, posts, plans, SEO advice) based on the business details you provide.</li>
          <li>To keep the service secure, prevent abuse and fix problems.</li>
          <li>To contact you about your account and important changes.</li>
        </ul>
        <p>We do not sell your personal information or your contacts&apos; information.</p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>We use trusted providers to run Growvia, and share only what each needs: Supabase (database, authentication, file storage), Vercel (hosting), Resend (system emails), Google (Gemini AI, Search Console, PageSpeed), Meta (WhatsApp, Facebook and Instagram, when you connect them), Cloudflare Turnstile (bot protection), Razorpay (payments — we never see or store your full card details), and — only if enabled for your account — OpenAI, Perplexity, SerpApi or DataForSEO. Emails you send to your leads go through the mailbox you connect.</p>
      </section>
      <section>
        <h2>Your contacts&apos; information</h2>
        <p>When you store information about your leads and customers in Growvia, you decide what is collected and how it is used, and you are responsible for having a lawful reason to contact them. Every marketing email includes an unsubscribe link, and WhatsApp broadcasts only go to contacts marked as opted in.</p>
      </section>
      <section>
        <h2>Access for your team</h2>
        <p>If you invite teammates, they can see the workspaces you give them access to. Access is enforced by database-level security rules.</p>
      </section>
      <section>
        <h2>Keeping and deleting data</h2>
        <p>We keep your data while your account is active. You can delete leads, campaigns, forms and posts at any time and export your leads as CSV. To delete your account and its data, or to request deletion of data received from Facebook or Instagram, email {mail} from your account email address — we will confirm and complete the request within 30 days.</p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>Depending on where you live, you may have the right to access, correct, export or delete your personal information, or object to certain uses. Contact {mail} and we will respond promptly.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If we make significant changes we will update this page and let account holders know by email.</p>
      </section>
    </LegalPage>
  );
}
