import "server-only";
import { AiError, geminiJson } from "./gemini";
import type { Business } from "../data/types";

/* AI copywriting for emails and social posts, in the project's own voice. */

type Biz = Pick<Business, "name" | "segment" | "city" | "offer" | "audience" | "voice" | "goal" | "website">;

const brand = (b: Biz) => [
  `Business: ${b.name}${b.city ? ` (${b.city})` : ""} — ${b.segment}.`,
  b.offer && `What they sell: ${b.offer}.`,
  b.audience && `Ideal customer: ${b.audience}.`,
  b.goal && `Current goal: ${b.goal}.`,
  b.website && `Website: ${b.website}.`,
  `Brand voice: ${b.voice || "warm, clear and professional"}.`,
].filter(Boolean).join("\n");

export const TONES = ["Friendly", "Professional", "Short & direct", "Persuasive", "Playful", "Formal"] as const;

const EMAIL_RULES = `Rules for every email:
- Plain text only (no HTML, no markdown, no emoji in subject lines). Blank lines separate paragraphs.
- Personal, human, specific — sounds like one person writing to one person. No hype, no "I hope this email finds you well".
- 60–160 words unless asked otherwise. One clear call to action.
- You may use these merge tags exactly as written: {{first_name}}, {{company|your team}}, {{business_name}}, {{sender_name}}, {{booking_link}}, {{city}}.
- Sign off with {{sender_name}} on its own line.
- Subject lines: under 60 characters, lowercase-friendly, curiosity or clear value, never clickbait or ALL CAPS.
- Never invent prices, discounts, statistics or testimonials that were not given in the brief.`;

const clean = (s: unknown, n: number) => String(s ?? "").replace(/\r/g, "").trim().slice(0, n);

export type WrittenEmail = { subject: string; body: string; preheader?: string };

export async function writeEmail(b: Biz, o: { brief: string; tone?: string; purpose?: string; current?: { subject?: string; body?: string }; lead?: { name?: string; company?: string | null; stage?: string; notes?: string | null } | null; isFollowUp?: boolean }): Promise<{ options: WrittenEmail[] }> {
  const brief = clean(o.brief, 1500);
  const improving = !brief && (o.current?.body ?? "").trim().length > 20;
  if (!brief && !improving) throw new AiError("Tell the AI what the email is about — for example “invite past customers to our Diwali offer”.");
  const prompt = `You are a senior email copywriter for a small business.
${brand(b)}

${improving ? `Rewrite and improve this draft (keep its intent, make it clearer and more persuasive):\nSubject: ${clean(o.current?.subject, 200)}\n${clean(o.current?.body, 4000)}` : `Write an email. Brief: ${brief}`}
${o.purpose ? `Where it's used: ${clean(o.purpose, 200)}.` : ""}
${o.isFollowUp ? "This is a follow-up in the same thread — the subject may be left empty to reply in-thread; keep it shorter than a first email." : ""}
${o.lead ? `Written to one specific person: ${clean(o.lead.name, 80)}${o.lead.company ? ` at ${clean(o.lead.company, 80)}` : ""}${o.lead.stage ? ` (pipeline stage: ${o.lead.stage})` : ""}.${o.lead.notes ? ` Notes about them: ${clean(o.lead.notes, 600)}` : ""} Use their first name directly instead of {{first_name}}.` : ""}
Tone: ${clean(o.tone, 40) || "Friendly"}.

${EMAIL_RULES}

Return JSON: {"options":[{"subject":"…","preheader":"…","body":"…"}]} with exactly 3 genuinely different options (different angles, not rewordings).`;
  const { data } = await geminiJson<{ options?: WrittenEmail[] }>(prompt, { temperature: 0.8, maxTokens: 4096 });
  const options = (data.options ?? []).map((e) => ({ subject: clean(e.subject, 200), preheader: clean(e.preheader, 200), body: clean(e.body, 6000) })).filter((e) => e.body);
  if (!options.length) throw new AiError("The AI didn't return an email — try rephrasing the brief.");
  return { options: options.slice(0, 3) };
}

export type WrittenSequence = { name: string; steps: { delay_days: number; subject: string; body: string }[] };

export async function writeSequence(b: Biz, o: { goal: string; audience?: string; steps?: number; tone?: string }): Promise<WrittenSequence> {
  const goal = clean(o.goal, 1000);
  if (!goal) throw new AiError("Describe the campaign goal — for example “turn new website enquiries into booked calls”.");
  const n = Math.min(6, Math.max(2, Number(o.steps) || 4));
  const prompt = `You are a senior lifecycle-email strategist for a small business.
${brand(b)}

Design a ${n}-email campaign. Goal: ${goal}.
${o.audience ? `Who receives it: ${clean(o.audience, 300)}.` : ""}
Tone: ${clean(o.tone, 40) || "Friendly"}.
Email 1 has delay_days 0. Later emails wait 2–5 days after the previous one, and have an EMPTY subject so they land in the same thread (a reply-style follow-up), except a final "break-up" email may have its own short subject.
Each email has a distinct job (value, proof/story, objection, easy CTA, break-up). Emails stop automatically when the person replies, so never say "if you've already replied".

${EMAIL_RULES}

Return JSON: {"name":"short campaign name","steps":[{"delay_days":0,"subject":"…","body":"…"}]}`;
  const { data } = await geminiJson<WrittenSequence>(prompt, { temperature: 0.7, maxTokens: 6000 });
  const steps = (data.steps ?? []).slice(0, n).map((s, i) => ({ delay_days: i === 0 ? 0 : Math.min(30, Math.max(1, Math.round(Number(s.delay_days) || 3))), subject: clean(s.subject, 200), body: clean(s.body, 6000) })).filter((s) => s.body);
  if (!steps.length) throw new AiError("The AI didn't return any emails — try again.");
  if (!steps[0].subject) steps[0].subject = `A quick note from ${b.name}`;
  return { name: clean(data.name, 80) || "AI campaign", steps };
}

/* ───────── Social ───────── */

export type SocialIdea = { caption: string; hashtags: string[]; image: { headline: string; sub: string; prompt: string } };
const NET: Record<string, string> = {
  instagram: "Instagram (hook in the first line, line breaks, 5–12 relevant hashtags at the end)",
  facebook: "Facebook (conversational, 1–3 short paragraphs, 0–3 hashtags)",
  linkedin: "LinkedIn (professional insight, short lines, 3–5 hashtags)",
  x: "X/Twitter (under 270 characters including hashtags)",
  whatsapp: "WhatsApp Status/Channel (short, friendly, no hashtags)",
};

export async function writeSocial(b: Biz, o: { brief: string; tone?: string; channels?: string[]; count?: number }): Promise<{ options: SocialIdea[] }> {
  const brief = clean(o.brief, 1200);
  if (!brief) throw new AiError("Tell the AI what the post is about — for example “weekend offer on haircuts”.");
  const nets = (o.channels?.length ? o.channels : ["instagram", "facebook"]).map((c) => NET[c] ?? c).join("; ");
  const prompt = `You are a social media manager for a small business.
${brand(b)}

Write ${Math.min(4, Math.max(1, o.count ?? 3))} different post options about: ${brief}
Target networks: ${nets}. Make each caption work on all of them (respect the shortest limit if X is included).
Tone: ${clean(o.tone, 40) || "Friendly"}. Emoji are fine in moderation. End with a clear call to action.
Never invent prices, discounts or claims not in the brief.
For each option also design a square image: a short bold headline (max 6 words), a subline (max 10 words) and a detailed photo/illustration prompt (no text in the image, no logos, brand-safe).

Return JSON: {"options":[{"caption":"…","hashtags":["#tag"],"image":{"headline":"…","sub":"…","prompt":"…"}}]}`;
  const { data } = await geminiJson<{ options?: SocialIdea[] }>(prompt, { temperature: 0.9, maxTokens: 4096 });
  const options = (data.options ?? []).map(norm).filter((x) => x.caption);
  if (!options.length) throw new AiError("The AI didn't return a post — try rephrasing.");
  return { options };
}

function norm(x: Partial<SocialIdea>): SocialIdea {
  return {
    caption: clean(x.caption, 2200),
    hashtags: (Array.isArray(x.hashtags) ? x.hashtags : []).map((h) => `#${String(h).replace(/^#+/, "").replace(/\s+/g, "")}`).filter((h) => h.length > 1).slice(0, 15),
    image: { headline: clean(x.image?.headline, 60), sub: clean(x.image?.sub, 90), prompt: clean(x.image?.prompt, 600) },
  };
}

