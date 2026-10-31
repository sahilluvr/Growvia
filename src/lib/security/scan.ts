import "server-only";
import tls from "node:tls";
import { fetchPage, safeHost } from "@/lib/seo/crawl";
import { lookup } from "@/lib/health/dns";

/*
 * Security health (v078): an outside-in health check of the project's own website — what any browser or visitor
 * can see. Polite, read-only requests only: no exploitation, no password guessing, no heavy crawling.
 * It is not a penetration test, and the report says so.
 */

export type Status = "pass" | "warn" | "fail" | "info";
export type Area = "https" | "headers" | "content" | "exposure" | "email" | "domain" | "reputation";
export type Platform = "wordpress" | "shopify" | "wix" | "squarespace" | "webflow" | "cloudflare" | "other";
export type SecCheck = {
  id: string; area: Area; title: string; status: Status; weight: number; critical?: boolean;
  detail: string; why: string; fix?: string; steps?: string[];
};
export type SecReport = { url: string; host: string; domain: string; platform: Platform; cloudflare: boolean; score: number; grade: string; checks: SecCheck[]; at: string; counts: Record<Status, number> };

export const AREA_LABEL: Record<Area, string> = { https: "HTTPS & certificate", headers: "Browser protection", content: "Page content", exposure: "Exposed files & info", email: "Email spoofing", domain: "Domain", reputation: "Reputation" };

type Fetched = Awaited<ReturnType<typeof fetchPage>>;
export type Deps = {
  fetch: (url: string, timeout?: number) => Promise<Fetched>;
  tls: (host: string) => Promise<{ validTo: string; issuer: string; authorized: boolean; error?: string } | null>;
  dns: (name: string, type: "TXT" | "CAA" | "DS") => Promise<string[]>;
  rdap: (domain: string) => Promise<{ expires: string | null; statuses: string[] } | null>;
  safeBrowsing: ((url: string) => Promise<boolean | null>) | null;
  now: () => number;
};

/* ---------- live dependencies ---------- */

export async function tlsInfo(host: string): Promise<{ validTo: string; issuer: string; authorized: boolean; error?: string } | null> {
  if (!(await safeHost(host))) return null;
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
      const c = sock.getPeerCertificate();
      const out = c && c.valid_to ? { validTo: new Date(c.valid_to).toISOString(), issuer: String((c.issuer as { O?: string; CN?: string } | undefined)?.O ?? (c.issuer as { CN?: string } | undefined)?.CN ?? ""), authorized: sock.authorized, error: sock.authorized ? undefined : String(sock.authorizationError ?? "") } : null;
      sock.end(); resolve(out);
    });
    sock.on("error", () => resolve(null));
    sock.on("timeout", () => { sock.destroy(); resolve(null); });
  });
}

async function rdapLookup(domain: string) {
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { accept: "application/rdap+json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { events?: { eventAction: string; eventDate: string }[]; status?: string[] };
    return { expires: d.events?.find((e) => e.eventAction === "expiration")?.eventDate ?? null, statuses: (d.status ?? []).map((s) => s.toLowerCase()) };
  } catch { return null; }
}

