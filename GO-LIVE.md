# Growvia go-live checklist — usegrowvia.com

Work top to bottom. Each step says **where**, **what to enter**, and **how to check it worked**.
Contact / support email: **team.usegrowvia@gmail.com**. Sender for Growvia's own emails: **hello@usegrowvia.com** (via Resend).

---

## 1. Domain → Vercel (15 min + DNS time)

**Vercel → Project → Settings → Domains**
1. Add `usegrowvia.com` and `www.usegrowvia.com`. Make `usegrowvia.com` the primary and set `www` to **redirect** to it.
2. Vercel shows the DNS records to add. At your domain registrar (where you bought it) add exactly what Vercel shows — usually:
   - `A` record, name `@`, value `76.76.21.21`
   - `CNAME` record, name `www`, value `cname.vercel-dns.com`
   - Delete any old `A`/`AAAA` "parking" records for `@`.
3. Wait until both domains show **Valid Configuration** (5 min – a few hours). HTTPS is automatic.

✅ Check: `https://usegrowvia.com` loads, `https://www.usegrowvia.com` redirects to it.

## 2. Environment variables (Vercel → Settings → Environment Variables → Production)

| Name | Value |
|---|---|
| `SITE_URL` | `https://usegrowvia.com` |
| `CONTACT_EMAIL` | `team.usegrowvia@gmail.com` |
| `EMAIL_FROM` | `Growvia <hello@usegrowvia.com>` (after step 4 is verified) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | from step 8 |
| `BILLING_FREE_PRO_EMAILS` | optional — your own + clients' emails that get Pro free |

Keep all existing variables. Then **Deployments → ⋯ → Redeploy** (env changes need a redeploy).

✅ Check: open `https://usegrowvia.com/api/health` — `siteUrl` is `https://usegrowvia.com`, and `warnings` lists anything still missing.

The old `growvia-three.vercel.app` pages now redirect to usegrowvia.com automatically; its `/api/...` addresses keep working so nothing registered on the old address breaks mid-switch.

## 3. Supabase (Authentication)

**Supabase → Authentication → URL Configuration**
- **Site URL:** `https://usegrowvia.com`
- **Redirect URLs** (add all):
  - `https://usegrowvia.com/auth/callback`
  - `https://usegrowvia.com/**`
  - keep `https://growvia-three.vercel.app/**` for a few weeks

**Supabase → Authentication → Emails → SMTP Settings** — ⚠️ important: Supabase's built-in email only sends a couple of emails an hour, so sign-up confirmations and password resets will fail for real users without this.
- Enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
- Sender email `hello@usegrowvia.com`, sender name `Growvia`

**Supabase → SQL Editor**
1. Run `supabase/schema.sql` (v020 billing tables, if not done yet).
2. Run `supabase/cron.sql` — it now points at `https://usegrowvia.com/api/cron/tick`. Replace `YOUR-CRON-SECRET` with your `CRON_SECRET` first.

✅ Check: sign up with a fresh email → the confirmation email arrives from hello@usegrowvia.com and the link opens usegrowvia.com. "Forgot password" works too.

## 4. Resend (emails from hello@usegrowvia.com)

**Resend → Domains → Add domain → `usegrowvia.com`** (region: closest to India, e.g. Tokyo/Singapore if offered).
Add the records Resend shows at your registrar — typically:
- `MX` `send` → `feedback-smtp.<region>.amazonses.com` (priority 10)
- `TXT` `send` → `v=spf1 include:amazonses.com ~all`
- `TXT` `resend._domainkey` → the long DKIM key
- Also add DMARC: `TXT` `_dmarc` → `v=DMARC1; p=none; rua=mailto:team.usegrowvia@gmail.com`

Click **Verify**. Then set `EMAIL_FROM` (step 2) and redeploy.

Replies to Growvia's emails (welcome, invites, alerts, Agency enquiries) go to **team.usegrowvia@gmail.com** automatically.
Optional: to also *receive* mail at hello@usegrowvia.com, set up free forwarding (Cloudflare Email Routing if your DNS is on Cloudflare, or ImprovMX) → forward to the Gmail.

Free plan limit: 100 emails/day, 3,000/month — upgrade Resend when you have more users.

