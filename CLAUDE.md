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
npm run verify      # dataset check + astro check + build + link check.
                    # Exactly what CI runs.
```

The `deploy` job is gated on `verify`, so a red build never reaches the
server. Do not work around a failing check — they are load bearing:

- **`src/config/urls.ts`** is the allowlist of what an `href` may point at,
  enforced in `src/content.config.ts`. A `javascript:` href is live XSS here,
  because the CSP must carry `script-src 'unsafe-inline'` for Astro's
  pre-paint theme script. Add a scheme deliberately; never widen the scan in
  `scripts/check-links.mjs` to make a build pass.
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

- **Anything untrusted that reaches an EMAIL is an output boundary too.**
  `supabase/functions/notify` and `schedule` build HTML out of values a stranger
  typed into a public form: a commenter's `post_slug`, an applicant's
  `portfolio_url`. Every interpolation goes through `esc()` and every URL
  through `safeUrl()`, both in `_shared/util.ts` — `safeUrl` returns null for
  anything that is not plain http(s). Escaping alone is not enough: it stops a
  value breaking out of its attribute and says nothing about where the link
  goes. The moderation email is the one that matters most, because it is read
  by the person about to press Approve.

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

## The Studio

`studio/` is a separate npm package (Sanity v6, React 19, Node ≥ 22.12). The
site ships no React. `studio/package.json` has an `overrides` block with a
comment explaining why one pin must **not** be moved to the next major.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
