import { NextResponse } from "next/server";
import { submitForm } from "@/lib/forms-submit";
import { siteOrigin } from "@/lib/data";
import { adminClient } from "@/lib/server/admin";
import { fieldsOf, loadForm, settingsOf } from "@/lib/forms";
import { captchaOn } from "@/lib/captcha";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function backTo(page: string | null | undefined, params: Record<string, string> = { gv_sent: "1" }): string | null {
  try {
    const u = new URL(String(page ?? ""));
    if (!/^https?:$/.test(u.protocol) || u.host === new URL(siteOrigin()).host) return null;
    u.searchParams.delete("gv_sent"); u.searchParams.delete("gv_error");
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v.slice(0, 200));
    return u.toString();
  } catch { return null; }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

/** Public form definition for the inline embed (embed.js data-mode="inline"): fields and texts only, nothing private. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = adminClient();
  const x = db ? await loadForm(db, params.id) : null;
  if (!x) return NextResponse.json({ ok: false, error: "Form not found." }, { status: 404, headers: CORS });
  const s = settingsOf(x.form.settings, x.business.name);
  const branding = s.show_branding;
  const fields = fieldsOf(x.form.fields).map((f) => ({ id: f.id, type: f.type, label: f.label, required: f.required, placeholder: f.placeholder ?? "", options: f.type === "select" ? (f.options ?? []).filter(Boolean) : undefined, autocomplete: f.maps === "name" ? "name" : f.maps === "email" ? "email" : f.maps === "phone" ? "tel" : f.maps === "company" ? "organization" : "off" }));
  return NextResponse.json(
    { ok: true, id: x.form.id, intro: s.intro, button: s.button, success: { title: s.success_title, text: s.success_text }, redirect: s.redirect || null, captcha: Boolean(captchaOn && s.captcha), branding, fields },
    { headers: { ...CORS, "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" } },
  );
}

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
  let growviaPage = false;
  try { growviaPage = new URL(req.headers.get("origin") ?? "").host === new URL(siteOrigin()).host; } catch { /* no Origin header → external */ }
  const r = await submitForm(params.id, data, { ...meta, ip, ua: req.headers.get("user-agent"), growviaPage });
  if (isJson) return NextResponse.json(r, { status: r.ok ? 200 : r.status ?? 400, headers: CORS });
  // Plain HTML form whose script was stripped by a site builder: it posts into a small frame under the form
  // (target="gv-frame-…"), so the page never navigates — answer with a tiny status message for that frame.
  if (data._gv_frame === "1") {
    const msg = r.ok ? `<b>${esc(r.success.title)}</b><br>${esc(r.success.text)}` : `<span style="color:#b91c1c">${esc(r.error)}</span>`;
    return new Response(`<!doctype html><meta charset="utf-8"><body style="margin:0;font:15px/1.45 system-ui,sans-serif;background:transparent">${msg}</body>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  // Plain HTML form without our script (e.g. a site builder stripped it): go to the owner's thank-you page,
  // else straight back to the page the form was on — never to Growvia — with ?gv_sent=1.
  if (r.ok) return NextResponse.redirect(r.redirect ?? backTo(data._page || req.headers.get("referer")) ?? `${siteOrigin()}/f/${params.id}?sent=1`, 303);
  // Error on a plain HTML post: back to the same page on their site with the reason (the snippet shows it).
  const back = backTo(data._page || req.headers.get("referer"), { gv_error: r.error });
  if (back) return NextResponse.redirect(back, 303);
  return new Response(`<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto"><h2>Couldn't send</h2><p>${r.error.replace(/</g, "&lt;")}</p><p><a href="javascript:history.back()">← Go back</a></p>`, { status: r.status ?? 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
