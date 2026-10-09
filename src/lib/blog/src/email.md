---
slug: email-deliverability-spf-dkim-dmarc-guide
title: "Why Your Emails Land in Spam: SPF, DKIM, DMARC and Sending Habits Explained for Small Businesses"
description: A plain-English guide to email deliverability for small businesses — how SPF, DKIM and DMARC work, what Gmail, Yahoo and Outlook now require, how to warm up a new mailbox, and the writing habits that keep you in the inbox.
keywords: email deliverability, emails going to spam, SPF DKIM DMARC explained, Gmail bulk sender requirements, email warm up, cold email deliverability, one-click unsubscribe
category: Email
---
You wrote a great email. The offer is good, the subject line is sharp — and nobody replies. Very often the reason isn't the message at all: it went straight to the spam folder, or to the Promotions tab where nobody looks. Email providers decide where your message lands before a human ever sees it.

The good news is that deliverability is mostly within your control. This guide covers the technical setup (explained without jargon), what the big providers now require, how to start sending from a new address safely, and the habits that keep you in the inbox long term.

## How inbox providers decide where your email goes

Gmail, Outlook, Yahoo and others look at three broad things for every message:

1. **Authentication — are you who you say you are?** Checked with SPF, DKIM and DMARC records on your domain.
2. **Reputation — how have your past emails been received?** Do people open, reply and keep them, or delete, ignore and mark them as spam? Do many of your emails bounce?
3. **Content and behaviour — does this look like wanted mail?** Sudden spikes in volume, misleading subject lines, link-heavy messages and missing unsubscribe options all raise flags.

Get authentication right once, then protect your reputation with every send.

## SPF, DKIM and DMARC — the plain-English version

These three are DNS records: small text entries you add where your domain is managed (your registrar, such as Namecheap or GoDaddy, or your DNS host such as Cloudflare).

::flow What Gmail checks when your email arrives | SPF: is this server allowed to send for you? | DKIM: is the signature genuine and untouched? | DMARC: do they match your domain, and what's your policy? | Inbox, spam or rejected

### SPF (Sender Policy Framework)

SPF is a public list of which servers are allowed to send email for your domain. When Gmail receives an email "from" yourbusiness.com, it checks whether the sending server is on that list.

A typical SPF record is a TXT record on your root domain that looks like `v=spf1 include:_spf.google.com ~all`. The `include:` parts name your email providers; `~all` means "treat anything else with suspicion".

Two common mistakes: having **two separate SPF records** (you must merge them into one), and adding so many `include:`s that the record exceeds the limit of 10 DNS lookups, which makes it fail.

### DKIM (DomainKeys Identified Mail)

DKIM adds an invisible digital signature to every email you send. Your provider signs the message with a private key, and publishes the matching public key in your DNS (usually a TXT or CNAME record with a name like `selector._domainkey`). The receiving server checks the signature to confirm the email really came from you and wasn't altered on the way.

Your email provider generates the DKIM record for you — Google Workspace, Microsoft 365, Zoho and services like Resend or Mailchimp all have a "verify domain" or "authenticate" screen that shows exactly what to add.

### DMARC (Domain-based Message Authentication, Reporting and Conformance)

DMARC ties SPF and DKIM together and tells receivers what to do if a message fails: nothing (`p=none`), send it to spam (`p=quarantine`), or reject it (`p=reject`). It also lets you receive reports about who is sending email using your domain.

A safe starting DMARC record is a TXT record named `_dmarc` with the value `v=DMARC1; p=none; rua=mailto:you@yourbusiness.com`. Start with `p=none` to monitor, then move to `quarantine` once you're sure all your legitimate email passes.

Important: **only have one DMARC record.** Two `_dmarc` records cause DMARC to fail entirely.

| Record | What it proves | Where it lives | Typical value starts with |
|---|---|---|---|
| SPF | This server may send for my domain | TXT on the root (@) | `v=spf1` |
| DKIM | This email was signed by my domain and not altered | TXT/CNAME on `selector._domainkey` | provided by your email service |
| DMARC | What to do if SPF/DKIM fail, and where to send reports | TXT on `_dmarc` | `v=DMARC1` |

## What Gmail, Yahoo and Outlook now require

Since February 2024, Google and Yahoo have required more from senders, and Microsoft introduced similar rules for high-volume senders to Outlook addresses in 2025. In short:

