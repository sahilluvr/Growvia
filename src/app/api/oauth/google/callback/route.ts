import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { repo, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { encrypt, verifyId } from "@/lib/server/crypto";
import { GOOGLE_PURPOSES, exchangeGoogleCode, isPurpose, listSites, matchSite, type GooglePurpose } from "@/lib/google/gsc";
import { listLocations } from "@/lib/google/gbp";
import { myChannels } from "@/lib/google/youtube";
import { googleContacts } from "@/lib/google/contacts";
import { pmDomains } from "@/lib/google/postmaster";
import type { LocalState } from "@/lib/local/sync";
import { linkGbpAccount } from "@/lib/local/link";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** One callback for every Google sign-in; the signed state says what it was for. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = verifyId(url.searchParams.get("state") ?? "", "google-oauth");
  const [uid, projectId, nonce, p] = (state ?? "").split("~");
  const purpose: GooglePurpose = isPurpose(p) ? p : "gsc";
  const errKey = purpose === "gsc" ? "gsc_error" : "google_error";
  const target = GOOGLE_PURPOSES[purpose].back;
  const back = (q: string) => NextResponse.redirect(new URL(`${target}${target.includes("?") ? "&" : "?"}${q}`, req.url));
  const fail = (m: string) => back(`${errKey}=${encodeURIComponent(m)}`);

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "Google sign-in was cancelled." : url.searchParams.get("error")!);
  const user = await repo().getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(target)}`, req.url));
  if (!state || uid !== user.id || nonce !== cookies().get("gv_goauth")?.value) return fail("The sign-in link expired. Please try again.");
  const code = url.searchParams.get("code");
  if (!code) return fail("No authorization code from Google.");
  const granted = (url.searchParams.get("scope") ?? "").split(" ");
  const db = supabaseServer();
  try {
    const t = await exchangeGoogleCode(code, `${siteOrigin()}/api/oauth/google/callback`);
    const { data: b } = await db.from("businesses").select("id, website, owner_id, name, local_state").eq("id", projectId).maybeSingle();
    if (!b) return fail("Project not found.");
    let res: NextResponse;

    if (purpose === "contacts") {
      if (granted.length > 1 && !granted.some((s) => s.includes("contacts"))) return fail("Please tick “See and download your contacts” on Google's screen so Growvia can read them.");
      const rows = await googleContacts(t.accessToken);
      if (!rows.length) return fail("That Google account has no contacts to import.");
      await db.from("contact_imports").delete().eq("business_id", b.id).lt("created_at", new Date(Date.now() - 86400000).toISOString());
      const { data: imp, error } = await db.from("contact_imports").insert({ owner_id: b.owner_id, business_id: b.id, source: "google", label: t.email ? `Google Contacts (${t.email})` : "Google Contacts", rows }).select("id").single();
      if (error || !imp) return fail("Couldn't hold the contacts for review — run the latest schema.sql in Supabase.");
      res = back(`import=${imp.id}`);
    } else {
      // Google lets people untick permissions — catch that here with a clear message instead of a cryptic API error later.
      const need = { gsc: "webmasters", gbp: "business.manage", postmaster: "postmaster", youtube: "youtube.upload" }[purpose as "gsc"];
      const have = t.scopes.length ? t.scopes : granted.filter(Boolean);
      if (need && have.length > 0 && !have.some((s) => s.includes(need)))
        return fail(purpose === "gbp" ? "Google didn't give Growvia access to your Business Profile. Click Connect again and tick “See, edit, create and delete your Google business listings” on Google's screen."
          : `Google didn't give Growvia the ${GOOGLE_PURPOSES[purpose].label} permission. Connect again and tick every box on Google's screen.`);
      if (!t.refreshToken) return fail("Google didn't give lasting access. Remove Growvia at myaccount.google.com/permissions and connect again.");

      if (purpose === "gsc") {
        const sites = await listSites(t.accessToken);
        const site = matchSite(sites, b.website);
        await db.from("businesses").update({ gsc_refresh_enc: encrypt(t.refreshToken), gsc_email: t.email, gsc_sites: sites, gsc_site: site }).eq("id", b.id);
        res = back(site ? "gsc=connected" : sites.length ? "gsc=pick" : "gsc_error=This Google account has no Search Console properties. Add your site at search.google.com/search-console first.");
      } else if (purpose === "postmaster") {
        const domains = await pmDomains(t.accessToken).catch(() => [] as string[]);
        const { error } = await db.from("postmaster_links").upsert({ owner_id: b.owner_id, refresh_enc: encrypt(t.refreshToken), email: t.email, domains, error: null }, { onConflict: "owner_id" });
        if (error) return fail("Couldn't save the connection — run the latest schema.sql in Supabase.");
        res = back(domains.length ? `postmaster=${domains.length}` : "postmaster=0");
      } else if (purpose === "youtube") {
        if (granted.length > 1 && !granted.some((s) => s.includes("youtube.upload"))) return fail("Please allow “Manage your YouTube videos” on Google's screen so Growvia can upload for you.");
        const chans = await myChannels(t.accessToken);
        if (!chans.length) return fail("This Google account has no YouTube channel yet — create one at youtube.com, then connect again.");
        let n = 0;
        for (const c of chans) {
          const { error } = await db.from("channel_accounts").upsert({ owner_id: user.id, provider: "youtube", external_id: c.id, name: c.title, username: c.handle, picture: c.picture, access_token_enc: encrypt(t.refreshToken), status: "connected", last_error: null, meta: { email: t.email } }, { onConflict: "provider,external_id" });
          if (!error) n++;
        }
        if (!n) return fail("That YouTube channel is already connected to another Growvia account.");
        await db.from("activity").insert({ owner_id: user.id, agent: "Distributor", text: `Connected YouTube channel ${chans.map((c) => c.title).join(", ")}.`, tag: "Channels" });
        res = NextResponse.redirect(new URL(`/app/channels?connected=${n}`, req.url));
      } else {
        // Business Profile: remember the Google account, then list locations (this call fails until Google approves API access).
        const st = (b.local_state ?? {}) as LocalState;
        const next: LocalState = { ...st, google: { refresh_enc: encrypt(t.refreshToken), email: t.email, at: new Date().toISOString() }, sync_error: null, sync_error_kind: null };
        let pick = false;
        try {
          const locs = await listLocations(t.accessToken);
          next.locations = locs;
          next.locations_error = locs.length ? undefined : "This Google account doesn't manage any Business Profiles. Sign in with the account that owns or manages the profile on business.google.com.";
          const same = st.location && locs.find((l) => l.name === st.location!.name);
          if (same) next.location = same;
          else if (locs.length === 1) next.location = locs[0];
          else { delete next.location; pick = locs.length > 1; }
        } catch (e) {
          next.locations = [];
          next.locations_error = e instanceof Error ? e.message : "Couldn't list your Business Profile locations.";
        }
        await db.from("businesses").update({ local_state: next }).eq("id", b.id);
        if (next.location) await linkGbpAccount(db, user.id, b.id, next);
        res = back(pick ? "pick=1" : next.location ? "connected=1" : "connected=0");
      }
    }
    res.cookies.delete("gv_goauth");
    return res;
  } catch (e) {
    return fail((e as Error).message);
  }
}