export type PlannedPost = SocialIdea & { day: number; time: string; theme: string };

export async function planSocialWeek(b: Biz, o: { focus?: string; posts?: number; channels?: string[]; tone?: string }): Promise<PlannedPost[]> {
  const n = Math.min(7, Math.max(2, Number(o.posts) || 5));
  const nets = (o.channels?.length ? o.channels : ["instagram", "facebook"]).map((c) => NET[c] ?? c).join("; ");
  const prompt = `You are a social media strategist for a small business.
${brand(b)}

Plan ${n} posts for the next 7 days${o.focus ? ` focused on: ${clean(o.focus, 600)}` : ""}.
Mix themes: educational tip, behind the scenes, customer benefit/story (no invented testimonials), offer/CTA, local/community, question to drive comments.
Networks: ${nets}. Tone: ${clean(o.tone, 40) || "Friendly"}.
day is 1–7 (1 = tomorrow). time is local "HH:MM" at a good engagement hour for the audience.
Each post also gets a square image design: headline (max 6 words), subline (max 10 words), and a photo/illustration prompt without any text in the image.

Return JSON: {"posts":[{"day":1,"time":"10:00","theme":"…","caption":"…","hashtags":["#tag"],"image":{"headline":"…","sub":"…","prompt":"…"}}]}`;
  const { data } = await geminiJson<{ posts?: (Partial<PlannedPost>)[] }>(prompt, { temperature: 0.85, maxTokens: 8000 });
  const posts = (data.posts ?? []).slice(0, n).map((p, i) => ({ ...norm(p), day: Math.min(7, Math.max(1, Math.round(Number(p.day) || i + 1))), time: /^\d{1,2}:\d{2}$/.test(String(p.time)) ? String(p.time).padStart(5, "0") : "10:00", theme: clean(p.theme, 60) })).filter((p) => p.caption);
  if (!posts.length) throw new AiError("The AI didn't return a plan — try again.");
  return posts;
}
