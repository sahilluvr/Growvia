import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminClient } from "@/lib/server/admin";
import { webhookSignatureOk, type RzpPayment, type RzpSubscription } from "@/lib/billing/razorpay";
import { applySubscription, recordPayment } from "@/lib/billing/sync";
import { bustPlan } from "@/lib/billing/plan";
import { applyPrepaidPayment } from "@/lib/billing/prepaid";

export const dynamic = "force-dynamic";

/**
 * Razorpay → Growvia. Set this URL in Razorpay Dashboard → Webhooks with the events:
 * subscription.authenticated, .activated, .charged, .pending, .halted, .cancelled, .completed, .paused, .resumed, .updated, invoice.paid, payment.failed,
 * and payment.captured (PayPal / one-time prepaid plans — backup for when the browser closes before confirming).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!webhookSignatureOk(raw, req.headers.get("x-razorpay-signature"))) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "server key missing" }, { status: 500 });
  let ev: { event: string; payload: Record<string, { entity: Record<string, unknown> }> };
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const id = req.headers.get("x-razorpay-event-id") || createHash("sha256").update(raw).digest("hex");
  // Each event once (Razorpay retries until it gets a 2xx).
  const { error: dup } = await db.from("billing_events").insert({ id, type: ev.event });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const sub = ev.payload.subscription?.entity as RzpSubscription | undefined;
    const pay = ev.payload.payment?.entity as RzpPayment | undefined;
    const inv = ev.payload.invoice?.entity as { id: string; payment_id?: string; short_url?: string; subscription_id?: string } | undefined;
    let ownerId: string | undefined;
    if (sub) {
      const r = await applySubscription(db, sub);
      ownerId = r.ok ? ("ownerId" in r ? r.ownerId : undefined) : undefined;
      if (!ownerId) {
        const { data } = await db.from("subscriptions").select("owner_id").eq("rzp_subscription_id", sub.id).maybeSingle();
        ownerId = data?.owner_id;
      }
      // A scheduled cancel shows up as "cancelled" at period end; an immediate one ends access now.
      if (ownerId && ev.event === "subscription.cancelled") bustPlan(ownerId);
    }
    if (pay && (ev.event === "subscription.charged" || ev.event === "payment.failed")) {
      if (!ownerId && sub) ownerId = (Array.isArray(sub.notes) ? undefined : sub.notes?.owner_id);
      if (!ownerId && pay.invoice_id) {
        const { data } = await db.from("payments").select("owner_id").eq("invoice_id", pay.invoice_id).maybeSingle();
        ownerId = data?.owner_id;
      }
      if (ownerId && pay.amount > 0) await recordPayment(db, ownerId, sub?.id ?? null, pay);
    }
    // PayPal / prepaid: a one-time order payment (no subscription attached).
    if (pay && !sub && (ev.event === "payment.captured" || ev.event === "order.paid") && pay.order_id) {
      const r = await applyPrepaidPayment(db, pay).catch((e) => { console.error("[billing webhook] prepaid", e); return { ok: false as const }; });
      if (r.ok && "ownerId" in r && r.ownerId) bustPlan(r.ownerId);
    }
    if (inv && ev.event === "invoice.paid" && inv.payment_id) {
      await db.from("payments").update({ invoice_id: inv.id, invoice_url: inv.short_url ?? null }).eq("id", inv.payment_id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Let Razorpay retry later.
    await db.from("billing_events").delete().eq("id", id);
    console.error("[billing webhook]", ev.event, e);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
