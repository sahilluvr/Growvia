"use client";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

/** Friendly fallback if something unexpected breaks inside the app. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
      <h1 className="text-[22px] font-semibold tracking-tight">That didn&apos;t work</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-500">Something went wrong while loading or saving this. Nothing else was changed. If you have view-only access to this project, ask the owner for Member access to make changes.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="btn-primary h-10 px-5 text-[14px]"><RotateCcw className="h-4 w-4" /> Try again</button>
        <Link href="/app" className="btn-ghost h-10 px-5 text-[14px]">Go to overview</Link>
      </div>
    </div>
  );
}
