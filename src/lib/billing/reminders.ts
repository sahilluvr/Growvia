import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_INFO, isPaidPlan } from "./catalog";
import { sendTo } from "../notify";
import { pushInApp } from "../inapp";

const DAY = 86_400_000;

/**
 * PayPal plans don't renew by themselves: email (and bell) 7 days and 1 day before the end, and once when it ends.
 * Each reminder is sent once per paid period (dedupe on the end date).
 */
export async function remindPrepaid(db: SupabaseClient) {
  const now = Date.now();
  const { data } = await db.from("subscriptions").select("owner_id, plan, current_end").eq("provider", "prepaid").eq("status", "prepaid")
    .gt("current_end", new Date(now - 2 * DAY).toISOString()).lt("current_end", new Date(now + 8 * DAY).toISOString()).limit(200);
  let sent = 0;
  for (const s of data ?? []) {
    const end = Date.parse(s.current_end as string);
    const left = end - now;
    const stage = left <= 0 ? "ended" : left <= 1.5 * DAY ? "1" : left <= 7 * DAY ? "7" : null;
    if (!stage) continue;
    const { data: prof } = await db.from("profiles").select("email, name").eq("id", s.owner_id).maybeSingle();
    if (!prof?.email) continue;
    const name = isPaidPlan(s.plan) ? PLAN_INFO[s.plan].name : "Your plan";
    const when = new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    const subject = stage === "ended" ? `Your Growvia ${name} plan has ended` : stage === "1" ? `Your Growvia ${name} plan ends tomorrow` : `Your Growvia ${name} plan ends on ${when}`;
    const body = stage === "ended"
      ? `Your PayPal payment covered Growvia ${name} until ${when}, so your account is now on Free. Nothing is deleted — renew in a minute to switch everything back on.`
      : `Your PayPal payment covers Growvia ${name} until ${when}. PayPal doesn't renew automatically, so renew before then to keep your limits, scheduled posts and campaigns running. Time is added on top — you lose nothing by renewing early.`;
    const r = await sendTo({ ownerId: s.owner_id, type: "billing", to: prof.email, subject, title: subject, body, cta: { label: stage === "ended" ? "Renew now" : "Renew with PayPal", url: "/app/billing#upgrade" }, dedupe: `prepaid:${s.owner_id}:${s.current_end}:${stage}` });
    if (r && !("skipped" in r && r.skipped)) {
      await pushInApp(db, s.owner_id, { kind: "post_failed", title: subject, body: stage === "ended" ? "Renew to switch your plan back on." : "PayPal doesn't renew automatically — renew from Plan & billing.", url: "/app/billing#upgrade" });
      sent++;
    }
  }
  return sent;
}
