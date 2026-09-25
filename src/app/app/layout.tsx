import { early, repo, requireBusiness } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { Shell } from "@/components/app/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const countP = early(repo().countLeads("new"));
  const unreadP = early(Promise.resolve(supabaseServer().from("threads").select("id", { count: "exact", head: true }).eq("unread", true)).then((r) => r.count ?? 0));
  const { user, business, r } = await requireBusiness();
  const [newLeads, unread] = await Promise.all([countP, unreadP]);
  return (
    <Shell user={user} business={{ name: business.name, segment: business.segment, city: business.city }} newLeads={newLeads} unread={unread} mode={r.mode}>
      {children}
    </Shell>
  );
}
