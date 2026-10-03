import { NextResponse } from "next/server";
import { submitForm } from "@/lib/forms-submit";
import { siteOrigin } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

/** Accepts submissions from the Growvia form, the embed, or any plain HTML <form> on your own site. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ct = req.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  let data: Record<string, string> = {};
  let meta: { page?: string; referrer?: string; utm?: Record<string, string>; captcha?: string } = {};
  try {
    if (isJson) {
      const b = await req.json();
      // {fields:{…}} from Growvia's form, or a flat {name, email, …} object from your own code.
      const src = b.fields && typeof b.fields === "object" ? b.fields : Object.fromEntries(Object.entries(b ?? {}).filter(([k]) => !["page", "referrer", "utm", "captcha"].includes(k)));
      data = Object.fromEntries(Object.entries(src).filter(([, v]) => typeof v !== "object").map(([k, v]) => [k, String(v ?? "")]));
      const flatUtm = Object.fromEntries(Object.entries(data).filter(([k]) => k.startsWith("utm_")));
      meta = { page: b.page, referrer: b.referrer, utm: b.utm ?? flatUtm, captcha: b.captcha ?? data["cf-turnstile-response"] };
    } else {
      const f = await req.formData();
      f.forEach((v, k) => { if (typeof v === "string") data[k] = v; });
      const utm = Object.fromEntries(Object.entries(data).filter(([k]) => k.startsWith("utm_")));
      meta = { page: data._page || req.headers.get("referer") || undefined, referrer: data._referrer, utm, captcha: data["cf-turnstile-response"] || data.captcha };
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400, headers: CORS });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
  const r = await submitForm(params.id, data, { ...meta, ip, ua: req.headers.get("user-agent") });
  if (isJson) return NextResponse.json(r, { status: r.ok ? 200 : r.status ?? 400, headers: CORS });
  // Plain HTML form: send the visitor to your thank-you page (or Growvia's).
  if (r.ok) return NextResponse.redirect(r.redirect ?? `${siteOrigin()}/f/${params.id}?sent=1`, 303);
  return new Response(`<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto"><h2>Couldn't send</h2><p>${r.error.replace(/</g, "&lt;")}</p><p><a href="javascript:history.back()">← Go back</a></p>`, { status: r.status ?? 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