✅ Check: Settings → Team → invite yourself at another address → the email arrives (not in spam) and the link starts with `https://usegrowvia.com/invite/`.

## 5. Cloudflare Turnstile (captcha)

**Cloudflare → Turnstile → your widget → Hostnames** → add `usegrowvia.com` and `www.usegrowvia.com`.

✅ Check: the sign-up page shows the check box and signing up works.

## 6. Google Cloud (Search Console connect + Gemini)

**APIs & Services → Credentials → your OAuth client**
- Authorized JavaScript origins: add `https://usegrowvia.com`
- Authorized redirect URIs: add `https://usegrowvia.com/api/oauth/google/callback` (keep the old one for now)

**APIs & Services → OAuth consent screen**
- App home page `https://usegrowvia.com`, privacy `https://usegrowvia.com/privacy`, terms `https://usegrowvia.com/terms`
- Authorized domains: `usegrowvia.com`
- Support email: team.usegrowvia@gmail.com
- **Publish** the app. The Search Console scope (`webmasters.readonly`) is "sensitive", so Google will ask for **verification**: a short video of the connect flow + domain ownership (step 9). Until verified, users see an "unverified app" warning (they can still continue) and you're capped at 100 users.

**Gemini:** on the free key, all your users share one daily limit. Before a public launch, turn on billing for the Gemini API key's project (pay-as-you-go, cheap for Flash-Lite) so users don't hit "limit reached".

✅ Check: SEO → Search Console → Connect → Google sign-in → back on usegrowvia.com with your sites listed.

## 7. Meta (WhatsApp, Facebook, Instagram)

**developers.facebook.com → your app**
- **Settings → Basic:** App domains `usegrowvia.com`; Privacy Policy URL `https://usegrowvia.com/privacy`; Terms `https://usegrowvia.com/terms`; User data deletion → Instructions URL `https://usegrowvia.com/privacy`; contact email team.usegrowvia@gmail.com; Website platform site URL `https://usegrowvia.com`.
- **Facebook Login for Business → Settings → Valid OAuth Redirect URIs:** `https://usegrowvia.com/api/oauth/meta/callback`
- **Webhooks** (WhatsApp, Page, Instagram): Callback URL `https://usegrowvia.com/api/webhooks/meta` with the same verify token as today → **Verify and save** for each product.
- **Business verification** (Business Settings → Security Center) — needed for Advanced Access.
- **App Review:** request `pages_manage_posts`, `pages_read_engagement`, `pages_messaging`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_messages`, `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management` with screen recordings, then switch the app to **Live**. Until then only people with a role on the app can connect.

✅ Check: Channels → Connect Facebook works; a test WhatsApp message shows up in Inbox.

## 8. Razorpay (payments)

1. **Account & KYC:** complete KYC with website `https://usegrowvia.com`. Razorpay checks that the site shows Pricing, Contact, Terms, Privacy and Refund policy — all live (`/#pricing`, `/contact`, `/terms`, `/privacy`, `/refunds`). If Razorpay asks for a registered business name, address or phone on the Contact page, tell me and I'll add them.
2. **Enable Subscriptions** (Dashboard → Subscriptions; ask support if not visible).
3. **International payments** — needed to charge in US dollars. Request in Settings → Payment methods / via support. Until it's on, customers who pick USD are told to pay in INR.
4. **Test mode first:** Settings → API Keys (Test) → put `rzp_test_…` keys in Vercel → subscribe with a test card (`4111 1111 1111 1111`, any future date/CVV) or `success@razorpay` UPI → confirm Pro turns on, then cancel.
5. **Webhook:** Settings → Webhooks → Add → URL `https://usegrowvia.com/api/billing/webhook`, secret = your `RAZORPAY_WEBHOOK_SECRET`, events: `subscription.authenticated, subscription.activated, subscription.charged, subscription.pending, subscription.halted, subscription.cancelled, subscription.completed, subscription.paused, subscription.resumed, subscription.updated, invoice.paid, payment.failed`. Webhooks are separate in test and live mode — add it in **both**.
6. **Go live:** generate Live keys → replace in Vercel → redeploy. `/api/health` shows `razorpayMode: "live"`.

