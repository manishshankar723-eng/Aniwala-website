## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

**A CMS change needs `npm run restart` — code changes do not.** Sanity is read
through Astro's content layer, which caches into `.astro/` and is only
re-fetched when the server starts. So editing a component hot-reloads, but
publishing in the Studio, or any script that writes to the dataset, leaves the
dev server serving the content it started with — indefinitely, with no warning.
It looks exactly like the change not having worked. `astro dev status` prints
the uptime; if the server is older than the edit, that is the answer.

## Before pushing

```
npm run verify      # dataset + social card + astro check + build + link check.
                    # Exactly what CI runs.
```

The `deploy` job is gated on `verify`, so a red build never reaches the
server. Do not work around a failing check — they are load bearing:

- **`src/config/urls.ts`** is the allowlist of what an `href` may point at,
  enforced in `src/content.config.ts`. A `javascript:` href is live XSS here,
  because the CSP must carry `script-src 'unsafe-inline'` for Astro's
  pre-paint theme script. Add a scheme deliberately; never widen the scan in
  `scripts/check-links.mjs` to make a build pass. The `/` branch refuses a
  disguised second slash — `/\evil.com` and `/<TAB>/evil.com` both resolve off
  the site.
- **Studio validation is not a security boundary.** `validation:` rules in
  `studio/schemas/` run in the Studio UI only — the Content Lake API ignores
  them, so any write token skips them. Anything that must be true of CMS
  content belongs in `src/content.config.ts`, which runs on every build.

- **The Sanity dataset must stay Private.** A dataset is public on creation,
  and a public one answers unauthenticated GROQ queries — while the project id
  and dataset name sit in every `cdn.sanity.io` image URL on the site. The
  Studio mirror copies form submissions (names, phone numbers, CV links) into
  that dataset, so public + mirror = a public export of every lead and
  applicant, routing around every policy in `supabase/schema.sql`.
  `supabase/functions/_shared/sanity.ts` refuses to mirror into a public
  dataset and `scripts/check-dataset.mjs` fails the build if data is already
  exposed. Do not weaken either to make something pass.
- **`public/.htaccess` carries the CSP**, and it is the only thing standing
  between a CMS string and a loaded third-party frame. Video hosts are named
  there EXACTLY — the R2 bucket in `media-src`, Cloudflare Stream in
  `frame-src` — never as `*.r2.dev`, which would trust every bucket on the
  platform. Widening it is a deliberate act; a blocked video fails silently,
  so the temptation under pressure is to reach for a wildcard.
- **`supabase/schema.sql`** — RLS and the column grants are the only thing
  protecting form data. Read that file's header before changing a policy.
  Section 7 (the Turnstile cutover) is ACTIVE, not commented out: section 4
  still grants anon its insert columns, so a whole-file re-run without
  section 7 silently reopens direct-to-PostgREST inserts and makes Turnstile
  optional. Roll back by running section 4 alone. It also revokes everything
  from `authenticated` — Supabase's default grants include TRUNCATE, which RLS
  does not govern, and the site has no logins.
- **`TURNSTILE_SITE_KEY` is required, not optional.** With anon's INSERT
  revoked, a build without it ships forms that refuse every submission — and
  the build still passes.

- **Anything untrusted that reaches an EMAIL is an output boundary too.**
  `supabase/functions/notify` and `schedule` build HTML out of values a stranger
  typed into a public form: a commenter's `post_slug`, an applicant's
  `portfolio_url`. Every interpolation goes through `esc()` and every URL
  through `safeUrl()`, both in `_shared/util.ts` — `safeUrl` returns null for
  anything that is not plain http(s). Escaping alone is not enough: it stops a
  value breaking out of its attribute and says nothing about where the link
  goes. The moderation email is the one that matters most, because it is read
  by the person about to press Approve.

- **An email sent to an address a stranger chose carries nothing they typed.**
  The booking acknowledgement in `notify` goes out with no human in the loop,
  so it goes to the booker only — no CC — with fixed copy and a parsed time.
  Echoing the name field or CC'ing the guest list made it a way to send
  strangers arbitrary text from the studio's verified domain; escaping does
  nothing about words. Emails that echo input (confirm, decline) are sent only
  after a person presses a button. Timezones from a form go through
  `validTz()` — an unknown zone makes every `Intl` call throw.

