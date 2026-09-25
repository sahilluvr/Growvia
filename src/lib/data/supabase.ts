import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Repo, AppUser, Business, Campaign, ContentItem, ContentStatus, Lead, Activity } from "./types";

import { SUPABASE_URL, SUPABASE_KEY } from "../config";

export function supabaseServer() {
  const store = cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
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
  return msg;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
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
    async signUp({ email, password, name, redirectTo }) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo } });
      if (error) return { ok: false, error: friendly(error.message) };
      // Supabase returns a user with no identities when the email is already taken (and confirmations are on).
      if (data.user && data.user.identities && data.user.identities.length === 0) return { ok: false, error: friendly("already registered") };
      return { ok: true, needsConfirmation: !data.session };
    },
    async signIn({ email, password }) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      userP = null;
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    },
    async signOut() {
      userP = null;
      await sb.auth.signOut({ scope: "local" });
    },
    async requestPasswordReset(email, redirectTo) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
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

    getBusiness() {
      bizP ??= Promise.resolve(sb.from("businesses").select("*").maybeSingle()).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Business) ?? null;
      });
      return bizP;
    },
    async saveBusiness(input) {
      // One round trip: insert or update this user's single business row.
      const user = await repo.getUser();
      if (!user) throw new Error("Not signed in");
      const b = must(await sb.from("businesses").upsert({ ...input, owner_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "owner_id" }).select().single()) as Business;
      bizP = Promise.resolve(b);
      return b;
    },
    async savePlan(plan) {
      const b = await repo.getBusiness();
      if (!b) throw new Error("No business");
      must(await sb.from("businesses").update({ plan, updated_at: new Date().toISOString() }).eq("id", b.id).select("id"));
      bizP = Promise.resolve({ ...b, plan });
    },

    async listCampaigns() {
      // Campaigns and their content statuses in a single request.
      const rows = must(await sb.from("campaigns").select("*, content_items(status)").order("created_at", { ascending: false })) as (Campaign & { content_items: { status: ContentStatus }[] })[];
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
      return must(await sb.from("content_items").select("*").order("created_at", { ascending: false })) as ContentItem[];
    },
    async updateContent(id, patch) {
      must(await sb.from("content_items").update(patch).eq("id", id).select("id"));
    },

    async listLeads() {
      return (must(await sb.from("leads").select("*").order("created_at", { ascending: false })) as Lead[]).map((l) => ({ ...l, value: Number(l.value) }));
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
      const { count } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("stage", stage);
      return count ?? 0;
    },
    async listActivity(limit = 20) {
      return must(await sb.from("activity").select("*").order("created_at", { ascending: false }).limit(limit)) as Activity[];
    },
    async addActivity(a) {
      const list = Array.isArray(a) ? a : [a];
      await sb.from("activity").insert(list.map((x) => ({ agent: x.agent, text: x.text, tag: x.tag ?? null })));
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
