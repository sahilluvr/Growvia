# Growvia — Your AI Growth Team

_v013_

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
| Projects | `/app/projects` + sidebar switcher | Workspaces (one per client/brand) holding projects (websites/businesses); leads, campaigns, plan and SEO are per project |
| SEO & AI search | `/app/seo` | Crawl audit (technical, on-page, content, AI-search/GEO, social), Google PageSpeed, AI plan, page rewrites, llms.txt / robots.txt / schema, keywords, content ideas, Search Console |
| SEO report | `/r/seo/[token]` | Shareable, printable (PDF) client report — signed link, no login |
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

## SEO & AI search (v012)

Add the website on **SEO & AI search** and click **Run audit**. Growvia:
1. Crawls up to 25 pages like Googlebot (robots.txt, sitemap, llms.txt, redirects, broken links, soft 404s, canonicals, titles, descriptions, headings, alt text, schema, Open Graph, JavaScript-only pages).
2. Checks which AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended…) your robots.txt allows.
3. Runs Google PageSpeed on mobile + desktop (Lighthouse + real Chrome-user Core Web Vitals).
4. Writes a 3-phase plan, quick wins, new titles/descriptions, keywords, content ideas, FAQs, and ready-to-upload **llms.txt**, **robots.txt** and **JSON-LD schema** (Google Gemini; rule-based fallback without a key).
5. Pulls real searches, clicks and positions from Google Search Console when connected.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Free key from aistudio.google.com → Get API key. Optional `GEMINI_MODEL` (defaults to `gemini-flash-latest`, falls back automatically). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (Web application) with redirect URI `https://YOUR-SITE/api/oauth/google/callback`; enable "Google Search Console API"; add yourself as a test user. |
| `PAGESPEED_API_KEY` | Optional free Google API key (enable "PageSpeed Insights API") — avoids the shared rate limit. |

### v013 — tracking over time, AI visibility (GEO), experts, reports

- **AI visibility:** add the questions customers ask AI (or let Growvia suggest them). Growvia asks Google Gemini (with live Google Search), Perplexity and ChatGPT, then records if you're mentioned, your position among named businesses, whether your site is cited, competitors named, sentiment, and which websites AI cites. Share of voice + trend chart. Page-by-page AI-readiness score.
- **Keywords:** track keywords; 90 days of daily positions, clicks and impressions from Search Console (refreshed daily), best page per keyword, 7/28-day change, sparklines, position chart; optional exact live positions via SerpApi or DataForSEO. Keyword ideas from Search Console ("almost on page 1"), Google autocomplete and AI.
- **Experts:** AI panel of five specialists (Technical, Content, GEO, Local/Authority, Conversion), each with a grade and prioritised recommendations.
- **Reports:** last 7 / 30 / 90 days, this/last month or custom range; score, AI-visibility, clicks, impressions and keyword-position charts, keyword movers, issues fixed/new, share of voice; share link, PDF, and weekly/monthly emails.
- **Scheduler:** re-audits (daily/weekly/monthly), Search Console sync, AI-visibility checks and report emails run automatically from `/api/cron/tick`. Per-project settings on the SEO → Settings tab.

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Growvia's own emails (reports, welcome, invites, alerts). resend.com → API Keys; verify your domain, e.g. `EMAIL_FROM=Growvia <reports@yourdomain.com>` |
| `PERPLEXITY_API_KEY` | Optional — also check Perplexity answers (`PERPLEXITY_MODEL`, default `sonar`) |
| `OPENAI_API_KEY` | Optional — also check ChatGPT with web search (`OPENAI_MODEL`, default `gpt-4.1-mini`) |
| `SERPAPI_KEY` or `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` | Optional — exact live Google positions for any keyword |

Re-run `supabase/schema.sql` — v013 adds seo_keywords, seo_rankings, seo_daily, geo_prompts, geo_checks and SEO settings columns.

Re-run `supabase/schema.sql` — v012 adds `workspaces`, `seo_audits`, project links on businesses/activity and Search Console fields.

## v014 — Forms, email studio, team, system emails, AI social, captcha

