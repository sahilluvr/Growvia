import { Suspense } from "react";
import { EmailNav } from "@/components/app/EmailNav";

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="mb-5 h-[45px] border-b border-line" />}><EmailNav /></Suspense>
      {children}
    </>
  );
}
