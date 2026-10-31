/**
 * The address visitors actually used (https://usegrowvia.com), for building redirects.
 * Behind Cloud Run the Next.js standalone server sees its own bind address (http://0.0.0.0:8080) in req.url,
 * so never build redirects from req.url — use this. Safe in middleware (Edge) and route handlers.
 */
export function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const internal = !host || /^(0\.0\.0\.0|\[::\])(:\d+)?$/.test(host);
  if (internal) {
    const site = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
    if (site) return site;
    try { return new URL(req.url).origin; } catch { return "http://localhost:3000"; }
  }
  return `${proto}://${host}`;
}