- **Everyone** sending to Gmail should have SPF or DKIM set up, a valid reverse DNS for sending servers, and use a secure (TLS) connection.
- **Bulk senders** (Google's threshold is around 5,000 messages a day to Gmail addresses) must have **SPF, DKIM and DMARC**, with the "From" domain aligned to SPF or DKIM.
- Marketing and subscribed messages must include **one-click unsubscribe** and honour unsubscribes within two days.
- Keep your **spam complaint rate low** — Google asks senders to stay below 0.3%, and ideally under 0.1%.

Even if you send far fewer emails than those thresholds, meeting the same standards is the simplest way to stay out of spam.

## Starting with a new domain or mailbox: warm it up

New domains and new mailboxes have no reputation yet. Sending hundreds of emails on day one looks exactly like a spammer who just bought a domain. Build up gradually:

| Week | Emails per day (per mailbox) | Focus |
|---|---|---|
| 1 | 10–20 | Real conversations with people who know you; get replies |
| 2 | 20–40 | Existing customers and warm leads |
| 3 | 40–70 | Add newer contacts who opted in |
| 4+ | Increase slowly towards your target | Watch bounces, replies and spam complaints |

Replies are the strongest positive signal, so early emails should invite a response ("Would Tuesday or Thursday suit you better?"). If you plan to do outreach at scale, many businesses use a **separate domain** for cold outreach (for example tryyourbrand.com) so any reputation damage doesn't affect the main domain their customers and invoices depend on.

## List quality: the most underrated factor

- **Only email people who expect to hear from you** — customers, enquiries, people who signed up, or carefully researched business contacts with a genuine reason to hear from you.
- **Never buy email lists.** They're full of old, invalid and trap addresses and will wreck your reputation quickly. Laws such as the GDPR in Europe, CAN-SPAM in the US and India's Digital Personal Data Protection Act also set rules on consent and data use.
- **Remove bounces immediately.** A hard bounce ("address doesn't exist") should never be emailed again.
- **Honour unsubscribes instantly** and never re-add those people.
- **Clean inactive contacts.** If someone hasn't opened anything in six months, stop emailing them or send one "should we keep in touch?" message first.

## Writing emails that stay in the inbox

- **Write like a person.** Plain text or lightly formatted emails from a named person usually outperform heavy image-based designs for small businesses.
- **Honest subject lines.** No "RE:" on a first email, no fake urgency, no ALL CAPS, no misleading claims.
- **Few links.** One or two relevant links. Avoid URL shorteners, which spammers often use.
- **Avoid image-only emails.** Always include real text.
- **Personalise genuinely.** Use their name and something specific about them — not just a mail-merge field.
- **Include your details.** Your business name, and a physical address for marketing emails, plus an easy unsubscribe.
- **Stop when people reply.** Follow-up sequences should end automatically as soon as someone responds.
- **Respect timing.** Send during your recipient's working hours and don't blast your whole list at once — spread sends out.

## Mailbox limits

Every provider limits how much a single mailbox can send. Free Gmail accounts have much lower daily limits than paid Google Workspace accounts, and exceeding them can temporarily block sending. Staying well below the limit — and spreading emails across the day — is safer than pushing it.

> Growvia sends campaigns from your own mailbox (Gmail, Outlook, Zoho or any SMTP/IMAP provider), respects daily caps and your chosen sending hours, stops follow-ups automatically when someone replies, adds unsubscribe links to campaigns, and removes bounced addresses — so good habits are built in.

## How to check your setup

1. **Look up your records.** Free tools like MXToolbox or Google Admin Toolbox show your SPF, DKIM and DMARC records and flag errors.
2. **Send a test to a Gmail address,** open it, click the three dots → "Show original". You should see `SPF: PASS`, `DKIM: PASS` and `DMARC: PASS`.
3. **Use Google Postmaster Tools** (free) once you send regularly to Gmail users — it shows your domain reputation and spam rate.
4. **Seed test before a big send:** send to a few addresses of your own on Gmail, Outlook and Yahoo and check where it lands.

## Fixing a spam problem

If your emails are already going to spam:

1. Pause bulk sending.
2. Check authentication (SPF, DKIM, DMARC all pass, only one of each).
3. Remove bounced and inactive contacts.
4. Resume slowly with your most engaged contacts, aiming for replies.
5. Simplify your content: fewer links, no images, clear sender name.
6. Monitor Postmaster Tools and bounce rates for a few weeks before scaling back up.

Reputation recovers, but it takes consistent good behaviour over weeks.

## Quick checklist

- One SPF record, including every service that sends for you
- DKIM enabled with every sending service
- One DMARC record, starting at `p=none` with reports going to you
- One-click unsubscribe on marketing emails
- New mailbox warmed up gradually
- Clean, permission-based list; bounces removed
- Human, honest, lightly formatted emails
- Follow-ups stop when someone replies
- Spam complaint rate monitored and kept under 0.1%

Get these right and most small businesses will find their emails reliably land where they should — in front of the people who want to read them. If you'd like campaigns with these safeguards built in, you can [start with Growvia for free](/signup).
