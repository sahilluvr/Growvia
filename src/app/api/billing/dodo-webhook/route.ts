import { NextResponse } from "next/server";
import { adminClient } from "@/lib/server/admin";
import { dodoWebhookOk, type DodoPayment, type DodoSubscription } from "@/lib/billing/dodo";
import { applyDodoSubscription, recordDodoPayment } from "@/lib/billing/dodo-sync";

export const dynamic = "force-dynamic";

/**
 * Dodo Payments → Growvia. Add this URL in Dodo → Developer → Webhooks and tick the subscription.* and
 * payment.* events; put the endpoint's signing secret in DODO_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const h = { id: req.headers.get("webhook-id"), timestamp: req.headers.get("webhook-timestamp"), signature: req.headers.get("webhook-signature") };
  if (!dodoWebhookOk(raw, h)) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "server key missing" }, { status: 500 });
  let ev: { type: string; data: Record<string, unknown> & { payload_type?: string } };
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  // Each delivery once (Dodo retries until it gets a 2xx).
  const id = `dodo:${h.id}`;
  const { error: dup } = await db.from("billing_events").insert({ id, type: ev.type });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });
  try {
    if (ev.type.startsWith("subscription.") && ev.data?.subscription_id) {
      await applyDodoSubscription(db, ev.data as unknown as DodoSubscription);
    } else if ((ev.type === "payment.succeeded" || ev.type === "payment.failed") && ev.data?.payment_id) {
      await recordDodoPayment(db, ev.data as unknown as DodoPayment);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    await db.from("billing_events").delete().eq("id", id);
    console.error("[dodo webhook]", ev.type, e);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
