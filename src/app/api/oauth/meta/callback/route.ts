import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { repo, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { encrypt, verifyId } from "@/lib/server/crypto";
import { exchangeCode, grantedScopes, igProfile, listPages, subscribePage, type IgInfo } from "@/lib/meta/graph";
import { pushInApp } from "@/lib/inapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/app/channels?${q}`, req.url));
  if (url.searchParams.get("error")) return back(`error=${encodeURIComponent(url.searchParams.get("error_description") || "Facebook login was cancelled.")}`);
  const user = await repo().getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/app/channels", req.url));
  const state = verifyId(url.searchParams.get("state") ?? "", "meta-oauth");
  const nonce = cookies().get("gv_oauth")?.value;
  if (!state || state !== `${user.id}~${nonce}`) return back("error=The login link expired. Please try again.");
  const code = url.searchParams.get("code");
  if (!code) return back("error=No authorization code from Facebook.");
  try {
    const userToken = await exchangeCode(code, `${siteOrigin()}/api/oauth/meta/callback`);
    const pages = await listPages(userToken);
    if (!pages.length) return back("error=No Facebook Pages found. Make sure you picked at least one Page when Facebook asked.");
    const db = supabaseServer();
    const granted = await grantedScopes(userToken);
    let fb = 0, ig = 0;
    const problems: string[] = [];
    const seenIg = new Set<string>();
    const saveIg = async (insta: IgInfo, token: string, pageId: string | null, fallbackName: string) => {
      if (seenIg.has(insta.id)) return;
      seenIg.add(insta.id);
      const { error: e2 } = await db.from("channel_accounts").upsert({
        owner_id: user.id, provider: "instagram", external_id: insta.id, name: insta.name || insta.username || fallbackName, username: insta.username ?? null,
        picture: insta.profile_picture_url ?? null, page_id: pageId, access_token_enc: encrypt(token), status: "connected", last_error: null,
      }, { onConflict: "provider,external_id" });
      if (e2) problems.push(`@${insta.username ?? insta.id} is connected to another Growvia account`);
      else ig++;
    };
    for (const p of pages) {
      const row = { owner_id: user.id, provider: "facebook", external_id: p.id, name: p.name, picture: p.picture?.data?.url ?? null, access_token_enc: encrypt(p.access_token), status: "connected", last_error: null };
      const { error } = await db.from("channel_accounts").upsert(row, { onConflict: "provider,external_id" });
      if (error) { problems.push(`${p.name} is connected to another Growvia account`); continue; }
      fb++;
      await subscribePage(p.id, p.access_token);
      const insta = p.instagram_business_account ?? p.connected_instagram_account;
      if (insta) await saveIg(insta, p.access_token, p.id, p.name);
    }
    // Instagram accounts the person picked in Meta's dialog that aren't linked through one of the Pages above
    // (e.g. linked to a Page they didn't select). They can still post with the person's own token.
    for (const id of [...(granted.targets.instagram_content_publish ?? []), ...(granted.targets.instagram_basic ?? [])]) {
      if (seenIg.has(id)) continue;
      const prof = await igProfile(id, userToken);
      if (prof) await saveIg(prof, userToken, null, "Instagram");
    }
    cookies().delete("gv_oauth");
    // Why no Instagram? Either it wasn't allowed in Meta's dialog, or it isn't a professional account linked to a Page.
    const igAllowed = !granted.scopes.length || (granted.scopes.includes("instagram_basic") && granted.scopes.includes("instagram_content_publish"));
    const igWhy = ig ? "" : igAllowed ? "notlinked" : "declined";
    await db.from("activity").insert({ owner_id: user.id, agent: "Distributor", text: `Connected ${fb} Facebook Page${fb === 1 ? "" : "s"}${ig ? ` and ${ig} Instagram account${ig === 1 ? "" : "s"}` : ""}.`, tag: "Channels" });
    await pushInApp(db, user.id, {
      kind: "channel", title: ig ? "Facebook & Instagram connected" : "Facebook connected",
      body: `${fb} Page${fb === 1 ? "" : "s"}${ig ? ` and ${ig} Instagram account${ig === 1 ? "" : "s"}` : ""} ready — you can publish and schedule from Publish.${igWhy ? " Instagram still needs linking — see Channels." : ""}`,
      url: ig || !igWhy ? "/app/publish" : "/app/channels#instagram", provider: ig ? "instagram" : "facebook",
    });
    return back(`connected=${fb + ig}&fb=${fb}&ig=${ig}${igWhy ? `&igwhy=${igWhy}` : ""}${problems.length ? `&error=${encodeURIComponent(problems.join("; "))}` : ""}`);
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : "Couldn't connect to Facebook.")}`);
  }
}
