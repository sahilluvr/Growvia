---
slug: healthcare-tracking-pixels-privacy
title: "Healthcare Website Tracking Pixels and HIPAA: What's Still Risky"
description: Healthcare website tracking pixels and HIPAA explained. The HHS guidance, the June 2024 court ruling, which pages are still risky and how to audit your site.
keywords: healthcare website tracking pixels HIPAA, Meta Pixel HIPAA, Google Analytics HIPAA, HHS online tracking technologies guidance, AHA v. Becerra ruling, healthcare website privacy audit, patient portal tracking, server-side tracking healthcare, consumer health data law pixels, HIPAA compliant analytics
published: 2026-09-17
category: Medical & wellness
hub: healthcare
---
If your practice website has a Meta Pixel, Google tag, TikTok pixel or similar code on it, it may be sending ad platforms more than you think. Page addresses, button clicks and form events can travel to third parties along with the visitor's IP address and cookies. On a healthcare site, that combination can reveal that a specific person was looking for care, booking an appointment or logging in to a patient portal.

This has become one of the biggest privacy risks in healthcare marketing. Regulators have issued guidance, a federal court has narrowed part of it, and the FTC and state laws have stepped in from other directions. Many practices are left unsure what they can safely track.

This guide explains where things stand, which pages are still high risk, what safer setups look like, and how to audit your own site in about an hour. It fits into our broader [AI marketing guide for medical practices](/blog/ai-marketing-for-medical-practices). It's not legal advice, so involve your privacy officer or healthcare attorney before changing your setup.

## What tracking pixels actually send

A tracking pixel is a small piece of JavaScript from an ad or analytics platform. When a page loads or a visitor takes an action, it sends an event to that platform. Typical data includes the page URL and title, the referring page, the visitor's IP address, browser details, cookie identifiers, and sometimes the text of buttons clicked or form fields completed.

On a retail site, that tells Meta someone looked at running shoes. On a healthcare site, the same event can say someone visited "/book-appointment/oncology" or clicked "Request a consultation for erectile dysfunction". If the platform can link that to a logged-in Facebook account or an advertising ID, it has health-related information tied to a person.

::flow What a pixel can send from a booking page | Visitor opens the appointment page | Pixel fires with URL, IP and cookie ID | Ad platform matches it to a user profile | Health intent is now in an ad system

The same applies to "conversion APIs" that send events from your server instead of the browser. Moving the data transfer to a server doesn't change what's being shared.

## The HHS guidance and the June 2024 court ruling

Here is the timeline, in plain terms.

::steps How the tracking rules developed | December 2022 — HHS's Office for Civil Rights issues a bulletin on online tracking technologies for HIPAA-regulated entities | July 2023 — the FTC and HHS send a joint letter to about 130 hospital systems and telehealth providers warning about tracking risks | March 2024 — HHS updates the bulletin with more examples and clarifications | June 20, 2024 — a federal court in Texas vacates part of the bulletin in AHA v. Becerra | August 2024 — HHS withdraws its appeal of the ruling

### What the HHS bulletin said

HHS's [bulletin on online tracking technologies](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/hipaa-online-tracking/index.html) said that covered entities and business associates can't use tracking tools in ways that result in impermissible disclosures of PHI to tracking vendors. It drew a line between two kinds of pages:

- **Authenticated pages**, which require a login, such as patient portals and telehealth platforms. HHS said tracking on these pages generally has access to PHI, so the vendor needs a business associate agreement (BAA) and the disclosure must be permitted by the Privacy Rule.
- **Unauthenticated pages**, the public pages anyone can see. HHS said tracking here generally isn't a PHI disclosure, with important exceptions such as appointment scheduling pages, symptom checkers, and login or registration pages.

The bulletin also said that a cookie banner asking visitors to "accept" tracking is not a valid HIPAA authorization. That point matters, because many practices assumed a banner solved the problem.

### What the court vacated

In American Hospital Association v. Becerra, the U.S. District Court for the Northern District of Texas ruled on June 20, 2024 that HHS had exceeded its authority with one specific piece of the guidance. HHS had said that collecting a visitor's IP address together with their visit to a public page about specific health conditions or providers could be a disclosure of individually identifiable health information. The court called this combination the "Proscribed Combination" and vacated that portion. HHS withdrew its appeal in August 2024, and its bulletin page now notes the court's decision.

### What the ruling did not change

The ruling was narrow. It did not say tracking is safe on healthcare sites. Several things are still in place:

- Tracking on **authenticated pages** like patient portals still involves PHI under HIPAA.
- Tracking that captures health information people enter, such as **appointment requests, intake forms and symptom checkers**, still raises disclosure issues.
- The **FTC Act** and the FTC's Health Breach Notification Rule still apply, including to many businesses outside HIPAA.
- **State laws** on consumer health data, privacy and wiretapping still apply.
- **Class-action lawsuits** over pixels on health websites have continued under state privacy and wiretap laws, regardless of HIPAA.

> Key takeaway: The June 2024 ruling removed HHS's position on public pages that only describe conditions or services. It did not make pixels safe on patient portals, booking flows or forms, and it did nothing to the FTC or state laws.

## The FTC and state laws fill the gaps

Even if HIPAA doesn't apply to a page, or to your business at all, the FTC can act on health data shared in ways people didn't expect. In February 2023 the FTC took action against GoodRx, which agreed to a $1.5 million civil penalty, the first enforcement under the [Health Breach Notification Rule](https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule), for sharing users' health information with advertising platforms. The FTC also took action against BetterHelp in 2023 over sharing consumers' health data for advertising. The FTC updated the Health Breach Notification Rule in 2024 to make clear it covers many health apps and similar technologies.

State consumer health data laws go further than HIPAA in some ways:

- **Washington's My Health My Data Act** took effect March 31, 2024 (June 30, 2024 for small businesses). It covers a broad range of consumer health data, requires consent to collect and share it, restricts geofencing around places that provide health services, and lets consumers sue. The state attorney general's [My Health My Data Act page](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy) has FAQs. Our [Seattle and King County guide](/local-marketing/king-county-wa) covers what this means locally.
- **Nevada SB 370** took effect March 31, 2024, with similar protections for consumer health data.
- **California, Texas, Colorado, Minnesota and other states** treat health data as sensitive data under their general privacy laws, often requiring consent.

These laws matter most for med spas, wellness businesses and other practices that may not be HIPAA covered entities but still handle health-related data on their websites.

## Which pages are risky now

Use this table as a working guide. Risk depends on your specific setup and state, so confirm with your privacy lead.

| Page or feature | Ad pixels (Meta, TikTok, Google Ads) | Basic analytics | Why |
|---|---|---|---|
| Patient portal and telehealth login | Remove | Only with a BAA-covered tool | Authenticated pages involve PHI under HIPAA |
| Online booking or appointment request flow | Remove | Only with a BAA-covered tool, or remove | Reveals that a person is seeking care, plus any details entered |
| Intake, symptom checker or "reason for visit" forms | Remove | Only with a BAA-covered tool | Captures health information the visitor types |
| Thank-you page after booking | Remove | Use caution | Firing a "conversion" here signals a booked appointment |
| Condition and treatment pages | High caution, often remove | Lower risk, configure carefully | Federal ruling narrowed HHS's view, but state laws and FTC still apply |
| Home, about, careers, directions, blog | Lower risk | Lower risk | Generally no health intent tied to a person |

::scale Tracking risk by page type | Lower risk: home, about, careers, directions, general blog | Higher risk: condition and treatment pages, especially in states with health data laws | Highest risk: portals, booking flows, intake forms and booking confirmation pages

## Safer analytics setups

You don't have to fly blind. Practices measure marketing well without sending health intent to ad platforms. Here are the main options, from simplest to most involved.

### 1. Strip ad pixels from sensitive pages

The quickest win. Use your tag manager to block ad pixels on portals, booking flows, forms and confirmation pages. Many practices remove Meta and TikTok pixels from the entire site and rely on other measurement.

### 2. Measure conversions without pixels

Track leads and bookings in your own systems instead. Count inquiries and booked first visits by source in your practice software ("How did you hear about us?" recorded as a general category). Use UTM tags on your ad links so your own analytics can attribute visits, then compare against bookings in aggregate.

### 3. Use analytics configured for privacy, or under a BAA

