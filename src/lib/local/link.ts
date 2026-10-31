import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalState } from "./sync";

/** A Business Profile location also appears as a channel so Content and Publish can post "What's new" updates to it. */
export async function linkGbpAccount(db: SupabaseClient, userId: string, businessId: string, st: LocalState) {
  if (!st.location || !st.google) return;
  await db.from("channel_accounts").delete().eq("provider", "gbp").contains("meta", { business_id: businessId }).neq("external_id", st.location.name);
  await db.from("channel_accounts").upsert({
    owner_id: userId, provider: "gbp", external_id: st.location.name, name: st.location.title, username: null, picture: null,
    access_token_enc: st.google.refresh_enc, status: "connected", last_error: null, meta: { business_id: businessId, account: st.location.account, email: st.google.email },
  }, { onConflict: "provider,external_id" });
}
