import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/data";
import { Wizard } from "./Wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set up your growth engine" };

export default async function OnboardingPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { r, user } = await requireUser();
  const b = await r.getBusiness();
  if (b?.plan) redirect("/app");
  return (
    <Wizard
      userName={user.name.split(" ")[0]}
      initial={{
        name: b?.name ?? searchParams.name ?? "",
        segment: b?.segment ?? searchParams.segment ?? "",
        city: b?.city ?? searchParams.city ?? "",
        website: b?.website ?? searchParams.website ?? "",
      }}
    />
  );
}