- **Website forms (per project):** Website forms → build the form (fields, texts, colour, after-submit message or redirect, auto-reply). Put it on any site with one script tag (auto-resizing iframe), an iframe, your own HTML `<form>` posting to `/api/forms/<id>`, or a hosted link. Every enquiry becomes a lead with the page, referrer and UTM tags; same email = updated lead, not a duplicate. Honeypot + rate limit + optional Turnstile stop spam.
- **Email studio:** Email → Campaigns · Write & send · Templates · Replies · Mailboxes. “Write with AI” in every email editor (3 options, or improve your draft; uses the lead's details on a lead page). “Create a campaign with AI” writes the whole sequence and timing. **Write & send** sends one email to a person, a tag, a pipeline stage or everyone — now or scheduled — through the campaign engine (sending limits, unsubscribe, reply tracking). Leads → select → Email.
- **Team:** Settings → Team. Invite by email as Admin, Member or Viewer; access to all workspaces or only some (e.g. one client). Teammates work on the owner's data; viewers are read-only with a clear banner. Project settings (project, forms) vs account settings (account, team, notifications, email, integrations).
- **System emails (Resend):** welcome, team invites, new-lead and reply alerts, meeting booked, SEO check finished, SEO alerts (score drops / new critical issues), keyword top-10 changes, AI-visibility changes, Monday summary, form auto-replies. Everyone chooses theirs in Settings → Notifications. Each alert is sent once (deduplicated) and logged.
- **AI social:** Publish → “Write with AI” (caption options + hashtags + image idea), “Create image” (branded PNGs in 4 layouts, 6 colour sets, square/portrait/story/wide; optional AI photo), and “Plan a week of posts” (drafts or scheduled, with images). Drafts can be edited; images can be downloaded.
- **Captcha:** Cloudflare Turnstile on sign up, sign in, forgot password and website forms.

| Variable | Purpose |
|---|---|
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | dash.cloudflare.com → Turnstile → Add site (add your Vercel domain). Leave both empty to switch the captcha off. Optional `CAPTCHA_MODE=supabase` if you enable Turnstile in Supabase Auth → Bot and Abuse Protection instead (then Supabase checks the token). |
| `RESEND_API_KEY`, `EMAIL_FROM` | All system emails above. Verify your domain in Resend. |
| `SITE_URL` | Needed so links in background emails point to your site. |
| `GEMINI_IMAGE_MODEL` | Optional — image model for AI photos (default `gemini-2.5-flash-image`; `off` hides the option). Branded designs work without it. |

Re-run `supabase/schema.sql` — v014 adds profiles, team_members, user_prefs, email_log, lead_forms, team-aware security policies, `sequences.kind` and `social_posts.ai`.

## v015 — Marketing website

- Homepage rewritten around what Growvia really does (SEO & AI search, email studio, AI social, forms, WhatsApp, one inbox, bookings, teams); early-access pricing.
- Feature pages at `/features` and `/features/<slug>` (seo, ai-search, email, inbox, whatsapp, social, forms, meetings, agencies) with FAQ + breadcrumb structured data and share images. Content lives in `src/lib/site/features.ts`.
- `/sitemap.xml`, `/robots.txt` (app and private links blocked), `/llms.txt` for AI assistants, Open Graph images.
- Draft `/privacy` and `/terms` pages (also needed for Meta App Review) — have them reviewed before relying on them.
- Optional env: `CONTACT_EMAIL` (defaults to team.usegrowvia@gmail.com). `SITE_URL` is used for canonical links and the sitemap.

## v016 — Ad studio (ad copy + video ads, free)

**Ad studio** (sidebar → Social & ads): paste a website or landing page and Growvia
1. reads it, copies its photos and logo into your storage, and writes an editable creative brief;
2. writes **text ads** for Google Search (15 headlines, 4 descriptions, paths, keywords, negatives, sitelinks), Facebook & Instagram (3 variants with preview + image designer), LinkedIn, X and display banners — trimmed to each platform's character limits, with live counters and autosave;
3. writes a **video ad story** (15–60 s; 9:16, 1:1 or 16:9; problem→solution, offer, explainer, customer story, behind the scenes) with editable scenes and a photo per scene;
4. records an **AI voice-over** (30 Gemini voices, sample before choosing) — free on Gemini's TTS models;
5. adds an **illustrated presenter** (6 original characters that lip-sync to the voice), captions that highlight each word, original generated music and your colours;
6. **exports the video in the browser** (MediaRecorder: MP4/H.264 in Chrome 126+/Safari, otherwise WebM), uploads it, and can send it to Publish as a Facebook/Instagram draft.

No paid video service is used. Keep the tab open while exporting — rendering happens in real time.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Also powers ad copy and the AI voice. |
| `GEMINI_TTS_MODEL` | Optional voice model override (defaults try `gemini-3.8-flash-lite-tts`, `gemini-3.8-flash-tts`, then older preview models). |

Re-run `supabase/schema.sql` — v016 adds the `ad_projects` table.

## v017 — Free AI limits handled, security fix

- **Gemini free limits:** each Gemini model has its own free quota. Growvia now moves to the next free model (Flash → other Flash versions → Flash-Lite) when one is used up, retries short per-minute waits, rests exhausted models, and runs bulk AI-visibility checks on Lite models first so your main quota stays free. If every free model is used up it tells you whether it's the per-minute or the daily limit (resets at midnight Pacific). `/api/health` shows which model is answering and which are resting. Optional `GEMINI_FALLBACK_MODELS` (comma-separated) adds more model names.
- Voice samples are made once per voice and reused.
- **Security:** a row can no longer point at another account's project (database rule `gv_can`). Viewers get a clear message instead of a crash when they try to change something; every form action now shows errors on the form.

Re-run `supabase/schema.sql` (updates `gv_can`).

## v018 — Website animations

Hero entrance with blur-up text, rotating audience word, drifting colour glows, cursor glow, magnetic + shine buttons, and a dashboard that rises in and tilts toward the cursor with counting numbers. Scroll progress bar; headings reveal word by word; feature and team cards get a cursor spotlight and icon pop; step connector line draws in; comparison ticks pop in; animated glowing border on the early-access plan; floating tool chips; two-way marquee (pauses on hover); FAQ answers slide in; end-card line draws on scroll. All dependency-free (`src/components/motion.tsx` + `globals.css`) and switched off automatically for people who prefer reduced motion.

## v019 — AI runs in the background

Slow AI work no longer freezes the screen. Website audits, speed tests, AI SEO plans, the expert panel, AI-visibility checks, ad copy, video stories and voice-overs now run as **background tasks** (`jobs` table): the button returns instantly, you can move to any page, a small "running" pill shows progress, and a pop-up appears on whatever page you're on when it's ready (with a View link). Desktop notifications appear too if you allow them. If you come back to the page while it's still running, the button shows it. Each task runs in its own server invocation (`/api/jobs/run`, started with `waitUntil`); the scheduler picks up anything missed and stops tasks that hang.

Re-run `supabase/schema.sql` (adds `jobs`). Uses `CRON_SECRET` and `SITE_URL` (already set).

## v020 — Plans & billing (Razorpay), faster suggestions, invite fixes

**Plans.** Free forever for one business (1 project) with starter limits; team members, SEO audits, AI, reports, leads and inbox unlimited. **Pro $19/month or $190/year** (2 months free). **Agency** from $99/month — contact form on the pricing section emails `CONTACT_EMAIL`. Every new account gets a **14-day Pro trial without a card** (existing accounts get theirs from the day you run the schema). Limits live in `src/lib/billing/catalog.ts`:

| | Free | Pro |
|---|---|---|
| Tracked keywords (account) | 10 | 100 |
| AI-visibility questions | 5, checked monthly | 30, checked weekly |
| Video ads / month | 1, with "Made with Growvia" | 20, no watermark |
| Emails from your mailbox / month | 300 (inbox replies never blocked) | 5,000 |
| Website forms | 1 (unlimited leads) | unlimited |
| Scheduled social posts / month | 10 | unlimited |

**Billing page** (`/app/billing`, also Settings → Plan & billing and the sidebar plan card): plan status, usage meters, upgrade (monthly/yearly, pay in **USD** or **INR converted at today's rate**), switch monthly ↔ yearly, cancel at period end or immediately, payment-problem banner with Razorpay's update link, payment history with invoices. Payments use Razorpay Subscriptions + Checkout; the signature is verified on the server and Pro switches on instantly (no waiting for the webhook). Upgrading during the trial doesn't charge until the trial ends. Switching plans on UPI/eMandate re-confirms the payment method and starts the new plan when the current period ends (no double charge).

**Set up Razorpay**
1. Razorpay Dashboard → Settings → API Keys → generate keys. Add in Vercel: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Settings → Webhooks → add `https://YOUR-DOMAIN/api/billing/webhook`, pick a secret (`RAZORPAY_WEBHOOK_SECRET`) and the events `subscription.authenticated, subscription.activated, subscription.charged, subscription.pending, subscription.halted, subscription.cancelled, subscription.completed, subscription.paused, subscription.resumed, subscription.updated, invoice.paid, payment.failed`.
3. Enable **Subscriptions** on your Razorpay account. To charge in US dollars, enable **International payments** (KYC, and your site must show Terms, Privacy and Refund & Cancellation — all included: `/terms`, `/privacy`, `/refunds`). Until USD is enabled, customers who pick USD are told to pay in INR instead; or set `BILLING_CURRENCIES=INR` to offer only rupees.
4. Optional: `BILLING_FREE_PRO_EMAILS=you@x.com,client@y.com` gives those accounts Pro free. `BILLING_USD_INR=88` is the fallback rate if the free rate service is down. Agency deals: set `plan='agency', status='active'` on the account's `subscriptions` row.

Re-run `supabase/schema.sql` (adds `subscriptions`, `billing_plans`, `billing_events`, `payments`, `usage_events`, `ai_cache`, `invite_info`). Needs `SUPABASE_SERVICE_ROLE_KEY`.

**Faster.** The homepage plan demo answers in under a second. Keyword and AI-question suggestions show instantly (cached or Google autocomplete / starter questions) and AI ideas stream in after; results are cached for 12 hours.

**Invite links fixed.** The invite page no longer needs the service key to find the invitation; opening an invite while signed in as someone else explains it and offers "Sign out & continue as …"; signed-in people following a sign-in link go to the invite instead of the dashboard; email-confirmation links opened in another browser send you to sign in and then back to the invite; `SITE_URL` without `https://` now works. In Supabase → Authentication → URL Configuration, make sure **Site URL** is your domain and `https://YOUR-DOMAIN/auth/callback` is in **Redirect URLs**.

## v021 — Live on usegrowvia.com

Domain fallbacks, crawler user agent, report footer and scheduler SQL now use `https://usegrowvia.com`; contact email `team.usegrowvia@gmail.com` (replies to Growvia's own emails go there too). The old `growvia-three.vercel.app` pages redirect to the new domain (API routes stay reachable during the switch). New `/contact` and `/bot` pages. `/api/health` now lists go-live `warnings`. **Follow `GO-LIVE.md`** for every dashboard setting (Vercel, Supabase, Resend, Turnstile, Google, Meta, Razorpay, Search Console).

## v024 — Blog + easier campaign audiences

**Blog** at `/blog` with 5 long-form guides (GEO / AI search, local SEO checklist, email deliverability, WhatsApp Business, 30-day marketing plan). Each post has Article + Breadcrumb schema, canonical URL, Open Graph, a table of contents and is in `sitemap.xml`, `llms.txt` and the RSS feed `/blog/rss.xml`. To add or edit a post: edit/add a Markdown file in `src/lib/blog/src/` (front matter: slug, title, description, keywords, category, optional published/updated), then run `node scripts/build-blog.mjs`. Optional env `GOOGLE_SITE_VERIFICATION` adds the Search Console HTML-tag verification.

**Campaign audiences:** a campaign's Leads tab now lets you choose individual people (search + select all), add everyone, by tag, by stage, or add someone by email (creates the lead). The Emails tab shows an "Add leads" prompt while a campaign is empty, and each lead's profile has "Add to campaign".

## v026 — Owner admin dashboard (`/admin`)

One login for the owner. Set in Vercel → Environment Variables: `ADMIN_EMAIL` (defaults to sahilaggarwal43@gmail.com) and **`ADMIN_PASSWORD`** (required — the dashboard stays locked until it's set; never put it in the code). Sessions last 12 hours; changing the password signs every session out; 5 wrong tries lock the login for 10 minutes; `/admin` is hidden from search engines and can't be framed.

- **Overview:** total/new/active users, paying, trial, free, complimentary, MRR/ARR, revenue (7/30 days, all time), payment problems, deactivated/unconfirmed, 30-day sign-up chart, newest users, latest payments.
- **Users:** search, filters (paying, trial, free, complimentary, deactivated, unconfirmed, inactive 30d+), sorting, CSV export. User page: account details, last sign-in, plan & Razorpay subscription, usage vs limits, projects, team memberships, payments, admin history.
- **Actions:** give Pro or Agency with no payment (forever or until a date, with a note) · downgrade to Free (optionally cancels their Razorpay subscription) · extend trial · deactivate / activate (blocks sign-in) · mark email confirmed. Every action is logged.
- **Finance:** MRR/ARR, active monthly/yearly subscriptions, revenue by month (12 months), INR/USD split, upcoming renewals, cancellations and payment problems, full payment list with Razorpay/invoice links.
- **System:** running/failed background tasks, system email failures (24h), admin activity log, link to `/api/health`.

Re-run `supabase/schema.sql` (adds `subscriptions.comp_until`, `admin_note`, `admin_events`, `admin_user_stats()`).

## v027 — Google Business Profile, YouTube, contact imports, honest scheduling, custom avatars, speed

- **Scheduling tells the truth.** A content card is only "Scheduled" when Growvia will really post it: Facebook, Instagram, YouTube and Google Business posts go out automatically once that account is connected. Otherwise the card is **Planned · reminder**, and at the planned time Growvia emails a reminder (new notification type "Scheduled posts"). Instagram and YouTube cards send you to Publish to add the photo or video. Posts that fail (for example a disconnected account or an expired token) come back to the card with the reason, and the team gets an email. Cards scheduled before v027 that had no real post are turned into planned reminders by `schema.sql`.
- **Google Business Profile** (`/app/local`, sidebar "Google Business"): connect with Google; see views on Search and Maps, calls, website clicks, directions, chats and bookings, what people searched to find you, every review (with an AI-drafted reply you can post), a 12-point profile check, an AI description writer, and your review link. It syncs daily and emails you about new reviews. **Google Maps rankings** track up to 30 searches weekly with SerpApi or DataForSEO, and work even without Business Profile API approval. Content marked "Google Business" can post "What's new" updates.
- **YouTube**: Channels → Connect YouTube. Publish → tick the channel, add an MP4 (up to 50 MB), then set the title and visibility (public, unlisted or private). It uses YouTube's resumable upload, and quota errors are explained in plain English.
- **Contacts for WhatsApp and email**: upload a CSV or a phone/Outlook **vCard (.vcf)**, or import from **Google Contacts**. Before importing you can review the list, set a default country code, choose phone-only, tag everyone, and confirm they agreed to WhatsApp messages. Duplicates are matched by email *or* phone; existing leads get the tag and opt-in instead of being added twice.
- **Video ads**: "Your photo" uses your own photo as the presenter. It's a round portrait that moves with the voice-over, in every position.
- **Google logo**: `favicon.ico`, `icon.png` and `apple-icon.png`, `/logo.png`, plus Organization and WebSite JSON-LD. Google shows the logo after it recrawls the site, which usually takes days to a few weeks.
- **Speed**: a lighter first paint on phones (no hero blur or moving glows on mobile, no extra mono font download, and off-screen sections skip rendering until you scroll to them). `/api/health` → `speedFix` explains how to put Vercel in the same region as Supabase, which is the biggest remaining speed win.

One Google OAuth client serves every Google feature, with the same redirect URI `/api/oauth/google/callback`. See GO-LIVE.md §12 for the APIs to enable and the Business Profile access request.

## v028 — Menu that fits on one screen + Competitors

- The sidebar groups (Website & local, Outreach, Social & ads, Setup) open one at a time, and the group for the page you're on opens by itself. It fits on a 768px laptop screen without scrolling. Overview, Inbox and Leads are always visible.
- **Jump to… (⌘K / Ctrl+K)**: type a few letters ("reviews", "invite", "youtube") and press Enter.
- **Phones**: a bottom tab bar (Home, Inbox, Leads, Publish, More) with unread badges; the full menu opens from More.
- **Competitors** (`/app/competitors`, under Website & local):
  - **Suggestions**: Growvia suggests businesses that keep showing up next to you in Google Maps, Google results and AI answers. One click tracks them (up to 10). A name seen on Maps and a website seen on Google are merged into one suggestion.
  - **Scorecard**: you against each competitor on Google rating, reviews, new reviews per month (from weekly checks), average Google Maps position across your tracked searches, Google top-10 keywords, and AI mention rate. The best value in each column is highlighted.
  - **"Where they're beating you — and what to do"**: ranked insights (review gap, review speed, rating, Maps and Google searches they win, AI questions where they're recommended and you aren't), each with a link to the fix.
  - **Head-to-head page** per competitor: Maps, Google and AI tables side by side, a reviews-over-time chart, and editing or removing the competitor.
  - Ratings and reviews refresh weekly with the cron job (one SerpApi search per competitor), or on demand with Refresh. Live Google checks now store the top 20 sites, and Maps checks store the top 20 places.
  - The old SEO settings competitor box is moved to the new page automatically by `schema.sql`, and AI share of voice keeps using the same list.

## v029 — Sending health (Outreach → Sending health, `/app/health`)

Checks every day that your emails and WhatsApp messages actually arrive, and explains every fix in plain English.
- **Email health per mailbox** (score out of 100): bounce rate, reply and unsubscribe rates, send failures, domain setup, blocklists, and Gmail's own reputation and spam rate from Google Postmaster Tools (connect with Google). **Auto-protection:** if bounces spike (10%+ in 24 hours or 8%+ in a week) or Gmail complaints pass 0.3%, campaigns from that mailbox pause at once and the team gets an email. One-to-one emails still work, and one click resumes.
- **Safe warm-up**: a new mailbox starts at 10 campaign emails a day and adds 3 a day (or 25, +5 for mailboxes already in use) up to its daily limit. It holds automatically while numbers are bad. It uses no fake engagement networks. It's on by default when you connect a new mailbox.
- **Contact list check**: fixes typos (gmial.com → gmail.com), marks addresses whose domain has no mail server as invalid (campaigns skip them), flags temporary addresses, and stops active campaign emails to dead addresses.
- **WhatsApp number health**: Meta's quality rating (with history), messaging limit and how much of today's limit is left, template health (paused or rejected), delivered, read and STOP rates. At LOW quality, broadcasts pause automatically while chats keep working. The phone check formats numbers for WhatsApp and flags invalid numbers and duplicates.
- **Domains**: MX, SPF (including duplicate SPF records merged into one), DKIM (with provider-specific steps for Google, Microsoft and Zoho), DMARC and blocklists. It detects where your DNS is managed (Cloudflare, GoDaddy, Namecheap, Hostinger and more), links straight to its DNS page, gives exact records with copy buttons, and can **fix everything in one click on Cloudflare** with a temporary API token that isn't stored. **Find a domain** checks name ideas for availability and gives buy links.
- DNS is read over HTTPS (Cloudflare or Google DNS), so it works on Vercel. New notification type: "Sending health alerts".

## v047 — PayPal for customers outside India (through Razorpay)
- Razorpay won't enable international cards, so US-dollar buyers pay **once with PayPal** (Razorpay order in USD — PayPal shows for non-INR orders). PayPal can't auto-renew, so a payment buys 1 month or 1 year: same plan = time added on top; another plan = starts now with unused days converted into the new plan. Reminder emails + bell 7 days and 1 day before the end and when it ends. Rupee subscriptions are unchanged; a rupee subscription bought during PayPal time starts when it ends.
- Turn on: link PayPal in Razorpay (Settings → Configuration → PayPal), add `PAYPAL_PREPAID=on` in Vercel, tick **payment.captured** on the Razorpay webhook, run `supabase/schema-v047.sql`.

## v046 — Bing Webmaster Tools verification
- Adds the `msvalidate.01` meta tag (Bing ownership) to every page; `BING_SITE_VERIFICATION` env overrides it. After deploying, Bing Webmaster Tools → usegrowvia.com → Verify (HTML Meta Tag), then submit `https://usegrowvia.com/sitemap.xml`.

## v045 — Admin "Websites" + notifications top-right
- **Admin → Websites** (`/admin/websites`): every URL users added or had Growvia evaluate — project sites, SEO audits (score, issues, failures with the reason), competitor sites, Ad studio pages, Search Console properties — with the user, project and date. Filters, search, "group by domain", CSV export. Each user's admin page also lists their websites.
- Notification bell moved to a slim top bar at the top-right on desktop (the dropdown no longer covers the sidebar search); phones keep it in the header.

## v044 — Full-length videos, Instagram connect help, notifications & celebrations
- **Full-length video everywhere.** Browser recordings (Ad studio) have broken headers — Facebook kept only the first few seconds. Every recorded/WebM video is now converted once to a standard H.264/AAC MP4 (constant 30 fps, faststart, real duration) by `/api/media/standardize` (ffmpeg via `@ffmpeg-installer/ffmpeg`, bundled only into that function). Runs on export, on save/schedule, and as a safety net at publish. Facebook gets a regular full Page video (with a title, not a Reel); Instagram gets a Reel shared to the feed.
- **Instagram connect.** Finds Instagram via `instagram_business_account`, `connected_instagram_account`, and the accounts picked in Meta's window (granular scopes — works even when the Instagram is linked to a Page that wasn't selected). When none is found, Channels explains exactly why ("not linked to your Page" vs "switched off in Meta's window") with 3 steps and a one-click **Connect Instagram**.
- **Notifications.** New bell (sidebar + phone header) with unread badge, polling every 30s; anything new pops as a toast — scheduled post live, failures, connections. Scheduled posts also email when they go live.
- **Celebrations.** First post (and 10th/25th/50th/100th) gets a confetti celebration, once. "Publish now" shows live steps while it works, then a toast with "View on Facebook/Instagram" links; scheduling shows "Scheduled ✓" with the local time.
- **Run `supabase/schema-v044.sql`** (adds `app_notifications`). Without it everything works, just no bell items.

## v043 — SEO fixes from Growvia's own audit + Facebook/Instagram connect
- Titles ≤ 60 chars everywhere (`src/lib/site/seo-text.ts`: `seoTitle`, `metaDescription`; optional `seo_title` / `meta_description` front matter), feature pages get search titles, unique descriptions for every page, root/blog descriptions shortened.
- Share previews: per-guide and per-county Open Graph images, plus blog, category and local index images.
- New /about page (story, beliefs, FAQ, AboutPage + FAQPage schema); Contact page FAQ; home FAQ questions are headings + FAQPage schema; SoftwareApplication schema with plan prices.
- Account pages (login, signup, forgot, reset) are noindex with their own titles; topic pages with < 3 guides are noindex and out of the sitemap; category pages have real introductions.
- Channels: "Continue with Facebook" is always clickable and explains what's missing if the Meta app keys aren't set. Supports `META_LOGIN_CONFIG_ID` for "Facebook Login for Business" apps.

## v042 — WhatsApp Business app numbers (coexistence) + clear template error
- Connect tools → WhatsApp has a second button, "Use my WhatsApp Business app number": Embedded Signup with `featureType: whatsapp_business_app_onboarding` (Meta "coexistence"). No PIN registration; Growvia asks Meta to sync contacts and recent chats (`smb_app_data`). The number keeps working in the phone app.
- When Meta refuses templates, Growvia checks the number (`platform_type`/`status`); if it's a Business-app-only number (WhatsApp Manager shows "Offline") it says exactly that and how to reconnect, instead of pointing to Business Verification. "Check status" flags it too.

## v041 — Automatic IndexNow (Bing, ChatGPT search, Yandex…)
- `src/lib/seo/indexnow.ts`: after each deploy (and hourly for date-scheduled pages) the scheduler sends only new/changed sitemap URLs to IndexNow (api.indexnow.org → Bing, Yandex, Seznam, Naver; Bing feeds ChatGPT search, DuckDuckGo, Yahoo). Key file `public/44c5a1c966bde96736dabed44e554b94.txt`. State kept in `billing_plans` key `indexnow-state`. Skips outside production / non-live domains.
- Admin → Overview → "Search engines": last check, pages tracked, "Send all pages now".
- Google doesn't support IndexNow: it uses the sitemap (resubmitted in Search Console) and URL Inspection requests.

## v040 — 50 industry guides + 25 US local market pages
- 50 new in-depth guides (≈150k words; ≈200k including the local pages) in 9 industry hubs: dentists, lawyers, medical & wellness, home services, real estate, accountants, restaurants, salons & spas, gyms — each with an "All-in-one AI marketing for X" pillar (`src/lib/blog/hubs.ts`) plus cross-industry guides. All published on past dates (Sep 1 – Oct 2, 2026); the previously scheduled October posts were moved into September, so nothing is future-dated.
- 25 US county/metro playbooks at `/local-marketing/<slug>` (`src/lib/local/src/*.md` → `node scripts/build-blog.mjs` → `pages.generated.ts`), each with local geography, seasons, languages and state rules (bar ad filing, privacy/health-data laws), linked to the industry pillars.
- Interlinking: front-matter `hub:` → "Part of the guide" banner, pillar lists every hub guide + local markets, related guides by hub/category, category pages `/blog/category/<cat>`, blog index hubs + topics, footer links, breadcrumbs with the pillar.
- SEO: FAQPage JSON-LD from each "## Frequently asked questions" section, CollectionPage on hubs/categories, Article + place schema on local pages, sitemap includes categories and local pages.
- Two new animated visuals: `::funnel` and `::compare` (components/blog/Viz.tsx).

## v039 — Four plans: Free, Pro $19, Growth $45, Agency $99 (monthly or yearly)
- One source of truth: `src/lib/billing/catalog.ts` (`PRICES`, `LIMITS`, `PLAN_INFO`, `COMPARE`, `HIGHLIGHTS`, `PRICE_TEXT`). Pricing section, compare tables, FAQ, footer, terms, refunds, shipping, llms.txt, blog and limit messages all read from it.
- Pick any plan from the start: pricing cards link to `/signup?plan=growth&interval=year` → onboarding → `/app/billing?plan=…&interval=…#upgrade` with that plan preselected. Signed-in visitors go straight to checkout.
- Plan & billing: 4-plan picker with monthly/yearly switch and USD/INR. **Upgrade** = new subscription charged now, old one cancelled now, unused days refunded pro rata (`refundUnused` in `lib/billing/sync.ts`, idempotent). **Downgrade** = new subscription starting at the end of the paid period (`scheduled_change.plan`), today's plan kept until then; can be undone ("Keep Agency"). Above 75 projects → talk to us.
- Usage nudges (`components/app/UsageNudge.tsx`): 80% heads-up, 100% upgrade card naming the cheapest plan that raises that limit — on the dashboard and billing page. Limit errors use `upgradeHint()`.
- Admin: give Pro/Growth/Agency free; MRR counts all paid plans, refunds netted out.
- Run **schema-v039.sql** once (GO-LIVE §18).

## v037 — Dollar payments fall back to rupees automatically

- If Razorpay refuses US-dollar subscriptions (international payments not switched on yet), checkout uses the same plan in **rupees** instead of showing an error. The dollar option is then hidden for 12 hours, and Growvia checks again after that, so it reappears by itself once Razorpay enables it. This covers upgrade, monthly/yearly switch and change payment method.

## v036 — Easier connections, change payment method, international-ready checkout

- **Connect tools** (`/app/integrations`, under Setup in the sidebar): one checklist of email, website form, Search Console, Google Business, WhatsApp, Facebook & Instagram and YouTube. Each shows its status, what it does, how long it takes, and one button. It also shows "N of 6 connected" and the next step.
- **Email in 3 fields:** type your address and Growvia detects the provider (Gmail, Google Workspace, Microsoft 365, Zoho/Zoho India, Yahoo, iCloud, GoDaddy, Hostinger, Titan, Namecheap) from the address and its mail servers, fills in the server settings, and shows exact steps with a "Create app password" link. Personal Outlook/Hotmail gets a clear "not supported by Microsoft" note.
- **One-click WhatsApp** with Meta Embedded Signup (needs `META_WA_CONFIG_ID`): a Facebook window covers the business, number and SMS code. Growvia exchanges the code, subscribes to the account's messages and registers the number. Manual IDs remain as an advanced option. The developer setup box is hidden from customers.
- **Website form install steps** for WordPress, Wix, Shopify, Squarespace, Webflow and GoDaddy, plus "Email the code to my web developer".
- **Add or change payment method** (card, UPI or currency) on the billing page. It creates a new subscription that starts at renewal (or right away if a payment failed) and stops the old one, so there's no double charge. Cancelling after a change now keeps the paid time.
- Checkout shows the Growvia logo. New **/shipping** policy page (required by Razorpay for international payments). See GO-LIVE §16.

## v035 — Pro $19/month, instant upgrades, a Free plan that shows the value of Pro

- **Price:** Pro is **$19/month or $190/year** (2 months free). Everything reads from `PRICE_USD` / `PRICE_TEXT` in `lib/billing/catalog.ts`: pricing section, FAQ, footer, billing page, upgrade messages, terms, refunds and llms.txt. Existing subscribers keep their old price, because Razorpay plans are keyed by amount and only new checkouts use $19.
- **Instant upgrade:** upgrading during the free trial charges today and starts the paid period today. The only wait is for time already paid for: a cancelled plan that hasn't ended, or complimentary Pro with an end date.
- **Free plan now (for one business):** 1 project, 1 mailbox, 2 competitors, 10 keywords, 5 AI questions a month, 300 emails, 1 form with "Powered by Growvia" (can't be turned off), 10 scheduled posts, 1 watermarked video.
- **Pro:** 10 projects, 5 mailboxes, 10 competitors per project, 100 keywords, 30 weekly AI questions, 5,000 emails, unlimited forms (no badge) and posts, 20 videos, priority support. Agency has no project or mailbox limit.
- **Upgrade prompts at the limit:** for a new project (a screen before the wizard), a second mailbox, a third competitor and the form badge, each with the price and "starts instantly". Existing Free accounts keep anything already above the limits; they just can't add more.
- **Fix:** a brand-new subscription now clears any leftover "cancel at period end" from an old one.

## v034 — 5 guides for the US, Africa and the UAE (live now)

- US SMS marketing (TCPA, 10DLC), local SEO for US home service businesses (Local Services Ads, Google Verified), WhatsApp marketing in Africa (Nigeria, Kenya, South Africa, Ghana), digital marketing in Dubai and the UAE, and email marketing laws by country. About 3,500 words each, from official sources.
- Dated 12–26 September 2026, so all five are live now; the October posts still publish on their dates.

## v033 — 10 in-depth guides, published on a schedule

- 10 new long guides (about 3,000 words each, written from official Google, Meta, FTC and web.dev documentation): Google Business Profile, Google reviews, keyword research, technical SEO audit, Core Web Vitals, contact forms, email welcome sequence, schema markup, local competitor analysis and social media content plan.
- **Scheduled publishing:** a post with a future `published:` date stays hidden from the blog, sitemap, RSS and llms.txt until that day (India time). Pages refresh hourly, so nothing needs to be redeployed. Links to a not-yet-published post show as plain text until it goes live.
- Schedule: 2, 5, 7, 10, 13, 16, 19, 21, 24 and 27 October 2026. To change it, edit `published:` in `src/lib/blog/src/*.md` and run `node scripts/build-blog.mjs`.

## v032 — Clear fix for "insufficient authentication scopes"

- Google shows a separate checkbox for each permission. If someone leaves the Business Profile box (or the YouTube, Search Console or Postmaster box) unticked, Growvia now catches it as soon as they come back from Google. It saves nothing and tells them exactly which box to tick.
- Any Google API error that says "insufficient authentication scopes" now shows that same plain-English message with a **Reconnect** button.

## v031 — Growvia's own lead form on usegrowvia.com

- `/contact` is now a "Talk to us" page with the Growvia website form (`components/site/GrowviaForm.tsx`, form `ca31c8da-…`). It uses the same `embed.js` customers paste, so it's also our live demo of the feature. Leads land in Growvia → Leads with the page, referrer and UTM tags.
- "Contact" added to the top menu, and "Talk to us" added under the final call to action on the home page.

## v030 — Faster dashboard

- **One database round trip per page.** Most pages now load their data while the login check is still running. They use the last-opened project (remembered in a cookie), which fixes itself if it's wrong, so it's never shown to the wrong project. Plan and limits come from a single `project_plan` database call. Measured at 150 ms DB latency: 355–585 ms → ~200–250 ms per page.
- **Instant sidebar clicks.** A page is prefetched when you hover over, focus or touch its link (hovering over a group warms its first two pages), instead of fully prefetching every link on load. Hover then click opens in ~40 ms.
- **New indexes** for lead stages and unread threads.
- **`/api/health` now tells you how to make it faster.** It shows `databaseRegion` and, if Vercel and Supabase are in different regions, `speedFix` with the exact `vercel.json` region to use. If Supabase still uses the legacy JWT secret, it shows `speedFix2`, because every request then pays an extra network call to verify the login.

## Speed

- `vercel.json` pins server functions to **bom1 (Mumbai)** — keep it in the same region as your Supabase project (Supabase → Project Settings → General → Region). If Supabase is elsewhere, change `bom1` to the matching Vercel region (e.g. `sin1` Singapore, `iad1` US East, `fra1` Frankfurt).
- `/api/health` reports `serverRegion` and `dbLatencyMs` — under ~40 ms means they're co-located.
- Pages fetch everything in one parallel round trip; sidebar pages are prefetched so clicks open instantly; approvals and stage changes update on screen immediately.

## Architecture

- `src/lib/data/` — one `Repo` interface, two drivers: `supabase.ts` (production) and `local.ts` (demo). Picked automatically by env vars.
- `src/app/actions.ts` — all server actions (auth, onboarding, plan, campaigns, content, leads, settings, public form).
- `src/lib/engine.ts` — growth engine v1 (rules-based plan + content generation). Swap in an LLM later without changing the UI.
- `src/middleware.ts` — refreshes Supabase sessions and protects `/app` and `/onboarding`.
