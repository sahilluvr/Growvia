---
slug: schema-markup-for-local-business
title: "Schema Markup for Local Businesses: A Practical Guide"
description: A plain-English guide to schema markup for local businesses: which structured data types matter, key properties, how to add JSON-LD, and how to test it.
keywords: schema markup for local business, local business schema, structured data seo, json-ld example, rich results, organization schema, schema for ai search
published: 2026-09-22
category: SEO
---
Your website tells people a lot. Your opening hours sit in the footer. Your address is on the contact page. Your star rating is in a widget near the top. A human visitor pieces all of that together in seconds. A search engine has to guess, and it does not always guess right.

**Schema markup**, also called structured data, removes the guessing. It is a small block of code that labels the facts on your page in a language machines read easily: this is the business name, this is the phone number, these are the hours, this is the price. Google uses it to understand your pages and, in some cases, to show richer search results, such as star ratings, product prices or event dates.

This guide covers what it does and does not do, which types actually matter for a local business, the properties to include, how to add it on common website builders, and how to test it.

## What structured data actually is

Structured data is a standard way of describing things on a web page. The vocabulary comes from [schema.org](https://schema.org/), a shared project started by the major search engines. It defines hundreds of "types", such as `LocalBusiness`, `Product` and `Event`. Each type has "properties", such as `name`, `address` or `price`.

There are three formats for writing it: JSON-LD, Microdata and RDFa. Google supports all three. But its [introduction to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) recommends the format that is easiest to implement and maintain, which in most cases is JSON-LD. It describes JSON-LD as less prone to user errors.

JSON-LD is a separate block of code, usually placed in the page's head section. It does not touch your visible design. That is why it is so popular: you can add, change or remove it without breaking the layout.

A simple JSON-LD block for a dental clinic has a few key parts:

- `"@context": "https://schema.org"` tells machines which vocabulary you are using.
- `"@type": "Dentist"` says what kind of thing the page describes.
- `"name": "Smile Studio Dental"` gives the business name.
- `"address"` holds a nested `PostalAddress` with street, city, region, postal code and country.
- `"telephone": "+91-98765-43210"` gives the main contact number, with country code.

> Think of schema as a label on a jar. It does not change what is inside, it just makes the contents obvious at a glance.

## What schema does, and what it doesn't

This is where a lot of SEO advice goes wrong, so let's be precise.

**What it does.** Structured data helps Google understand what a page is about and which facts belong to which thing. It also makes a page *eligible* for certain rich results. Google is clear that you must include all required properties to be eligible. Eligibility is necessary, not sufficient.

**What it doesn't do.** Schema is not a direct ranking factor. Adding a `LocalBusiness` block will not push you from page three to page one. Google's documentation talks about schema affecting how results *appear*, not where they rank. Rich results can make your listing more eye-catching, which may lift clicks, but that is an indirect effect.

**No guarantees.** Google's [structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) say that even correct markup does not guarantee a rich result. Google's systems decide what to show based on the search and the person searching.

**AI search.** Many people now claim schema is the secret to appearing in ChatGPT or Google's AI Overviews. Be careful here. Google's page on [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) says plainly that there is no special schema.org structured data you need to add for AI Overviews or AI Mode. It does recommend that your structured data matches the visible text on the page.

So the honest summary is this. Schema is part of good SEO hygiene. It makes your facts clear and consistent for any machine that reads your site, including search engines and AI tools. It is not a shortcut, and it does not replace good content, reviews or a well-kept Google Business Profile.

| Claim you may hear | Reality |
| --- | --- |
| Schema boosts rankings directly | No. It helps understanding and rich result eligibility |
| Correct schema guarantees stars in search | No. Google decides whether to show rich results |
| You need special schema for AI Overviews | No. Google says no special markup is needed |
| Schema can describe things not on the page | No. Markup must match visible content |
| Schema is worth doing for a local business | Yes. It is low effort and keeps your facts clear |

## The schema types that matter for small businesses

Schema.org has hundreds of types. A typical local business needs four or five. Here is a quick map before we go into detail.

| Type | Use it for | Where it goes |
| --- | --- | --- |
| Organization or LocalBusiness | Your business identity, logo, contacts | Home page or About page |
| LocalBusiness subtype | Physical premises customers visit | Home page or each location page |
| Product with Offer | Items you sell online | Each product page |
| Event | Workshops, classes, sales events | Each event page |
| BreadcrumbList | Site navigation trail | Most inner pages |
| Article or BlogPosting | Blog posts and news | Each article |

We will start with the two identity types, then cover the rest in their own sections.

### Organization schema: your business identity

`Organization` describes your business as an entity. Google's [Organization documentation](https://developers.google.com/search/docs/appearance/structured-data/organization) says there are no required properties. You add the ones that apply. Google uses this information to understand your business and may use it for things like the logo shown in search results and knowledge panels.

Google recommends placing it on your home page, or on one page that describes your organisation, such as your About page. You do not need to repeat it on every page.

The most useful properties are:

- `name` and `alternateName` for your official name and any short form people use.
- `url` for your main website address.
- `logo` for your logo image. Google asks for at least 112 by 112 pixels, a crawlable URL, and an image that looks right on a white background.
- `sameAs` for links to your official profiles, such as Facebook, Instagram, LinkedIn or YouTube.
- `telephone`, `email` and `address` for contact details.
- `description` for a short, factual summary.

The `sameAs` property deserves a special mention. It tells machines that your website and your social profiles are the same entity. That kind of clear, consistent identity is exactly what helps search engines and AI assistants trust who you are. We cover this idea in more depth in our guide on [how to get recommended by ChatGPT, Gemini and Perplexity](/blog/get-recommended-by-chatgpt-gemini-perplexity).

If you sell online, Google recommends the more specific `OnlineStore` subtype rather than plain `Organization`.

> Only list profiles you actually own and keep active in sameAs. A dead or unofficial page adds confusion, not trust.

### LocalBusiness schema and its subtypes

If customers visit your premises, or you serve a defined local area, `LocalBusiness` is the most important type for you. It is technically a more specific kind of `Organization`, so it carries all the same properties plus local ones.

Google's [LocalBusiness documentation](https://developers.google.com/search/docs/appearance/structured-data/local-business) asks you to use the most specific subtype possible. Schema.org has many. A few examples:

- `Restaurant`, `CafeOrCoffeeShop`, `Bakery`
- `Dentist`, `Physician`, `MedicalClinic`
- `HairSalon`, `BeautySalon`, `DaySpa`
- `Plumber`, `Electrician`, `HVACBusiness`
- `AccountingService`, `LegalService`, `RealEstateAgent`
- `AutoRepair`, `HealthClub`, `Store`

You can browse the full list on schema.org's [LocalBusiness page](https://schema.org/LocalBusiness). If nothing fits exactly, pick the closest parent. You can also list more than one type as an array, for example a business that is both a bakery and a cafe.

Here are the properties Google lists, and what they mean in practice.

| Property | Status | What to enter |
| --- | --- | --- |
| name | Required | Your business name, exactly as on your signage and Google Business Profile |
| address | Required | A PostalAddress with streetAddress, addressLocality, addressRegion, postalCode, addressCountry |
| telephone | Recommended | Main number with country and area code |
| url | Recommended | The working URL of this specific location |
| geo | Recommended | GeoCoordinates with latitude and longitude, at least 5 decimal places |
| openingHoursSpecification | Recommended | Days plus opens and closes times |
| priceRange | Recommended | A short text range, under 100 characters |
| image | Recommended | Photos of the business, such as the storefront |
| menu | Recommended for food | URL of your menu |
| servesCuisine | Recommended for food | The cuisine you serve |
| department | Optional | A nested LocalBusiness for departments with their own details |

A few practical notes on the trickier ones.

**Address.** Fill in every part separately rather than cramming the whole address into one field. Use exactly the same spelling as your Google Business Profile. Consistency of name, address and phone number matters across the web; see our [local SEO checklist](/blog/local-seo-checklist-small-business).

**Geo coordinates.** Google asks for at least five decimal places for latitude and longitude. You can get these by right-clicking your location in Google Maps. For example, `"latitude": 30.70465` and `"longitude": 76.71787`.

**Opening hours.** Use `openingHoursSpecification` with `dayOfWeek`, `opens` and `closes`. Times use the 24-hour hh:mm:ss format, so 7 pm is `"closes": "19:00:00"`. You can group days that share hours. For a seasonal closure or holiday, add `validFrom` and `validThrough` dates.

**Multiple locations.** Each branch should have its own page with its own `LocalBusiness` block. Do not stack five addresses into the home page markup. Each location page should describe that location only.

> Your schema hours, your website footer and your Google Business Profile should all say the same thing. Update all three together.

Speaking of your profile: schema on your website does not replace a well-kept Google Business Profile. The profile is still the main source for the map pack. Our [Google Business Profile optimization guide](/blog/google-business-profile-optimization-guide) walks through it.

## Product and Offer schema for shops

If you sell products online, `Product` markup is the type most likely to change how your results look. It can show price, availability and ratings in search results.

Google splits this into two features, and the difference matters:

- **Product snippets** are for pages that review or compare products. Google's [product snippet documentation](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) requires a `name` and at least one of `review`, `aggregateRating` or `offers`.
- **Merchant listings** are for pages where a customer can actually buy the product from you. These need a product `name`, an `image`, and an `offers` block with a `price` above zero and a three-letter `priceCurrency`, such as `"priceCurrency": "INR"`.

For a shop, the useful properties inside `Offer` are `price`, `priceCurrency`, `availability` (for example `https://schema.org/InStock`) and `url`. On the product itself, add `description`, `brand`, `sku` and good images.

One important limit: product rich results only support pages focused on a single product, or variants of the same product. Category pages that list many products are not eligible.

## Review snippets and the self-serving rule

Star ratings in search results are the rich result most business owners want. They are also the one most often marked up incorrectly.

Google's [review snippet documentation](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) contains a rule every local business should know. If the business being reviewed controls the reviews about itself, its pages using `LocalBusiness` or any other `Organization` markup are not eligible for star review features. Google calls these self-serving reviews.

In plain terms, you cannot put your own testimonials, or reviews pulled into your site through a widget, into `LocalBusiness` schema and expect stars for your business in search.

What still works:

- Product pages on your shop can carry `aggregateRating` for that product, if the reviews are genuine and shown on the page.
- Review sites that review *other* businesses can mark those up.
- Event, Recipe, Course, Book and Software App types can carry reviews under their own rules.

For a local service business, the realistic path to stars is your Google Business Profile reviews, which appear in Maps and the local pack.

> Never mark up reviews that are not visible on the page, or ratings you cannot back up. It can lead to a manual action.

## Event, Breadcrumb and Article schema

These three are less central than `LocalBusiness`, but they are easy wins if they fit your site.

**Event.** If you run workshops, classes, tastings, open days or sales, each event page can use `Event` markup. The key properties are `name`, `startDate` and `location`. Add `endDate`, `description`, `image`, `offers` for ticket price, and `eventStatus` if an event is cancelled or moved. Dates should include a time zone, for example `"startDate": "2026-11-14T18:00+05:30"`.

**BreadcrumbList.** Breadcrumbs show where a page sits in your site, such as Home, then Services, then Teeth Whitening. The markup is a list of `ListItem` entries, each with a `position`, `name` and `item` URL. It helps Google present the page's place in your site more clearly.

**Article.** For blog posts and news, `Article` or `BlogPosting` helps Google understand the headline, author, images and dates. Google lists no required properties for it. The useful ones are `headline`, `image`, `datePublished`, `dateModified` and `author` with a name and profile URL.

## FAQ and HowTo: what changed

You will still see older guides telling you to add FAQ and HowTo schema everywhere. That advice is out of date.

In [August 2023, Google announced changes](https://developers.google.com/search/blog/2023/08/howto-faq-changes) to both. HowTo rich results were removed from search results. FAQ rich results were limited to well-known, authoritative government and health websites. For most businesses, both features effectively stopped appearing at that point.

The story continued after that. According to Google's [Search Central changelog](https://developers.google.com/search/updates), Google added a deprecation notice to the FAQ rich result documentation in May 2026. In June 2026 it removed that documentation entirely, noting that the FAQ rich result feature is no longer shown in Google Search results. Neither FAQ nor HowTo appears in Google's current gallery of supported features.

What does that mean for you?

- Do not add FAQ or HowTo markup expecting a visual feature in Google. It will not appear.
- You do not need to rush to delete existing FAQ markup. Unused structured data does not cause problems in Google Search.
- Keep writing genuine FAQ sections on your pages. Clear question-and-answer content is still useful to visitors, and plain, well-organised answers are easy for any search engine or AI assistant to read.

Google has also phased out several other, less common features since 2025, such as Course info, Vehicle listing and Practice problems. The lesson is simple. Check Google's current [search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) before investing time in a markup type.

## How to add schema on WordPress, Shopify, Wix and custom sites

You do not have to write JSON-LD by hand. Most platforms either add it for you or give you a simple place to put it.

**WordPress.** SEO plugins such as Yoast SEO and Rank Math generate Organization, Article and Breadcrumb markup automatically once you fill in their settings. Some offer local business modules for hours, address and multiple locations. Avoid running two SEO plugins at once, since both will output their own schema.

**Shopify.** Many Shopify themes include Product markup by default, pulling price and stock from your product data. Check that the theme's markup is complete before adding an app. If you install a schema app, make sure it replaces the theme's markup rather than duplicating it. Organization and LocalBusiness details often need an app or a small edit to the theme.

**Wix.** Wix adds basic structured data to many page types automatically. Its SEO settings also let you add your own custom markup to a page. You can paste a JSON-LD block for your `LocalBusiness` details on your home page there.

**Custom or developer-built sites.** Ask your developer to render JSON-LD in the page head from the same data that shows on the page. That way the hours, prices and address in the markup can never drift away from what visitors see.

## How to test and monitor your markup

Never assume your markup works just because you added it. Test it.

::flow A simple testing loop | Add the JSON-LD | Run Google's Rich Results Test | Fix errors and warnings | Request indexing | Watch Search Console's reports

**Rich Results Test.** Google's [Rich Results Test](https://search.google.com/test/rich-results) checks a live URL or pasted code. It shows which Google rich result types the page is eligible for, plus errors and warnings. Errors mean a required property is missing or broken, so the page cannot get that feature. Warnings mean a recommended property is missing. Fix errors first, then warnings where the data exists.

**Schema Markup Validator.** The [Schema Markup Validator](https://validator.schema.org/) checks your markup against the full schema.org vocabulary, not just Google's features. It is useful for types Google does not show as rich results, such as a plain `LocalBusiness` block, and for spotting typos in property names.

**Search Console.** Once your pages are live and indexed, Google Search Console shows rich result status reports for types it detects, such as Products, Breadcrumbs or Events. Google recommends using them after deployment, because markup can break later through template changes or plugin updates. After fixing a problem, use the "Validate fix" button to ask Google to recheck.

> Re-test your key pages after any theme change, plugin update or site migration. That is when schema most often breaks silently.

## Common schema mistakes to avoid

Most schema problems fall into a handful of patterns. Check your site against this list.

1. **Markup that doesn't match the page.** Google's guidelines say not to mark up content that is not visible to readers. If your schema says you open at 8 am but your page says 9 am, you are sending mixed signals.
2. **The wrong type.** Using `Organization` when you have a shopfront, or `LocalBusiness` for a purely online business, blurs what you are. Choose the most specific accurate type.
3. **Multiple conflicting blocks.** A theme, an SEO plugin and a schema app can each output their own `Organization` or `Product` block. The result is two different names, logos or prices on one page. Keep one source of truth per type.
4. **Self-serving review stars.** Adding `aggregateRating` to your own `LocalBusiness` markup from testimonials is not eligible for stars, as covered above.
5. **Stale information.** Holiday hours, changed phone numbers and old prices left in the markup. Update schema whenever the facts change.
6. **Broken image and logo URLs.** Google requires image URLs to be crawlable and indexable. A logo blocked by robots.txt or behind a login will not work.
7. **Chasing deprecated features.** Spending hours on FAQ or HowTo markup for search features that no longer exist.

Misleading markup can lead to a manual action from Google. That removes your eligibility for rich results, though Google says it does not affect regular ranking.

Schema is one item in a broader technical health check. If you want the full picture, our [technical SEO audit checklist](/blog/technical-seo-audit-checklist) covers crawling, indexing, speed and the rest. Tools like Growvia can scan your pages, flag missing or broken structured data, and draft a starter JSON-LD block from your business details for you to review. Its audits re-check schema over time, so you hear about breakages early.

## Frequently asked questions

### Does schema markup improve my Google rankings?

Not directly. Google does not treat structured data as a ranking boost. It helps Google understand your pages and makes them eligible for rich results, which can make your listing more attractive and may improve clicks.

### What is the best schema type for a local business?

Use `LocalBusiness` with the most specific subtype that fits, such as `Dentist`, `Restaurant` or `Plumber`. Include your name and full address, which are required, plus phone, URL, geo coordinates and opening hours. Put it on your home page or on each location page.

### Can I get review stars for my business with schema?

Usually not through your own website. Google treats reviews a business controls about itself as self-serving, so `LocalBusiness` and `Organization` pages are not eligible for star features. Product pages with genuine product reviews can still qualify, and your Google Business Profile reviews show stars in Maps.

### Should I still add FAQ schema to my pages?

Not for Google rich results. FAQ rich results were restricted in 2023 and Google has since stopped showing the feature entirely. Existing FAQ markup does no harm, but your effort is better spent on clear, genuine FAQ content that helps visitors.

### Do I need schema to appear in AI Overviews or ChatGPT?

Google says no special schema is needed for its AI features. Accurate structured data still helps machines read your facts clearly and consistently. What matters most is useful content, a consistent business identity across the web, and good reviews.

### How do I check if my schema is working?

Paste your URL into Google's Rich Results Test to see eligible features, errors and warnings. Use the Schema Markup Validator for general schema.org checks. After launch, watch the rich result reports in Google Search Console for problems.

### Is JSON-LD better than Microdata?

Google supports both, but recommends JSON-LD in most cases because it is easier to implement and maintain. It sits in a separate block, so you can update it without touching your page design.
