---
slug: technical-seo-audit-checklist
title: "Technical SEO Audit Checklist: 48 Checks for Small Businesses"
description: A plain-English technical SEO audit checklist with 48 checks for small business sites: crawling, indexing, redirects, speed, mobile, schema and AI bots.
keywords: technical seo audit, seo audit checklist, website seo audit, technical seo checklist, how to audit a website for seo, crawlability indexing, small business seo audit
published: 2026-09-13
category: SEO
---
You can write the best service page in your city and still get zero traffic from it. If Google can't crawl the page, won't index it, or picks a duplicate copy instead, your content never gets a chance to rank. Technical SEO is the plumbing underneath everything else.

The good news is that most small business websites have the same dozen or so problems. A dental clinic site that loads on both `http://` and `https://`. A bakery whose new website still has a leftover `noindex` tag from the developer's staging copy. A CA firm whose old blog URLs all lead to a 404 page after a redesign. None of these need an agency to find. They need a checklist and an hour.

Here are 48 checks grouped by area, with how to test each one using free tools and how to decide what to fix first. New to audits? Start with the 60-minute walkthrough near the end.

## How Google actually finds and ranks a page

Every page goes through three steps, and each part of the audit maps to one of them.

::flow How a page gets from your server to Google's results | Discover | Crawl | Render | Index | Rank

1. **Crawling.** Googlebot, Google's automated visitor, discovers your URL through links or your sitemap and downloads it.
2. **Rendering.** Google runs the page's JavaScript to see what a real browser would show.
3. **Indexing.** Google decides whether the page is useful and unique enough to store, and which version of it is the main one.

Ranking only happens after all three. A technical audit checks for anything that blocks or confuses those steps. Keywords and content come later; our guide to [keyword research for small businesses](/blog/keyword-research-for-small-business) picks up there.

> Tip: Fix crawling and indexing problems before anything else. A fast, beautiful page that isn't indexed earns nothing.

## Crawling and indexing checks

One wrong line here can hide your whole site from Google.

### robots.txt: the "do not enter" sign

Your `robots.txt` file lives at `yourdomain.com/robots.txt` and tells crawlers which areas they may visit. `Disallow: /cart/` sensibly keeps bots out of checkout. `Disallow: /` blocks everything, and it's surprisingly common after a launch.

