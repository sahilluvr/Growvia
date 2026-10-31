"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Code2, Copy, KeyRound, Loader2, Plus, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { aiFormCopyAction, createFormAction, deleteFormAction, duplicateFormAction, regenerateServerKeyAction, removeServerKeyAction, saveFormAction, testAutoReplyAction } from "@/app/form-actions";
import { inputCls, textareaCls } from "@/components/ui/styles";
import { CopyButton } from "@/components/app/bits";
import { LeadForm } from "@/app/f/[id]/LeadForm";
import { FIELD_TYPES, FILE_TYPES, normalizeOrigins, plainLabel, slugKey, splitTags, uniqueKey, type FieldType, type FormField, type FormSettings } from "@/lib/forms-model";

const TYPE_LABEL: Record<FieldType, string> = { text: "Short text", email: "Email", tel: "Phone", url: "Website (URL)", textarea: "Long text", select: "Dropdown", radio: "Choose one (radio)", multiselect: "Choose several", checkbox: "Checkbox", range: "Slider (steps)", hidden: "Hidden value", file: "File upload" };
const MAP_LABEL: Record<FormField["maps"], string> = { name: "Lead name", email: "Lead email", phone: "Lead phone", company: "Lead company", message: "Lead message", custom: "Answer only", wa_opt_in: "WhatsApp consent", consent: "Privacy consent" };
const CHOICE = ["select", "radio", "multiselect", "range"];
const TEXTY = ["text", "email", "tel", "url", "textarea"];

/* ───────── New form (asks for a name) ───────── */
export function NewFormButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const go = () => start(async () => { setErr(""); const r = await createFormAction(name.trim() || "Untitled form"); if (r?.id) { setOpen(false); router.push(`/app/forms?id=${r.id}`); } else setErr(r?.error ?? "Couldn't create the form."); });
  if (!open) return <button onClick={() => setOpen(true)} className="btn-primary h-10 px-4 text-[14px]"><Plus className="h-4 w-4 text-lime" /> New form</button>;
  return (
    <span className="grid justify-items-end gap-1">
      <span className="flex items-center gap-2">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Form name, e.g. Contact us" className={`${inputCls} h-10 w-56`} maxLength={80} aria-label="New form name" />
        <button disabled={pending} onClick={go} className="btn-primary h-10 px-4 text-[14px]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</button>
        <button onClick={() => setOpen(false)} className="btn-ghost h-10 w-10 px-0" aria-label="Cancel"><X className="h-4 w-4" /></button>
      </span>
      {err && <span role="alert" className="max-w-sm text-right text-[12px] text-red-600">{err} {/Upgrade|Pro/.test(err) && <a href="/app/billing#upgrade" className="font-medium underline">See plans</a>}</span>}
    </span>
  );
}

/* ───────── Small inputs ───────── */
function Chips({ value, onChange, placeholder, normalize, label }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; normalize: (raw: string) => string[]; label: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => { const next = [...new Set([...value, ...normalize(raw)])]; onChange(next); setDraft(""); };
  return (
    <div className={`${inputCls} flex min-h-11 flex-wrap items-center gap-1.5 py-1.5`}>
      {value.map((t) => <span key={t} className="flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[13px]">{t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button></span>)}
      <input value={draft} aria-label={label} onChange={(e) => { const v = e.target.value; if (/[,;\n]/.test(v)) add(v); else setDraft(v); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) add(draft); } if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }} onBlur={() => draft.trim() && add(draft)} placeholder={value.length ? "" : placeholder} className="min-w-[8rem] flex-1 bg-transparent text-[14px] outline-none" />
    </div>
  );
}
/** One option per line — spaces inside options are kept; only the ends are trimmed when saving. */
function OptionsBox({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  return <textarea value={text} rows={Math.min(8, Math.max(3, value.length + 1))} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)); }} placeholder={"One option per line\ne.g. AI agents\nWeb development"} className={`${textareaCls} text-[13px]`} aria-label="Options, one per line" />;
}
const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => <label className="block"><span className="text-[13px] font-medium">{label}{hint && <span className="ml-1 font-normal text-stone-400">{hint}</span>}</span><div className="mt-1.5">{children}</div></label>;
const Toggle = ({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: React.ReactNode; disabled?: boolean }) => <label className={`flex items-center gap-2 text-[14px] ${disabled ? "opacity-50" : ""}`}><input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;

/* ───────── Builder ───────── */
type Props = {
  id: string; name: string; fields: FormField[]; settings: FormSettings; origin: string; submissions: number; blocked: number; projectName: string;
  captchaOn: boolean; mailOn: boolean; canDelete: boolean; hasServerKey: boolean; mailboxes: { id: string; label: string }[]; team: string[];
  recent: { id: string; name: string; email: string | null; when: string; page: string | null }[];
};
type Section = "fields" | "texts" | "leads" | "reply" | "security" | "style";

