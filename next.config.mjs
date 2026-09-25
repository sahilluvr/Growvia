/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Prefetched app pages open instantly; keep them fresh (new leads etc.) by refetching after 30s.
    staleTimes: { dynamic: 0, static: 30 },
  },
};
export default nextConfig;