- **The mail bill is capped in `notify` (`mailBudget`, default 90/day), NOT by
  the rate limiter.** Past the budget, submissions are saved and mirrored but
  not emailed, with one alert. Do not lower the daily ceilings in
  `schema.sql` section 5 to protect the Resend quota again: a ceiling low
  enough for that let one person with twenty solved captchas close the forms
  for a day. Change a ceiling there and change `DAILY_CEILING` in
  `functions/backup/index.ts` too.

- **Half the security is dashboard state no build checks** — Supabase
  sign-ups disabled, the staging password in hPanel, the fine-grained GitHub
  token in the Sanity webhook, the Hostinger password and 2FA. README →
  *Settings that live outside this repo* lists each one and why. Never print a
  webhook's headers or a token's value while checking one of these: print the
  token TYPE (`github_pat_` / `ghp_`) and nothing else.

- **A media or embed URL from the CMS is checked in CODE, not only by the CSP.**
  `findUnsafeHref` in `src/config/urls.ts` walks keys ending in `href` — that is
  every link on a CMS-built page and no media field at all. So `isSafeMediaSrc`
  guards the hero video, and the host pattern in `src/lib/pieces.ts` guards
  which origin a Cloudflare Stream iframe may load. Match the SUBDOMAIN there,
  never the suffix: `[^/]*cloudflarestream.com` also accepts
  `evilcloudflarestream.com` and — a backslash being a slash inside a URL
  authority — `attacker.example\x.cloudflarestream.com`, which a browser
  resolves to `attacker.example`. The CSP refuses both. It is the backstop, not
  the check.

- **The CSS is inside the document on purpose.**
  `build.inlineStylesheets: 'always'` in `astro.config.mjs`. Putting it back to
  `'auto'` restores the slowest thing this site had. Measured on a PageSpeed
  run of the homepage: the document finished at 511ms and NOTHING painted until
  1230ms. Four `<link rel=stylesheet>` tags were discovered together at 521ms,
  three landed by 673ms, and `Blocks.css` — 8.8KB over the wire — did not
  arrive until 1196ms, having lost one h2 connection to two preloaded fonts and
  a dozen CDN images. First paint followed it by 34ms and LCP followed first
  paint by 99ms. The curtain in `Loader.astro`, the fonts and the GSAP chain
  are all downstream of that and none of them was ever the constraint — the
  page simply had nothing to paint. It is not even a byte trade: the homepage
  document goes 32.1KB to 47.5KB gzipped, against 22.9KB of stylesheet requests
  removed. What it costs is cross-page CSS caching, which this site does not
  need; sessions here start cold.

- **A palette token has a contrast floor, and the social card reads the
  palette.** `--color-ink-faint` was `#61677a` on a `#0b0c10` ground — 3.47:1,
  under the 4.5:1 that the 11.52px footer type needs — and the light theme's
  was worse at 3.38:1. Both are lifted. Do not quieten either one back down
  without measuring it. Separately, `scripts/check-og.mjs` FAILS THE BUILD when
  `public/og-default.jpg` was painted in colours `global.css` no longer uses:
  it parses the first `:root` block, so any palette edit is also a card edit.
  It compares `brand.logoDark` the same way, so a LOGO swap is a card edit
  too — the card is generated by hand and nothing about publishing in the
  Studio regenerates it. Regenerate with
  `npm i --no-save sharp fontkit && node --env-file=.env scripts/generate-og-image.mjs && npm i`
  and commit `public/og-default.jpg` and `scripts/og-source.json` together.

- **`imageUrl` never upscales.** `.fit('max')` in `src/lib/sanity/client.ts`
  makes a requested width a CEILING rather than an instruction. Sanity's
  default fit enlarges a source smaller than the ask, and every width here is
  chosen against a layout rather than against the file — the header mark WAS a
  100x88 upload requested at 320px, which cost 8.9KB to deliver 4.3KB of real
  detail. `iconUrl`, `webpUrl` and `ogImageUrl` set their own fit and must keep
  it: a social card has to be exactly 1200x630 whatever was uploaded, and an
  undersized one is better upscaled than refused by the scraper.

