---
slug: core-web-vitals-explained
title: "Core Web Vitals Explained: How to Make Your Website Faster"
description: Core Web Vitals in plain English: what LCP, INP and CLS mean, how to read PageSpeed Insights, and a prioritised plan to speed up your small business site.
keywords: core web vitals, improve website speed, LCP INP CLS, pagespeed insights, page experience, website speed small business, how to fix INP, core web vitals report
published: 2026-09-15
category: SEO
---
You tap a link, stare at a blank screen, then tap a button that does nothing. Or you press "Call now" and the page jumps, so you hit an ad instead. Most people leave, and your customers do the same on your website.

Core Web Vitals are Google's way of putting numbers on those moments. They measure three things: how fast your main content appears, how quickly the page responds when someone taps, and how much the layout jumps around. Google uses them in its ranking systems, and they are a good proxy for whether visitors stay or go.

This guide explains each metric, how to read Google's free tools, and what actually fixes a slow site, including tips for WordPress, Shopify, Wix and Squarespace. You don't need to be a developer to follow it.

## What Core Web Vitals are, in plain English

Core Web Vitals are three measurements of real visitors' experience on your pages. Google publishes the official definitions and thresholds on [web.dev](https://web.dev/articles/vitals).

- **Largest Contentful Paint (LCP)** measures loading. It is the time until the biggest thing in the visible screen appears. That is usually your hero image, a product photo or a large headline.
- **Interaction to Next Paint (INP)** measures responsiveness. When someone taps a menu, a button or a form field, how long until the screen visibly reacts?
- **Cumulative Layout Shift (CLS)** measures visual stability. It scores how much content moves around unexpectedly while the page loads and is used.

