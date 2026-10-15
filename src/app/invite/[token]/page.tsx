import Link from "next/link";
import type { Metadata } from "next";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { adminClient } from "@/lib/server/admin";
import { Logo } from "@/components/Logo";
import { AcceptInvite } from "./client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team invitation", robots: { index: false } };

type Invite = { email: string; role: string; owner_name: string; owner_id: string };

/** Looks the invitation up by its secret token. Works without the service key (security-definer lookup). */
async function findInvite(token: string): Promise<Invite | null> {
  try {
    const { data, error } = await supabaseServer().rpc("invite_info", { tok: token });
    if (!error) return (data as Invite | null) ?? null;
  } catch { /* fall back below */ }
  const db = adminClient();
  if (!db) return null;
  const { data: m } = await db.from("team_members").select("email, role, owner_id").eq("invite_token", token).eq("status", "invited").maybeSingle();
  if (!m) return null;
  const { data: p } = await db.from("profiles").select("name").eq("id", m.owner_id).maybeSingle();
  return { ...m, owner_name: p?.name ?? "the team" };
}

export default async function InvitePage({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token).trim();
  const [inv, user] = await Promise.all([findInvite(token), repo().getUser().catch(() => null)]);
  const next = `/invite/${encodeURIComponent(token)}`;
  const q = (email: string) => `next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`;
  const sameEmail = user && inv && user.email.toLowerCase() === inv.email.toLowerCase();
  const isOwner = user && inv && user.id === inv.owner_id;
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4">
      <main className="card grid w-full max-w-md gap-4 p-8 text-center">
        <div className="mx-auto"><Logo /></div>
        {!inv ? (
          <>
            <h1 className="text-[22px] font-semibold tracking-tight">This invitation isn&apos;t valid anymore</h1>
            <p className="text-[14px] text-stone-500">It may have been accepted already, cancelled, or replaced by a newer invite (clicking &ldquo;Resend&rdquo; makes a fresh link). Ask the person who invited you for the latest link.</p>
            <Link href={user ? "/app" : "/login"} className="btn-primary mx-auto h-10 px-5 text-[14px]">{user ? "Open Growvia" : "Go to sign in"}</Link>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold tracking-tight">Join {inv.owner_name} on Growvia</h1>
            <p className="text-[14px] text-stone-500">You&apos;ve been invited as <b className="text-ink">{inv.role}</b> using <b className="text-ink">{inv.email}</b>.</p>
            {!user ? (
              <div className="grid gap-2">
                <Link href={`/signup?${q(inv.email)}`} className="btn-primary h-11 text-[14px]">Create my account</Link>
                <Link href={`/login?${q(inv.email)}`} className="btn-ghost h-11 text-[14px]">I already have an account</Link>
                <p className="text-[12px] text-stone-500">Use <b>{inv.email}</b> — the invitation only works for that email.</p>
              </div>
            ) : sameEmail ? (
              <><p className="text-[13px] text-stone-500">Signed in as {user.email}</p><AcceptInvite token={token} /></>
            ) : (
              <div className="grid gap-3" data-testid="invite-wrong-account">
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-[13px] text-amber-900">
                  {isOwner ? <>You&apos;re signed in as <b>{user.email}</b> — the person who sent this invite. To test it, open the link in a private window, or sign out first.</> : <>You&apos;re signed in as <b>{user.email}</b>, but this invitation is for <b>{inv.email}</b>.</>}
                </p>
                <form action={`/auth/signout?${q(inv.email)}`} method="post"><button className="btn-primary h-11 w-full text-[14px]">Sign out &amp; continue as {inv.email}</button></form>
                <Link href="/app" className="text-[13px] text-stone-500 underline underline-offset-4">Stay signed in and go to Growvia</Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
