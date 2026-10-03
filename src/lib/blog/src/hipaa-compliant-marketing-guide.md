---
slug: hipaa-compliant-marketing-guide
title: "HIPAA Compliant Marketing: What Practices Can and Can't Do in 2026"
description: A plain-English guide to HIPAA compliant marketing for practices. Marketing vs treatment messages, authorizations, BAAs, reviews, testimonials and state laws.
keywords: HIPAA compliant marketing, HIPAA marketing rules, HIPAA marketing authorization, business associate agreement marketing, HIPAA review replies, patient testimonials HIPAA, healthcare email marketing HIPAA, Washington My Health My Data Act, Nevada SB 370 consumer health data, medical practice marketing compliance
published: 2026-09-29
category: Medical & wellness
hub: healthcare
---
Most HIPAA problems in marketing don't come from bad intentions. They come from a front desk replying to an angry review, a contractor installing an ad pixel on the booking page, or someone exporting the patient list into a newsletter tool because it was faster. Each one feels like ordinary marketing. Each one can be a disclosure of protected health information (PHI).

HIPAA compliant marketing is not about doing less marketing. It's about knowing which messages count as "marketing" under the law, which tools are allowed to touch patient data, and where the hard lines are in public channels like reviews and social media.

This guide explains those rules in plain English, with examples, templates and a checklist you can use this week. It's part of our [AI marketing system for medical practices](/blog/ai-marketing-for-medical-practices), which covers the growth side. This is not legal advice. HIPAA has nuances and state laws differ, so confirm anything important with your privacy officer or a healthcare attorney.

## Who HIPAA applies to (and who it doesn't)

HIPAA's Privacy Rule applies to "covered entities" and their "business associates". Covered entities include health plans, clearinghouses and healthcare providers that transmit health information electronically in connection with standard transactions, such as billing insurance. Business associates are vendors that create, receive, maintain or transmit PHI on a covered entity's behalf.

That means most clinics, chiropractors, physical therapists and dental practices that bill insurance are covered. Some cash-only practices, like certain med spas, may not be. That doesn't free them to do anything they want. The FTC Act still bans unfair and deceptive practices with health data, the FTC's Health Breach Notification Rule covers many health apps and services outside HIPAA, and state consumer health data laws (covered below) can apply even where HIPAA doesn't.

If you aren't sure whether you're a covered entity, HHS has a [covered entity guidance page](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html). Treat the answer as a starting point, not a free pass.

## What HIPAA means by "marketing"

Under the Privacy Rule, marketing is a communication about a product or service that encourages the recipient to buy or use it. If you use PHI to send marketing, you generally need the patient's written authorization first.

The key is that many patient communications are **not** marketing under this definition. HHS's [marketing guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/marketing/index.html) lists the main exceptions. Communications are generally not marketing when they are about:

- **The patient's own treatment**, such as appointment reminders, recall notices, prescription refill reminders and care instructions.
- **Case management or care coordination**, including recommending alternative treatments or providers.
- **Your own health-related products and services**, such as a new location, a new service line, or which insurance plans you accept.

There's a major catch. Since the HITECH Act changes took effect in 2013, if a third party pays you to send a treatment or operations communication about its product, it becomes marketing and needs authorization. A narrow exception allows refill reminders where the payment only covers the cost of sending them.

Two other situations don't need authorization even when the message is marketing: a face-to-face conversation with the patient, and a promotional gift of nominal value that you provide (a branded pen or water bottle).

::compare Usually allowed vs usually needs authorization | Allowed without authorization: appointment and recall reminders; care-plan follow-ups; announcing your new service or location; telling patients which insurance you accept | Needs written authorization: promoting a third party's product because they pay you; using a patient's story or photo in ads; sharing patient lists with advertisers; selling PHI

### A quick test before you send anything

Ask three questions, in order:

