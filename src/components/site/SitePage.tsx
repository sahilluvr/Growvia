import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

/** Shell for marketing sub-pages (nav + footer). */
export function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  );
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
