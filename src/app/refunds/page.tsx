import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";
import { CONTACT_EMAIL } from "@/lib/site/features";

export const metadata: Metadata = { title: "Refund & cancellation policy", description: "How cancelling, changing plans and refunds work for Growvia Pro, Growth and Agency, including pro-rata refunds on upgrades and our 7-day first-payment refund.", alternates: { canonical: "/refunds" } };

export default function Refunds() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Refund & cancellation policy" updated="2 October 2026">
      <section><p>We want Growvia to be worth what you pay. This page explains how cancelling, changing plans and refunds work for our paid plans (Pro, Growth and Agency).</p></section>
      <section>
        <h2>Free trial</h2>
        <p>Every new account gets 14 days of Pro free, with no card. If you upgrade during the trial, you&apos;re charged straight away and your paid period starts that day. If you don&apos;t upgrade, the account simply moves to Free when the trial ends — you&apos;re never charged without choosing to.</p>
      </section>
      <section>
        <h2>Changing plans</h2>
        <ul>
          <li><b>Upgrading</b> (e.g. Pro → Growth): the new plan starts at once and you&apos;re charged for it today. The unused days of your old plan are refunded automatically, pro rata, to the original payment method.</li>
          <li><b>Downgrading</b> (e.g. Agency → Growth): you keep your current plan until the end of the period you&apos;ve paid for; the smaller plan starts then. Nothing is charged until that date, and you can undo it before then.</li>
          <li><b>Monthly ↔ yearly:</b> the new billing period starts at your next renewal, so you&apos;re never charged twice.</li>
        </ul>
      </section>
      <section>
        <h2>Cancelling</h2>
        <ul>
          <li>Cancel anytime from <b>Plan &amp; billing</b> in your account. No emails or calls needed.</li>
          <li>By default you keep your plan until the end of the month or year you&apos;ve paid for, then move to the Free plan. You won&apos;t be charged again.</li>
          <li>You can also cancel immediately; the plan stops at once.</li>
          <li>Your projects, leads, emails and reports are kept when you move to Free.</li>
        </ul>
      </section>
      <section>
        <h2>Refunds</h2>
        <ul>
          <li><b>First payment:</b> if Growvia isn&apos;t right for you, email us within 7 days of your first charge and we&apos;ll refund it in full.</li>
          <li><b>Yearly plans:</b> if you cancel within 14 days of a yearly charge, we&apos;ll refund it in full.</li>
          <li><b>Renewals:</b> monthly renewals aren&apos;t refunded, but you can cancel at any time so there are no further charges.</li>
          <li><b>Charged by mistake</b> (a double charge, or a charge after you cancelled): we always refund it.</li>
        </ul>
        <p>Approved refunds go back to the original payment method through Razorpay, usually within 5–7 business days (depending on your bank).</p>
      </section>
      <section>
        <h2>Payment problems</h2>
        <p>If a renewal fails, Razorpay retries automatically for a few days and you can update your payment from Plan &amp; billing. Your plan stays on meanwhile; if payment still fails, the account moves to Free.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Refunds and billing questions: {mail}. Please include the email on your Growvia account.</p>
      </section>
    </LegalPage>
  );
}