Confirm with your CA: GST registration and whether prices are shown tax-inclusive (currently treated as inclusive). Also confirm the refund terms on `/refunds` (7 days on first payment, 14 days on yearly) are what you want.

## 9. Search engines

- **Google Search Console:** add a *Domain* property `usegrowvia.com` → verify with the DNS TXT record it gives you → Sitemaps → submit `https://usegrowvia.com/sitemap.xml`. This also proves domain ownership for the OAuth verification in step 6.
- **Bing Webmaster Tools:** import from Search Console.
- Optional: Google Business Profile for Growvia.

## 10. Plans that must change before charging real customers

- **Vercel:** Hobby is non-commercial only → upgrade to **Pro** before taking payments.
- **Supabase:** Free pauses after a week of no activity and has 1 GB storage → **Pro** once you have real users (also daily backups).
- **Resend:** free 3,000 emails/month → upgrade as you grow.
- **Gemini:** turn on billing (step 6).

## 11. Final smoke test on usegrowvia.com (15 min)

1. `https://usegrowvia.com/api/health` → `ok: true`, `warnings: []` (except Razorpay test mode while testing).
2. Sign up (new email) → confirm email → onboarding → dashboard shows "Pro trial · 14 days left".
3. Log out → Forgot password → reset email arrives → reset works.
4. Invite a teammate → they accept from their own browser → they see your project.
5. Add a website → run an audit → pop-up "is ready".
6. Create a website form → embed it on a test page → submit → lead appears + alert email.
7. Plan & billing → upgrade (test mode) → Pro → cancel.
8. Pricing section → "Talk to us" → enquiry lands in team.usegrowvia@gmail.com.
9. Check on your phone: homepage, sign up, dashboard menu.

Trademark note: "Growvia" is used by other businesses (e.g. growvia.social). Consider a quick trademark search before spending on marketing.

## 12. v027 — Google Business Profile, YouTube, Google Contacts (one-time, ~15 min + Google's review)

All three use the Google OAuth client you already have, with the same redirect URI `https://usegrowvia.com/api/oauth/google/callback`.

**Google Cloud → APIs & Services → Library → enable:**
- Google Business Profile: **My Business Account Management API**, **My Business Business Information API**, **Business Profile Performance API**, **Google My Business API** (reviews and posts)
- **YouTube Data API v3**
- **People API** (Google Contacts)

**Business Profile API access (required, free):** go to developers.google.com/my-business/content/prereqs → "Request access" → choose the same Cloud project and give usegrowvia.com as the website. Until Google approves (usually a few days), `/app/local` explains that it's waiting and still shows Google Maps rankings (these use your SERPAPI_KEY).

**OAuth consent screen → Data access → add scopes:** `business.manage`, `youtube.upload`, `youtube.readonly`, `contacts.readonly`. They're "sensitive", so add them to the verification you're already doing for Search Console (a short screen recording for each connect flow).
- Until YouTube's API audit is done, YouTube may lock videos uploaded through the API as **private**. You can make them public in YouTube Studio, or request the audit in the YouTube API Services form.

**Supabase → SQL Editor:** run `supabase/schema.sql` again. It adds the YouTube/Google Business channel types, `gbp_*` tables, `local_*` tables, `contact_imports` and `social_posts.options`, and it turns old "scheduled" cards that never had a real post into planned reminders.

**Speed:** open `/api/health`. If `dbLatencyMs` is above ~40, follow `speedFix`: set `vercel.json` → `regions` to the Vercel region next to your Supabase project, then redeploy. This is the biggest speed-up for signed-in pages.

✅ Check: Google Business → Sign in with Google → your location shows (or the "waiting for approval" message) · Channels → Connect YouTube → the channel is listed · Leads → Import → Google Contacts → the review list appears.

## 13. v028 — Competitors

Run `supabase/schema.sql` again. It adds `competitors`, `competitor_snapshots` and `seo_rankings.top`, and moves the competitors from SEO settings into the new page. Nothing else is needed: ratings, reviews and Maps positions use your existing `SERPAPI_KEY`, and each tracked competitor costs about one SerpApi search a week.

## 14. v029 — Sending health