- **`logoDark` and `logoLight` are a PAIR, and nothing checks that they
  differ.** Both held the same file for months — the WordPress crop
  `cropped-Aniwala_W_L-100x88.png`, a white mark with a hairline black
  outline — so the two-image swap in `Header.astro` had nothing to swap and
  light mode showed a ghost. It fails silently in exactly one theme, which is
  the one nobody is looking at. That upload also had the wordmark baked in
  while `showWordmark` drew the name a second time as type; the marks in
  those slots are mark-only for that reason. `scripts/fix-brand-marks.mjs`
  records what was wrong and what replaced it.

- **An uploaded icon in the Studio silently outranks `public/favicon.svg`.**
  With `brand.favicon` set, `getBrand` returns an `icon` and `Base.astro`
  links CDN PNGs; with it EMPTY it links the committed SVG. Only one of those
  can follow the visitor's tab strip — `favicon.svg` carries its own
  `prefers-color-scheme` rule and fills black on a light strip, white on a
  dark one, over no background at all. A PNG is the colour it was exported
  as, on the ground it was exported over, and the ground it had here
  (`#0b0c10`: 11 red, 12 green, 16 BLUE) does not read as near-black at the
  16px a tab renders. It reads as a navy tile, and it was reported as "why is
  the logo blue". So leave the field empty unless an upload can beat a mark
  that repaints itself.

- **The generated icons are opaque, and their two colours are not a free
  choice.** `favicon.ico` and `public/icon-*.png` come out of
  `scripts/generate-icons.mjs`, and a bitmap has no styling layer for a media
  query to attach to — only `favicon.svg` can flip with the theme. So these
  are fixed, and both halves were wrong once: the mark was GOLD, which
  nothing else on the site does (the header, the social card and
  `favicon.svg` all draw it white), and the ground was `#0b0c10`, whose blue
  channel is its largest and which therefore reads as navy at 16px. They are
  `#ffffff` on `#000000` now. Opaque is the part that must not change — iOS
  composites a transparent touch icon onto its own background and it comes
  out looking broken. `favicon.ico` is served `max-age=604800`, so a change
  here takes a week to reach anyone who already has it, on top of the
  browser's own favicon cache; check in a private window, not a hard refresh.

## Accessibility

**`npm run verify` does not check any of this.** It is caught by Lighthouse or
it is not caught. Four rules, each of which was broken once:

- **An ARIA role is a promise about BEHAVIOUR, not a description of a layout.**
  The booking calendar carried `role="grid"` over a flat run of `<button>`s. A
  grid requires `row` children containing `gridcell`s, and it makes a screen
  reader offer arrow-key movement, one tab stop for the whole widget and a
  roving tabindex — none of which existed. It is `role="group"` now, which
  keeps the label and claims nothing about how to move inside it. Half the grid
  pattern is worse than none of it; if it ever wants the real one, the rows,
  the cells and the roving tabindex ship together. This single element was also
  the entire `agentic-browsing` category score, which has only two weighted
  audits.

- **An accessible name must CONTAIN the element's visible text.** The brand
  link's two wordmark spans were adjacent with no whitespace, so its text
  content was `ANIWALAStudios` — a run-together nothing shows on screen,
  because `.brand-text` is a flex column and the gap between the lines is
  layout rather than text. The `aria-label` said "Aniwala Studios — home",
  which does not contain `aniwalastudios`. The cost is voice control: "click
  Aniwala Studios" has to hit the thing that visibly says it. The `{' '}`
  between those spans is load bearing, and it works because a whitespace-only
  run between flex items is not rendered.

- **24x24 CSS pixels is the floor for anything clickable.** The header's caret
  button was 23.2px wide — eight tenths of a pixel short, which is exactly the
  kind of miss that survives every review until something measures it. Widen a
  small target INTO its own padding rather than toward its neighbour: the same
  audit also fails a target that is large enough but sits too close to the next
  one, so growing it the wrong way trades one failure for another.

- **Contrast is a token-level question, not a component-level one.** The footer
  is where PageSpeed caught `--color-ink-faint`; it was not where the problem
  was. `src/pages/schedule.astro` and `src/pages/moderate.astro` hardcode their
  own palette deliberately — they render out of an email with no CMS and no
  stylesheet behind them — so they inherit no token fix and had to be lifted by
  hand. They are the two files to re-check whenever a text colour moves.