const SB_KEY = (process.env.GOOGLE_SAFE_BROWSING_KEY ?? "").trim();
async function safeBrowsing(url: string): Promise<boolean | null> {
  try {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SB_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ client: { clientId: "growvia", clientVersion: "1" }, threatInfo: { threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"], platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url }] } }),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { matches?: unknown[] };
    return Boolean(d.matches?.length);
  } catch { return null; }
}

export const LIVE: Deps = {
  fetch: fetchPage, tls: tlsInfo,
  dns: (n, t) => lookup(n, t),
  rdap: rdapLookup, safeBrowsing: SB_KEY ? safeBrowsing : null, now: () => Date.now(),
};

/* ---------- helpers ---------- */

export function normalizeSite(input: string): { url: string; host: string; domain: string } | null {
  let s = (input ?? "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    if (!/\./.test(host)) return null;
    return { url: `https://${host}/`, host, domain: regDomain(host) };
  } catch { return null; }
}
const TWO_PART = /\.(co|com|net|org|gov|ac|edu)\.[a-z]{2}$/;
export const regDomain = (host: string) => { const h = host.replace(/^www\./, ""); const p = h.split("."); return p.slice(TWO_PART.test(h) ? -3 : -2).join("."); };

export function detectPlatform(html: string, h: Headers): { platform: Platform; cloudflare: boolean } {
  const cloudflare = Boolean(h.get("cf-ray")) || /cloudflare/i.test(h.get("server") ?? "");
  const gen = (html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)/i)?.[1] ?? "").toLowerCase();
  const platform: Platform =
    /wp-content|wp-includes/.test(html) || gen.includes("wordpress") ? "wordpress"
    : h.get("x-shopid") || h.get("x-shopify-stage") || /cdn\.shopify\.com/.test(html) ? "shopify"
    : h.get("x-wix-request-id") || /static\.wixstatic\.com|wix\.com/.test(html) ? "wix"
    : /squarespace/.test(html) || gen.includes("squarespace") ? "squarespace"
    : /webflow/.test(html) || gen.includes("webflow") ? "webflow"
    : cloudflare ? "cloudflare" : "other";
  return { platform, cloudflare };
}

