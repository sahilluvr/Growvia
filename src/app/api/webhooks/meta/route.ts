import { NextResponse } from "next/server";
import { adminClient } from "@/lib/server/admin";
import { decrypt } from "@/lib/server/crypto";
import { META_APP_SECRET, META_VERIFY_TOKENS, verifySignature } from "@/lib/meta/graph";
import { ingestWebhook } from "@/lib/meta/channels";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Meta calls this once to verify the webhook URL.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && META_VERIFY_TOKENS.includes(q.get("hub.verify_token") ?? "")) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

// Incoming WhatsApp messages + delivery receipts, Messenger and Instagram DMs.
export async function POST(req: Request) {
  const raw = await req.text();
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 });
  const secrets = [META_APP_SECRET];
  const { data: own } = await db.from("channel_accounts").select("app_secret_enc").not("app_secret_enc", "is", null);
  for (const r of own ?? []) { try { secrets.push(decrypt(r.app_secret_enc)); } catch {} }
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secrets)) return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  let payload: { object?: string; entry?: unknown[] };
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const r = await ingestWebhook(db, payload);
  return NextResponse.json({ ok: true, ...r });
}