## Scroll

**Where a page starts is ScrollTrigger's decision, not Astro's.** Every internal
link is a `ClientRouter` swap, and the router does its part: it scrolls to the
top at `moveToLocation`, about 100ms in, and a trace shows the new page still at
0 through `astro:after-swap` and `astro:page-load`. Then, half a second later,
the `ScrollTrigger.refresh()` in `initMotion` put the PREVIOUS page's offset
back. Every link followed from halfway down a page opened the next one halfway
down; it was reported as "the privacy policy opens at the footer", and it was
never an Astro bug.

- **Two pieces of ScrollTrigger state survive the swap, and clearing either one
  alone changes NOTHING.** `refresh()` reverts pins to measure them, which moves
  the page, so it records the offset first and puts it back after — right inside
  one document, a different document's number after a swap. That record is taken
  from a CACHED scroll value, and `clearScrollMemory()` does not invalidate the
  cache: it bumps the global counter and the entry's own counter together, so
  they stay level, the cache still reads clean, and it is holding the old page's
  number. So `teardownMotion` writes the real position through
  `ScrollTrigger.getScrollFunc(window)` FIRST and clears the memory SECOND. Both
  lines, in that order. The first attempt at this did only the second and
  measured as having changed nothing at all.

- **Do not reach for a scroll-to-top on `astro:after-swap` instead.** It looks
  like the obvious one-liner and it breaks two things that currently work: back
  and forward have to restore the offset the visitor left, and a link to
  `/contact/#book` has to land on the widget rather than at the top. Both are
  downstream of the same teardown — on a back/forward the router restores the
  old offset before `initMotion` runs, so the same two lines record THAT.

- **`npm run verify` does not check any of this**, the same as Accessibility
  above. It takes a real browser: load a page, scroll it with the WHEEL, click
  an internal link, and read `scrollY` about four seconds later. Scrolling with
  `window.scrollTo` in a test is not a reproduction — a programmatic jump can
  leave the cache in step and hide the bug, which makes it easy to call
  something fixed when it is not.

- **The GSAP ticker callback is removed on teardown, and that is a leak, not a
  feel.** `gsap.ticker.add` had no matching `remove`, so it piled up one
  callback per navigation forever. It does NOT stiffen scrolling, tempting as
  that guess is: Lenis advances by `time - this.time`, so the second and later
  calls in a frame carry a timestamp it has already seen and advance by zero.
  Measured against the live site before the fix — 142-158 frames to settle a
  wheel cold, 151 after five swaps. Do not go looking for a scroll symptom here.

## Video

**Every autoplaying video goes through `src/lib/video.ts`**, booted from
`Base.astro` on `astro:page-load`, and is marked either `data-video="silent"`
(a hero or band — decoration) or `data-video="player"` (a portfolio tile). A
`<video>` added anywhere without one of those attributes is outside the rule
and will drift.

- **Nothing ever starts making noise.** A silent video has `muted` re-applied
  on every `volumechange`, so the attribute is a guarantee, not a starting
  state. A tile starts muted on EVERY arrival — a browser restores the volume a
  visitor left behind — and only one tile may hold audio at a time. The
  `heroBlock.sound` and `piece.sound` fields that used to bargain over this are
  deleted from `studio/schemas/` and cleared from the dataset by
  `scripts/unset-sound.mjs`. Do not add them back; the argument is in the
  comments where each one used to be.

- **Do not start playback from an inline script in a component.**
  `ClientRouter` does not re-run an inline script that has already executed, so
  the hero played on the first arrival and came back from every other page
  frozen on its poster, with no error. That is what `video.ts` replaced. It
  re-asks whether a video should be playing on `astro:page-load`, `pageshow`
  (bfcache), `visibilitychange` and the media events — one `load()` retry
  covers a stalled CDN range request, which fires no error and waits forever.

- **`preload="auto"` is not a fix for a slow start.** A media element delays the
  window `load` event until its preload level is satisfied, and the first-load
  curtain in `Loader.astro` lifts on `load` — so raising it trades a frozen
  video for a longer black screen. Both heroes stay on `metadata` deliberately.

