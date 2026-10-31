/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker/Cloud Run build: self-contained server (node server.js). Vercel builds don't set this.
  ...(process.env.BUILD_STANDALONE ? { output: "standalone" } : {}),
  poweredByHeader: false,
  experimental: {
    // Prefetched app pages open instantly; keep them fresh (new leads etc.) by refetching after 30s.
    staleTimes: { dynamic: 0, static: 30 },
    // Fonts for the social image generator (read from disk at runtime).
    outputFileTracingIncludes: {
      "/**": ["./src/lib/social/fonts/*.ttf"],
      // ffmpeg ships only with the video converter function (keeps every other function small).
      "/api/media/standardize": ["./node_modules/@ffmpeg-installer/ffmpeg/**", "./node_modules/@ffmpeg-installer/linux-x64/**"],
    },
    serverComponentsExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  },
  async redirects() {
    // Old address → new domain (pages only). /api stays on both so webhooks, form posts, tracking pixels and
    // OAuth callbacks registered on the old address keep working during the switch.
    const site = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
    const target = site && !/^https?:\/\//.test(site) ? `https://${site}` : site;
    const old = (process.env.OLD_HOSTS || "growvia-three.vercel.app").split(",").map((h) => h.trim()).filter(Boolean);
    // Language-style guesses (e.g. /EN found by Google from an outside link) → the English homepage, not a 404.
    const lang = ["/en", "/EN", "/En", "/en-us", "/en-US", "/EN-US", "/en-gb", "/en-GB", "/en-in", "/en-IN"].flatMap((l) => [
      { source: l, destination: "/", permanent: true },
      { source: `${l}/:path*`, destination: "/:path*", permanent: true },
    ]);
    // www.usegrowvia.com → usegrowvia.com (one address for Google; Cloud Run serves both hosts).
    let www = [];
    try {
      const h = target ? new URL(target).hostname : "";
      if (h && !h.startsWith("www.")) www = [{ source: "/:path*", has: [{ type: "host", value: `www.${h}` }], destination: `${target}/:path*`, permanent: true }];
    } catch { /* bad SITE_URL */ }
    // Blog posts link to /pricing — the plans live on the home page.
    const pages = [{ source: "/pricing", destination: "/#pricing", permanent: true }];
    if (!target || old.some((h) => target.includes(h))) return [...www, ...pages, ...lang];
    return [...www, ...pages, ...lang, ...old.map((host) => ({ source: "/:path((?!api/).*)", has: [{ type: "host", value: host }], destination: `${target}/:path`, permanent: true }))];
  },
  async headers() {
    // The app and sign-in pages can't be framed by other sites (clickjacking); /embed forms can.
    const deny = [{ key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }];
    return ["/app/:path*", "/login", "/signup", "/forgot", "/reset", "/onboarding", "/invite/:path*", "/admin/:path*", "/admin"].map((source) => ({ source, headers: deny }));
  },
};
export default nextConfig;
