import type { Metadata } from "next";
import Link from "next/link";
import { siteOrigin } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = { title: "Forms API — developer docs", description: "Post leads to Growvia forms from a browser, your own HTML, or your server. Field keys, validation errors, origin rules, rate limits, Turnstile, uploads, pre-fill and UTMs.", alternates: { canonical: "/docs/forms" } };

const Code = ({ children }: { children: string }) => <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 text-[12.5px] leading-relaxed text-lime/90"><code>{children}</code></pre>;
const H = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="mt-12 scroll-mt-20 text-[22px] font-semibold tracking-tight">{children}</h2>;

export default function FormsDocs() {
  const o = siteOrigin(), id = "FORM_ID";
  return (
    <>
    <Nav />
    <main className="container-x max-w-3xl py-14 text-[15px] leading-relaxed text-stone-700">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Developer docs</p>
      <h1 className="mt-2 text-[34px] font-semibold tracking-tight text-ink">Growvia Forms API</h1>
      <p className="mt-3">Every Growvia form has an ID (in the builder&apos;s <b>Embed</b> tab, with each field&apos;s <b>key</b>). Post to it from a browser, your own HTML, or your server — leads land in Growvia with all answers, UTMs and consent.</p>
      <nav className="mt-6 flex flex-wrap gap-2 text-[13px]">{[["post", "POST"], ["get", "GET"], ["errors", "Errors"], ["server", "From a server"], ["origins", "Origins"], ["limits", "Rate limits & spam"], ["files", "File uploads"], ["prefill", "Pre-fill & hidden"], ["examples", "Examples"]].map(([a, l]) => <a key={a} href={`#${a}`} className="rounded-full border border-line px-3 py-1 hover:border-ink">{l}</a>)}</nav>

      <H id="post">POST {"/api/forms/:id"}</H>
      <p>Send JSON. Values are keyed by <b>field key</b> (stable — renaming or reordering a field never changes it; renamed keys keep working as aliases).</p>
      <Code>{`POST ${o}/api/forms/${id}
Content-Type: application/json
Authorization: Bearer <server key>      ← optional, server-to-server only

{
  "fields": {
    "full_name": "Alex Carter",
    "work_email": "alex@carter.com",
    "services": ["AI agents", "Web development"],   ← multi-select = array
    "budget": "$25k–$50k",
    "consent": "yes"                                ← checkbox: its "checked" value
  },
  "page": "https://yoursite.com/contact?utm_source=linkedin",
  "referrer": "https://www.linkedin.com/",
  "utm": { "utm_source": "linkedin", "utm_campaign": "qa" },
  "turnstileToken": "…"                             ← only if Turnstile is on (hosted/iframe)
}`}</Code>
      <p className="mt-3">Success — <code>200</code>:</p>
      <Code>{`{ "ok": true, "success": { "title": "Thanks — message sent!", "text": "…" }, "redirect": "https://…" | undefined, "leadId": "…" }`}</Code>
      <p className="mt-3">Plain HTML forms (<code>application/x-www-form-urlencoded</code>) and uploads (<code>multipart/form-data</code>) are accepted too. Add <code>Accept: application/json</code> to get JSON back instead of a redirect.</p>

      <H id="get">GET {"/api/forms/:id"}</H>
      <p>The public form definition — build your own form from it.</p>
      <Code>{`{ "ok": true, "id": "…", "button": "Send message", "success": {…}, "error_text": "…",
  "fields": [
    { "key": "work_email", "type": "email", "label": "Work email", "required": true, "placeholder": "", "help": "", "max": 200 },
    { "key": "services", "type": "multiselect", "options": ["AI agents","Web development","SEO"], "min": 1, "max": 2 },
    { "key": "budget", "type": "range", "options": ["Under $25k","$25k–$50k","$50k–$100k"], "default": "$25k–$50k" },
    { "key": "consent", "type": "checkbox", "required": true, "checked_value": "yes", "consent": true,
      "label": "I agree to the [privacy policy](https://…)" },
    { "key": "cv", "type": "file", "accept": ["pdf"], "max_mb": 10 },
    { "key": "service", "type": "hidden", "param": "service" }
  ] }`}</Code>
      <p className="mt-3">Types: <code>text email tel url textarea select radio multiselect checkbox range hidden file</code>. Labels may contain safe links written as <code>[text](https://url)</code> — render them as links opening in a new tab, never as HTML.</p>

      <H id="errors">Errors and status codes</H>
      <Code>{`400 { "ok": false, "status": 400, "error": "Please fix 2 fields (starting with “Consent”).",
      "fields": { "consent": "Please tick the box to agree before sending.", "project_details": "Tell us a bit more (10+ characters)" } }
403 { "ok": false, "status": 403, "error": "This website isn't allowed to send this form." }
429 { "ok": false, "status": 429, "error": "Too many messages — please try again in a few minutes." }
404 form not found · 413 upload too big`}</Code>
      <p className="mt-3">Show <code>fields[key]</code> next to each input. Every rule (required, checkbox value, email/phone/URL format, options, min/max length or choices, file type/size) is enforced on the server.</p>

      <H id="server">Posting from your server</H>
      <p>Create a <b>server key</b> in the form&apos;s <b>Spam &amp; security</b> tab (shown once — store it as a secret). Requests with <code>Authorization: Bearer &lt;key&gt;</code> skip the website check and the human check. The per-email limit still applies. Never put the key in browser code.</p>

      <H id="origins">Origin rules and CORS</H>
      <p>With <b>Allowed websites</b> empty, any site may post (CORS <code>*</code>). When set, browser posts must come from those domains (subdomains included) or get <code>403</code>; CORS echoes allowed origins only. The hosted link <code>{o}/f/{id}</code> and the iframe always work — the iframe only renders on your allowed sites.</p>

      <H id="limits">Rate limits and spam protection</H>
      <ul className="mt-3 list-disc pl-5"><li>Hidden bot trap field <code>_gv_hp</code> — always on (leave it empty).</li><li>Per device and per email limits (default 5 and 3 per 10 minutes) → <code>429</code>.</li><li>Minimum time to fill in (default 3 s): send the time the form loaded as <code>_gv_t</code> (milliseconds). Without it the check is skipped.</li><li>Cloudflare Turnstile on Growvia&apos;s hosted page and iframe when switched on (send <code>turnstileToken</code>).</li></ul>
      <p className="mt-2">Blocked attempts are logged with the reason and counted in the builder.</p>

      <H id="files">File uploads</H>
      <p>Use <code>multipart/form-data</code> with the file under its field key. Allowed types are checked by file signature (not just the name), the size limit is per field (default 10 MB). Files are stored privately — the team gets 10-minute download links in Growvia; they are never public.</p>
      <Code>{`curl -X POST ${o}/api/forms/${id} -H "Accept: application/json" \\
  -F full_name="Alex Carter" -F work_email="alex@carter.com" -F consent=yes \\
  -F project_details="We need an AI assistant for support" -F cv=@resume.pdf`}</Code>

      <H id="prefill">URL pre-fill, hidden fields and UTMs</H>
      <p>Any field can opt in to a URL parameter (builder → field → <i>Fill from URL parameter</i>). <code>{`${o}/f/${id}?service=Hire%20engineers&utm_source=linkedin`}</code> fills <code>service</code> and saves the UTMs. The script embed reads your page&apos;s URL; the iframe receives it automatically. Hidden fields have a default value and can be filled the same way. Page URL, referrer and <code>utm_source / medium / campaign / term / content</code> are saved on every lead.</p>

      <H id="examples">Examples</H>
      <p className="mt-3 font-medium text-ink">Browser (fetch)</p>
      <Code>{`const res = await fetch("${o}/api/forms/${id}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fields: { full_name, work_email, consent: "yes", _gv_t: String(loadedAt) },
                         page: location.href, referrer: document.referrer }),
});
const out = await res.json();
if (!out.ok) showErrors(out.fields); // { key: message }`}</Code>
      <p className="mt-4 font-medium text-ink">Next.js route handler (forwarding with the server key)</p>
      <Code>{`// app/api/contact/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch("${o}/api/forms/${id}", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: \`Bearer \${process.env.GROWVIA_FORM_KEY}\` },
    body: JSON.stringify({ fields: body, page: req.headers.get("referer") ?? undefined }),
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}`}</Code>
      <p className="mt-4 font-medium text-ink">curl</p>
      <Code>{`curl -X POST ${o}/api/forms/${id} \\
  -H "Content-Type: application/json" -H "Authorization: Bearer $GROWVIA_FORM_KEY" \\
  -d '{"fields":{"full_name":"Alex Carter","work_email":"alex@carter.com","consent":"yes"}}'`}</Code>
      <p className="mt-10 text-[13px] text-stone-500">Questions? <Link href="/contact" className="underline">Contact us</Link>.</p>
    </main>
    <Footer />
    </>
  );
}