- **Reduced motion is handled in `video.ts`, not in CSS.** `autoplay` has
  already fired by the time a media query could apply. A visitor who presses
  play on a tile has asked for the motion, and that one keeps running.

- **A video's poster is produced, not remembered.** The Studio drop zone offers
  a frame after every upload (`options: { posterField: '<sibling image field>' }`
  on the video field turns it on) and `upload-r2.mjs` writes one beside the
  source. The frame is picked by luma CONTRAST across the opening, never frame
  0 — graded work opens on black, and a poster grabbed from frame 0 is the
  black rectangle the poster exists to prevent. It is a floor, not a judgement:
  the scrubber and `--poster-at=` are the expected second step.

- **The hero's still is a field on the hero block**, not an `artwork` slot. The
  slot indirection is what let the still and the video drift apart — swapping
  one left the other in a document nobody opened. `posterSlot` is read as a
  fallback and hides itself on heroes that do not use it; do not file anything
  new that way.

- **A hero loop is a SIZE budget, and it has already regressed once.** The
  README works through the 16.5MB original that was cut down to a 24s, 1.26MB
  loop, and the Studio's field note says to stay under about 5MB. The homepage
  hero is currently `video/pieces/new-video-2d49a7833b4b45a1.mp4`, and it is
  1280x720, silent, faststart correct, keyframed every 0.8s, with CRF doing its
  job at 512kbps — every part of the recipe followed except one. It is **96
  seconds long, so 6.16MB**, which is 93% of the whole page's weight. Duration
  is the only lever that matters here: halving 60fps to 30 saves 12%, while
  trimming to 20s saves 79%. The 1.26MB loop is still in the bucket at
  `video/krazzy-4-hero-loop-720-09d7ed28.mp4`, one paste away. Check the LENGTH
  of anything going into a hero's Background video field — nothing in the build
  does, and a long loop fails silently by simply being slow.

- **A poster and the frame the video opens on must match, or be crossfaded.**
  The `poster` attribute is swapped for the first decoded frame instantly and
  unfaded, so a better still can make the snap worse rather than better.
  `upload-r2.mjs --start=<seconds>` trims the front and takes the poster from
  the result at t=0 (same bytes, invisible handover); `lib/video.ts` fades each
  video in over the still behind it as the general case. Each component owns
  the opacity it fades TO — the page-hero band is `0.38`, and a global "fade to
  1" there would turn the band into a video.

## The Studio

`studio/` is a separate npm package (Sanity v6, React 19, Node ≥ 22.12). The
site ships no React. `studio/package.json` has an `overrides` block with a
comment explaining why one pin must **not** be moved to the next major.

**A push does not deploy the Studio.** `.github/workflows/deploy.yml` builds and
ships the website only; neither of its jobs touches `studio/`. A change under
`studio/schemas/` or `studio/components/` is live only after
`cd studio && npm run deploy`. So one change can have three halves that ship
three ways — site code by push, Studio code by `npm run deploy`, content by
Publish or a dataset script — and it is easy to finish one and report all three.
Say which halves are done.

- **The deploy is gated by `npm run check`** (`studio/scripts/check-schema.mjs`),
  which catches an unregistered type or an undefined field group — both compile
  under `sanity build` and then take the whole Studio down at runtime. The root
  `npm run verify` does NOT type-check the Studio; run
  `cd studio && npx tsc --noEmit` as well.
- **Verify a deploy from `studio/dist`, not from memory.** It is exactly what was
  uploaded. `find studio/schemas studio/components -newer studio/dist/index.html`
  empty means nothing changed since; `grep -rl "<string>" studio/dist` confirms a
  specific change shipped.
- **Deleting a schema field does not delete its data.** The values stay in the
  Content Lake and the Studio renders them as unknown-field warnings, whose
  obvious "fix" is to put the field back. Clear them with a script that covers
  `drafts.*` too — a draft is its own document, and `scripts/unset-sound.mjs` is
  the pattern: dry run, one transaction, patch array members by `_key`, never
  by index.
- **A custom option on a field needs declaration merging**, not a cast. Sanity's
  `StringOptions` is a closed type; `posterField` is added with
  `declare module 'sanity'` in `components/R2VideoInput.tsx`, beside the code
  that reads it, so a misspelt option in a schema is a type error rather than a
  panel that silently never appears.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