Many people miss this: Google says robots.txt [is not a mechanism for keeping a page out of Google](https://developers.google.com/search/docs/crawling-indexing/robots/intro). A blocked page can still appear in results without a description. To hide a page, use `noindex` or a password.

### noindex: the "don't list me" label

A `noindex` tag, `<meta name="robots" content="noindex">`, tells Google not to show a page in results. Fine on thank-you pages, a disaster on your homepage. WordPress's "Discourage search engines" setting does the same thing site-wide.

### XML sitemap: your list of pages

An XML sitemap is a file listing the URLs you want indexed, usually at `/sitemap.xml`. Google's [sitemap guidelines](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) set a limit of 50,000 URLs or 50MB per file. Google ignores the `priority` and `changefreq` fields, and only trusts `lastmod` dates that are consistently accurate.

### Search Console: Page indexing report and URL Inspection

Google Search Console is free, and it's where Google tells you directly what it thinks of your site. Two features matter most:

- **Page indexing report** (Indexing, then Pages). It groups non-indexed URLs by reason, such as "Excluded by noindex tag" or "Duplicate, Google chose different canonical than user".
- **URL Inspection.** Paste any URL to see whether it's indexed, which canonical Google chose and when it was last crawled.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 1 | robots.txt exists and loads | Visit /robots.txt | Returns a 200 status, no `Disallow: /` for all bots |
| 2 | CSS and JavaScript aren't blocked | Read robots.txt rules | Google can fetch the files it needs to render pages |
| 3 | XML sitemap exists | Visit /sitemap.xml | Loads and lists your real pages |
| 4 | Sitemap lists only good URLs | Spot-check URLs in a crawler | Only canonical, indexable, 200-status pages |
| 5 | Sitemap submitted and referenced | Search Console Sitemaps; `Sitemap:` line in robots.txt | Status "Success", URL count matches reality |
| 6 | No accidental noindex | Crawler or URL Inspection on key pages | Money pages are indexable |
| 7 | Page indexing report reviewed | Search Console, Indexing, Pages | Every excluded reason is understood and intentional |
| 8 | Key pages inspected | URL Inspection on homepage and top services | "URL is on Google", correct canonical |

## Duplicate versions: HTTPS, www and trailing slashes

To Google, `http://clinic.com`, `https://clinic.com` and `https://www.clinic.com` are different addresses. If all of them load the same page, you split your signals and let Google guess which to show.

Pick one HTTPS version and permanently redirect every other version to it. Do the same for trailing slashes: `/services/` or `/services`, never both.

Also watch for mixed content: an HTTPS page loading images or scripts over plain HTTP.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 9 | Valid HTTPS certificate | Open the site in a browser | Padlock shows, no warnings, certificate not near expiry |
| 10 | HTTP redirects to HTTPS | Type the http:// version | One 301 hop to the HTTPS URL |
| 11 | One host version | Try www and non-www | The other version redirects to your chosen one |
| 12 | Consistent trailing slashes | Try a URL with and without the slash | One version redirects to the other |
| 13 | No mixed content | Browser console or a crawler | All images, scripts and fonts load over HTTPS |

## Canonicals and redirects

### Canonical tags: "this is the main version"

A canonical tag, `<link rel="canonical" href="...">`, tells Google which URL is the original when similar versions exist, such as `/shirts/blue` and `/shirts/blue?colour=navy`.

It's a hint, not a command. If it conflicts with your redirects, sitemap or internal links, Google may choose its own canonical.

### 301 vs 302 redirects

A redirect sends visitors and bots from an old URL to a new one. The type matters. Google's [redirects documentation](https://developers.google.com/search/docs/crawling-indexing/301-redirects) says a permanent redirect (301 or 308) signals that the target should be canonical. A temporary one (302 or 307) doesn't, so the old URL may stay in results.

Use 301 for anything permanent, like a redesign or domain move. Keep 302 for genuinely short-term cases.

### Redirect chains and loops

A chain is A redirecting to B, which redirects to C. Each hop slows things down. A loop, where B sends you back to A, breaks the page. Point every old URL straight to its final destination.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 14 | Every indexable page has a canonical | Crawler report | Usually self-referencing on unique pages |
| 15 | Canonicals point to live, indexable URLs | Crawler report | Targets return 200 and aren't noindexed |
| 16 | Only one canonical per page | View source or crawler | No duplicate tags from theme plus plugin |
| 17 | Permanent moves use 301 or 308 | Crawler status codes | No long-lived 302s on moved pages |
| 18 | No redirect chains or loops | Crawler redirect report | Every redirect resolves in one hop |
| 19 | Internal links point to final URLs | Crawler "redirected internal links" | Menus and body links skip redirects entirely |

## Status codes: 404, soft 404 and 5xx

Every page load returns a three-digit status code that Google reads.

- **200** means OK.
- **404** means not found. Google says it [drops previously indexed URLs](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) that return 404 or 410. That's fine for pages you removed on purpose.
- **Soft 404** is a page that's empty or says "not found" while sending 200. Empty category pages are common culprits.
- **5xx** means a server error. Google slows its crawling when it sees these, and persistent server errors can get URLs removed from the index.

A few 404s from old, unlinked pages are harmless. Fix 404s your own pages still link to, and redirect removed pages that had backlinks.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 20 | No internal links to 404 pages | Crawler broken-link report | Zero broken internal links |
| 21 | No soft 404s on real pages | Search Console Page indexing report | Real pages have real content |
| 22 | No recurring 5xx errors | Search Console Crawl stats; crawler | Server errors are rare and short-lived |
| 23 | Custom 404 page returns a 404 code | Visit a made-up URL, check status | Helpful page, but status is 404, not 200 |

## Site structure, internal links and URL design

### Click depth and orphan pages

Google finds pages by following links and treats often-linked pages as more important. Keep every important page within about three clicks of the homepage.

An **orphan page** has no internal links pointing to it. Ad landing pages often end up orphaned, then never rank.

### Anchor text

Anchor text is a link's clickable text. "Root canal treatment in Mohali" tells Google far more than "click here".

### URL design

Good URLs are short, lowercase and hyphenated: `/services/teeth-whitening/` beats `/index.php?page_id=482`. Never change a live URL without a 301 redirect.

If `?sort=price` and `?sort=newest` each create an indexable URL, a small store can produce hundreds of near-duplicates.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 24 | Key pages within three clicks | Crawler "crawl depth" column | Services, products and contact are shallow |
| 25 | No orphan pages | Compare sitemap URLs against crawled URLs | Every important page has internal links |
| 26 | Descriptive anchor text | Review menus and body links | Anchors describe the destination |
| 27 | Clean, readable URLs | Scan the crawl list | Lowercase, hyphens, no random IDs |
| 28 | Parameters don't create duplicates | Crawl and look for `?` URLs | Canonicals or noindex handle filtered views |

## Titles, descriptions, headings and images

### Title tags and meta descriptions

The title tag is the clickable headline in search results; the meta description is the text beneath it. Google doesn't always use them. Google's [title link documentation](https://developers.google.com/search/docs/appearance/title-link) says it may generate a different title when yours is missing, vague, outdated or doesn't match the page's main heading. For descriptions, Google's [snippet guidance](https://developers.google.com/search/docs/appearance/snippet) says it mostly builds snippets from page content, and uses your meta description when it describes the page better. So write clear, specific ones, and make your title and H1 agree.

### Headings

Use one H1 that states the page's topic, then H2s and H3s like chapters and sub-chapters. Never pick heading levels for font size.

### Images

Images are usually the heaviest part of a page. Give each one alt text, such as "dentist fitting clear aligners". Compress and size files to how they display. Prefer WebP or AVIF, and lazy-load only images below the fold.

> Tip: Never lazy-load your main hero image. It's usually the page's largest element, and delaying it hurts your loading score.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 29 | Every page has a title | Crawler "missing titles" | No blanks, no "Home" or "Untitled" |
| 30 | Titles are unique and specific | Crawler "duplicate titles" | Service plus location or benefit, brand at the end |
| 31 | Meta descriptions are unique | Crawler report | Accurate summary with a reason to click |
| 32 | One clear H1 per page | Crawler H1 report | Matches the page's topic and title |
| 33 | Logical heading order | Browser heading extension | H2s and H3s in a sensible outline |
| 34 | Images have descriptive alt text | Crawler "missing alt" | Decorative images excepted |
| 35 | Images compressed and sized | PageSpeed Insights opportunities | No oversized image warnings |
| 36 | Modern formats and correct lazy-loading | PageSpeed Insights | WebP or AVIF; hero image loads immediately |

## Mobile, speed and JavaScript

### Mobile-first indexing

Google [indexes and ranks the mobile version](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) of your site, crawled with a smartphone bot. If your mobile layout hides your services or reviews, Google may not count them. Keep content and structured data the same on both.

### Page speed and Core Web Vitals

Core Web Vitals are Google's three user-experience metrics. According to [web.dev](https://web.dev/articles/vitals), "good" means Largest Contentful Paint (loading) within 2.5 seconds, Interaction to Next Paint (responsiveness) of 200 milliseconds or less, and Cumulative Layout Shift (visual stability) of 0.1 or less, measured at the 75th percentile of real visits. For what each metric means and how to fix it, read [Core Web Vitals explained](/blog/core-web-vitals-explained).

### JavaScript rendering

Google can run JavaScript, but its [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) guide flags real traps. It only follows links that are `<a>` elements with an `href`, so script-driven buttons may never be followed. And if the raw HTML says `noindex`, Google may skip rendering, so removing it with JavaScript may not work.

Quick test: in URL Inspection, run "Test live URL" and view the rendered page. If prices or reviews are missing there, Google can't see them.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 37 | Responsive design works on phones | Open key pages on your own phone | Readable text, tappable buttons, no sideways scroll |
| 38 | Mobile content matches desktop | Compare both versions | Nothing important hidden or removed on mobile |
| 39 | Core Web Vitals pass | PageSpeed Insights field data; Search Console | LCP, INP and CLS all "Good" on mobile |
| 40 | Links are real `<a href>` links | Crawler finds all pages; inspect menu code | Navigation is crawlable without clicks |
| 41 | Key content is in the rendered HTML | URL Inspection, Test live URL | Text, prices and reviews visible to Google |
| 42 | No noindex in raw HTML that JS later removes | View source vs rendered HTML | Raw HTML has the correct robots tag |

## Structured data, hreflang and AI crawlers

### Structured data

Structured data, or schema markup, labels your content for machines: your business, hours and reviews. It can make pages eligible for rich results. Test it with Google's [Rich Results Test](https://search.google.com/test/rich-results), and make sure the markup matches what visitors actually see. Our [schema markup guide for local businesses](/blog/schema-markup-for-local-business) shows exactly which types to use.

### hreflang (only if you have multiple languages)

If you run English and Hindi versions, hreflang tags tell Google which suits which audience. Each version must reference all others, reciprocally, plus an `x-default` fallback. Single-language sites can skip this.

### AI crawlers in robots.txt

AI companies run their own crawlers, which you can allow or block in robots.txt. Some collect training data. Others fetch pages to cite in AI answers, and blocking those can remove you from them.

| Crawler | Company | What it does |
| --- | --- | --- |
| GPTBot | OpenAI | Collects content for training models |
| OAI-SearchBot | OpenAI | Surfaces sites in ChatGPT search answers |
| ChatGPT-User | OpenAI | Visits pages when a user asks; robots.txt may not apply |
| Google-Extended | Google | Controls use of content for Gemini training |
| ClaudeBot | Anthropic | Collects content for model training |
| Claude-SearchBot | Anthropic | Indexes content for Claude's search results |
| Claude-User | Anthropic | Fetches pages when a user asks Claude |
| PerplexityBot | Perplexity | Surfaces and links sites in Perplexity answers |
| Perplexity-User | Perplexity | User-initiated fetches; generally ignores robots.txt |

These names come from each company's own documentation: [OpenAI](https://developers.openai.com/docs/bots), [Google](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers), [Anthropic](https://support.claude.com/en/articles/8896518) and [Perplexity](https://docs.perplexity.ai/guides/bots). Google states that Google-Extended doesn't affect inclusion or ranking in Google Search.

Most businesses should allow the search-type bots and decide on training bots by preference. The bigger risk is a security plugin or CDN blocking every unfamiliar bot. Our guide to [getting recommended by ChatGPT, Gemini and Perplexity](/blog/get-recommended-by-chatgpt-gemini-perplexity) covers the rest of AI visibility.

| # | Check | How to test | What good looks like |
| --- | --- | --- | --- |
| 43 | Structured data is valid | Rich Results Test | No errors on key page types |
| 44 | Schema matches visible content | Compare markup to the page | Same name, address, hours and prices |
| 45 | hreflang is reciprocal (if used) | Crawler hreflang report | Every version links to every other and back |
| 46 | hreflang has x-default (if used) | View source | Fallback version declared |
| 47 | AI search crawlers not blocked by accident | Read robots.txt; check CDN bot settings | OAI-SearchBot, PerplexityBot and Claude-SearchBot allowed if you want visibility |
| 48 | AI training crawlers set deliberately | Read robots.txt | GPTBot, Google-Extended and ClaudeBot rules reflect your choice |

## How to prioritise your fixes

Even a small site can surface dozens of issues. Score each one by impact and effort rather than fixing them in tool order.

| Issue | Impact | Effort | Priority |
| --- | --- | --- | --- |
| Site-wide noindex or `Disallow: /` | Severe | Minutes | Fix today |
| HTTP and HTTPS both live | High | Low | Fix this week |
| Key pages not indexed | High | Varies | Fix this week |
| Broken internal links to service pages | High | Low | Fix this week |
| Redirect chains after a redesign | Medium | Low | This month |
| Duplicate or missing titles | Medium | Low | This month |
| Poor Core Web Vitals on mobile | Medium | Medium to high | Plan it in |
| Missing alt text | Low to medium | Low | Batch it |
| Missing schema | Medium | Medium | This month |
| hreflang errors | Only if multilingual | Medium | As needed |

Anything stopping Google indexing your money pages comes first, then duplicates and redirects, then on-page polish, then speed and schema.

## A 60-minute audit with free tools

You need Search Console, PageSpeed Insights, the Rich Results Test and a crawler. Screaming Frog's free version crawls up to 500 URLs, plenty for most small sites.

### Minutes 0–10: the basics

Open `/robots.txt` and `/sitemap.xml`. Type the `http://` and non-preferred www versions of your domain and confirm they redirect.

### Minutes 10–25: Search Console

Note each "not indexed" reason in the Page indexing report. Inspect your homepage and top three service pages, confirming the expected canonical. Check your sitemap shows "Success".

### Minutes 25–40: the crawl

Crawl from your homepage. Sort by status code for 404s, 5xx errors and redirects, then check titles, H1s, alt text, noindex and canonicals.

### Minutes 40–50: speed and mobile

Run PageSpeed Insights on mobile for your homepage and one key page. Note Core Web Vitals and the top suggestions, then try both pages on your phone.

### Minutes 50–60: schema, AI and your fix list

Run the Rich Results Test on two key pages and re-read robots.txt for AI crawler rules. Then score every issue by impact and effort and pick the top five.

> Tip: Re-run the audit after any redesign, platform migration or new plugin. Most serious technical problems arrive with a launch.

Growvia's SEO audit automates much of this list: it crawls up to 25 pages, checks titles, redirects, canonicals, schema, images, sitemap and robots.txt, and ranks issues by impact. It also shows PageSpeed and Search Console data alongside. If you're also chasing local customers, pair this audit with our [local SEO checklist](/blog/local-seo-checklist-small-business).

## Frequently asked questions

### How often should a small business run a technical SEO audit?

A full audit every three to six months suits most small sites, with a monthly glance at the Page indexing report. Always audit again after a redesign or domain move.

### What's the difference between a technical SEO audit and a full SEO audit?

A technical audit checks whether search engines can crawl, render and index your site properly. A full SEO audit adds content quality, keyword targeting, backlinks and local signals like your Google Business Profile. Technical issues come first, because they can block every other effort.

### Can I do a technical SEO audit without coding skills?

Yes. Free tools show most problems in plain language. Some fixes, like server speed, may need your developer, but finding the issues doesn't.

### Why is Google showing a different title from the one I wrote?

Google may rewrite title links when your title tag is vague, outdated, stuffed with keywords or doesn't match the page's main heading. Make your title specific, accurate and consistent with your H1. That usually raises the chance Google keeps it.

### Should I block AI crawlers like GPTBot in robots.txt?

It depends on your goal. Blocking training bots such as GPTBot or Google-Extended limits use of your content for model training. Blocking search-type bots such as OAI-SearchBot or PerplexityBot can remove you from AI answers. Most businesses that want customers should keep the search bots allowed.

### Does every 404 error hurt my rankings?

No. A 404 for a page you deliberately removed is normal, and Google simply drops it from the index. The problems are broken links on your own site and removed pages that had backlinks or traffic. Redirect those to the closest relevant live page.
