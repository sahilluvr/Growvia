import type { Metadata } from "next";
import { requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { PageHeader } from "@/components/app/PageHeader";
import { ensureStarterTemplates } from "@/app/email-actions";
import { TemplatesClient } from "./TemplatesClient";
import type { Template } from "@/lib/email/types";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { business } = await requireBusiness();
  await ensureStarterTemplates();
  const { data } = await supabaseServer().from("email_templates").select("*").order("category").order("name");
  return (
    <>
      <PageHeader title="Templates" sub="Reusable emails for campaigns, replies and one-off messages. Use {{first_name}}-style fields to personalise." />
      <TemplatesClient templates={(data ?? []) as Template[]} businessName={business.name} />
    </>
  );
}
