"use server";
import { guard } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { cleanDomain, domainOf, isFreeDomain, validDomain, type DomainReport } from "@/lib/health/domain";
import { WARMUP_PRESETS, type MailboxH } from "@/lib/health/email";
import { domainReport, refreshMailboxHealth, refreshPostmaster } from "@/lib/health/jobs";
import { refreshWaHealth } from "@/lib/health/whatsapp";
import { cleanEmailList, cleanPhones } from "@/lib/health/lists";
import { checkIdeas, cloudflareFix, ideasFor, type DomainIdea } from "@/lib/health/registrar";
import type { ChannelAccount } from "@/lib/meta/channels";

type FormState = { ok?: boolean; error?: string; message?: string } | undefined;

async function me() {
  const r = repo();
  const [user, business] = await Promise.all([r.getUser(), r.getBusiness().catch(() => null)]);
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  return { db: supabaseServer(), user, business, owner: business.owner_id ?? user.id };
}
const done = () => revalidatePath("/app/health");
const err = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/** "Check everything now": every mailbox (fresh DNS), Gmail data, every WhatsApp number. */
export async function recheckAllAction(): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, owner } = await me();
    const [{ data: mbs }, { data: nums }, { data: link }] = await Promise.all([
      db.from("mailboxes").select("*"), db.from("channel_accounts").select("*").eq("provider", "whatsapp"), db.from("postmaster_links").select("owner_id").eq("owner_id", owner).maybeSingle(),
    ]);
    const deadline = Date.now() + 45_000;
    for (const mb of (mbs ?? []) as MailboxH[]) { if (Date.now() > deadline) break; await domainReport(db, mb.owner_id, domainOf(mb.from_email), mb.smtp_host, 0).catch(() => null); }
    if (link) await refreshPostmaster(db, owner).catch(() => null);
    for (const mb of (mbs ?? []) as MailboxH[]) { if (Date.now() > deadline) break; await refreshMailboxHealth(db, mb).catch(() => null); }
    for (const acc of (nums ?? []) as ChannelAccount[]) { if (Date.now() > deadline) break; await refreshWaHealth(db, acc).catch(() => null); }
    const { data: doms } = await db.from("sender_domains").select("domain, checked_at").eq("owner_id", owner);
    for (const d of doms ?? []) { if (Date.now() > deadline) break; await domainReport(db, owner, d.domain, null, 0.05).catch(() => null); }
    done();
    return { ok: true, message: "Everything re-checked." };
  });
}

export async function setWarmupAction(mailboxId: string, on: boolean, preset: keyof typeof WARMUP_PRESETS = "new"): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db } = await me();
    const p = WARMUP_PRESETS[preset] ?? WARMUP_PRESETS.new;
    const warmup = on ? { enabled: true, started_at: new Date().toISOString(), start: p.start, step: p.step } : { enabled: false };
    const { error } = await db.from("mailboxes").update({ warmup }).eq("id", mailboxId);
    if (error) return { error: "Couldn't save — run the latest schema.sql in Supabase." };
    done();
    return { ok: true, message: on ? `Warm-up on: ${p.start} emails today, then +${p.step} a day up to your daily limit.` : "Warm-up off — the full daily limit applies." };
  });
}

export async function setDailyLimitAction(mailboxId: string, limit: number): Promise<FormState> {
  const { db } = await me();
  const n = Math.max(1, Math.min(2000, Math.round(limit)));
  await db.from("mailboxes").update({ daily_limit: n }).eq("id", mailboxId);
  done();
  return { ok: true, message: `Daily limit set to ${n}.` };
}

export async function resumeMailboxAction(mailboxId: string): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db } = await me();
    const { data: mb } = await db.from("mailboxes").select("health, from_email").eq("id", mailboxId).maybeSingle();
    if (!mb) return { error: "Mailbox not found." };
    await db.from("mailboxes").update({ health: { ...(mb.health ?? {}), paused: false, paused_reason: null, resumed_at: new Date().toISOString() } }).eq("id", mailboxId);
    // Waiting campaign emails go out on the next run.
    await db.from("enrollments").update({ next_run_at: new Date().toISOString(), last_error: null }).like("last_error", "Paused to protect%").eq("status", "active");
    done();
    return { ok: true, message: `Resumed ${mb.from_email}. Growvia keeps watching and pauses again if bounces stay high.` };
  });
}

export async function resumeNumberAction(accountId: string): Promise<FormState> {
  const { db } = await me();
  const { data: acc } = await db.from("channel_accounts").select("meta").eq("id", accountId).maybeSingle();
  if (!acc) return { error: "Number not found." };
  await db.from("channel_accounts").update({ meta: { ...(acc.meta ?? {}), health: { ...(acc.meta?.health ?? {}), paused: false, paused_reason: null, resumed_at: new Date().toISOString() } } }).eq("id", accountId);
  done();
  return { ok: true, message: "Broadcasts resumed. Send only to people who opted in, in small batches, until quality is green again." };
}