export function FormBuilder(p: Props) {
  const router = useRouter();
  const [name, setName] = useState(p.name);
  const [fields, setFields] = useState(p.fields);
  const [s, setS] = useState(p.settings);
  const [open, setOpen] = useState<string | null>(null);
  const [sec, setSec] = useState<Section>("fields");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [busy, startBusy] = useTransition();
  const [pv, setPv] = useState<"form" | "success" | "errors">("form");
  const [serverKey, setServerKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(p.hasServerKey);
  const set = <K extends keyof FormSettings>(k: K, v: FormSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const upd = (key: string, patch: Partial<FormField>) => setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => setFields((fs) => { const n = [...fs]; const j = i + d; if (j < 0 || j >= n.length) return fs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const add = (type: FieldType) => {
    const label = { text: "Company", email: "Work email", tel: "Phone", url: "Website", textarea: "Project details", select: "Service", radio: "Preferred contact", multiselect: "Services", checkbox: "I agree to the [privacy policy](https://example.com/privacy)", range: "Budget", hidden: "Form type", file: "Attachment" }[type];
    const key = uniqueKey(type === "checkbox" ? "consent" : label, fields.flatMap((f) => [f.key, ...(f.aliases ?? [])]));
    const f: FormField = { key, id: key, type, label, required: false, maps: type === "checkbox" ? "consent" : "custom", ...(CHOICE.includes(type) ? { options: type === "range" ? ["Under $25k", "$25k–$50k", "$50k–$100k"] : ["Option 1", "Option 2"] } : {}), ...(type === "file" ? { accept: ["pdf", "doc", "docx"], max_mb: 10 } : {}), ...(type === "checkbox" ? { checked_value: "yes" } : {}), ...(type === "hidden" ? { default: "" } : {}) };
    setFields((fs) => [...fs, f]); setOpen(key); setSec("fields");
  };
  const save = () => start(async () => { const r = await saveFormAction(p.id, name, fields, s); setMsg(r?.error ? { t: r.error, bad: true } : { t: r?.message ?? "Saved." }); if (!r?.error) router.refresh(); });
  const keysTaken = (except: string) => fields.filter((f) => f.key !== except).flatMap((f) => [f.key, ...(f.aliases ?? [])]);
  const turnstileWarn = s.captcha && !p.captchaOn;
  const code = useMemo(() => ({
    script: `<!-- Growvia form: paste where the form should appear -->\n<script src="${p.origin}/embed.js" data-growvia-form="${p.id}" async></script>`,
    inline: `<script src="${p.origin}/embed.js" data-growvia-form="${p.id}" data-mode="inline" async></script>`,
    iframe: `<iframe src="${p.origin}/embed/${p.id}" title="Contact form" style="width:100%;min-height:640px;border:0" loading="lazy"></iframe>`,
    html: htmlCode(p.origin, p.id, fields, s.button, { title: s.success_title, text: s.success_text }),
    link: `${p.origin}/f/${p.id}`,
  }), [p.origin, p.id, fields, s.button, s.success_title, s.success_text]);
  const [tab, setTab] = useState<keyof typeof code>("script");

  const SECTIONS: [Section, string][] = [["fields", "Fields"], ["texts", "Texts"], ["leads", "Leads & alerts"], ["reply", "Auto-reply"], ["security", "Spam & security"], ["style", "Style"]];

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
      <div className="grid content-start gap-4">
        <section className="card p-5">
          <div className="flex flex-wrap items-end gap-3">
            <Row label="Form name" hint="only you see this"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={80} /></Row>
            <span className="ml-auto flex flex-wrap gap-2 text-[12px] text-stone-500"><span className="rounded-full bg-mist px-2.5 py-1">Project: <b className="text-ink">{p.projectName}</b></span><span className="rounded-full bg-mist px-2.5 py-1">{p.submissions} submissions</span><span className={`rounded-full px-2.5 py-1 ${p.blocked ? "bg-amber-50 text-amber-800" : "bg-mist"}`}>{p.blocked} blocked (30 days)</span></span>
          </div>
          <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Form settings">{SECTIONS.map(([k, l]) => <button key={k} onClick={() => setSec(k)} className={`rounded-full px-3 py-1.5 text-[13px] ${sec === k ? "bg-ink text-white" : "bg-mist text-stone-600 hover:text-ink"}`}>{l}{k === "security" && turnstileWarn && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" />}</button>)}</nav>
        </section>

        {sec === "fields" && (
          <section className="card p-5">
            <ol className="grid gap-2">
              {fields.map((f, i) => {
                const isOpen = open === f.key;
                return (
                  <li key={f.key} className={`rounded-xl border ${isOpen ? "border-ink" : "border-line"} bg-white`}>
                    <div className="flex items-center gap-2 p-2.5">
                      <button onClick={() => setOpen(isOpen ? null : f.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition ${isOpen ? "rotate-180" : ""}`} />
                        <span className="min-w-0 truncate text-[14px] font-medium">{plainLabel(f.label)}{f.required && <span className="text-red-600"> *</span>}</span>
                        <span className="shrink-0 rounded-full bg-mist px-2 py-0.5 text-[11px] text-stone-600">{TYPE_LABEL[f.type]}</span>
                        <code className="shrink-0 truncate rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-stone-500">{f.key}</code>
                      </button>
                      <button onClick={() => move(i, -1)} disabled={!i} className="btn-ghost h-8 w-8 px-0" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="btn-ghost h-8 w-8 px-0" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setFields((fs) => fs.filter((x) => x.key !== f.key))} disabled={f.maps === "name"} className="btn-ghost h-8 w-8 px-0" aria-label="Remove field"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    {isOpen && <FieldEditor f={f} taken={keysTaken(f.key)} onChange={(patch) => { upd(f.key, patch); if (patch.key && patch.key !== f.key) setOpen(patch.key); }} />}
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex flex-wrap gap-1.5">{FIELD_TYPES.map((t) => <button key={t} onClick={() => add(t)} className="btn-ghost h-8 px-2.5 text-[12px]"><Plus className="h-3.5 w-3.5" /> {TYPE_LABEL[t]}</button>)}</div>
            <p className="mt-3 text-[12px] text-stone-500">The <b>key</b> is the name your website posts and the CSS class (<code>gv-field-key</code>). It never changes when you rename or reorder a field; if you edit a key, the old one keeps working.</p>
          </section>
        )}

        {sec === "texts" && (
          <section className="card grid gap-3 p-5">
            <div className="flex justify-end"><button disabled={busy} onClick={() => startBusy(async () => { const r = await aiFormCopyAction(); if (r.error) setMsg({ t: r.error, bad: true }); else setS((x) => ({ ...x, title: r.title ?? x.title, intro: r.intro ?? x.intro, button: r.button ?? x.button, success_title: r.success_title ?? x.success_title, success_text: r.success_text ?? x.success_text, auto_reply: { ...x.auto_reply, subject: r.subject ?? x.auto_reply.subject, body: r.body ?? x.auto_reply.body } })); })} className="btn-ghost h-9 px-3 text-[13px]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Write with AI</button></div>
            <Row label="Heading" hint="shown on the hosted page"><input value={s.title} onChange={(e) => set("title", e.target.value)} placeholder={name} className={inputCls} maxLength={120} /></Row>
            <Row label="Intro" hint="optional"><input value={s.intro} onChange={(e) => set("intro", e.target.value)} className={inputCls} maxLength={400} /></Row>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Submit button"><input value={s.button} onChange={(e) => set("button", e.target.value)} className={inputCls} maxLength={40} /></Row>
              <Row label="Thank-you page" hint="optional https:// link"><input value={s.redirect} onChange={(e) => set("redirect", e.target.value)} placeholder="Stay on the page" className={inputCls} maxLength={500} /></Row>
            </div>
            <Row label="Success title"><input value={s.success_title} onChange={(e) => set("success_title", e.target.value)} className={inputCls} maxLength={120} /></Row>
            <Row label="Success message"><textarea value={s.success_text} onChange={(e) => set("success_text", e.target.value)} rows={2} className={textareaCls} maxLength={300} /></Row>
            <Row label="Error message" hint="shown when something needs fixing"><input value={s.error_text} onChange={(e) => set("error_text", e.target.value)} className={inputCls} maxLength={200} /></Row>
          </section>
        )}

        {sec === "leads" && (
          <section className="card grid gap-3 p-5">
            <Row label="Tag new leads" hint="Enter or comma adds a tag"><Chips value={s.tags} onChange={(v) => set("tags", v)} placeholder="e.g. website, contact" normalize={splitTags} label="Add a tag" /></Row>
            <Row label="New leads land in stage"><select value={s.stage} onChange={(e) => set("stage", e.target.value as FormSettings["stage"])} className={inputCls}>{["new", "contacted", "qualified", "won", "lost"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></Row>
            <Toggle on={s.notify} onChange={(v) => set("notify", v)} label="Email the team about every new lead" />
            {s.notify && <>
              <Row label="Send alerts to" hint={p.team.length ? `teammates: ${p.team.slice(0, 3).join(", ")}${p.team.length > 3 ? "…" : ""}` : "any email addresses"}><Chips value={s.notify_to} onChange={(v) => set("notify_to", v)} placeholder="Leave empty to use your notification settings" normalize={(r) => r.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)} label="Add an alert recipient" /></Row>
              <Row label="Alert subject" hint="{name} {email} {company} {form}"><input value={s.notify_subject} onChange={(e) => set("notify_subject", e.target.value)} className={inputCls} maxLength={200} /></Row>
              <p className="text-[12px] text-stone-500">Alerts include every answer. Each one is logged under Settings → Notifications.</p>
            </>}
          </section>
        )}

        {sec === "reply" && (
          <section className="card grid gap-3 p-5">
            <Toggle on={s.auto_reply.enabled} disabled={!p.mailOn} onChange={(v) => set("auto_reply", { ...s.auto_reply, enabled: v })} label={<>Send visitors an automatic reply {!p.mailOn && <span className="text-[12px] text-amber-700">(email sending isn&apos;t set up)</span>}</>} />
            <p className="text-[12px] text-stone-500">Off by default. Write the message, send yourself a test, then switch it on and save.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Sender name"><input value={s.auto_reply.from_name} onChange={(e) => set("auto_reply", { ...s.auto_reply, from_name: e.target.value })} className={inputCls} maxLength={60} /></Row>
              <Row label="Reply-to address" hint="optional"><input value={s.auto_reply.reply_to} onChange={(e) => set("auto_reply", { ...s.auto_reply, reply_to: e.target.value })} placeholder="hello@yourbusiness.com" className={inputCls} maxLength={200} /></Row>
            </div>
            {p.mailboxes.length > 0 && <Row label="Send from" hint="connected mailbox replies show in your inbox"><select value={s.auto_reply.mailbox_id} onChange={(e) => set("auto_reply", { ...s.auto_reply, mailbox_id: e.target.value })} className={inputCls}><option value="">Growvia email (verified domain)</option>{p.mailboxes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Row>}
            <Row label="Subject" hint="{first_name} {name} {company}"><input value={s.auto_reply.subject} onChange={(e) => set("auto_reply", { ...s.auto_reply, subject: e.target.value })} className={inputCls} maxLength={200} /></Row>
            <Row label="Message"><textarea value={s.auto_reply.body} onChange={(e) => set("auto_reply", { ...s.auto_reply, body: e.target.value })} rows={6} className={textareaCls} maxLength={4000} /></Row>
            <div className="rounded-xl border border-line bg-paper p-3 text-[13px]"><p className="text-[11px] uppercase tracking-wide text-stone-400">Preview</p><p className="mt-1 font-medium">{s.auto_reply.subject.replace(/\{\{?first_name\}?\}/g, "Alex").replace(/\{\{?name\}?\}/g, "Alex Carter").replace(/\{\{?company\}?\}/g, "Carter Dental")}</p><p className="mt-1 whitespace-pre-line text-stone-600">{s.auto_reply.body.replace(/\{\{?first_name\}?\}/g, "Alex").replace(/\{\{?name\}?\}/g, "Alex Carter").replace(/\{\{?company\}?\}/g, "Carter Dental")}</p><p className="mt-2 text-[12px] text-stone-400">From “{s.auto_reply.from_name}”{s.auto_reply.reply_to ? ` · replies go to ${s.auto_reply.reply_to}` : ""}</p></div>
            <button disabled={busy || !p.mailOn} onClick={() => startBusy(async () => { const r = await testAutoReplyAction(p.id, s); setMsg(r?.error ? { t: r.error, bad: true } : { t: r?.message ?? "Test sent." }); })} className="btn-ghost h-9 justify-self-start px-3 text-[13px]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send a test to myself</button>
          </section>
        )}

        {sec === "security" && (
          <section className="card grid gap-4 p-5">
            <div>
              <h3 className="flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck className="h-4 w-4" /> Spam protection</h3>
              <ul className="mt-2 grid gap-1.5 text-[13px] text-stone-600"><li>✓ Hidden bot trap — always on</li></ul>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Row label="Per device" hint="submissions"><input type="number" min={1} max={100} value={s.spam.ip_limit} onChange={(e) => set("spam", { ...s.spam, ip_limit: Number(e.target.value) })} className={inputCls} /></Row>
                <Row label="Per email" hint="submissions"><input type="number" min={1} max={50} value={s.spam.email_limit} onChange={(e) => set("spam", { ...s.spam, email_limit: Number(e.target.value) })} className={inputCls} /></Row>
                <Row label="Within" hint="minutes"><input type="number" min={1} max={1440} value={s.spam.window_min} onChange={(e) => set("spam", { ...s.spam, window_min: Number(e.target.value) })} className={inputCls} /></Row>
              </div>
              <div className="mt-3 max-w-xs"><Row label="Minimum time to fill in" hint="seconds (0 = off)"><input type="number" min={0} max={60} value={s.spam.min_seconds} onChange={(e) => set("spam", { ...s.spam, min_seconds: Number(e.target.value) })} className={inputCls} /></Row></div>
              <div className="mt-3"><Toggle on={s.captcha} onChange={(v) => set("captcha", v)} label="Cloudflare Turnstile human check (hosted page and iframe)" /></div>
              {turnstileWarn && <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Turnstile is switched on here, but Growvia&apos;s Turnstile keys aren&apos;t set up yet — so the human check is <b>not</b> running. The bot trap, time check and rate limits still protect this form.</p>}
              {s.captcha && p.captchaOn && <p className="mt-2 text-[12px] text-lime-800">Turnstile is active on the hosted page and iframe.</p>}
            </div>
            <div className="border-t border-line pt-4">
              <h3 className="text-[14px] font-semibold">Allowed websites</h3>
              <p className="mt-1 text-[12px] text-stone-500">Leave empty to accept posts from any site. When set, other sites get “403 not allowed”. The hosted link and iframe always work.</p>
              <div className="mt-2"><Chips value={s.allowed_origins} onChange={(v) => set("allowed_origins", v)} placeholder="yourbusiness.com" normalize={(r) => normalizeOrigins(r)} label="Add an allowed website" /></div>
            </div>
            <div className="border-t border-line pt-4">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold"><KeyRound className="h-4 w-4" /> Server key</h3>
              <p className="mt-1 text-[12px] text-stone-500">For your website&apos;s own backend: send <code>Authorization: Bearer &lt;key&gt;</code> to skip the website check. {hasKey ? "A key is active." : "No key yet."}</p>
              {serverKey && <div className="mt-2 flex items-center gap-2 rounded-xl bg-ink p-3 font-mono text-[12px] text-lime"><span className="min-w-0 flex-1 break-all">{serverKey}</span><CopyButton text={serverKey} /></div>}
              {serverKey && <p className="mt-1 text-[12px] text-amber-800">Copy it now — it won&apos;t be shown again.</p>}
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => startBusy(async () => { const r = await regenerateServerKeyAction(p.id); if (r.key) { setServerKey(r.key); setHasKey(true); } else setMsg({ t: r.error ?? "Couldn't create a key.", bad: true }); })} className="btn-ghost h-9 px-3 text-[13px]">{hasKey ? "Regenerate key" : "Create server key"}</button>
                {hasKey && <button disabled={busy} onClick={() => startBusy(async () => { await removeServerKeyAction(p.id); setHasKey(false); setServerKey(null); })} className="btn-ghost h-9 px-3 text-[13px]">Remove</button>}
              </div>
            </div>
          </section>
        )}

        {sec === "style" && (
          <section className="card grid gap-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Accent colour"><span className="flex items-center gap-2"><input type="color" value={s.accent} onChange={(e) => set("accent", e.target.value)} className="h-11 w-14 rounded-lg border border-line" /><input value={s.accent} onChange={(e) => set("accent", e.target.value)} className={inputCls} maxLength={7} /></span></Row>
              <Row label="Corners"><select value={s.style.radius} onChange={(e) => set("style", { ...s.style, radius: e.target.value as FormSettings["style"]["radius"] })} className={inputCls}><option value="square">Square</option><option value="rounded">Rounded</option><option value="pill">Pill</option></select></Row>
              <Row label="Font"><select value={s.style.font} onChange={(e) => set("style", { ...s.style, font: e.target.value as FormSettings["style"]["font"] })} className={inputCls}><option value="inherit">Same as my website</option><option value="system">System font</option></select></Row>
              <Row label="Theme"><select value={s.style.theme} onChange={(e) => set("style", { ...s.style, theme: e.target.value as FormSettings["style"]["theme"] })} className={inputCls}><option value="light">Light</option><option value="dark">Dark</option></select></Row>
            </div>
            <Toggle on={s.show_branding} onChange={(v) => set("show_branding", v)} label="Show “Powered by Growvia”" />
            <details className="rounded-xl border border-line p-3"><summary className="cursor-pointer text-[13px] font-medium">Advanced: custom CSS (iframe and script)</summary><textarea value={s.custom_css} onChange={(e) => set("custom_css", e.target.value)} rows={6} spellCheck={false} className={`${textareaCls} mt-2 font-mono text-[12px]`} placeholder=".gv-button { border-radius: 999px; }" /></details>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button disabled={pending} onClick={save} className="btn-primary h-11 px-5 text-[14px]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save form"}</button>
          <button disabled={busy} onClick={() => startBusy(async () => { const r = await duplicateFormAction(p.id); if (r?.id) router.push(`/app/forms?id=${r.id}`); else setMsg({ t: r?.error ?? "Couldn't duplicate.", bad: true }); })} className="btn-ghost h-11 px-4 text-[14px]"><Copy className="h-4 w-4" /> Duplicate</button>
          {p.canDelete && <button disabled={busy} onClick={() => { if (confirm("Delete this form? Leads stay in Leads.")) startBusy(async () => { await deleteFormAction(p.id); router.push("/app/forms"); router.refresh(); }); }} className="btn-ghost h-11 px-4 text-[14px] text-red-700"><Trash2 className="h-4 w-4" /> Delete</button>}
          {msg && <p role={msg.bad ? "alert" : "status"} className={`text-[13px] ${msg.bad ? "text-red-600" : "text-lime-800"}`}>{msg.t}</p>}
        </div>
      </div>

      <div className="grid content-start gap-4">
        <section className="card p-5">
          <div className="flex items-center justify-between"><h3 className="text-[14px] font-semibold">Live preview</h3>
            <div className="flex gap-1 text-[12px]">{(["form", "errors", "success"] as const).map((k) => <button key={k} onClick={() => setPv(k)} className={`rounded-full px-2.5 py-1 ${pv === k ? "bg-ink text-white" : "bg-mist"}`}>{k === "form" ? "Form" : k === "errors" ? "Errors" : "Success"}</button>)}</div>
          </div>
          <div className={`mt-4 rounded-2xl p-4 ${s.style.theme === "dark" ? "bg-ink" : "bg-paper"}`}>
            {s.title && <p className={`mb-3 text-[18px] font-semibold ${s.style.theme === "dark" ? "text-white" : ""}`}>{s.title}</p>}
            <LeadForm key={JSON.stringify(fields).length + pv} formId={p.id} fields={fields} button={s.button} accent={s.accent} success={{ title: s.success_title, text: s.success_text }} errorText={s.error_text} captcha={null} preview style={s.style} previewState={pv} />
          </div>
        </section>

        <section className="card p-5">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold"><Code2 className="h-4 w-4" /> Embed</h3>
          <div className="mt-3 flex flex-wrap gap-1 text-[12px]">{(["script", "inline", "iframe", "html", "link"] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-2.5 py-1 ${tab === k ? "bg-ink text-white" : "bg-mist"}`}>{{ script: "Script", inline: "Use my site's styles", iframe: "iFrame", html: "Your own HTML", link: "Link" }[k]}</button>)}</div>
          <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-ink p-3 text-[11.5px] leading-relaxed text-lime/90"><code>{code[tab]}</code></pre>
          <div className="mt-2 flex items-center gap-3"><CopyButton text={code[tab]} /><Link href="/docs/forms" target="_blank" className="text-[12px] font-medium underline underline-offset-2">Developer docs (API, server posts, examples)</Link></div>
          {tab === "script" && <div className="mt-3"><InstallSteps code={code.script} /></div>}
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[12px] font-medium">Field keys</p>
            <table className="mt-1.5 w-full text-[12px]"><tbody>{fields.map((f) => <tr key={f.key} className="border-t border-line/60"><td className="py-1 pr-2">{plainLabel(f.label)}</td><td className="py-1 font-mono text-stone-600">{f.key}{f.aliases?.length ? <span className="text-stone-400"> (also {f.aliases.join(", ")})</span> : null}</td><td className="py-1 text-right text-stone-400">{TYPE_LABEL[f.type]}</td></tr>)}</tbody></table>
          </div>
        </section>

        {p.recent.length > 0 && (
          <section className="card p-5">
            <h3 className="text-[14px] font-semibold">Latest submissions</h3>
            <ul className="mt-2 grid gap-1.5 text-[13px]">{p.recent.map((r) => <li key={r.id}><Link href={`/app/leads/${r.id}`} className="flex justify-between gap-2 hover:underline"><span className="truncate">{r.name}{r.email ? ` · ${r.email}` : ""}</span><span className="shrink-0 text-stone-400">{r.when}</span></Link></li>)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}

/* ───────── One field's settings ───────── */
function FieldEditor({ f, taken, onChange }: { f: FormField; taken: string[]; onChange: (p: Partial<FormField>) => void }) {
  const [keyDraft, setKeyDraft] = useState(f.key);
  const keyErr = !/^[a-z][a-z0-9_]{0,39}$/.test(keyDraft) ? "Use lowercase letters, numbers and _ (start with a letter)." : taken.includes(keyDraft) ? "Another field already uses this key." : "";
  return (
    <div className="grid gap-3 border-t border-line p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Row label="Label" hint="links: [text](https://…)"><input value={f.label} onChange={(e) => onChange({ label: e.target.value })} className={inputCls} maxLength={300} /></Row>
        <Row label="Key" hint="posted name"><input value={keyDraft} onChange={(e) => setKeyDraft(slugKey(e.target.value) === "f_field" && !e.target.value ? "" : e.target.value.toLowerCase())} onBlur={() => { if (!keyErr && keyDraft !== f.key) onChange({ key: keyDraft, id: keyDraft, aliases: [...new Set([...(f.aliases ?? []), f.key])] }); else setKeyDraft(f.key); }} className={`${inputCls} font-mono`} maxLength={40} aria-invalid={Boolean(keyErr)} />{keyErr && keyDraft !== f.key && <span className="mt-1 block text-[11px] text-red-600">{keyErr}</span>}</Row>
        <Row label="Type"><select value={f.type} onChange={(e) => { const t = e.target.value as FieldType; onChange({ type: t, ...(CHOICE.includes(t) && !f.options?.length ? { options: ["Option 1", "Option 2"] } : {}), ...(t === "file" ? { accept: f.accept ?? ["pdf", "doc", "docx"], max_mb: f.max_mb ?? 10 } : {}), ...(t === "checkbox" ? { checked_value: f.checked_value ?? "yes" } : {}) }); }} className={inputCls}>{FIELD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></Row>
        <Row label="Saves as"><select value={f.maps} onChange={(e) => onChange({ maps: e.target.value as FormField["maps"] })} className={inputCls}>{Object.entries(MAP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Row>
      </div>
      {f.type !== "hidden" && <Toggle on={f.required} onChange={(v) => onChange({ required: v })} label={f.type === "checkbox" ? "Must be ticked to send" : "Required"} />}
      {f.type !== "hidden" && f.type !== "checkbox" && <div className="grid gap-3 sm:grid-cols-2">
        {TEXTY.includes(f.type) && <Row label="Placeholder"><input value={f.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} className={inputCls} maxLength={120} /></Row>}
        <Row label="Help text" hint="optional"><input value={f.help ?? ""} onChange={(e) => onChange({ help: e.target.value })} className={inputCls} maxLength={300} /></Row>
      </div>}
      {(TEXTY.includes(f.type) || f.type === "multiselect") && <div className="grid gap-3 sm:grid-cols-3">
        <Row label={f.type === "multiselect" ? "Min choices" : "Min length"}><input type="number" min={0} value={f.min ?? ""} onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Row>
        <Row label={f.type === "multiselect" ? "Max choices" : "Max length"}><input type="number" min={0} value={f.max ?? ""} onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} /></Row>
        <Row label="Error text" hint="optional"><input value={f.error ?? ""} onChange={(e) => onChange({ error: e.target.value })} className={inputCls} maxLength={200} /></Row>
      </div>}
      {CHOICE.includes(f.type) && <Row label={f.type === "range" ? "Steps (one per line, low → high)" : "Options (one per line)"}><OptionsBox value={f.options ?? []} onChange={(o) => onChange({ options: o })} /></Row>}
      {["select", "radio", "range"].includes(f.type) && <Row label="Default choice" hint="optional"><select value={f.default ?? ""} onChange={(e) => onChange({ default: e.target.value || undefined })} className={inputCls}><option value="">None</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select></Row>}
      {f.type === "checkbox" && <Row label="Value when ticked"><input value={f.checked_value ?? "yes"} onChange={(e) => onChange({ checked_value: e.target.value })} className={inputCls} maxLength={40} /></Row>}
      {f.type === "file" && <div className="grid gap-3 sm:grid-cols-2">
        <Row label="Allowed file types"><div className="flex flex-wrap gap-2">{FILE_TYPES.map((x) => <label key={x} className="flex items-center gap-1 text-[13px]"><input type="checkbox" checked={(f.accept ?? []).includes(x)} onChange={(e) => onChange({ accept: e.target.checked ? [...(f.accept ?? []), x] : (f.accept ?? []).filter((y) => y !== x) })} /> {x.toUpperCase()}</label>)}</div></Row>
        <Row label="Max size" hint="MB"><input type="number" min={1} max={25} value={f.max_mb ?? 10} onChange={(e) => onChange({ max_mb: Number(e.target.value) })} className={inputCls} /></Row>
      </div>}
      {(f.type === "hidden" || TEXTY.includes(f.type)) && <Row label="Default value" hint={f.type === "hidden" ? "saved on every lead" : "optional"}><input value={f.default ?? ""} onChange={(e) => onChange({ default: e.target.value || undefined })} className={inputCls} maxLength={500} /></Row>}
      {f.type !== "file" && <Row label="Fill from URL parameter" hint={`optional — e.g. ?${f.param || f.key}=…`}><input value={f.param ?? ""} onChange={(e) => onChange({ param: e.target.value.replace(/[^a-zA-Z0-9_\-]/g, "") || undefined })} placeholder={f.key} className={`${inputCls} font-mono`} maxLength={40} /></Row>}
    </div>
  );
}

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const labelHtml = (t: string) => { let out = "", last = 0; const re = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]{1,500})\)/g; let m: RegExpExecArray | null; while ((m = re.exec(t))) { out += esc(t.slice(last, m.index)) + `<a href="${esc(m[2])}" target="_blank" rel="noopener noreferrer">${esc(m[1])}</a>`; last = m.index + m[0].length; } return out + esc(t.slice(last)); };

/** "Your own HTML" embed: semantic markup with gv-* classes; posts via fetch (multipart), works without JS too. */
export function htmlCode(origin: string, id: string, fields: FormField[], button: string, success: { title: string; text: string }) {
  const hasFile = fields.some((f) => f.type === "file");
  const row = (f: FormField) => {
    const fid = `gv-${f.key}`, req = f.required ? " required" : "", ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "", def = f.default ? ` value="${esc(f.default)}"` : "";
    const help = f.help ? `\n    <small class="gv-help">${labelHtml(f.help)}</small>` : "";
    const errEl = `\n    <span class="gv-field-error" data-for="${f.key}" hidden></span>`;
    if (f.type === "hidden") return `  <input type="hidden" name="${f.key}"${def}${f.param ? ` data-param="${esc(f.param)}"` : ""}>`;
    if (f.type === "checkbox") return `  <div class="gv-field gv-field-checkbox gv-field-${f.key}">\n    <label><input class="gv-checkbox" type="checkbox" id="${fid}" name="${f.key}" value="${esc(f.checked_value ?? "yes")}"${req}> ${labelHtml(f.label)}</label>${errEl}\n  </div>`;
    const label = `    <label class="gv-label" for="${fid}">${labelHtml(f.label)}${f.required ? "" : " (optional)"}</label>${help}`;
    let control: string;
    if (f.type === "multiselect" || f.type === "radio") control = `    <div class="gv-choices">\n${(f.options ?? []).map((o, i) => `      <label class="gv-choice"><input type="${f.type === "radio" ? "radio" : "checkbox"}" name="${f.key}"${i === 0 ? ` id="${fid}"` : ""} value="${esc(o)}"${f.default === o ? " checked" : ""}> ${esc(o)}</label>`).join("\n")}\n    </div>`;
    else if (f.type === "select" || f.type === "range") control = `    <select class="gv-select" id="${fid}" name="${f.key}"${req}>\n      <option value="" disabled${f.default ? "" : " selected"}>Choose an option</option>\n${(f.options ?? []).map((o) => `      <option value="${esc(o)}"${f.default === o ? " selected" : ""}>${esc(o)}</option>`).join("\n")}\n    </select>`;
    else if (f.type === "textarea") control = `    <textarea class="gv-textarea" id="${fid}" name="${f.key}" rows="4"${f.max ? ` maxlength="${f.max}"` : ""}${f.min ? ` minlength="${f.min}"` : ""}${ph}${req}>${esc(f.default ?? "")}</textarea>`;
    else if (f.type === "file") control = `    <input class="gv-file" type="file" id="${fid}" name="${f.key}" accept="${(f.accept ?? []).map((x) => `.${x}`).join(",")}"${req}>`;
    else control = `    <input class="gv-input" type="${f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}" id="${fid}" name="${f.key}"${f.max ? ` maxlength="${f.max}"` : ""}${f.min ? ` minlength="${f.min}"` : ""}${ph}${def}${req}>`;
    return `  <div class="gv-field gv-field-${f.type} gv-field-${f.key}">\n${label}\n${control}${errEl}\n  </div>`;
  };
  const formId = `gv-form-${id.slice(0, 8)}`;
  const js = `<script>
(function () {
  var f = document.getElementById("${formId}"); if (!f) return;
  var SUCCESS = ${JSON.stringify(success).replace(/[<\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))};
  var q = new URLSearchParams(location.search);
  f.elements._page.value = location.href; f.elements._gv_t.value = String(Date.now());
  var frame = document.getElementsByName("${formId}-frame")[0]; if (frame) frame.style.display = "none";
  f.querySelectorAll("[data-param]").forEach(function (h) { var v = q.get(h.getAttribute("data-param")); if (v) h.value = v; });
  function thanks(t, x) { var ok = document.createElement("div"); ok.className = "gv-success"; ok.setAttribute("role", "status"); var a = document.createElement("p"); a.className = "gv-success-title"; a.textContent = t; var b = document.createElement("p"); b.className = "gv-success-text"; b.textContent = x; ok.appendChild(a); ok.appendChild(b); f.replaceWith(ok); }
  if (q.get("gv_sent") === "1") { thanks(SUCCESS.title, SUCCESS.text); return; }
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var b = f.querySelector(".gv-button"), label = b.textContent, fd = new FormData(f);
    q.forEach(function (v, k) { if (k.indexOf("utm_") === 0) fd.set(k, v); });
    f.querySelectorAll(".gv-field-error").forEach(function (x) { x.hidden = true; });
    b.disabled = true; b.textContent = "Sending...";
    fetch(f.action, { method: "POST", headers: { Accept: "application/json" }, body: fd })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: "Connection problem, please try again." }; })
      .then(function (r) {
        if (r.ok && r.redirect) { location.href = r.redirect; return; }
        if (r.ok) { thanks((r.success && r.success.title) || SUCCESS.title, (r.success && r.success.text) || SUCCESS.text); return; }
        var err = f.querySelector(".gv-error"); err.textContent = r.error || "Something went wrong."; err.hidden = false;
        if (r.fields) Object.keys(r.fields).forEach(function (k) { var s = f.querySelector('.gv-field-error[data-for="' + k + '"]'); if (s) { s.textContent = r.fields[k]; s.hidden = false; } });
        b.disabled = false; b.textContent = label;
      });
  });
})();
</script>`;
  return `<form id="${formId}" class="gv-form" action="${origin}/api/forms/${id}" method="POST"${hasFile ? ' enctype="multipart/form-data"' : ""} target="${formId}-frame">\n${fields.map(row).join("\n")}\n  <input type="text" name="_gv_hp" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off" aria-hidden="true">\n  <input type="hidden" name="_page" value="">\n  <input type="hidden" name="_gv_t" value="">\n  <input type="hidden" name="_gv_frame" value="1">\n  <p class="gv-error" role="alert" hidden></p>\n  <button class="gv-button" type="submit">${esc(button)}</button>\n</form>\n<iframe name="${formId}-frame" title="Form status" class="gv-status-frame" style="width:100%;height:64px;border:0;background:transparent"></iframe>\n${js}`;
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
