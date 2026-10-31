/* Tiny in-memory stand-in for the Supabase client: enough of the query builder for the forms pipeline. */
type Row = Record<string, unknown>;
export function fakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const files: Record<string, Uint8Array> = {};
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const get = (r: Row, path: string) => path.split(".").reduce<unknown>((o, k) => (o as Row | undefined)?.[k], r);
  function q(table: string) {
    const t = (tables[table] ??= []);
    let filters: ((r: Row) => boolean)[] = [], op: "select" | "insert" | "update" | "delete" | "upsert" = "select", payload: Row | Row[] | null = null;
    let head = false, count = false, lim = Infinity, ord: [string, boolean] | null = null, wantSelect = false, conflict: string | null = null;
    const api: Record<string, unknown> = {
      select(_c?: string, o?: { count?: string; head?: boolean }) { if (op === "select") { head = Boolean(o?.head); count = Boolean(o?.count); } else wantSelect = true; return api; },
      insert(p: Row | Row[]) { op = "insert"; payload = p; return api; },
      upsert(p: Row | Row[], o?: { onConflict?: string }) { op = "upsert"; payload = p; conflict = o?.onConflict ?? null; return api; },
      update(p: Row) { op = "update"; payload = p; return api; },
      delete() { op = "delete"; return api; },
      eq(k: string, v: unknown) { filters.push((r) => get(r, k) === v); return api; },
      neq(k: string, v: unknown) { filters.push((r) => get(r, k) !== v); return api; },
      ilike(k: string, v: string) { filters.push((r) => String(get(r, k) ?? "").toLowerCase() === v.toLowerCase()); return api; },
      gt(k: string, v: string) { filters.push((r) => String(get(r, k) ?? "") > v); return api; },
      gte(k: string, v: string) { filters.push((r) => String(get(r, k) ?? "") >= v); return api; },
      lt(k: string, v: string) { filters.push((r) => String(get(r, k) ?? "") < v); return api; },
      contains(k: string, v: unknown[]) { filters.push((r) => Array.isArray(get(r, k)) && v.every((x) => (get(r, k) as unknown[]).includes(x))); return api; },
      in(k: string, v: unknown[]) { filters.push((r) => v.includes(get(r, k))); return api; },
      is(k: string, v: unknown) { filters.push((r) => (get(r, k) ?? null) === v); return api; },
      or() { return api; }, not() { return api; },
      order(k: string, o?: { ascending?: boolean }) { ord = [k, o?.ascending !== false]; return api; },
      limit(x: number) { lim = x; return api; },
      maybeSingle: () => run().then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })),
      single: () => run().then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
    };
    async function run(): Promise<{ data: unknown; error: null; count?: number }> {
      const match = () => t.filter((r) => filters.every((f) => f(r)));
      if (op === "upsert" && conflict) {
        // Upsert on a key: update the matching row in place, insert otherwise.
        const keys = conflict.split(",").map((x) => x.trim());
        for (const r of Array.isArray(payload) ? payload : [payload!]) {
          const hit = t.find((x) => keys.every((k) => x[k] === r[k]));
          if (hit) Object.assign(hit, r); else t.push({ created_at: new Date(Date.now() + n).toISOString(), ...r });
        }
        return { data: null, error: null };
      }
      if (op === "insert" && (Array.isArray(payload) ? payload : [payload!]).some((r) => r.id !== undefined && t.some((x) => x.id === r.id))) {
        return { data: null, error: { message: "duplicate key value violates unique constraint" } as never };
      }
      if (op === "insert" || op === "upsert") {
        const rows = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({ id: id(), created_at: new Date(Date.now() + n).toISOString(), ...r }));
        t.push(...rows); return { data: wantSelect ? rows : null, error: null };
      }
      if (op === "update") { const m = match(); m.forEach((r) => Object.assign(r, payload)); return { data: m, error: null }; }
      if (op === "delete") { const m = match(); tables[table] = t.filter((r) => !m.includes(r)); return { data: null, error: null }; }
      let rows = match();
      if (ord) { const [k, asc] = ord; rows = [...rows].sort((a, b) => (String(get(a, k)) < String(get(b, k)) ? -1 : 1) * (asc ? 1 : -1)); }
      rows = rows.slice(0, lim);
      return { data: head ? null : rows, error: null, ...(count ? { count: rows.length } : {}) };
    }
    return api;
  }
  return {
    tables, files,
    from: (t: string) => q(t),
    storage: { from: () => ({
      upload: async (path: string, bytes: Uint8Array) => { files[path] = bytes; return { data: { path }, error: null }; },
      createSignedUrl: async (path: string, s: number) => ({ data: files[path] ? { signedUrl: `https://storage.example/${path}?expires=${s}` } : null, error: null }),
    }) },
  };
}
