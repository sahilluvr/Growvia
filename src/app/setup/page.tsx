import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { setupMissing } from "@/lib/config";

export const metadata: Metadata = { title: "Finish setup", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (!setupMissing) redirect("/login");
  return (
    <main className="min-h-dvh bg-paper px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/"><Logo /></Link>
        <div className="card mt-8 p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime-700">Almost there</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tightest">Growvia sign-in opens once the database is connected</h1>
          <p className="mt-3 text-[15px] text-stone-500">
            This deployment doesn&apos;t have its Supabase keys yet, so accounts can&apos;t be saved. If you run this site, connect it in two minutes:
          </p>
          <ol className="mt-6 grid gap-4 text-[15px]">
            <li><b>1.</b> Supabase → <b>Project Settings → API</b>: copy the <b>Project URL</b> and the <b>anon / publishable</b> key.</li>
            <li><b>2.</b> Vercel → your project → <b>Settings → Environment Variables</b>, add for <b>Production, Preview and Development</b>:
              <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[13px] leading-relaxed text-lime">{`SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon or publishable key>
SITE_URL=https://<your-site>.vercel.app`}</pre>
            </li>
            <li><b>3.</b> Vercel → <b>Deployments</b> → latest → <b>⋯ → Redeploy</b>. Keys only take effect after a redeploy.</li>
            <li><b>4.</b> Open <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-[13px]">/api/health</code> — every check should say ok.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
