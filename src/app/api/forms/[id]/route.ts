import { NextResponse } from "next/server";
import { submitForm, type UploadIn } from "@/lib/forms-submit";
import { siteOrigin } from "@/lib/data";
import { adminClient } from "@/lib/server/admin";
import { loadForm, settingsOf, plainLabel } from "@/lib/forms";
import { corsHeaders } from "@/lib/forms-guard";
import { captchaOn, TURNSTILE_SITE_KEY } from "@/lib/captcha";
import type { RawInput } from "@/lib/forms-validate";

export const dynamic = "force-dynamic";
const MAX_BODY = 30 * 1024 * 1024;

async function settingsFor(id: string) {
  const db = adminClient();
  const x = db ? await loadForm(db, id).catch(() => null) : null;
  return x ? { x, s: settingsOf(x.form.settings, x.business.name) } : null;
}

export async function OPTIONS(req: Request, { params }: { params: { id: string } }) {
  const f = await settingsFor(params.id);
  return new NextResponse(null, { status: 204, headers: corsHeaders(req, f?.s) });
}

/** Public form definition: keys, labels, types, options, validation — enough to build your own form. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const f = await settingsFor(params.id);
  if (!f) return NextResponse.json({ ok: false, error: "Form not found." }, { status: 404, headers: corsHeaders(req) });
  const { x, s } = f;
  const fields = x.form.fields.map((d) => ({
    key: d.key, id: d.key, type: d.type, label: d.label, label_text: plainLabel(d.label), required: d.required, placeholder: d.placeholder ?? "", help: d.help ?? "",
    ...(d.options ? { options: d.options } : {}), ...(d.default ? { default: d.default } : {}), ...(d.min !== undefined ? { min: d.min } : {}), ...(d.max !== undefined ? { max: d.max } : {}),
    ...(d.error ? { error: d.error } : {}), ...(d.param ? { param: d.param } : {}), ...(d.type === "checkbox" ? { checked_value: d.checked_value } : {}),
    ...(d.type === "file" ? { accept: d.accept, max_mb: d.max_mb } : {}), ...(d.maps === "consent" ? { consent: true } : {}),
    autocomplete: d.maps === "name" ? "name" : d.maps === "email" ? "email" : d.maps === "phone" ? "tel" : d.maps === "company" ? "organization" : "off",
  }));
  return NextResponse.json(
    { ok: true, id: x.form.id, title: s.title, intro: s.intro, button: s.button, success: { title: s.success_title, text: s.success_text }, error_text: s.error_text, redirect: s.redirect || null,
      captcha: Boolean(captchaOn && s.captcha), turnstile_site_key: captchaOn && s.captcha ? TURNSTILE_SITE_KEY : null, branding: s.show_branding, style: { accent: s.accent, ...s.style }, fields },
    { headers: { ...corsHeaders(req, s), "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=600" } },
  );
}

/** Accepts submissions: JSON, URL-encoded (plain HTML forms) and multipart (file uploads). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const f = await settingsFor(params.id);
  const cors = corsHeaders(req, f?.s);
  const type = req.headers.get("content-type") ?? "";
  const isJson = type.includes("application/json");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return NextResponse.json({ ok: false, status: 413, error: "That upload is too big." }, { status: 413, headers: cors });

  let data: RawInput = {};
  const uploads: Record<string, UploadIn> = {};
  let meta: { page?: string; referrer?: string; utm?: Record<string, string>; captcha?: string } = {};
  try {
    if (isJson) {
      const body = (await req.json()) as { fields?: RawInput; page?: string; referrer?: string; utm?: Record<string, string>; turnstileToken?: string; captcha?: string };
      data = body.fields ?? {};
      meta = { page: body.page, referrer: body.referrer, utm: body.utm, captcha: body.turnstileToken ?? body.captcha };
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") {
          const key = k.replace(/\[\]$/, "");
          const prev = data[key];
          data[key] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
        } else if (v && typeof v === "object" && "arrayBuffer" in v && (v as File).size > 0) {
          const file = v as File;
          uploads[k] = { name: file.name || "upload", type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
        }
      }
      const one = (k: string) => (Array.isArray(data[k]) ? (data[k] as string[])[0] : (data[k] as string | undefined));
      const utm: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) { const x = one(k); if (x) utm[k] = x; }
      meta = { page: one("_page") || req.headers.get("referer") || undefined, referrer: one("_referrer"), utm, captcha: one("cf-turnstile-response") ?? one("turnstileToken") };
    }
  } catch {
    return NextResponse.json({ ok: false, status: 400, error: "Couldn't read the form." }, { status: 400, headers: cors });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip");
  const r = await submitForm(params.id, data, uploads, { req, ip, ua: req.headers.get("user-agent"), page: meta.page, referrer: meta.referrer, utm: meta.utm, captcha: meta.captcha });
  const wantsJson = isJson || (req.headers.get("accept") ?? "").includes("application/json");
  if (wantsJson) return NextResponse.json(r.ok ? r : { ok: false, status: r.status, error: r.error, ...(r.fields ? { fields: r.fields } : {}) }, { status: r.ok ? 200 : r.status, headers: cors });

  // Plain HTML post into the small status frame (target="gv-frame-…"): a tiny message, no navigation.
  if (data._gv_frame === "1") {
    const msg = r.ok ? `<b>${esc(r.success.title)}</b><br>${esc(r.success.text)}` : `<span style="color:#b91c1c">${esc(r.error)}</span>${r.fields ? `<ul style="margin:6px 0 0;padding-left:18px;color:#b91c1c">${Object.values(r.fields).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}`;
    return new Response(`<!doctype html><meta charset="utf-8"><body style="margin:0;font:15px/1.45 system-ui,sans-serif;background:transparent">${msg}</body>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (r.ok) return NextResponse.redirect(r.redirect ?? backTo(String(data._page ?? "") || req.headers.get("referer")) ?? `${siteOrigin()}/f/${params.id}?sent=1`, 303);
  const back = backTo(String(data._page ?? "") || req.headers.get("referer"), { gv_error: r.error });
  if (back) return NextResponse.redirect(back, 303);
  return new Response(`<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto"><h2>Couldn't send</h2><p>${esc(r.error)}</p><p><a href="javascript:history.back()">← Go back</a></p>`, { status: r.status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

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
