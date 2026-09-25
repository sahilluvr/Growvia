import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { repo, siteOrigin } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { encrypt, verifyId } from "@/lib/server/crypto";
import { exchangeCode, listPages, subscribePage } from "@/lib/meta/graph";

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
    let fb = 0, ig = 0;
    const problems: string[] = [];
    for (const p of pages) {
      const row = { owner_id: user.id, provider: "facebook", external_id: p.id, name: p.name, picture: p.picture?.data?.url ?? null, access_token_enc: encrypt(p.access_token), status: "connected", last_error: null };
      const { error } = await db.from("channel_accounts").upsert(row, { onConflict: "provider,external_id" });
      if (error) { problems.push(`${p.name} is connected to another Growvia account`); continue; }
      fb++;
      await subscribePage(p.id, p.access_token);
      const insta = p.instagram_business_account;
      if (insta) {
        const { error: e2 } = await db.from("channel_accounts").upsert({
          owner_id: user.id, provider: "instagram", external_id: insta.id, name: insta.name || insta.username || p.name, username: insta.username ?? null,
          picture: insta.profile_picture_url ?? null, page_id: p.id, access_token_enc: encrypt(p.access_token), status: "connected", last_error: null,
        }, { onConflict: "provider,external_id" });
        if (!e2) ig++;
      }
    }
    cookies().delete("gv_oauth");
    await db.from("activity").insert({ owner_id: user.id, agent: "Distributor", text: `Connected ${fb} Facebook Page${fb === 1 ? "" : "s"}${ig ? ` and ${ig} Instagram account${ig === 1 ? "" : "s"}` : ""}.`, tag: "Channels" });
    return back(`connected=${fb + ig}${problems.length ? `&error=${encodeURIComponent(problems.join("; "))}` : ""}`);
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : "Couldn't connect to Facebook.")}`);
  }
}
