"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, Code2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { aiFormCopyAction, createFormAction, deleteFormAction, saveFormAction } from "@/app/form-actions";
import { inputCls, textareaCls } from "@/components/ui/styles";
import { CopyButton } from "@/components/app/bits";
import type { FormField, FormSettings } from "@/lib/forms";

export function NewFormButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <span className="grid justify-items-end gap-1">
      <button disabled={pending} onClick={() => start(async () => { setErr(""); const r = await createFormAction(`Form ${new Date().toLocaleDateString("en-IN")}`); if (r?.id) router.push(`/app/forms?id=${r.id}`); else if (r?.error) setErr(r.error); })} className="btn-ghost h-10 px-4 text-[14px]"><Plus className="h-4 w-4" /> New form</button>
      {err && <span role="alert" className="max-w-sm text-right text-[12px] text-red-600">{err} {/Upgrade to Pro/.test(err) && <a href="/app/billing#upgrade" className="font-medium underline">See Pro</a>}</span>}
    </span>
  );
}

const MAP_LABEL: Record<string, string> = { name: "Name", email: "Email", phone: "Phone", company: "Company", message: "Message", custom: "Other (saved in notes)", wa_opt_in: "WhatsApp consent" };

export function FormBuilder({ id, name: n0, fields: f0, settings: s0, origin, submissions, captchaOn, mailOn, canDelete, recent, brandingLocked }: {
  id: string; name: string; fields: FormField[]; settings: FormSettings; origin: string; submissions: number; captchaOn: boolean; mailOn: boolean; canDelete: boolean; brandingLocked?: boolean;
  recent: { id: string; name: string; email: string | null; when: string; page: string | null }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(n0);
  const [fields, setFields] = useState(f0);
  const [s, setS] = useState(s0);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [ai, startAi] = useTransition();
  const [tab, setTab] = useState<"script" | "iframe" | "html" | "link">("script");
  const [v, setV] = useState(0);
  const set = <K extends keyof FormSettings>(k: K, val: FormSettings[K]) => setS((x) => ({ ...x, [k]: val }));
  const upd = (i: number, patch: Partial<FormField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => setFields((fs) => { const a = [...fs]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const add = (type: FormField["type"], maps: FormField["maps"], label: string) => setFields((fs) => [...fs, { id: `${maps === "custom" ? "field" : maps}_${fs.length + 1}`, type, label, required: false, maps }]);
  const save = () => start(async () => { const r = await saveFormAction(id, name, fields, s); setMsg(r?.error ? { t: r.error, bad: true } : { t: r?.message ?? "Saved" }); setV((x) => x + 1); router.refresh(); });
  const code = {
    script: `<!-- Growvia form: paste where the form should appear -->\n<script src="${origin}/embed.js" data-growvia-form="${id}" async></script>`,
    iframe: `<iframe src="${origin}/embed/${id}" title="Contact form" style="width:100%;min-height:520px;border:0" loading="lazy"></iframe>`,
    html: `<form action="${origin}/api/forms/${id}" method="POST">\n${fields.map((f) => f.type === "textarea" ? `  <textarea name="${f.id}" placeholder="${f.label}"${f.required ? " required" : ""}></textarea>` : f.type === "checkbox" ? `  <label><input type="checkbox" name="${f.id}"${f.required ? " required" : ""}> ${f.label}</label>` : `  <input name="${f.id}" type="${f.type === "select" ? "text" : f.type}" placeholder="${f.label}"${f.required ? " required" : ""}>`).join("\n")}\n  <input type="text" name="_gv_hp" style="display:none" tabindex="-1" autocomplete="off">\n  <button type="submit">${s.button}</button>\n</form>`,
    link: `${origin}/f/${id}`,
  }[tab];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <div className="grid content-start gap-5">
        <section className="card grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold tracking-tight outline-none" aria-label="Form name" />
            <span className="text-[13px] text-stone-500">{submissions} submission{submissions === 1 ? "" : "s"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-[13px] font-medium">Heading <span className="font-normal text-stone-400">link page only</span></span><input value={s.title} onChange={(e) => set("title", e.target.value)} className={`${inputCls} mt-1.5`} /></label>
            <label className="block"><span className="text-[13px] font-medium">Button text</span><input value={s.button} onChange={(e) => set("button", e.target.value)} className={`${inputCls} mt-1.5`} /></label>
            <label className="block sm:col-span-2"><span className="text-[13px] font-medium">Intro <span className="font-normal text-stone-400">optional</span></span><input value={s.intro} onChange={(e) => set("intro", e.target.value)} className={`${inputCls} mt-1.5`} /></label>
          </div>
          <button type="button" disabled={ai} onClick={() => startAi(async () => { const r = await aiFormCopyAction(); if (r.error) setMsg({ t: r.error, bad: true }); else setS((x) => ({ ...x, title: r.title ?? x.title, intro: r.intro ?? x.intro, button: r.button ?? x.button, success_title: r.success_title ?? x.success_title, success_text: r.success_text ?? x.success_text, auto_reply: { ...x.auto_reply, subject: r.subject ?? x.auto_reply.subject, body: r.body ?? x.auto_reply.body } })); })} className="btn-ghost h-9 w-fit px-3.5 text-[13px]">{ai ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Write the texts with AI</button>
        </section>

        <section className="card overflow-hidden">
          <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Fields</h3>
          <ul className="divide-y divide-line">
            {fields.map((f, i) => (
              <li key={i} className="grid gap-2 p-4 sm:grid-cols-2 sm:items-center 2xl:grid-cols-[minmax(180px,1fr)_130px_130px_auto]">
                <input value={f.label} onChange={(e) => upd(i, { label: e.target.value })} className={`${inputCls} h-10 sm:col-span-2 2xl:col-span-1`} aria-label={`Field ${i + 1} label`} />
                <select value={f.type} onChange={(e) => upd(i, { type: e.target.value as FormField["type"] })} className={`${inputCls} h-10`} aria-label={`Field ${i + 1} type`}>{["text", "email", "tel", "textarea", "select", "checkbox"].map((t) => <option key={t} value={t}>{{ text: "Short text", email: "Email", tel: "Phone", textarea: "Long text", select: "Dropdown", checkbox: "Checkbox" }[t]}</option>)}</select>
                <select value={f.maps} onChange={(e) => upd(i, { maps: e.target.value as FormField["maps"] })} className={`${inputCls} h-10`} aria-label={`Field ${i + 1} saves as`}>{Object.entries(MAP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <div className="flex items-center gap-1 sm:col-span-2 2xl:col-span-1">
                  <label className="mr-1 flex items-center gap-1 text-[12px]"><input type="checkbox" checked={f.required} onChange={(e) => upd(i, { required: e.target.checked })} /> Required</label>
                  <button type="button" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-mist" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-mist" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${f.label}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {f.type === "select" && <input value={(f.options ?? []).join(", ")} onChange={(e) => upd(i, { options: e.target.value.split(",").map((x) => x.trim()) })} placeholder="Options, comma separated" className={`${inputCls} h-9 sm:col-span-2 2xl:col-span-4`} aria-label="Dropdown options" />}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-line p-4 text-[13px]">
            {[["text", "company", "Company"], ["select", "custom", "Service interested in"], ["text", "custom", "Budget"], ["checkbox", "wa_opt_in", "Yes, you can message me on WhatsApp"], ["text", "custom", "New question"]].map(([t, m, l]) => <button key={l} type="button" onClick={() => add(t as FormField["type"], m as FormField["maps"], l)} className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink"><Plus className="mr-1 inline h-3 w-3" />{l}</button>)}
          </div>
        </section>

        <section className="card grid gap-4 p-5">
          <h3 className="text-[15px] font-semibold">After someone submits</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-[13px] font-medium">Thank-you heading</span><input value={s.success_title} onChange={(e) => set("success_title", e.target.value)} className={`${inputCls} mt-1.5`} /></label>
            <label className="block"><span className="text-[13px] font-medium">Thank-you text</span><input value={s.success_text} onChange={(e) => set("success_text", e.target.value)} className={`${inputCls} mt-1.5`} /></label>
            <label className="block"><span className="text-[13px] font-medium">Or send them to your page <span className="font-normal text-stone-400">optional</span></span><input value={s.redirect} onChange={(e) => set("redirect", e.target.value)} placeholder="https://yoursite.com/thank-you" className={`${inputCls} mt-1.5`} /></label>
            <label className="block"><span className="text-[13px] font-medium">Tag new leads</span><input value={s.tag} onChange={(e) => set("tag", e.target.value)} className={`${inputCls} mt-1.5`} /></label>
          </div>
          <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" checked={s.notify} onChange={(e) => set("notify", e.target.checked)} className="mt-1" /> Email me and my team about every new lead {!mailOn && <span className="text-[12px] text-amber-700">(needs RESEND_API_KEY)</span>}</label>
          <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" checked={s.auto_reply.enabled} onChange={(e) => set("auto_reply", { ...s.auto_reply, enabled: e.target.checked })} className="mt-1" /> Send the visitor an instant thank-you email</label>
          {s.auto_reply.enabled && (
            <div className="grid gap-2 rounded-xl bg-paper p-3">
              <input value={s.auto_reply.subject} onChange={(e) => set("auto_reply", { ...s.auto_reply, subject: e.target.value })} className={inputCls} aria-label="Auto-reply subject" />
              <textarea value={s.auto_reply.body} onChange={(e) => set("auto_reply", { ...s.auto_reply, body: e.target.value })} rows={6} className={textareaCls} aria-label="Auto-reply message" />
              <p className="text-[12px] text-stone-500">{"{{first_name}}"} is replaced with their name. Replies go to your email.</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-[14px]">Button colour <input type="color" value={s.accent} onChange={(e) => set("accent", e.target.value)} className="h-8 w-12 rounded border border-line" aria-label="Button colour" /></label>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={s.captcha} onChange={(e) => set("captcha", e.target.checked)} /> Bot protection {!captchaOn && <span className="text-[12px] text-stone-400">(add Turnstile keys)</span>}</label>
            <label className="flex items-center gap-2 text-[14px]" title={brandingLocked ? "Upgrade to Pro to remove the badge" : undefined}><input type="checkbox" checked={brandingLocked || s.show_branding} disabled={brandingLocked} onChange={(e) => set("show_branding", e.target.checked)} /> “Powered by Growvia”{brandingLocked && <a href="/app/billing" className="text-[12px] text-lime-800 underline">Pro removes it</a>}</label>
          </div>
          {captchaOn && s.captcha && <p className="text-[12px] text-stone-500">With bot protection on, use the script or iframe embed (plain HTML forms can't show the human check — switch it off to use them).</p>}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} onClick={save} className="btn-primary h-11 px-6 text-[14px]">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save form</button>
          {msg && <span className={`text-[13px] ${msg.bad ? "text-red-600" : "text-lime-700"}`}>{msg.t}</span>}
          {canDelete && <button onClick={() => { if (confirm(`Delete ${name}? Leads it collected stay in Leads.`)) start(async () => { await deleteFormAction(id); router.push("/app/forms"); }); }} className="ml-auto text-[13px] text-stone-500 hover:text-red-600">Delete form</button>}
        </div>
      </div>

      <div className="grid content-start gap-5">
        <section id="install" className="card scroll-mt-24 overflow-hidden">
          <h3 className="flex items-center gap-2 border-b border-line px-5 py-3 text-[15px] font-semibold"><Code2 className="h-4 w-4" /> Add to your website</h3>
          <div className="flex gap-1 border-b border-line px-3 pt-2 text-[13px]">{([["script", "Script"], ["iframe", "iFrame"], ["html", "Your own HTML"], ["link", "Link"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-2.5 py-1.5 ${tab === k ? "border-ink font-medium" : "border-transparent text-stone-500"}`}>{l}</button>)}</div>
          <div className="grid gap-2 p-4">
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-ink p-3 font-mono text-[11px] leading-relaxed text-lime">{code}</pre>
            <div className="flex flex-wrap items-center gap-2"><CopyButton text={code} label="Copy code" />{tab === "link" && <a href={code} target="_blank" className="text-[13px] underline">Open</a>}</div>
            <p className="text-[12px] text-stone-500">{tab === "script" ? "Works on WordPress (Custom HTML block), Wix (Embed code), Webflow, Shopify, Squarespace and plain HTML. Resizes itself and passes UTM tags." : tab === "html" ? "Style it your way; submissions still land in Leads. Save first so field names match." : tab === "link" ? "Share in bios, WhatsApp, QR codes and emails." : "Fixed height; use Script for auto-sizing."}</p>
            {tab === "script" && <InstallSteps code={code} />}
          </div>
        </section>
        <section className="card overflow-hidden">
          <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Preview</h3>
          <iframe key={v} src={`/embed/${id}?preview=1`} title="Form preview" className="h-[560px] w-full border-0 bg-white" />
          <p className="px-5 pb-3 text-[12px] text-stone-400">Save to update the preview.</p>
        </section>
        <section className="card overflow-hidden">
          <h3 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Latest from this form</h3>
          {recent.length ? <ul className="divide-y divide-line text-[13px]">{recent.map((l) => <li key={l.id} className="px-5 py-2.5"><Link href={`/app/leads/${l.id}`} className="font-medium hover:underline">{l.name}</Link> <span className="text-stone-500">· {l.email ?? "no email"} · {l.when}</span>{l.page && <span className="block truncate font-mono text-[11px] text-stone-400">{l.page}</span>}</li>)}</ul> : <p className="p-5 text-[13px] text-stone-500">No submissions yet.</p>}
        </section>
      </div>
    </div>
  );
}

const PLATFORMS: { key: string; name: string; steps: string[] }[] = [
  { key: "wordpress", name: "WordPress", steps: ["Open the page in the WordPress editor.", "Click + and add a “Custom HTML” block where the form should go.", "Paste the code, then click Update."] },
  { key: "wix", name: "Wix", steps: ["In the Wix Editor click Add (+) → Embed Code → Embed HTML.", "Click “Enter Code”, paste the code and click Update.", "Drag the box to size, then Publish."] },
  { key: "shopify", name: "Shopify", steps: ["Online Store → Themes → Customize.", "Open the page, Add section → “Custom Liquid” (or Custom HTML).", "Paste the code and Save."] },
  { key: "squarespace", name: "Squarespace", steps: ["Edit the page and click an insert point (+).", "Choose “Code”, paste the code, and turn off “Display Source”.", "Save the page."] },
  { key: "webflow", name: "Webflow", steps: ["Drag an “Embed” element onto the page.", "Paste the code and Save & Close.", "Publish the site."] },
  { key: "godaddy", name: "GoDaddy Website Builder", steps: ["Edit the site → Add Section → search “HTML”.", "Paste the code into the HTML section.", "Click Done, then Publish."] },
  { key: "other", name: "Someone else builds my site", steps: ["Send the code to your web developer with the button below — it takes them two minutes."] },
];
function InstallSteps({ code }: { code: string }) {
  const [k, setK] = useState("wordpress");
  const pl = PLATFORMS.find((x) => x.key === k)!;
  const mail = `mailto:?subject=${encodeURIComponent("Please add our contact form to the website")}&body=${encodeURIComponent(`Hi,\n\nCould you add our contact form to the website (contact page and service pages)? Paste this code where the form should appear:\n\n${code}\n\nIt resizes itself and works on any page. Thanks!`)}`;
  return (
    <div className="grid gap-2 rounded-xl bg-mist p-3 text-[13px]" data-testid="install-steps">
      <label className="flex flex-wrap items-center gap-2 font-medium text-ink">My website is built with
        <select value={k} onChange={(e) => setK(e.target.value)} className="h-8 rounded-lg border border-line bg-white px-2 text-[13px] font-normal">{PLATFORMS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
      </label>
      <ol className="grid list-decimal gap-1 pl-5 text-stone-700">{pl.steps.map((t) => <li key={t}>{t}</li>)}</ol>
      <a href={mail} className="justify-self-start text-[12px] font-medium text-lime-800 underline underline-offset-2">Email the code to my web developer</a>
    </div>
  );
}