Google states on its [HIPAA and Google Analytics page](https://support.google.com/analytics/answer/13297105) that it doesn't offer BAAs for Analytics and that HIPAA-regulated customers must not use it in ways that give Google access to PHI, which in practice means keeping it off authenticated pages and pages related to providing health services. Some analytics vendors built for healthcare will sign a BAA. If you need detailed measurement on sensitive pages, that's the route, and the BAA must be in place before any data flows.

### 4. Server-side tagging, done carefully

Server-side tag management lets your own server receive events first, strip IP addresses, URLs and other identifiers, and forward only what you approve. It can reduce what reaches ad platforms. It doesn't make sharing PHI acceptable, and a misconfigured server container can send exactly as much as a browser pixel. Treat it as an engineering control that supports your policy, not a compliance shortcut.

### 5. Consent tools, with realistic expectations

Consent management platforms help with state privacy laws that require opt-in or opt-out choices. They don't replace a HIPAA authorization, and HHS said a cookie banner isn't one.

::compare A typical clinic setup, before and after an audit | Before: Meta Pixel on every page; Google Ads conversion on the booking thank-you page; contact form asking about symptoms; Analytics on the patient portal | After: no ad pixels on booking, portal or forms; conversions counted from practice software by source; short form with no health fields; Analytics only on public non-clinical pages

## How to audit your site in an hour

You don't need to be a developer to find the obvious problems. Here's a simple audit your office manager or web person can run.

1. **List your tags.** Open your tag manager (often Google Tag Manager) and list every tag, its vendor and the pages it fires on. If tags are hard-coded in your website theme, ask your web developer for the list.
2. **Walk the patient journey.** In a private browser window, visit your home page, a condition page, the booking page, the form, the thank-you page and the portal login. Use a tag-checking browser extension or your browser's developer tools (the Network tab) and filter for domains like facebook.com, google-analytics.com, googletagmanager.com, doubleclick.net and tiktok.com.
3. **Look at what's in the requests.** Check whether URLs, page titles or form fields contain condition names, provider specialties or appointment details.
4. **Check your booking vendor.** Third-party scheduling widgets sometimes add their own trackers. Ask the vendor what they load and whether they'll sign a BAA.
5. **Check your forms.** If a form asks for health information, confirm where submissions go and whether that system is covered by a BAA.
6. **Fix and document.** Remove or restrict tags, then write down what runs where and why. Repeat after every website redesign or new marketing vendor.

::check Pixel audit checklist | No ad pixels on portal, booking, forms or confirmation pages | No condition names in URLs sent to ad platforms | Booking widget trackers reviewed | Forms routed to BAA-covered systems if they ask about health | Cookie banner configured for state laws | Tag list documented and dated

For a wider technical review of your site, our [technical SEO audit checklist](/blog/technical-seo-audit-checklist) covers crawlability and site health, and the [contact form best practices guide](/blog/website-contact-form-best-practices) shows how to keep forms short and effective.

## How this changes your marketing (less than you fear)

Losing pixels on sensitive pages feels like losing your marketing data. In practice, most of what drives new patients for small practices doesn't depend on ad pixels at all: Google Business Profile, reviews, condition pages, referral relationships and AI-search visibility.

Growvia focuses on exactly that side. It runs SEO audits in plain English, tracks your keyword rankings through Google Search Console, checks whether ChatGPT, Gemini and Perplexity recommend you, and watches competitors' Maps positions and review velocity, none of which needs patient data. It's not a HIPAA-covered system, so it shouldn't receive PHI, and it doesn't install ad pixels on your site. Our guide to [getting recommended by AI assistants](/blog/get-recommended-by-chatgpt-gemini-perplexity) explains one of the fastest-growing channels that needs no tracking at all.

For the rest of the compliance picture, including review replies, testimonials and BAAs, read the [HIPAA compliant marketing guide](/blog/hipaa-compliant-marketing-guide). Med spas, which often lean heavily on Meta ads, should also read the [med spa marketing guide](/blog/med-spa-marketing-guide), and chiropractors running paid campaigns can find safer approaches in the [chiropractor marketing guide](/blog/chiropractor-marketing-guide). For the full growth plan, return to the [medical practice marketing pillar](/blog/ai-marketing-for-medical-practices).

## Frequently asked questions

### Can I use the Meta Pixel on a healthcare website?

It's high risk on any page connected to booking, portals, forms or confirmations, and many practices remove it from those pages or from the whole site. On purely general pages it's lower risk, but state health data laws and FTC rules still apply, so get advice first.

### Did the June 2024 court ruling make tracking pixels legal for healthcare?

No. In AHA v. Becerra, the court vacated only HHS's position on IP addresses combined with visits to public pages about conditions or providers. Tracking on patient portals, booking flows and forms remains high risk, and the FTC and state laws are unaffected.

### Is Google Analytics HIPAA compliant?

Google says it doesn't offer BAAs for Google Analytics and that HIPAA-regulated customers must not use it in ways that give Google access to PHI. Keep it off authenticated and health-service pages, or use an analytics vendor that will sign a BAA.

### Does a cookie consent banner make tracking HIPAA compliant?

No. HHS's guidance says a cookie banner isn't a valid HIPAA authorization. Consent tools can help with state privacy laws, but they don't fix PHI disclosures.

### How do I measure ad results without a pixel on my booking page?

Track inquiries and booked first visits by source in your practice software, use UTM tags on ad links, and compare spend to bookings each month. It's less granular, but it's safer and usually accurate enough for a small practice.
