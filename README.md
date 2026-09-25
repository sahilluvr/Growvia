# Growvia — Your AI Growth Team

_v010_

Marketing site + the logged-in Growvia product.

**Stack:** Next.js 14 (App Router, Server Actions) · TypeScript · Tailwind CSS 3 · Supabase (Auth + Postgres, free tier) · Geist · lucide-react

## What's inside

| Area | Route | What it does |
|---|---|---|
| Landing | `/` | Hero, growth loop, AI team, interactive plan preview, pricing, FAQ |
| Auth | `/signup` `/login` `/forgot` `/reset` | Email + password, password reset, route protection |
| Onboarding | `/onboarding` | 3-step setup → builds growth plan + first campaign |
| Overview | `/app` | KPIs, leads chart, weekly priorities, campaigns, AI activity, lead-form link |
| Growth plan | `/app/plan` | Strategy, audiences, opportunities → one-click campaigns, 30-day roadmap |
| Campaigns | `/app/campaigns`, `/app/campaigns/[id]` | Edit / approve / schedule / mark posted / copy; pause, complete, delete |
| Content | `/app/content` | All content by status with filters |
| Leads | `/app/leads` | Pipeline board + list, add/edit/delete, stage changes, search, CSV export |
| Settings | `/app/settings` | Business profile (+ rebuild plan), profile, password, sign out |
| Public lead form | `/f/[businessId]` | Shareable form; submissions land in Leads |
| Inbox | `/app/inbox` | Email, WhatsApp, Instagram DMs and Messenger in one chat view; delivered/read ticks, 24h window, templates |
| Channels | `/app/channels` | Connect WhatsApp Business numbers and Facebook Pages + Instagram (Facebook login) |
| WhatsApp | `/app/whatsapp` | Template broadcasts to opted-in contacts (by tag/stage), sent/delivered/read/replied/failed stats |
| Publish | `/app/publish` | Post photos, videos, carousels and text to Facebook + Instagram now or on a schedule |

## Run locally (no setup)

```bash
npm install
npm run dev   # http://localhost:3000
```
Without Supabase keys the app runs in **local demo mode** (data in `.data/growvia-db.json`). Great for trying it out — not for production.

## Go live with Supabase (free)

1. supabase.com → **New project** (Free plan).
2. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**.
3. **Authentication → URL Configuration**
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: add `https://your-app.vercel.app/auth/callback` (and `http://localhost:3000/auth/callback` for local dev)
4. **Authentication → Sign In / Providers → Email**: keep "Confirm email" ON for production (users get a confirmation link), or turn it OFF for instant signup while testing.
5. **Project Settings → API**: copy the Project URL and anon/publishable key.
6. Vercel → Project → **Settings → Environment Variables** — add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (anon or publishable key — never the service_role / secret key)
   - `SITE_URL` (your live URL)
   No `NEXT_PUBLIC_` prefix: Supabase is only used on the server, so nothing is exposed to browsers.
   Then **Redeploy**.

Locally, put the same values in `.env.local` (see `.env.example`).

7. Open **`https://your-app.vercel.app/api/health`** — it must show `"mode": "supabase"` and `"ok": true`. It checks the keys, Auth, every table and the lead-form function (it never shows your keys).

If the keys are missing on Vercel, sign-in pages send visitors to `/setup` instead of breaking. (The local demo store is disabled on Vercel on purpose: each request can hit a different server, so accounts would appear to vanish.)

Security: every table has Row Level Security — users can only read and write their own rows. The public lead form uses two narrow `security definer` functions (`public_business`, `submit_lead`).

## Email engine (v006)

Real email from the user's own mailbox, with replies threaded into Growvia.

- **Connect a mailbox:** Settings → Email sending. Gmail/Google Workspace (App Password), Outlook/Microsoft 365, Zoho, or any SMTP+IMAP host. The connection is tested before saving; the password is AES-GCM encrypted.
- **Templates:** starter library per business type + your own, with `{{first_name}}`, `{{company|fallback}}`, `{{booking_link}}` etc.
- **Email campaigns (sequences):** multi-step emails with waits, sending days/hours + time zone, daily send cap, follow-ups in the same thread, auto-stop on reply, unsubscribe link + one-click List-Unsubscribe, bounce detection, open/click tracking.
- **Inbox:** replies are read over IMAP and matched by email headers into threads; reply from Growvia and it threads correctly in the lead's mail app.
- **Leads:** CSV import (auto column detection, dedupe, tags), tags, bulk actions, lead timeline, send now or schedule.
- **Meetings:** public booking page `/book/<slug>` with availability, time zone, confirmation + calendar invite emails, cancellation.

