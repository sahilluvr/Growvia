// Edge-safe runtime configuration (used by middleware and server code).
// Server-only variables (no NEXT_PUBLIC_ prefix): Supabase is only called from the server, so nothing is sent
// to the browser, and values are read at runtime — changing them in Vercel needs a redeploy but no code change.
// The older NEXT_PUBLIC_* names still work as a fallback.
const clean = (...v: (string | undefined)[]) => (v.map((x) => x?.trim()).find(Boolean) || "").replace(/\/$/, "");

// Literal process.env accesses so both the Node and Edge (middleware) bundles resolve them reliably.
export const SUPABASE_URL = clean(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_KEY = clean(process.env.SUPABASE_ANON_KEY, process.env.SUPABASE_PUBLISHABLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const SITE_URL = clean(process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL);

export const isSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY);
/** Shared secret the scheduler (Supabase pg_cron) sends to /api/cron/tick. */
export const CRON_SECRET = clean(process.env.CRON_SECRET);

/** Supabase is required everywhere (dev included). Without it the app shows setup instructions. */
export const setupMissing = !isSupabase;
/** Kept for the health endpoint's wording. */
export const localAllowed = false;