const HOSTED: Platform[] = ["shopify", "wix", "squarespace", "webflow"];
/** Platform-specific "how to fix" for adding security headers. */
function headerSteps(p: Platform, cf: boolean, header: string): string[] {
  if (HOSTED.includes(p)) return [`${cap(p)} controls most security headers on its servers, so many can't be changed from your dashboard.`, cf ? `Because your site is behind Cloudflare, you can add “${header}” with a Cloudflare Transform Rule (Rules → Transform Rules → Modify Response Header).` : `If it matters for your business, ask ${cap(p)} support, or put the site behind Cloudflare (free) and add the header there.`];
  const out: string[] = [];
  if (cf) out.push(`Cloudflare: Rules → Transform Rules → Modify Response Header → add “${header}”.`);
  if (p === "wordpress") out.push(`WordPress: a security-headers plugin can add “${header}”, or ask your host to add it in the server settings (Apache .htaccess or Nginx config).`);
  if (p === "other" || p === "cloudflare") out.push(`Ask whoever manages your hosting to add the “${header}” response header to every page.`);
  return out;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const days = (iso: string | null | undefined, now: number) => (iso ? Math.floor((Date.parse(iso) - now) / 86_400_000) : null);

/* ---------- the scan ---------- */

export async function scanSite(input: string, deps: Deps = LIVE): Promise<SecReport> {
  const site = normalizeSite(input);
  if (!site) throw new Error("That doesn't look like a website address.");
  const { host, domain } = site;
  if (deps === LIVE && !(await safeHost(host).catch(() => false))) throw new Error("That website address can't be checked.");
  const now = deps.now();
  const checks: SecCheck[] = [];
  const add = (c: SecCheck) => checks.push(c);

  // 1) HTTPS page + certificate
  const [home, plain, cert] = await Promise.all([
    deps.fetch(`https://${host}/`, 15000),
    deps.fetch(`http://${host}/`, 12000),
    deps.tls(host),
  ]);
  const httpsOk = home.status >= 200 && home.status < 400 && /^https:/.test(home.url);
  const html = home.body ?? "";
  const h = home.headers ?? new Headers();
  const { platform, cloudflare } = detectPlatform(html, h);

  add(httpsOk
    ? { id: "https", area: "https", title: "Site loads securely over HTTPS", status: "pass", weight: 20, detail: `https://${host} answered with status ${home.status}.`, why: "HTTPS encrypts everything between visitors and your site, and browsers mark sites without it as “Not secure”." }
    : { id: "https", area: "https", title: "Site doesn't load over HTTPS", status: "fail", weight: 20, critical: true, detail: home.error ? `The secure version couldn't be reached (${home.error}).` : `The secure version answered with status ${home.status || "none"}.`, why: "Without HTTPS, browsers warn visitors and anything they type (forms, logins) can be intercepted.", fix: "Turn on an SSL certificate for your domain. Most hosts and platforms offer a free one (Let's Encrypt) with one click.", steps: cloudflare ? ["Cloudflare: SSL/TLS → Overview → set mode to “Full (strict)” and make sure your host has a certificate."] : ["Look for “SSL”, “HTTPS” or “Security” in your hosting or website builder dashboard and turn it on."] });

  const redirected = /^https:/.test(plain.url) && plain.status > 0 && plain.status < 400;
  add(redirected
    ? { id: "redirect", area: "https", title: "Visitors on http:// are sent to https://", status: "pass", weight: 8, detail: "The plain http address redirects to the secure version.", why: "Old links and typed addresses still land on the secure site." }
    : { id: "redirect", area: "https", title: "http:// doesn't redirect to https://", status: plain.status ? "fail" : "warn", weight: 8, detail: plain.status ? `http://${host} stays on http (status ${plain.status}).` : "We couldn't confirm a redirect from http.", why: "Visitors who type your address or follow old links can end up on an unencrypted page.", fix: "Force HTTPS for every page.", steps: [cloudflare ? "Cloudflare: SSL/TLS → Edge Certificates → turn on “Always Use HTTPS”." : "", platform === "wordpress" ? "WordPress: set both site URLs to https:// in Settings → General and ask your host to force HTTPS." : "", HOSTED.includes(platform) ? `${cap(platform)}: look for “Force HTTPS” or “SSL” in your domain settings.` : "Ask your host to redirect all http traffic to https."].filter(Boolean) });

  if (cert) {
    const d = days(cert.validTo, now) ?? 0;
    const status: Status = !cert.authorized && d >= 0 ? "fail" : d < 0 ? "fail" : d < 14 ? "fail" : d < 30 ? "warn" : "pass";
    add({ id: "cert", area: "https", title: d < 0 ? "Security certificate has expired" : !cert.authorized ? "Security certificate isn't trusted" : `Security certificate valid for ${d} more days`, status, weight: 15, critical: d < 0, detail: `Issued by ${cert.issuer || "unknown"}, valid until ${cert.validTo.slice(0, 10)}.${cert.error ? ` Browser check: ${cert.error}.` : ""}`, why: "An expired or untrusted certificate shows a full-page warning that stops most visitors.", fix: status === "pass" ? undefined : "Renew the certificate or turn on automatic renewal with your host. Free certificates usually renew every 90 days automatically when set up correctly.", steps: status === "pass" ? undefined : ["Check your hosting or platform's SSL settings for auto-renewal.", cloudflare ? "Cloudflare: SSL/TLS → Edge Certificates shows when your certificate renews." : "If renewal keeps failing, ask your host to check the domain's DNS points to them."].filter(Boolean) });
  } else {
    add({ id: "cert", area: "https", title: "Couldn't read the security certificate", status: "info", weight: 0, detail: "The certificate check didn't complete. This sometimes happens with strict firewalls.", why: "Certificate expiry is worth watching so your site never shows a warning page." });
  }

  // 2) Browser protection headers
  if (httpsOk) {
    const hsts = h.get("strict-transport-security") ?? "";
    const maxAge = Number(hsts.match(/max-age=(\d+)/i)?.[1] ?? 0);
    add(maxAge >= 15552000
      ? { id: "hsts", area: "headers", title: "Browsers are told to always use HTTPS (HSTS)", status: "pass", weight: 5, detail: `Strict-Transport-Security: ${hsts}`, why: "Stops downgrade attacks on public Wi-Fi." }
      : { id: "hsts", area: "headers", title: maxAge ? "HSTS is set but short" : "HSTS isn't turned on", status: "warn", weight: 5, detail: maxAge ? `max-age is ${maxAge} seconds; six months or more is recommended.` : "No Strict-Transport-Security header.", why: "HSTS tells browsers to use HTTPS every time, which protects visitors on public Wi-Fi from being sent to a fake http version.", fix: "Add the Strict-Transport-Security header with max-age of at least 6 months, once you're sure every page works on HTTPS.", steps: cloudflare ? ["Cloudflare: SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS) → Enable."] : headerSteps(platform, cloudflare, "Strict-Transport-Security") });

    const csp = h.get("content-security-policy") ?? "";
    add(csp
      ? { id: "csp", area: "headers", title: "Content Security Policy is set", status: "pass", weight: 5, detail: "A Content-Security-Policy header is present.", why: "Limits which scripts can run, which reduces the damage of injected code." }
      : { id: "csp", area: "headers", title: "No Content Security Policy", status: "warn", weight: 5, detail: "No Content-Security-Policy header.", why: "A CSP limits which scripts can run on your pages, so injected or malicious scripts are blocked.", fix: "Start with a simple policy and tighten it over time. Test carefully: a strict policy can break chat widgets or analytics.", steps: headerSteps(platform, cloudflare, "Content-Security-Policy") });

    const xfo = h.get("x-frame-options") ?? "";
    const fa = /frame-ancestors/i.test(csp);
    add(xfo || fa
      ? { id: "frame", area: "headers", title: "Protected against clickjacking", status: "pass", weight: 4, detail: xfo ? `X-Frame-Options: ${xfo}` : "CSP frame-ancestors is set.", why: "Other sites can't secretly embed your pages to trick visitors into clicking." }
      : { id: "frame", area: "headers", title: "Pages can be embedded by other sites", status: "warn", weight: 4, detail: "No X-Frame-Options or CSP frame-ancestors.", why: "Attackers can load your page invisibly inside theirs and trick visitors into clicking buttons (clickjacking).", fix: "Add “X-Frame-Options: SAMEORIGIN”.", steps: headerSteps(platform, cloudflare, "X-Frame-Options: SAMEORIGIN") });

    const nos = (h.get("x-content-type-options") ?? "").toLowerCase() === "nosniff";
    add(nos
      ? { id: "nosniff", area: "headers", title: "File types are enforced (nosniff)", status: "pass", weight: 3, detail: "X-Content-Type-Options: nosniff", why: "Stops browsers guessing file types in risky ways." }
      : { id: "nosniff", area: "headers", title: "Browsers may guess file types", status: "warn", weight: 3, detail: "No X-Content-Type-Options: nosniff.", why: "Without it, a browser can treat an uploaded file as a script.", fix: "Add “X-Content-Type-Options: nosniff”.", steps: headerSteps(platform, cloudflare, "X-Content-Type-Options: nosniff") });

    const rp = h.get("referrer-policy");
    add(rp
      ? { id: "referrer", area: "headers", title: "Referrer policy is set", status: "pass", weight: 2, detail: `Referrer-Policy: ${rp}`, why: "Controls what page addresses are shared with other sites." }
      : { id: "referrer", area: "headers", title: "No referrer policy", status: "warn", weight: 2, detail: "No Referrer-Policy header.", why: "Full page addresses (which can include private details) may be sent to other sites when visitors click links.", fix: "Add “Referrer-Policy: strict-origin-when-cross-origin”.", steps: headerSteps(platform, cloudflare, "Referrer-Policy: strict-origin-when-cross-origin") });

    const pp = h.get("permissions-policy");
    add(pp
      ? { id: "permissions", area: "headers", title: "Permissions policy is set", status: "pass", weight: 2, detail: "Permissions-Policy header present.", why: "Limits access to camera, microphone and location." }
      : { id: "permissions", area: "headers", title: "No permissions policy", status: "warn", weight: 2, detail: "No Permissions-Policy header.", why: "Lets you switch off features your site doesn't use (camera, microphone, location), so embedded scripts can't request them.", fix: "Add “Permissions-Policy: camera=(), microphone=(), geolocation=()” if you don't use those features.", steps: headerSteps(platform, cloudflare, "Permissions-Policy") });

    // Cookies
    const cookies = typeof (h as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function" ? (h as Headers & { getSetCookie: () => string[] }).getSetCookie() : (h.get("set-cookie") ? [h.get("set-cookie")!] : []);
    if (cookies.length) {
      const weak = cookies.filter((c) => !/;\s*secure/i.test(c) || !/;\s*samesite=/i.test(c));
      add(weak.length
        ? { id: "cookies", area: "headers", title: `${weak.length} cookie${weak.length === 1 ? "" : "s"} missing security flags`, status: "warn", weight: 5, detail: weak.slice(0, 3).map((c) => c.split(";")[0].split("=")[0]).join(", "), why: "Cookies without Secure and SameSite flags are easier to steal or misuse.", fix: "Set cookies with Secure, HttpOnly (for login/session cookies) and SameSite=Lax.", steps: platform === "wordpress" ? ["WordPress: update plugins that set these cookies, or ask your host to add secure cookie flags."] : ["Ask your developer or platform support to add the Secure and SameSite flags."] }
        : { id: "cookies", area: "headers", title: "Cookies use security flags", status: "pass", weight: 5, detail: `${cookies.length} cookie${cookies.length === 1 ? "" : "s"} checked.`, why: "Secure, SameSite cookies are harder to steal or misuse." });
    }
  }

  // 3) Page content
  if (httpsOk && html) {
    const mixed = [...html.matchAll(/<(?:script|img|iframe|source|video|audio)[^>]+src=["'](http:\/\/[^"']+)/gi), ...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["'](http:\/\/[^"']+)/gi)].map((m) => m[1]);
    add(mixed.length
      ? { id: "mixed", area: "content", title: `${mixed.length} insecure (http) file${mixed.length === 1 ? "" : "s"} on the home page`, status: "warn", weight: 6, detail: mixed.slice(0, 3).join(" · "), why: "Insecure images or scripts break the padlock and some browsers block them.", fix: "Change these links to https://, or host the files on your own site.", steps: platform === "wordpress" ? ["WordPress: a search-and-replace for http://yourdomain → https://yourdomain in the database usually fixes old links."] : ["Edit the page or theme and replace http:// with https:// for these files."] }
      : { id: "mixed", area: "content", title: "No insecure files on the home page", status: "pass", weight: 6, detail: "All images, scripts and styles load over HTTPS.", why: "Keeps the padlock intact." });

    const insecureForms = [...html.matchAll(/<form[^>]+action=["'](http:\/\/[^"']+)/gi)].map((m) => m[1]);
    add(insecureForms.length
      ? { id: "forms", area: "content", title: "A form sends data without encryption", status: "fail", weight: 6, detail: insecureForms.slice(0, 2).join(" · "), why: "Anything visitors type into this form can be read in transit.", fix: "Change the form's action address to https://." }
      : { id: "forms", area: "content", title: "Forms submit securely", status: "pass", weight: 6, detail: "No forms post to http:// addresses on the home page.", why: "Protects what leads type into your forms." });

    const ext = new Set([...html.matchAll(/<script[^>]+src=["'](https?:)?\/\/([^/"']+)/gi)].map((m) => m[2].toLowerCase()).filter((x) => regDomain(x) !== domain));
    add(ext.size > 15
      ? { id: "thirdparty", area: "content", title: `Scripts load from ${ext.size} outside services`, status: "warn", weight: 2, detail: [...ext].slice(0, 6).join(", "), why: "Every outside script can read what happens on your pages. Fewer is safer and faster.", fix: "Remove plugins, trackers and widgets you no longer use." }
      : { id: "thirdparty", area: "content", title: `Scripts from ${ext.size} outside service${ext.size === 1 ? "" : "s"}`, status: "pass", weight: 2, detail: ext.size ? [...ext].slice(0, 6).join(", ") : "None.", why: "A small number of trusted outside scripts keeps risk low." });
  }

  // 4) Information leaks + exposed files
  const server = h.get("server") ?? "", powered = h.get("x-powered-by") ?? "";
  const gen = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)/i)?.[1] ?? "";
  const leaks = [/\d/.test(server) ? `Server: ${server}` : "", powered ? `X-Powered-By: ${powered}` : "", /\d/.test(gen) ? `Generator: ${gen}` : ""].filter(Boolean);
  add(leaks.length
    ? { id: "versions", area: "exposure", title: "Software versions are visible", status: "warn", weight: 3, detail: leaks.join(" · "), why: "Showing exact versions makes it easy for attackers to look up known flaws.", fix: "Hide version numbers, and keep the software up to date.", steps: [platform === "wordpress" ? "WordPress: keep core, themes and plugins updated; a security plugin can remove the generator tag." : "", "Ask your host to hide the Server and X-Powered-By version details."].filter(Boolean) }
    : { id: "versions", area: "exposure", title: "Software versions aren't advertised", status: "pass", weight: 3, detail: "No version numbers in headers or page code.", why: "Less information for attackers." });

  const probes: { path: string; test: (r: Fetched) => boolean; label: string; critical: boolean }[] = [
    { path: "/.git/HEAD", label: "Website source history (.git)", critical: true, test: (r) => r.status === 200 && /^ref:\s*refs\//m.test(r.body) },
    { path: "/.env", label: "Settings file with passwords (.env)", critical: true, test: (r) => r.status === 200 && !/<html/i.test(r.body) && /^[A-Z][A-Z0-9_]{2,}\s*=/m.test(r.body) },
    { path: "/wp-config.php.bak", label: "WordPress config backup", critical: true, test: (r) => r.status === 200 && /DB_PASSWORD|DB_NAME/.test(r.body) },
    { path: "/.DS_Store", label: "Folder listing file (.DS_Store)", critical: false, test: (r) => r.status === 200 && r.body.startsWith("\u0000\u0000\u0000\u0001Bud1") },
    { path: "/wp-content/uploads/", label: "Open folder listing (uploads)", critical: false, test: (r) => r.status === 200 && /<title>Index of \//i.test(r.body) },
  ];
  const probed = await Promise.all(probes.map(async (p) => ({ p, r: await deps.fetch(`https://${host}${p.path}`, 8000).catch(() => null) })));
  const found = probed.filter((x) => x.r && x.r.url.startsWith(`https://${host}${x.p.path}`) && x.p.test(x.r));
  const crit = found.filter((x) => x.p.critical);
  add(found.length
    ? { id: "exposed", area: "exposure", title: crit.length ? "Private files are publicly downloadable" : "Folder contents are visible", status: crit.length ? "fail" : "warn", weight: 15, critical: crit.length > 0, detail: found.map((x) => `${x.p.label} at ${x.p.path}`).join(" · "), why: crit.length ? "These files can contain passwords, keys or your site's full source code. Treat any secrets in them as leaked." : "Anyone can browse files you may not have meant to publish.", fix: crit.length ? "Block or delete these files today, then change any passwords or API keys they contained." : "Turn off directory listing.", steps: [platform === "wordpress" ? "WordPress: delete backup files from the server and ask your host to block access to hidden files (.git, .env)." : "Ask your host or developer to remove these files from the public folder and block hidden files.", crit.length ? "After removing them, change database passwords and any API keys mentioned in the files." : "Apache: add “Options -Indexes”; Nginx: make sure “autoindex” is off."] }
    : { id: "exposed", area: "exposure", title: "No common private files exposed", status: "pass", weight: 15, detail: "Checked .git, .env, config backups and folder listings.", why: "Accidentally public files are one of the most common real-world leaks." });

  const sec = await deps.fetch(`https://${host}/.well-known/security.txt`, 6000).catch(() => null);
  const hasSec = Boolean(sec && sec.status === 200 && /contact:/i.test(sec.body) && !/<html/i.test(sec.body));
  add(hasSec
    ? { id: "securitytxt", area: "exposure", title: "security.txt tells researchers how to report issues", status: "pass", weight: 1, detail: "/.well-known/security.txt found.", why: "Gives people who find a problem a way to tell you privately." }
    : { id: "securitytxt", area: "exposure", title: "No security.txt", status: "warn", weight: 1, detail: "/.well-known/security.txt not found.", why: "A tiny text file telling people where to report security problems.", fix: "Add /.well-known/security.txt with a “Contact:” line (an email address) and an “Expires:” date." });

  // 5) Email spoofing (domain DNS)
  const [txtRoot, txtDmarc, caa, ds] = await Promise.all([
    deps.dns(domain, "TXT").catch(() => null), deps.dns(`_dmarc.${domain}`, "TXT").catch(() => null),
    deps.dns(domain, "CAA").catch(() => null), deps.dns(domain, "DS").catch(() => null),
  ]);
  if (txtRoot) {
    const spf = txtRoot.find((t) => /^v=spf1/i.test(t));
    add(spf
      ? { id: "spf", area: "email", title: "SPF lists who may send your email", status: /[-~]all\b/.test(spf) ? "pass" : "warn", weight: 4, detail: spf.slice(0, 160), why: "SPF helps stop others sending email pretending to be you.", fix: /[-~]all\b/.test(spf) ? undefined : "End your SPF record with “~all” or “-all”." }
      : { id: "spf", area: "email", title: "No SPF record", status: "fail", weight: 4, detail: `No v=spf1 record on ${domain}.`, why: "Anyone can send email that looks like it's from your domain.", fix: "Add an SPF TXT record listing your email providers. Growvia's Sending health page shows the exact record." });
  }
  if (txtDmarc) {
    const dmarc = txtDmarc.find((t) => /^v=DMARC1/i.test(t));
    const pol = dmarc?.match(/\bp=(\w+)/i)?.[1]?.toLowerCase();
    add(!dmarc
      ? { id: "dmarc", area: "email", title: "No DMARC policy", status: "fail", weight: 6, detail: `No DMARC record at _dmarc.${domain}.`, why: "Without DMARC, inboxes don't know what to do with fake emails using your name, so scams can reach your customers.", fix: "Add a DMARC TXT record, starting with “v=DMARC1; p=none; rua=mailto:you@yourdomain” and moving to p=quarantine once reports look clean." }
      : pol === "none"
        ? { id: "dmarc", area: "email", title: "DMARC is in monitor-only mode", status: "warn", weight: 6, detail: dmarc.slice(0, 160), why: "p=none only reports fake emails; it doesn't stop them.", fix: "When your real email passes checks, change p=none to p=quarantine, later p=reject." }
        : { id: "dmarc", area: "email", title: `DMARC blocks fake email (p=${pol})`, status: "pass", weight: 6, detail: dmarc.slice(0, 160), why: "Inboxes reject or quarantine email pretending to be you." });
  }

  // 6) Domain
  if (caa) add(caa.length
    ? { id: "caa", area: "domain", title: "Only chosen companies may issue certificates (CAA)", status: "pass", weight: 2, detail: caa.slice(0, 3).join(" · "), why: "Limits who can issue certificates for your domain." }
    : { id: "caa", area: "domain", title: "No CAA record", status: "warn", weight: 2, detail: "Any certificate authority may issue certificates for your domain.", why: "A CAA record limits which companies can issue certificates for your domain, reducing the risk of a fraudulent one.", fix: "Add a CAA DNS record for your certificate provider (for example 0 issue \"letsencrypt.org\")." });
  if (ds) add(ds.length
    ? { id: "dnssec", area: "domain", title: "DNSSEC is on", status: "pass", weight: 2, detail: "DS record found at the registry.", why: "Protects visitors from forged DNS answers." }
    : { id: "dnssec", area: "domain", title: "DNSSEC isn't turned on", status: "warn", weight: 2, detail: "No DS record found.", why: "DNSSEC signs your DNS so visitors can't be quietly sent to a fake server.", fix: "Turn on DNSSEC at your DNS provider and registrar (often one click; Cloudflare: DNS → Settings → DNSSEC)." });

  const reg = await deps.rdap(domain);
  if (reg) {
    const d = days(reg.expires, now);
    if (d != null) add({ id: "domain_expiry", area: "domain", title: d < 0 ? "Domain registration has expired" : `Domain renews in ${d} days`, status: d < 30 ? "fail" : d < 60 ? "warn" : "pass", weight: 8, critical: d < 0, detail: `Registration expires ${String(reg.expires).slice(0, 10)}.`, why: "If the domain expires, your website and email stop working, and someone else can register it.", fix: d < 60 ? "Renew the domain now and turn on auto-renew at your registrar." : undefined });
    const locked = reg.statuses.some((s) => s.includes("client transfer prohibited") || s.includes("clienttransferprohibited"));
    add(locked
      ? { id: "domain_lock", area: "domain", title: "Domain is locked against transfers", status: "pass", weight: 3, detail: "Transfer lock is on.", why: "Stops your domain being moved to another registrar without your approval." }
      : { id: "domain_lock", area: "domain", title: "Domain transfer lock is off", status: "warn", weight: 3, detail: "No transfer lock found.", why: "A transfer lock stops someone moving your domain away using a stolen login.", fix: "Turn on “domain lock” or “transfer lock” in your registrar account." });
  }

  // 7) Reputation
  if (deps.safeBrowsing) {
    const flagged = await deps.safeBrowsing(`https://${host}/`);
    if (flagged != null) add(flagged
      ? { id: "safebrowsing", area: "reputation", title: "Google flags this site as unsafe", status: "fail", weight: 25, critical: true, detail: "Listed by Google Safe Browsing.", why: "Chrome and other browsers show a red warning page and many visitors leave.", fix: "Clean the site, then request a review in Google Search Console → Security issues." }
      : { id: "safebrowsing", area: "reputation", title: "Not flagged by Google Safe Browsing", status: "pass", weight: 25, detail: "No malware or phishing warnings.", why: "Browsers show your site normally." });
  }

  return finalize({ url: `https://${host}/`, host, domain, platform, cloudflare, checks, at: new Date(now).toISOString() });
}

/** Weighted score: pass = full, warn = half, fail = 0; info doesn't count. A critical failure caps the score at 49. */
export function finalize(r: Omit<SecReport, "score" | "grade" | "counts">): SecReport {
  const scored = r.checks.filter((c) => c.status !== "info" && c.weight > 0);
  const total = scored.reduce((s, c) => s + c.weight, 0) || 1;
  const earned = scored.reduce((s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
  let score = Math.round((earned / total) * 100);
  if (r.checks.some((c) => c.critical && c.status === "fail")) score = Math.min(score, 49);
  const counts = { pass: 0, warn: 0, fail: 0, info: 0 } as Record<Status, number>;
  for (const c of r.checks) counts[c.status]++;
  return { ...r, score, grade: gradeOf(score), counts };
}
export const gradeOf = (s: number) => (s >= 90 ? "A" : s >= 80 ? "B" : s >= 65 ? "C" : s >= 50 ? "D" : "F");

/** Fixes in the order to do them: failures (critical first, then by weight), then warnings by weight. */
export function priorities(r: Pick<SecReport, "checks">): SecCheck[] {
  const rank = (c: SecCheck) => (c.status === "fail" ? (c.critical ? 0 : 1) : 2);
  return r.checks.filter((c) => c.status === "fail" || c.status === "warn").sort((a, b) => rank(a) - rank(b) || b.weight - a.weight);
}
