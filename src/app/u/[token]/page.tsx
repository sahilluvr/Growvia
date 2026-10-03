import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { verifyId } from "@/lib/server/crypto";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function UnsubscribePage({ params, searchParams }: { params: { token: string }; searchParams: { done?: string } }) {
  const valid = Boolean(verifyId(params.token, "unsub"));
  const done = searchParams.done === "1";
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <LogoMark className="mx-auto h-9 w-9" />
        {done ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-[15px] text-stone-500">You won&apos;t receive any more of these emails.</p>
          </>
        ) : valid ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Unsubscribe from these emails?</h1>
            <p className="mt-2 text-[15px] text-stone-500">You&apos;ll stop receiving marketing emails from this sender.</p>
            <form action={`/api/unsub/${params.token}`} method="post" className="mt-6">
              <button className="btn-primary w-full">Unsubscribe</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
            <p className="mt-2 text-[15px] text-stone-500">Reply to the email and ask to be removed — the sender will take care of it.</p>
          </>
        )}
      </div>
    </main>
  );
}
