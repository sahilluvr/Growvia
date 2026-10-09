"use server";
import { dbErr, guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { NOTIFY_TYPES } from "@/lib/notify";

type FormState = { ok?: boolean; error?: string; message?: string } | undefined;

export async function saveNotifyPrefsAction(s: FormState, f: FormData): Promise<FormState> {
  return guard(() => saveNotifyPrefsActionImpl(s, f));
}
async function saveNotifyPrefsActionImpl(_: FormState, f: FormData): Promise<FormState> {
  const user = await repo().getUser();
  if (!user) redirect("/login");
  const notify = Object.fromEntries(NOTIFY_TYPES.map((t) => [t.id, f.get(t.id) === "on"]));
  const { error } = await supabaseServer().from("user_prefs").upsert({ user_id: user.id, notify, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  revalidatePath("/app/settings");
  return error ? { error: dbErr(error) } : { ok: true, message: "Saved." };
}
