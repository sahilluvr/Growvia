import type { Metadata } from "next";
import { requireBusiness } from "@/lib/data";
import { PageHeader } from "@/components/app/PageHeader";
import { finderStatusAction } from "@/app/finder-actions";
import { FinderClient } from "./client";

export const metadata: Metadata = { title: "Find leads" };

export default async function FindLeadsPage({ searchParams }: { searchParams: { what?: string; where?: string } }) {
  const { business } = await requireBusiness();
  const status = await finderStatusAction();
  return (
    <>
      <PageHeader eyebrow={business.name} title="Find leads" sub="Pick who you want to reach and where. Growvia finds the businesses, adds them as leads and writes the emails — you just press Launch." />
      <FinderClient status={status} initial={{ what: (searchParams.what ?? "").slice(0, 80), where: (searchParams.where ?? "").slice(0, 80) }} />
    </>
  );
}
