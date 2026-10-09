import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";
import { CONTACT_EMAIL } from "@/lib/site/features";
import { TRIAL_DAYS } from "@/lib/billing/catalog";

export const metadata: Metadata = { title: "Shipping & delivery policy", description: "Growvia is software delivered online: when your free account, trial and paid plans become available, and what to do if a plan isn't showing after payment.", alternates: { canonical: "/shipping" } };

export default function Shipping() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Shipping & delivery policy" updated="2 October 2026">
      <section><p>Growvia is online software (software as a service). Nothing physical is shipped, and there are no shipping charges anywhere in the world.</p></section>
      <section>
        <h2>How you receive the service</h2>
        <ul>
          <li><b>Free plan and {TRIAL_DAYS}-day Pro trial:</b> available as soon as you create an account at usegrowvia.com.</li>
          <li><b>Pro, Growth and Agency plans:</b> switched on in your account the moment your payment is confirmed, usually within a few seconds.</li>
          <li><b>Receipts:</b> listed in your account under Plan &amp; billing, and emailed to the address on your account.</li>
        </ul>
      </section>
      <section>
        <h2>If something doesn&apos;t arrive</h2>
        <p>If you&apos;ve paid and your plan isn&apos;t showing within 15 minutes, open Plan &amp; billing and click refresh, or write to {mail} with the email on your account. We reply within one business day and fix it, or refund you under our <a href="/refunds">refund policy</a>.</p>
      </section>
      <section>
        <h2>Where we serve</h2>
        <p>Growvia is available worldwide. Prices are in US dollars; customers in India can also pay in Indian rupees.</p>
      </section>
    </LegalPage>
  );
}
