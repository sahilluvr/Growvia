import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";
import { CONTACT_EMAIL } from "@/lib/site/features";

export const metadata: Metadata = { title: "GrowviaBot", alternates: { canonical: "/bot" } };

export default function Bot() {
  return (
    <LegalPage title="GrowviaBot" updated="30 September 2026">
      <section>
        <p>GrowviaBot is the crawler behind Growvia&apos;s website audits. It only visits a site when that site&apos;s owner (or someone they work with) runs an SEO audit or a scheduled re-check in Growvia.</p>
      </section>
      <section>
        <h2>How it behaves</h2>
        <ul>
          <li>User agent: <code>Mozilla/5.0 (compatible; GrowviaBot/1.0; +https://usegrowvia.com/bot)</code></li>
          <li>Reads a limited number of public pages per audit, plus robots.txt, sitemap.xml and llms.txt.</li>
          <li>Never submits forms, logs in, or collects personal data.</li>
        </ul>
      </section>
      <section>
        <h2>Questions or opt-out</h2>
        <p>If you see GrowviaBot on a site you run and didn&apos;t ask for an audit, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your domain and we&apos;ll stop it.</p>
      </section>
    </LegalPage>
  );
}
