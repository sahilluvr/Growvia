import { PRICES } from "@/lib/billing/catalog";
import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";
import { CONTACT_EMAIL } from "@/lib/site/features";

export const metadata: Metadata = { title: "Terms of service", description: "The terms for using Growvia: accounts, free and paid plans, billing and renewals, acceptable use, your data and content, and how to cancel.", alternates: { canonical: "/terms" } };

export default function Terms() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Terms of service" updated="30 September 2026">
      <section><p>By creating an account or using Growvia you agree to these terms. If you use Growvia for a company or for clients, you confirm you&apos;re allowed to accept them on their behalf.</p></section>
      <section>
        <h2>Plans and payment</h2>
        <ul>
          <li>Growvia has a free plan and three paid plans: Pro (${PRICES.pro.month} per month or ${PRICES.pro.year} per year), Growth (${PRICES.growth.month} per month or ${PRICES.growth.year} per year) and Agency (${PRICES.agency.month} per month or ${PRICES.agency.year} per year). Paid plans start, and are charged, when you choose them. Moving to a higher plan takes effect immediately and the unused part of your current period is refunded pro rata; moving to a lower plan takes effect at the end of your current paid period. Plan limits are shown on our pricing page and in your account; we&apos;ll give at least 30 days&apos; notice before changing prices for existing subscribers.</li>
          <li>New accounts get a 14-day Pro trial without a card. When it ends the account moves to Free unless you subscribe.</li>
          <li>Paid plans renew automatically each month or year until you cancel. Payments are processed by Razorpay; prices are in US dollars, and if you choose to pay in Indian rupees the amount is converted at that day&apos;s rate. Taxes may apply where required.</li>
          <li>You can cancel anytime from Plan &amp; billing. You keep your plan until the end of the period you&apos;ve paid for. See our <a href="/refunds">refund &amp; cancellation policy</a>.</li>
          <li>If a renewal payment fails we&apos;ll retry for a few days; if it still fails the account moves to Free. Nothing is deleted when you move to Free — anything above the Free limits just can&apos;t grow.</li>
        </ul>
      </section>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>Keep your login secure and tell us about any unauthorised use.</li>
          <li>You&apos;re responsible for what you and your invited teammates do in your account.</li>
        </ul>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>Don&apos;t use Growvia to send spam or messages to people without a lawful basis, to break the rules of connected platforms (such as Meta&apos;s WhatsApp and Instagram policies or Google&apos;s terms), to publish unlawful, misleading or infringing content, or to attack or overload the service. We may suspend accounts that do.</p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>You own the content and data you put into Growvia, including AI-generated drafts you choose to use. You give us permission to store and process it only to provide the service. Review AI-generated content before you publish or send it — it can be wrong.</p>
      </section>
      <section>
        <h2>Connected services</h2>
        <p>Features that use third-party services (for example Meta, Google, your email provider or AI providers) depend on those services and their terms. We&apos;re not responsible for their availability or decisions, such as template approvals or account restrictions.</p>
      </section>
      <section>
        <h2>No guarantees</h2>
        <p>We work hard to keep Growvia reliable, but the service is provided &ldquo;as is&rdquo;. We can&apos;t guarantee specific results such as rankings, AI mentions, leads or sales. To the extent the law allows, our liability is limited to the amount you paid us in the 12 months before a claim.</p>
      </section>
      <section>
        <h2>Ending</h2>
        <p>You can stop using Growvia at any time and ask us to delete your account. We may end or suspend access for serious or repeated breaches of these terms.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>{mail}</p>
      </section>
    </LegalPage>
  );
}