INP is the newest of the three. It officially [replaced First Input Delay (FID) on 12 March 2024](https://web.dev/blog/inp-cwv-march-12). FID only measured the delay before the *first* tap was handled. INP looks at interactions across the whole visit and reports one of the slowest. That makes it a tougher, and fairer, test. Any article still talking about FID is out of date.

### The thresholds: what counts as "good"

Each metric has three bands. Here are the current numbers from Google:

| Metric | What it measures | Good | Needs improvement | Poor |
| --- | --- | --- | --- | --- |
| LCP | Main content loading | 2.5 seconds or less | 2.5 to 4 seconds | Over 4 seconds |
| INP | Response to taps and clicks | 200 milliseconds or less | 200 to 500 milliseconds | Over 500 milliseconds |
| CLS | Unexpected layout movement | 0.1 or less | 0.1 to 0.25 | Over 0.25 |

::scale Largest Contentful Paint (LCP), mobile, 75th percentile | Good: ≤ 2.5 s | Needs improvement: 2.5–4 s | Poor: > 4 s

Two details matter a lot here.

First, Google judges you at the **75th percentile** of page visits. In simple terms, three out of four visits need to be "good". A fast experience for you on office Wi-Fi does not count if a quarter of your visitors are on patchy mobile data.

Second, mobile and desktop are **assessed separately**. It is very common to pass on desktop and fail on mobile. For most small businesses, mobile is where most visitors are, so start there.

> A page passes the Core Web Vitals assessment only when all three metrics are good at the 75th percentile.

## How much Core Web Vitals really matter for rankings

This is where a lot of advice gets exaggerated, so let's stick to what Google actually says.

Google's [page experience documentation](https://developers.google.com/search/docs/appearance/page-experience) states plainly that "Core Web Vitals are used by our ranking systems." So yes, they count.

The same page also says Google "always seeks to show the most relevant content, even if the page experience is sub-par." And it warns that good results in the Core Web Vitals report "doesn't guarantee that your pages will rank at the top."

A fair reading: relevance and helpful content come first, and speed acts more like a tie-breaker between similarly useful pages. The business case is bigger than the ranking case. Every visitor you earn through ads or SEO is wasted if they leave before the page loads. So don't drop content work to chase perfect scores, but don't ignore a "Poor" rating either.

## Field data vs lab data: why your two scores disagree

You run a test and see a scary orange score of 45, yet Google says your page "passed". Both can be true, because they measure different things.

**Field data** comes from real Chrome users visiting your site. Google collects it anonymously in the Chrome User Experience Report, known as **CrUX**. It reflects real phones, real networks and real behaviour, collected over a [rolling 28-day window](https://developers.google.com/speed/docs/insights/v5/about). This is what Google uses for Core Web Vitals in Search.

**Lab data** comes from **Lighthouse**, which loads your page once in a simulated environment. It is great for finding problems, but it is one test with no real taps.

| | Field data (CrUX) | Lab data (Lighthouse) |
| --- | --- | --- |
| Source | Real Chrome visitors | One simulated page load |
| Time period | Trailing 28 days | The moment you run it |
| Used for ranking | Yes | No |
| Measures INP | Yes | No (uses Total Blocking Time as a hint) |
| Best for | Knowing where you stand | Diagnosing why |

The 0–100 "Performance score" is a lab score. It is a useful health check, but it is not a Core Web Vital.

> Use field data to decide *whether* you have a problem. Use lab data to work out *what* is causing it.

## Reading PageSpeed Insights and Search Console

[PageSpeed Insights](https://pagespeed.web.dev/) is free and the best place to start. Paste in a page address, wait a moment, and you get two tabs: **Mobile** and **Desktop**. Check mobile first.

The report has two main parts.

### PageSpeed Insights: the real-user section

At the top you will see "Discover what your real users are experiencing". This is the CrUX field data. You may see two views:

- **This URL** — data for that exact page, if it gets enough traffic.
- **Origin** — data for your whole site combined.

Look for "Core Web Vitals Assessment: Passed" or "Failed", with bars for LCP, INP and CLS below. "No data" means not enough Chrome visitors yet, which is normal for smaller sites. Lean on lab data and real-phone testing instead.

### PageSpeed Insights: the lab diagnosis

Lower down is the Lighthouse test. You get the Performance score plus lab metrics like LCP, CLS and Total Blocking Time.

The useful part is the list of **diagnostics and insights**. These name specific problems, often down to the exact file, such as an oversized image or a heavy script.

Test your most important pages, not just the homepage: a main service page and contact page, or a product and collection page for a shop.

### The Search Console Core Web Vitals report

PageSpeed Insights tests one page at a time. Google Search Console shows the whole site. If you have not set up Search Console yet, it is the first item in our [technical SEO audit checklist](/blog/technical-seo-audit-checklist).

Open **Experience → Core Web Vitals**. The [report](https://support.google.com/webmasters/answer/9205520) uses the same real-user CrUX data. It is split into Mobile and Desktop, and each URL is marked Poor, Need improvement or Good.

A few things to know:

- **URLs are grouped.** Google clusters pages that look and behave alike, such as all your blog posts or all product pages. Fixing the template usually fixes the whole group.
- **The worst metric sets the status.** A group with good LCP and CLS but poor INP is marked Poor.
- **Small sites may see little or nothing.** Without enough traffic, the report can be empty or fall back to site-wide data.
- **Validation takes about four weeks.** After a fix, click "Validate fix". Google then monitors the group over a 28-day period before marking it passed or failed.

## Fixing LCP: getting your main content on screen faster

LCP is the metric most small business sites fail. Google's [LCP optimisation guide](https://web.dev/articles/optimize-lcp) breaks it into four stages: the server response, the delay before the main image starts loading, the download itself, and the final render. Most fixes target one of those.

### Make your hero image light and early

The largest element is usually an image. Common problems are images that are far too large, in old formats, or discovered late by the browser.

- **Resize and compress.** A 4000-pixel photo straight from a camera does not belong in a phone-sized banner. Export it at the size it is shown.
- **Use modern formats** like WebP or AVIF. Most platforms and image plugins can convert automatically.
- **Never lazy-load the main image.** `loading="lazy"` is great for images further down the page. On the hero image it delays LCP every time.
- **Tell the browser it matters.** Adding `fetchpriority="high"` to the hero image asks the browser to fetch it first.
- **Avoid hero images loaded by CSS or JavaScript sliders.** The browser finds a plain image tag much sooner.

### Fix slow hosting and server response

The first stage of LCP is **Time to First Byte (TTFB)**, how long your server takes to start sending the page. If this is slow, nothing else can be fast.

- **Use page caching**, so the server sends a ready-made page instead of building it each visit.
- **Use a CDN** (content delivery network), which serves files from a location near the visitor.
- **Upgrade very cheap shared hosting** if TTFB stays high after caching. It is often the hidden bottleneck.
- **Remove redirect chains.** Each redirect adds a full round trip before the page even starts.

### Clear render-blocking CSS and scripts

Browsers wait for certain CSS and JavaScript files before showing anything. Remove unused plugins and apps, and defer non-essential scripts.

## Fixing INP: making taps and clicks feel instant

INP problems feel like a sluggish site. You tap the menu and nothing happens for half a second. Google's [INP guide](https://web.dev/articles/optimize-inp) explains that the delay comes from three places: waiting for the browser to be free, running the code for that tap, and drawing the update on screen.

The root cause is almost always **too much JavaScript** keeping the phone's processor busy. On a cheaper Android phone, a script that runs fine on your laptop can freeze the page.

### Audit your third-party widgets

For small businesses, the biggest INP offenders are usually tools added over the years:

- Live chat and chatbot widgets
- Multiple analytics and tracking pixels
- Pop-up and "spin to win" tools
- Review, social feed and Instagram embeds
- Heatmap and session-recording scripts
- Several marketing tags firing on every page

Each one adds code that runs on the visitor's phone. List every script and remove the ones that don't earn their keep. Delay the rest: many chat widgets can load after a scroll or a few seconds, and booking or map embeds belong only on pages that need them.

### Lighten heavy themes and page builders

Huge, deeply nested pages take longer to update after each tap. Page builders, mega-menus and big sliders all add work.

### Keep forms snappy

Forms are where INP hurts most, because that is where people convert. Avoid validation scripts that run on every keystroke, and avoid loading several form plugins at once. Our guide to [website contact form best practices](/blog/website-contact-form-best-practices) covers the design side of a fast, simple form.

> If you only do one thing for INP, remove or delay the third-party scripts you don't truly need.

## Fixing CLS: stopping the page from jumping around

Layout shift is the annoying jump when content moves under your thumb. Google's [CLS guide](https://web.dev/articles/optimize-cls) lists a handful of usual suspects, and they are mostly easy to fix.

- **Images and videos without dimensions.** Always include `width` and `height` attributes. The browser then reserves the right space before the image arrives.
- **Ads, embeds and iframes.** YouTube videos, maps, ad slots and social posts often load late and push content down. Reserve their space with a fixed `min-height` or `aspect-ratio` in CSS.
- **Banners injected at the top.** Cookie notices, promo bars and "Download our app" banners that appear above content cause big shifts. Overlay them at the bottom, or reserve their space from the start.
- **Web fonts swapping in.** When a custom font replaces the fallback font, text can reflow. Pick a fallback font with similar sizing, and consider `font-display: optional` for non-critical fonts.
- **Animations that move layout.** Animate with CSS `transform` rather than changing positions like `top` or `margin`.

Shifts within half a second of a user's tap are not counted. An accordion opening on tap is fine; content jumping by itself is not.

## Platform-specific tips

How much you can fix depends a lot on your platform. Here is what usually works on each.

### WordPress

WordPress gives you the most control, and also the most ways to slow things down.

- **Install one good caching plugin**, such as WP Rocket, LiteSpeed Cache or W3 Total Cache. Use one, not several.
- **Add image optimisation**, either built into your caching plugin or via a dedicated image plugin that converts to WebP.
- **Cut plugins.** Deactivate and delete anything unused. Check for plugins that load scripts on every page when you only need them on one.
- **Be wary of heavy page builders and multipurpose themes.** A lighter theme is often the biggest win.
- **Choose hosting with server-level caching** if your TTFB stays high.

### Shopify

Shopify handles hosting and the CDN, so the usual problems are apps and themes.

- **Review your apps.** Many apps inject scripts on every page, and some leave code behind after uninstalling. Check your theme files or ask the app developer to clean up.
- **Use a well-built, current theme.** Shopify's own Online Store 2.0 themes are a solid baseline.
- **Keep hero sliders to one image**, and compress collection and product images before upload.
- **Check the web performance report** in your Shopify admin, which shows real-visitor Core Web Vitals for your store.

### Wix and Squarespace

On hosted builders you can't change server settings or most code, so focus on what you control.

- **Compress images before uploading**, and avoid huge background videos on mobile.
- **Limit third-party embeds** and custom code snippets, which are the main source of slow INP.
- **Keep pages shorter and simpler.** Split very long pages with many galleries and sections.
- **Use the built-in tools.** Wix includes a site speed dashboard with real-user data.

> On hosted builders, every embed and custom code snippet you add is code you can't optimise later. Add them sparingly.

## Mobile on slow networks: why it matters in India

Field data reflects your real visitors. If many customers browse on budget Android phones over mobile data, as is common in India, that is the experience you are graded on. A page that feels quick on office fibre can crawl on a crowded 4G tower. Cheaper phones also have slower processors, which hits INP hardest.

Some practical habits:

- **Test on a real mid-range phone**, using mobile data rather than Wi-Fi.
- **Use the Mobile tab in PageSpeed Insights.** Lighthouse emulates a mid-range phone on a throttled connection, which is closer to reality than your laptop.
- **Treat every kilobyte as a cost.** Smaller images and fewer scripts help most on slow networks.
- **Pick a CDN with locations near your customers**, so files don't travel across the world.

If someone finds you on Google Maps and taps through, a slow page loses them at the last step. Our [local SEO checklist](/blog/local-seo-checklist-small-business) covers the rest of that journey.

## A prioritised fix plan

Not every fix is worth the same. Start at the top of this table and work down. Effort assumes a typical small business site with access to a developer or a confident site owner.

| Fix | Main metric | Effort | Likely impact |
| --- | --- | --- | --- |
| Compress and resize the hero image, use WebP or AVIF | LCP | Low | High |
| Remove `loading="lazy"` from the hero image, add `fetchpriority="high"` | LCP | Low | High |
| Add width and height to all images and embeds | CLS | Low | High |
| Remove unused plugins, apps and tracking scripts | INP, LCP | Low | High |
| Turn on page caching and a CDN | LCP | Low to medium | High |
| Delay chat, pop-up and social widgets until after load | INP | Medium | High |
| Reserve space for ads, banners and cookie notices | CLS | Medium | Medium |
| Limit custom fonts and weights, set sensible fallbacks | LCP, CLS | Medium | Medium |
| Defer non-critical JavaScript and CSS | LCP, INP | Medium | Medium |
| Move to better hosting if TTFB stays slow | LCP | Medium | High (when hosting is the bottleneck) |
| Switch to a lighter theme or rebuild heavy templates | All three | High | High |

Do the low-effort items first and re-test before moving to bigger projects.

## How to verify your improvements

After making changes, check your work in two stages.

1. **Check the lab data straight away.** Clear your cache, then re-run PageSpeed Insights on the changed pages.
2. **Test on a real phone.** Use mobile data, tap the menu and form fields, and watch for jumps.
3. **Start validation in Search Console.** In the Core Web Vitals report, open the affected issue and click "Validate fix".
4. **Wait for the field data to catch up.** CrUX uses a trailing 28-day window, so the real-user numbers shift gradually. Expect around four weeks before you see the full effect.
5. **Keep a simple change log.** Note what you changed and when. If numbers move, you will know why.

Be patient: a fix made yesterday is only one day out of 28 in the data, so don't undo good work too early.

If you want one place to keep an eye on this, the SEO audit in Growvia runs Google PageSpeed on both mobile and desktop and shows real-user Chrome data next to the lab results. That makes it easier to spot when a new plugin or widget has quietly slowed things down.

## Frequently asked questions

### What is a good PageSpeed Insights score?

Google considers a Lighthouse performance score of 90 or above good, and 50 to 89 needs improvement. But that score is lab data and is not used for ranking. The Core Web Vitals assessment at the top of the report, based on real users, matters more.

### Did INP replace FID?

Yes. Interaction to Next Paint replaced First Input Delay as a Core Web Vital on 12 March 2024. INP measures responsiveness across the whole visit, not just the first interaction. A good INP is 200 milliseconds or less.

### How do I fix INP on my website?

Start by removing or delaying third-party scripts such as chat widgets, pop-ups, extra tracking pixels and social embeds. Then simplify heavy themes and page builders, which add work after each tap. If you have a developer, ask them to break up long JavaScript tasks.

### Why does PageSpeed Insights say "No data" for my site?

The real-user section needs enough Chrome visitors to report safely. Smaller or newer sites often don't meet that threshold yet. Use the lab results and test on real phones in the meantime.

### Will fixing Core Web Vitals boost my rankings?

It can help, but it won't override relevance. Google says Core Web Vitals are used in ranking, yet it always tries to show the most relevant content first. Treat speed as one important part of a healthy site, alongside helpful content and good technical SEO such as [schema markup](/blog/schema-markup-for-local-business).

### How long until Google sees my speed improvements?

Lab tools show changes immediately. Real-user data uses a rolling 28-day window, so expect around four weeks for field data and Search Console validation to catch up.

### Should I focus on mobile or desktop first?

Mobile, for most small businesses. The two are assessed separately, and mobile is usually slower. Mobile fixes almost always help desktop too.
