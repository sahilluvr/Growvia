import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Repo, AppUser, Business, Campaign, ContentItem, ContentStatus, Lead, Activity, Workspace, ProjectSummary } from "./types";

/** Cookie holding the project (business) the user is working in. */
export const PROJECT_COOKIE = "gv_project";

import { SUPABASE_URL, SUPABASE_KEY } from "../config";

export function supabaseServer() {
  const store = cookies();
  // Tells the database which project you're working in, so rows teammates create belong to the right account.
  const project = store.get(PROJECT_COOKIE)?.value;
  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    global: { headers: project && /^[0-9a-f-]{36}$/i.test(project) ? { "x-gv-project": project } : {} },
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Try again or reset your password.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox for the link.";
  if (m.includes("password should be")) return "Password must be at least 8 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("banned")) return `This account has been deactivated. If you think this is a mistake, email ${process.env.CONTACT_EMAIL?.trim() || "team.usegrowvia@gmail.com"}.`;
  return msg;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: (res.error as { code?: string }).code });
  return res.data as T;
}

const EMPTY_COUNTS = (): Record<ContentStatus, number> => ({ draft: 0, approved: 0, scheduled: 0, published: 0 });

export function supabaseRepo(): Repo {
  const sb = supabaseServer();
  // Per-request memo: layout + page + actions share one lookup instead of repeating network calls.
  let userP: Promise<AppUser | null> | null = null;
  let bizP: Promise<Business | null> | null = null;

  const repo: Repo = {
    mode: "supabase",

    getUser() {
      // getClaims verifies the session token's signature locally (Supabase's asymmetric signing keys) — no
      // network round trip on most requests. Projects on legacy secrets fall back to asking the Auth server.
      userP ??= sb.auth.getClaims().then(({ data, error }) => {
        const c = data?.claims;
        if (error || !c?.sub) return null;
        const email = (c.email as string) ?? "";
        const meta = (c.user_metadata ?? {}) as { full_name?: string };
        return { id: c.sub, email, name: meta.full_name || email.split("@")[0] } satisfies AppUser;
      }).catch(() => null);
      return userP;
    },
    async signUp({ email, password, name, redirectTo, captchaToken }) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo, ...(captchaToken ? { captchaToken } : {}) } });
      if (error) return { ok: false, error: friendly(error.message) };
      // Supabase returns a user with no identities when the email is already taken (and confirmations are on).
      if (data.user && data.user.identities && data.user.identities.length === 0) return { ok: false, error: friendly("already registered") };
      return { ok: true, needsConfirmation: !data.session };
    },
    async signIn({ email, password, captchaToken }) {
      const { error } = await sb.auth.signInWithPassword({ email, password, ...(captchaToken ? { options: { captchaToken } } : {}) });
      userP = null;
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    },
    async signOut() {
      userP = null;
      await sb.auth.signOut({ scope: "local" });
    },
    async requestPasswordReset(email, redirectTo, captchaToken) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo, ...(captchaToken ? { captchaToken } : {}) });
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    },
    async updateProfile(name) {
      const { error } = await sb.auth.updateUser({ data: { full_name: name } });
      if (!error) await sb.auth.refreshSession(); // new token carries the new name
      userP = null;
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    },

    /** The current project's id without waiting for a query (from the project cookie); falls back to looking it up. */
    readId() {
      const c = cookies().get(PROJECT_COOKIE)?.value;
      return c && /^[0-9a-f-]{36}$/i.test(c) ? Promise.resolve(c) : repo.getBusiness().then((b) => b?.id ?? null).catch(() => null);
    },

    getBusiness() {
      // The project chosen in the switcher (cookie), else the account's first project.
      bizP ??= (async () => {
        const want = cookies().get(PROJECT_COOKIE)?.value;
        if (want && /^[0-9a-f-]{36}$/i.test(want)) {
          const { data } = await sb.from("businesses").select("*").eq("id", want).maybeSingle();
          if (data) return data as Business;
        }
        const { data, error } = await sb.from("businesses").select("*").order("created_at").limit(1).maybeSingle();
        if (error) throw new Error(error.message);
        return (data as Business) ?? null;
      })();
      return bizP;
    },
    async saveBusiness(input) {
      // Update the current project, or create the account's first one.
      const user = await repo.getUser();
      if (!user) throw new Error("Not signed in");
      const cur = await repo.getBusiness().catch(() => null);
      if (!cur) {
        const ws = (await repo.listWorkspaces()).workspaces[0] ?? (await repo.createWorkspace("My workspace"));
        return repo.createBusiness(input, ws.id);
      }
      const b = must(await sb.from("businesses").update({ ...input, updated_at: new Date().toISOString() }).eq("id", cur.id).select().single()) as Business;
      bizP = Promise.resolve(b);
      return b;
    },
    async createBusiness(input, workspaceId) {
      const user = await repo.getUser();
      if (!user) throw new Error("Not signed in");
      const b = must(await sb.from("businesses").insert({ ...input, owner_id: user.id, workspace_id: workspaceId }).select().single()) as Business;
      try { cookies().set(PROJECT_COOKIE, b.id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 }); } catch { /* read-only context */ }
      bizP = Promise.resolve(b);
      return b;
    },
    async listWorkspaces() {
      const [w, p] = await Promise.all([
        sb.from("workspaces").select("id, name, created_at").order("created_at"),
        sb.from("businesses").select("id, name, website, segment, city, workspace_id, created_at").order("created_at"),
      ]);
      return { workspaces: (w.data ?? []) as Workspace[], projects: (p.data ?? []) as ProjectSummary[] };
    },
    async createWorkspace(name) {
      const user = await repo.getUser();
      if (!user) throw new Error("Not signed in");
      return must(await sb.from("workspaces").insert({ name: name.slice(0, 80), owner_id: user.id }).select("id, name, created_at").single()) as Workspace;
    },
    async savePlan(plan) {
      const b = await repo.getBusiness();
      if (!b) throw new Error("No business");
      must(await sb.from("businesses").update({ plan, updated_at: new Date().toISOString() }).eq("id", b.id).select("id"));
      bizP = Promise.resolve({ ...b, plan });
    },

    async listCampaigns() {
      // Campaigns and their content statuses in a single request.
      const bid = await repo.readId();
      if (!bid) return [];
      const rows = must(await sb.from("campaigns").select("*, content_items(status)").eq("business_id", bid).order("created_at", { ascending: false })) as (Campaign & { content_items: { status: ContentStatus }[] })[];
      return rows.map(({ content_items, ...c }) => {
        const counts = EMPTY_COUNTS();
        content_items.forEach((i) => counts[i.status]++);
        return { ...c, counts };
      });
    },
    async getCampaign(id) {
      const { data, error } = await sb.from("campaigns").select("*, content_items(*)").eq("id", id).order("created_at", { referencedTable: "content_items" }).maybeSingle();
      if (error || !data) return null;
      const { content_items, ...campaign } = data as Campaign & { content_items: ContentItem[] };
      return { campaign: campaign as Campaign, items: content_items };
    },
    async createCampaign(input, items) {
      const b = await repo.getBusiness();
      if (!b) throw new Error("No business");
      const c = must(await sb.from("campaigns").insert({ ...input, business_id: b.id, status: "active" }).select().single()) as Campaign;
      if (items.length) must(await sb.from("content_items").insert(items.map((i) => ({ ...i, campaign_id: c.id }))).select("id"));
      return c;
    },
    async updateCampaign(id, patch) {
      must(await sb.from("campaigns").update(patch).eq("id", id).select("id"));
    },
    async deleteCampaign(id) {
      must(await sb.from("campaigns").delete().eq("id", id).select("id"));
    },
    async listContent() {
      const bid = await repo.readId();
      if (!bid) return [];
      const rows = must(await sb.from("content_items").select("*, campaigns!inner(business_id)").eq("campaigns.business_id", bid).order("created_at", { ascending: false })) as (ContentItem & { campaigns?: unknown })[];
      return rows.map(({ campaigns: _c, ...i }) => i as ContentItem);
    },
    async updateContent(id, patch) {
      must(await sb.from("content_items").update(patch).eq("id", id).select("id"));
    },

    async listLeads() {
      const bid = await repo.readId();
      if (!bid) return [];
      return (must(await sb.from("leads").select("*").eq("business_id", bid).order("created_at", { ascending: false })) as Lead[]).map((l) => ({ ...l, value: Number(l.value) }));
    },
    async createLead(input) {
      const b = await repo.getBusiness();
      if (!b) throw new Error("No business");
      return must(await sb.from("leads").insert({ ...input, business_id: b.id }).select().single()) as Lead;
    },
    async updateLead(id, patch) {
      must(await sb.from("leads").update(patch).eq("id", id).select("id"));
    },
    async deleteLead(id) {
      must(await sb.from("leads").delete().eq("id", id).select("id"));
    },

    async countLeads(stage) {
      const bid = await repo.readId();
      if (!bid) return 0;
      const { count } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("business_id", bid).eq("stage", stage);
      return count ?? 0;
    },
    async listActivity(limit = 20) {
      const bid = await repo.readId();
      let q = sb.from("activity").select("*").order("created_at", { ascending: false }).limit(limit);
      if (bid) q = q.or(`business_id.eq.${bid},business_id.is.null`);
      return must(await q) as Activity[];
    },
    async addActivity(a) {
      const list = Array.isArray(a) ? a : [a];
      const b = await repo.getBusiness().catch(() => null);
      await sb.from("activity").insert(list.map((x) => ({ agent: x.agent, text: x.text, tag: x.tag ?? null, business_id: b?.id ?? null })));
    },

    async publicBusiness(id) {
      const { data, error } = await sb.rpc("public_business", { bid: id });
      if (error || !data || !Array.isArray(data) || !data[0]) return null;
      return data[0];
    },
    async submitPublicLead(id, lead) {
      const { data, error } = await sb.rpc("submit_lead", { bid: id, p_name: lead.name, p_email: lead.email, p_phone: lead.phone, p_message: lead.message });
      return !error && data === true;
    },
  };
  return repo;
}