1. Run `supabase/schema.sql` again. It adds `messages.bounced_at` and `unsubscribed_at` (filled in from past bounces), `mailboxes.warmup` and `health`, and the `sender_domains` and `postmaster_links` tables.
2. **Gmail Postmaster Tools (optional, free):** in Google Cloud → APIs & Services → Library, enable **Gmail Postmaster Tools API**. On the OAuth consent screen, add the scope `postmaster.readonly` (it's sensitive, so include it in your verification). Then add `usegrowvia.com` and your clients' domains at postmaster.google.com (one TXT record each).
3. Nothing else is needed. The daily cron runs the checks, and WhatsApp quality comes from your existing Meta connection.

## 15. v030 — Faster dashboard (biggest wins are here)

1. Run `supabase/schema.sql` again. It adds the `project_plan` function and two indexes.
2. Open **https://usegrowvia.com/api/health**:
   - If it shows `speedFix`, put that region in `vercel.json` (`"regions": ["…"]`) and redeploy. Vercel and Supabase in the same region cuts every database call from ~150 ms to ~2–5 ms, which is the biggest speed-up available.
   - If it shows `speedFix2`: Supabase → Project Settings → **JWT Keys** → *Migrate JWT secret* → rotate to the new signing key. Logins are then verified without a network call on every page.
3. Optional: Vercel → Project → Settings → Functions → turn on **Fluid compute** (fewer cold starts).

## 16. v036: Growvia name at checkout, international payments, one-click WhatsApp

**Show "Growvia" instead of your personal name**
1. Razorpay Dashboard → Account & Settings → **Brand name and logo** (also listed as "Business name / billing label"). Set it to **Growvia** and upload `public/logo.png`. Razorpay only accepts a name that closely matches your registered business name or your **domain** (usegrowvia.com), so "Growvia" should be accepted.
2. The checkout window already shows "Growvia" and the logo (v036 adds the logo). UPI apps and bank statements may still show the name on your Razorpay KYC until you register a business (for example a sole proprietorship or LLP named Growvia) and update KYC.

**Accept international payments**
1. Razorpay needs these pages on your site. All are live: /terms, /privacy, /refunds, **/shipping** (new in v036), /contact.
2. Razorpay Dashboard → Account & Settings → **International payments** → request activation, or raise a ticket with Razorpay Support asking to enable *international cards* for subscriptions. Describe the business as "SaaS — online marketing software, USD subscriptions". Have your KYC done and PAN/bank details ready. Razorpay may also ask for your IEC or GSTIN; for software services, ask them what applies.
3. Once approved: Vercel → Environment Variables → set `BILLING_CURRENCIES=USD,INR` → Redeploy. Visitors outside India can then pay in US dollars; Indian customers keep UPI and INR.
4. Until then, foreign cards may be declined, so keep `BILLING_CURRENCIES=INR`.

**One-click WhatsApp (Meta Embedded Signup)**
1. developers.facebook.com → your app → **Facebook Login for Business → Configurations → Create configuration**. Choose **WhatsApp Embedded Signup**, with permissions `whatsapp_business_management` and `whatsapp_business_messaging`. Copy the **Configuration ID**.
2. Facebook Login for Business → Settings: add `usegrowvia.com` under Allowed Domains for the JavaScript SDK, and turn on "Login with the JavaScript SDK".
3. Vercel → add `META_WA_CONFIG_ID=<that ID>` → Redeploy. The Channels page then shows a single **Connect WhatsApp** button, with manual IDs as an advanced fallback.
4. For customers outside your own business portfolio, Meta requires **Business Verification**, **Tech Provider** onboarding and **App Review** (advanced access to both permissions). Until then, only you and testers on the app can complete it.


## §17 Sign in with Google (v038)
Growvia runs the Google step itself (Google's screen says "continue to usegrowvia.com"), then hands the ID token to Supabase.
1. Google Cloud → APIs & Services → Credentials → your existing OAuth client (same GOOGLE_CLIENT_ID used for Search Console) → Authorized redirect URIs → add `https://usegrowvia.com/auth/google/callback`. Save.
2. OAuth consent screen → Publishing status must be **In production** (in "Testing" only listed test users can sign in). App name "Growvia", logo, support email, homepage, privacy and terms links. openid/email/profile need no extra verification.
3. Supabase → Authentication → Sign In / Providers → Google → Enable, paste the same Client ID and Client Secret, leave "Skip nonce checks" OFF. Save.
4. Supabase → Authentication → URL Configuration: Site URL https://usegrowvia.com.
5. Test in a private window: /signup → Continue with Google → /onboarding. Then /login → Continue with Google → /app.
Existing email/password users who sign in with Google on the same email are linked to the same account automatically. Gmail spelled differently (dots, +tags, googlemail.com) is handled too: Growvia removes the empty duplicate Supabase just made, moves the old account to Google's spelling and links it — needs SUPABASE_SERVICE_ROLE_KEY (already set). Password sign-in and reset with either spelling keep working, and email sign-up blocks a second account on the same Gmail.

## 18. v039 — Growth plan, self-serve Agency, upgrades/downgrades (5 min)
1. Supabase → SQL Editor → paste **schema-v039.sql** (or the "v039" block at the end of supabase/schema.sql) → Run. It lets the subscriptions table store `growth` (without it, Growth payments can't be saved).
2. Nothing to create in Razorpay: the Growth and Agency plans (monthly + yearly, USD and INR) are created automatically the first time someone picks them.
3. Razorpay → Settings → Webhooks: keep the same webhook. Refunds for upgrades go through the Refunds API on the same key — make sure the account balance can cover refunds (Razorpay deducts them from settlements).
4. Test in a private window: pricing → Growth (yearly) → sign up → onboarding finishes on Plan & billing with Growth yearly selected → pay. Then pick Agency → charged now, old plan refunded pro rata (shows as "Refunded" in Payment history). Pick Pro → "Switch to Pro on <date>", nothing charged.

## 19. v041 — IndexNow (nothing to set up)
After deploying, open https://usegrowvia.com/44c5a1c966bde96736dabed44e554b94.txt — it should show the key. Within an hour, Admin → Overview → Search engines shows "Last check … pages tracked". Optional: in Bing Webmaster Tools you can "Import from Google Search Console" to see Bing's indexing reports; IndexNow works without it.

## 20. v043 — Facebook & Instagram publishing (one-time, ~15 min)
1. developers.facebook.com → My Apps → **Growvia** (App ID 3828392810636488) → App settings → Basic: copy **App ID** and **App secret** (Show).
2. Use cases → **Facebook Login for Business** → Configurations → Create configuration → "User access token" → add permissions: pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_metadata, pages_messaging, instagram_basic, instagram_content_publish, instagram_manage_messages, instagram_manage_comments, business_management → copy the **Configuration ID**.
3. Facebook Login for Business → Settings → Valid OAuth Redirect URIs: `https://usegrowvia.com/api/oauth/meta/callback`. App domains: usegrowvia.com.
4. Vercel → Environment Variables: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID` → Redeploy.
5. While the app is "In development", only people with a role on the app (you) can connect. Submit for App Review (pages_manage_posts, instagram_content_publish…) before customers use it.

## 21. v044 — notifications table + video converter (2 min)
1. Supabase → SQL Editor → run `supabase/schema-v044.sql` (bell notifications, toasts, milestone celebrations).
2. Nothing to set in Vercel: the video converter uses the existing `CRON_SECRET` and `SITE_URL`. It runs in its own function (`/api/media/standardize`, up to 5 min) — on Vercel Hobby, keep Fluid Compute on (default) so long videos have time to convert.
3. Instagram: it must be a **Professional** account **linked to your Facebook Page** (Page → Settings → Linked accounts → Instagram). Then Channels → Connect Instagram and tick both the Page and the Instagram account in Meta's window.

## 22. v047 — PayPal for customers outside India (10 min)
1. Razorpay Dashboard → Settings → Configuration → PayPal → **Link Account** (live within ~48h).
2. Razorpay → Settings → Webhooks → your Growvia webhook → also tick **payment.captured**.
3. Supabase → SQL Editor → run `supabase/schema-v047.sql`.
4. Vercel → Environment Variables → `PAYPAL_PREPAID` = `on` → Redeploy. Until PayPal is live, keep it off (US-dollar buyers would see "PayPal isn't switched on yet").

