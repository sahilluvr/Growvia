import { SitePage } from "./SitePage";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <SitePage>
      <article className="container-x max-w-3xl py-16 sm:py-24">
        <h1 className="text-[36px] font-semibold tracking-tightest sm:text-[48px]">{title}</h1>
        <p className="mt-3 text-[14px] text-stone-500">Last updated {updated}</p>
        <div className="mt-10 grid gap-8 text-[16px] leading-relaxed text-stone-600 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:mt-3 [&_ul]:grid [&_ul]:gap-1.5 [&_p+p]:mt-3 [&_a]:text-ink [&_a]:underline">{children}</div>
      </article>
    </SitePage>
  );
}