### Extra environment variables (Vercel → Settings → Environment Variables)

| Name | What |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role / secret key. **Server-only** — powers the scheduler, booking page and tracking. |
| `CRON_SECRET` | Any long random string. Protects `/api/cron/tick`. |
| `ENCRYPTION_KEY` | Any long random string. Encrypts saved mailbox passwords and WhatsApp/Meta tokens. Recommended; adding it later is safe (older saved connections still open), but once set, never change or remove it. |

### Scheduler (every minute, free)

Run `supabase/cron.sql` in the Supabase SQL Editor after replacing `YOUR-SITE` and `YOUR-CRON-SECRET`. It uses Supabase's built-in `pg_cron` + `pg_net` to call `/api/cron/tick` every minute (sends due emails, reads replies). Vercel Cron also calls it once a day as a backup, and the app processes due work whenever you use it.

### Database

Re-run `supabase/schema.sql` (safe to run again) — v006 adds mailboxes, email_templates, sequences, sequence_steps, enrollments, threads, messages, booking_pages, bookings.

## WhatsApp, Facebook & Instagram (v007)

Everything runs on Meta's official, free APIs — no copy-pasting.

**One-time Meta app setup** (also shown step by step on `/app/channels`):
1. developers.facebook.com → My Apps → Create app → type **Business**. Add products **WhatsApp**, **Facebook Login for Business**, **Messenger**, **Instagram**.
2. Vercel env: `META_APP_ID`, `META_APP_SECRET` (App settings → Basic). `META_VERIFY_TOKEN` is optional — Growvia derives one and shows it on the Channels page.
3. Facebook Login → Settings → Valid OAuth Redirect URIs: `https://YOUR-SITE/api/oauth/meta/callback`
4. Webhooks: callback `https://YOUR-SITE/api/webhooks/meta` + the verify token. Subscribe WhatsApp → `messages`; Page/Instagram → `messages`.
5. While the app is in Development mode only you (and added testers) can connect. For clients: App Review for `pages_manage_posts`, `pages_messaging`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_messages`, `whatsapp_business_messaging`, then switch the app to Live.

**Connect WhatsApp:** Channels → Connect WhatsApp number → paste the WhatsApp Business Account ID and a permanent System User token (Phone number ID is optional — Growvia finds it). Growvia checks them with Meta and loads your approved templates.

**Connect Facebook + Instagram:** Channels → Continue with Facebook → pick your Pages. Instagram must be a Professional account linked to the Page.

**Message templates:** WhatsApp → Message templates → New template (ready-made starters, variables, buttons, live preview). Growvia submits it to Meta and tracks Waiting → Approved/Rejected automatically (subscribe the WhatsApp webhook field `message_template_status_update` too; the scheduler also re-checks every 5 minutes).

Rules Growvia follows for you: free-text WhatsApp/DM replies only within 24 h of the customer's last message (otherwise an approved template); broadcasts only to opted-in contacts by default; Instagram posts need a photo or video (uploaded files go to the public Supabase Storage bucket `media`).

| Variable | Purpose |
|---|---|
| `META_APP_ID` | Meta app ID (Facebook/Instagram login) |
| `META_APP_SECRET` | Verifies webhooks + exchanges login codes. Server-only. |
| `META_VERIFY_TOKEN` | Optional custom webhook verify token |

Re-run `supabase/schema.sql` — v007 adds `channel_accounts`, `social_posts`, `wa_broadcasts`, chat columns on threads/messages/leads, and the `media` storage bucket.

## Speed

- `vercel.json` pins server functions to **bom1 (Mumbai)** — keep it in the same region as your Supabase project (Supabase → Project Settings → General → Region). If Supabase is elsewhere, change `bom1` to the matching Vercel region (e.g. `sin1` Singapore, `iad1` US East, `fra1` Frankfurt).
- `/api/health` reports `serverRegion` and `dbLatencyMs` — under ~40 ms means they're co-located.
- Pages fetch everything in one parallel round trip; sidebar pages are prefetched so clicks open instantly; approvals and stage changes update on screen immediately.

## Architecture

- `src/lib/data/` — one `Repo` interface, two drivers: `supabase.ts` (production) and `local.ts` (demo). Picked automatically by env vars.
- `src/app/actions.ts` — all server actions (auth, onboarding, plan, campaigns, content, leads, settings, public form).
- `src/lib/engine.ts` — growth engine v1 (rules-based plan + content generation). Swap in an LLM later without changing the UI.
- `src/middleware.ts` — refreshes Supabase sessions and protects `/app` and `/onboarding`.