1. **Does this message use PHI?** That includes using patient status, visit history or a condition to decide who receives it. Even a list of patient names and emails is PHI, because it shows who your patients are.
2. **If yes, is it about the patient's treatment, care coordination or your own services?** If so, it's usually not marketing.
3. **Is anyone paying you to send it?** If a third party pays, you generally need authorization.

::flow Do you need a HIPAA authorization? | Uses PHI? If no, HIPAA marketing rules usually don't apply | About their treatment or your own services? Usually allowed | Third party paying you? Authorization needed | Unsure? Ask your privacy officer

## Business associate agreements: which vendors can touch PHI

Any vendor that receives PHI from you needs a signed business associate agreement (BAA) before it does. HHS publishes [sample BAA provisions](https://www.hhs.gov/hipaa/for-professionals/covered-entities/sample-business-associate-agreement-provisions/index.html) that show what a BAA covers: permitted uses, safeguards, breach reporting and what happens to data when the contract ends.

For marketing, this is where practices most often slip. A patient roster uploaded to an email tool, a call recording sent to an analytics vendor, or a form that collects symptoms and stores them in a CRM all count as giving PHI to a vendor.

| Vendor type | Typically signs a BAA? | What to do |
|---|---|---|
| EHR and practice-management system | Yes | Keep clinical data and patient lists here |
| HIPAA-focused patient messaging (Weave, NexHealth, Klara and similar) | Yes, check the contract | Use for reminders, recall and patient-specific texts and emails |
| Google Analytics | No, Google says it doesn't offer BAAs for Analytics | Never send PHI, keep it off authenticated and booking pages |
| Meta Pixel and most ad platforms | No | Don't use on pages that reveal health information or appointment intent |
| General email and marketing tools | Often no, some offer BAAs on specific plans | Use only for non-patient subscriber lists unless a BAA is in place |
| Call tracking (for example CallRail) | Some offer HIPAA plans | Check the plan and sign the BAA before recording calls |

Google's own [HIPAA and Google Analytics page](https://support.google.com/analytics/answer/13297105) states that it doesn't offer BAAs for Analytics and that HIPAA-regulated customers must not use it in ways that give Google access to PHI.

> Disclosure: We make Growvia, an all-in-one marketing app. Growvia is not a HIPAA-covered system and doesn't sign BAAs. Use it for SEO, Google Business Profile, competitor tracking, social posts and newsletters to people who subscribed through your website, and keep patient lists, treatment details and appointment data in your EHR or HIPAA-compliant patient communication software.

## Email marketing and website forms

Email is where general marketing and patient communication collide. Split them clearly.

### Two separate lists

- **Patient communications list.** Lives in your patient platform under a BAA. Used for reminders, recall, care follow-ups and announcements about your own services to existing patients.
- **Marketing subscriber list.** People who signed up on your website, at a community event or through social media. They may or may not be patients, and you don't add clinical information to their records. This list can live in a general marketing tool.

Don't merge the two by exporting patients into the marketing tool. If you want to send a newsletter to all patients, send it from your patient platform or from a vendor that has signed a BAA.

Both lists still need to follow CAN-SPAM: honest From and subject lines, your physical postal address, and a working unsubscribe that's honored within 10 business days. For international audiences, see our [email marketing laws by country guide](/blog/email-marketing-laws-by-country). Texting has its own rules on consent, quiet hours and 10DLC registration, covered in the [SMS marketing and TCPA guide](/blog/sms-marketing-tcpa-10dlc-guide).

### Website forms

A contact form that asks "What brings you in?" and emails the answer to a shared Gmail inbox is moving PHI into a system without a BAA. You have two clean options:

- Keep general contact forms short (name, phone, email, preferred time, preferred location) and handle the health conversation by phone or in your patient system.
- Use a HIPAA-compliant intake form tool, under a BAA, for anything that asks about symptoms, conditions, insurance details or medical history.

Pixels on forms and booking pages are a separate risk. Our [healthcare tracking pixels guide](/blog/healthcare-tracking-pixels-privacy) explains the HHS guidance, the June 2024 court ruling and how to audit your tags.

## Online reviews: the most public way to break HIPAA

HHS's Office for Civil Rights has settled more than once over review replies. Elite Dental Associates in Dallas paid $10,000 in 2019 after disclosing patient information while responding to Yelp reviews. New Vision Dental in California paid $23,000 in December 2022 for disclosing PHI in Yelp review replies.

The rule for every reply: **don't confirm the reviewer is a patient, and don't mention any visit, condition, treatment or bill**, even if the reviewer posted those details themselves. A patient choosing to share their own information doesn't give you permission to add to it.

::chat A HIPAA-safe reply to a detailed complaint | them: Dr. Lee misdiagnosed my shoulder and the billing office overcharged me $300. | you: We're sorry to hear about this experience. | you: Privacy rules don't allow us to discuss any individual's care or account online, and we take every concern seriously. | you: Please call our practice manager at (555) 010-3000 so we can listen and help.

### Asking for reviews

Ask every patient the same way. Google's policies ban "review gating", which means only asking patients you expect to be happy. The FTC's [Rule on Consumer Reviews and Testimonials](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers) (16 CFR Part 465), effective October 21, 2024, bans fake reviews, buying positive or negative reviews, undisclosed insider reviews and review suppression through threats or intimidation, with civil penalties per violation.

Ask in person with a QR code at checkout, or send the request through your patient platform using general wording. Don't send review requests from a tool that doesn't have a BAA if you'd have to load your patient list into it. The [dental reviews and HIPAA guide](/blog/dental-office-google-reviews-hipaa) has more reply templates for positive, negative and fake reviews, and they apply to any healthcare practice. For general review-request tactics, see [how to get more Google reviews](/blog/how-to-get-more-google-reviews).

## Testimonials, photos and patient stories

A patient story is powerful marketing. It's also PHI when it identifies the patient and their care. Using it in ads, on your website or on social media requires a valid HIPAA authorization.

A valid authorization is written, specific and signed. It describes what information will be used, who will use it, the purpose, an expiration date or event, the patient's right to revoke it, and whether you receive any payment connected to the use. The HHS regulation that sets these elements is [45 CFR 164.508](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.508).

::check Testimonial and photo authorization checklist | Written and signed before anything is posted | Names the exact content (quote, photo, video) | Lists where it will appear (website, social, ads) | States an expiration date or event | Explains the right to revoke | Discloses any payment or discount given | Stored with the patient record

The FTC adds its own requirements. Under the FTC's Endorsement Guides, testimonials must reflect the patient's honest experience, any material connection (a discount, free treatment, or payment) must be disclosed clearly, and if the results shown aren't what people can generally expect, you need to make that clear. Health claims in testimonials still need scientific support, because a testimonial can't say what you couldn't say yourself.

Practical tips:

- Never post a patient photo, even of a happy group at an event, without written consent.
- Watch backgrounds in office photos and videos. Schedules on screens, charts on desks and whiteboards can all show PHI.
- Don't repost a patient's social media post about their treatment without authorization. Liking or thanking can also confirm they're a patient, so keep it general or don't engage.
- When a patient revokes authorization, remove the content where you control it and stop new uses.

## Social media and advertising

On social media, the same rules apply as for reviews. Don't confirm patient relationships in comments or DMs, and move any health conversation to a secure channel. A reply like "Please call our office so we can help" is always safe.

For advertising, three rules cover most situations:

- **No patient lists in ad platforms.** Uploading patient emails or phone numbers for custom audiences or lookalikes discloses PHI to the platform.
- **No pixels where health data flows.** Keep ad tracking off patient portals, booking flows and symptom forms.
- **No health-based targeting.** Google's personalized ad policies don't allow targeting by health conditions, and Meta removed many health-related targeting options in 2022.

::scale Marketing risk meter | Low risk: SEO, Google Business Profile, educational blog posts, general social content | Medium risk: website forms, newsletters, review requests, ad tracking on public pages | High risk: pixels on booking or portal pages, patient lists in ad tools, review replies that confirm care

## State consumer health data laws

HIPAA is the floor, not the ceiling. Several states now regulate "consumer health data" much more broadly, and these laws can apply to businesses HIPAA doesn't cover, like some med spas, wellness studios and health apps.

| Law | Effective | What it means for marketers |
|---|---|---|
| Washington My Health My Data Act | March 31, 2024 (June 30, 2024 for small businesses) | Broad definition of consumer health data, consent needed to collect and share it, geofencing restrictions around health facilities, and a private right of action |
| Nevada SB 370 | March 31, 2024 | Similar consumer health data protections, with consent and privacy policy requirements |
| California CCPA/CPRA | In force | Health data is sensitive personal information with extra rights |
| Texas Data Privacy and Security Act | July 1, 2024 | Consent needed to process sensitive data, including health data, and it applies to small businesses that sell sensitive data |

Washington's attorney general has a [My Health My Data Act page](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy) with FAQs. Because of the private right of action, Washington is the state where a careless pixel or ad audience is most likely to end up in court. Our [Seattle and King County guide](/local-marketing/king-county-wa) covers local implications. Other states are adding similar laws, so check your state's current rules every year.

## A HIPAA marketing checklist for your practice

Use this as a quarterly review. It takes about an hour with your office manager.

1. **Map your tools.** List every marketing tool and note whether it ever receives PHI and whether a BAA is signed.
2. **Separate your lists.** Confirm patient lists live only in BAA-covered systems.
3. **Audit your website tags.** Remove ad pixels from portals, booking flows and health forms.
4. **Review your forms.** Remove symptom and condition fields from forms that go to non-BAA tools.
5. **Read your last 50 review replies.** Edit any that confirm a patient relationship or mention care.
6. **Check testimonial files.** Every story, photo and video should have a signed authorization on file.
7. **Train the team.** Five minutes at a staff meeting on review replies, social comments and photos.
8. **Write it down.** A one-page policy that says which tool sends which message.

## Where marketing tools fit

Most of your growth work never needs PHI. Local SEO, Google Business Profile, condition pages, competitor research, AI-search visibility and social content are all patient-free. That's the work Growvia is built for, with SEO audits in plain English, a competitor tracker, AI-visibility checks and email from your own mailbox to website subscribers.

Patient-specific work needs a HIPAA-compliant platform. The [chiropractor marketing guide](/blog/chiropractor-marketing-guide) and [physical therapy clinic marketing guide](/blog/physical-therapy-clinic-marketing) show how practices split the two in practice, and the [med spa marketing guide](/blog/med-spa-marketing-guide) covers before-and-after consent in more depth. For the full growth plan, go back to the [medical practice marketing pillar](/blog/ai-marketing-for-medical-practices).

## Frequently asked questions

### Is an appointment reminder considered marketing under HIPAA?

No. Appointment reminders, recall notices and other communications about a patient's own treatment are generally not marketing and don't need authorization. Send them through a system covered by a BAA.

### Can I email a newsletter to my patients?

A newsletter about your own services generally isn't HIPAA marketing, but your patient list is PHI. Send it through your patient platform or a vendor that has signed a BAA, rather than exporting patients into a general email tool.

### Can I reply to a Google review if the patient mentioned their treatment?

You can reply, but don't confirm they're a patient or add any details about their care. Thank them, state your commitment to quality and privacy, and invite them to contact the office directly.

### Do I need written consent to use a patient testimonial?

Yes. Using a patient's name, photo, story or video in marketing requires a signed HIPAA authorization, and the FTC also requires disclosure of any discount or payment given in exchange.

### Does HIPAA apply to a cash-only med spa?

It depends on whether the practice transmits health information electronically in standard transactions, such as insurance billing. Even if HIPAA doesn't apply, the FTC Act and state laws like Washington's My Health My Data Act can.

### Is Growvia HIPAA compliant?

No. Growvia is not a HIPAA-covered system and doesn't sign BAAs, so keep patient lists, treatment details and appointment data out of it and use it for marketing that doesn't involve PHI.