type EmailRes = { ok?: boolean; error?: string; message?: string; examples?: { email: string; why: string }[] };
type PhoneRes = { ok?: boolean; error?: string; message?: string; examples?: { phone: string; why: string }[] };
export async function cleanEmailListAction(): Promise<EmailRes> {
  return (await guard(async (): Promise<EmailRes> => {
    const { db, business } = await me();
    const r = await cleanEmailList(db, business.id);
    done(); revalidatePath("/app/leads");
    const parts = [`Checked ${r.checked} addresses`, r.invalid ? `${r.invalid} can't receive email (skipped from campaigns)` : "no dead addresses", r.risky ? `${r.risky} temporary addresses flagged` : "", r.typosFixed ? `${r.typosFixed} typos fixed (like gmial.com → gmail.com)` : ""].filter(Boolean);
    return { ok: true, message: `${parts.join(" · ")}.`, examples: r.examples };
  })) ?? {};
}

export async function cleanPhonesAction(country = "91"): Promise<PhoneRes> {
  return (await guard(async (): Promise<PhoneRes> => {
    const { db, business } = await me();
    const r = await cleanPhones(db, business.id, /^\d{1,4}$/.test(country) ? country : "91");
    done(); revalidatePath("/app/whatsapp");
    return { ok: true, message: `${r.withPhone} numbers · ${r.fixed} formatted for WhatsApp · ${r.invalid} invalid · ${r.duplicates} duplicates · ${r.optedIn} opted in.`, examples: r.examples };
  })) ?? {};
}

export async function addDomainAction(_: FormState, f: FormData): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, owner } = await me();
    const d = cleanDomain(String(f.get("domain") ?? ""));
    if (!validDomain(d)) return { error: "Enter a domain like yourbusiness.com" };
    if (isFreeDomain(d)) return { error: `${d} belongs to an email provider — add your own business domain instead.` };
    await domainReport(db, owner, d, null, 0);
    done();
    return { ok: true, message: `Checked ${d}.` };
  });
}

export async function checkDomainAction(domain: string): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, owner } = await me();
    const { data: mb } = await db.from("mailboxes").select("smtp_host, from_email").ilike("from_email", `%@${domain}`).limit(1).maybeSingle();
    const { report } = await domainReport(db, owner, domain, mb?.smtp_host ?? null, 0);
    done();
    const bad = report.checks.filter((c) => c.status === "bad").length;
    return { ok: true, message: bad ? `${bad} thing${bad === 1 ? "" : "s"} still to fix. DNS changes can take 5–60 minutes to show.` : "All set up correctly." };
  });
}

export async function removeDomainAction(domain: string): Promise<FormState> {
  const { db, owner } = await me();
  await db.from("sender_domains").delete().eq("owner_id", owner).eq("domain", domain);
  done();
  return { ok: true };
}

export async function cloudflareFixAction(domain: string, token: string): Promise<FormState> {
  return guard(async (): Promise<FormState> => {
    const { db, owner } = await me();
    if (token.trim().length < 20) return { error: "Paste a Cloudflare API token (Cloudflare → My Profile → API Tokens → Create → “Edit zone DNS”)." };
    const { data } = await db.from("sender_domains").select("checks").eq("owner_id", owner).eq("domain", domain).maybeSingle();
    const checks = (data?.checks as DomainReport | undefined)?.checks ?? [];
    try {
      const fixed = await cloudflareFix(domain, token, checks);
      await domainReport(db, owner, domain, null, 0).catch(() => null);
      done();
      return fixed.length ? { ok: true, message: `Added on Cloudflare: ${fixed.join(", ")}. The token wasn't saved. DKIM still has to be turned on in your email provider (steps below).` } : { ok: true, message: "Nothing Growvia can add automatically — see the steps below." };
    } catch (e) { return { error: err(e) }; }
  });
}

export async function domainIdeasAction(q?: string): Promise<{ ideas?: DomainIdea[]; error?: string }> {
  const { business } = await me();
  const term = (q ?? "").trim();
  const list = term ? (/\./.test(term) ? [cleanDomain(term)] : ideasFor(term, null, null)) : ideasFor(business.name, business.city, business.segment);
  if (!list.length || list.some((d) => !validDomain(d))) return { error: "Type a name like “bellas trattoria” or a domain like bellas.in" };
  return { ideas: await checkIdeas(list.slice(0, 12)) };
}
