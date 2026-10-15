/* Turns raw database errors into messages people can act on. */
export function dbErr(e: { message?: string; code?: string } | null | undefined, fallback = "Something went wrong — please try again."): string {
  const m = e?.message ?? "";
  if (!m) return fallback;
  if (e?.code === "42501" || /row-level security|permission denied|violates.*policy/i.test(m)) return "You have view-only access here — ask the account owner or an admin for edit access.";
  if (e?.code === "23505" || /duplicate key/i.test(m)) return "That already exists — try a different name.";
  if (/fetch failed|ECONNREFUSED|timeout/i.test(m)) return "Couldn't reach the database — check your connection and try again.";
  if (/does not exist|schema cache|column/i.test(m)) return "Your database needs the latest update — run supabase/schema.sql in the Supabase SQL editor.";
  return m.length > 180 ? fallback : m;
}

/** Framework "errors" that must pass through untouched (redirect(), notFound()). */
const isControlFlow = (e: unknown) => typeof (e as { digest?: unknown })?.digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND)/.test((e as { digest: string }).digest);

/** Runs a form action and turns any unexpected failure into a message on the form instead of a crash page. */
export async function guard<T extends { error?: string } | undefined>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (isControlFlow(e)) throw e;
    console.error("[action]", e);
    const msg = e instanceof Error ? e.message : "";
    return { error: dbErr({ message: msg, code: (e as { code?: string })?.code }, "Something went wrong — please try again.") };
  }
}
