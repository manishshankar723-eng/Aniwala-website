# Aniwala

Animation studio site. Astro (static) + GSAP/Lenis, deployed to
Hostinger shared hosting over SSH by GitHub Actions.

## Running the site locally

In VS Code: **Ctrl+Shift+P → Tasks: Run Task**, then pick one.

| Task | npm equivalent | What it does |
| --- | --- | --- |
| Start website | `npm start` | Starts the dev server in the background at http://localhost:4321 |
| Stop website | `npm stop` | Shuts it down |
| Restart website | `npm run restart` | Stop then start. Needed after editing `astro.config.mjs` |
| Website status | `npm run status` | Whether it's running, the port, the pid, the uptime |
| Website logs | `npm run logs` | Tail the background server's output |
| Build for production | `npm run build` | Builds to `./dist` — exactly what gets uploaded to Hostinger |

Background mode means the server keeps running after you close the terminal —
so use **Stop website**, not Ctrl+C, to shut it down. Both start and stop are
safe to run twice: starting an already-running server just reports the existing
one, and stopping nothing exits cleanly rather than erroring.

`npm run dev` still exists and runs the server in the foreground, tied to that
terminal. Use it only if you want the logs streaming in front of you.

| Other | What it does |
| --- | --- |
| `npm run preview` | Serves the built `./dist` locally to check the real build |

## How a change goes live

Two ways in, one way out.

**A code change** — push to `main`.
**A content change** — hit Publish in the Studio at
<https://aniwala.com/admin>. That redirects to `aniwala.sanity.studio`, which
Sanity now redirects onward to `https://www.sanity.io/@<org>/studio/<id>` —
hosted Studios moved. The bookmark still works; the origin the browser ends up
on is different, which matters for one thing only, and it is under *Video*.

Either one triggers the same GitHub Actions workflow: it type-checks, builds,
checks every internal link, and only then `rsync`s `dist/` over SSH into
`public_html`. Live in roughly 90 seconds. Watch it in the repo's **Actions**
tab.

The `deploy` job is gated on `needs: verify`, so a build that fails any of
those checks never reaches the server — the previous version keeps serving.
That is the safety net behind everything in *What the build refuses to ship*
below.

The content path works because a webhook on the Sanity project POSTs a
`repository_dispatch` event to GitHub when a document is published. Without
that webhook, publishing changes the database and nothing else — the site is
static and would carry on serving the previous build. If an editor says
"I published it and nothing happened", check the webhook first.

Hostinger runs PHP, not Node — it only ever receives finished HTML.
Never point the workflow at a Node runtime; there isn't one on this plan.

### The third way in: a change to the Studio itself

**Pushing does not deploy the Studio.** The workflow above has two jobs,
`verify` and `deploy`, and neither touches `studio/` — it builds and ships the
*website*. The Studio is a separate npm package hosted by Sanity, and the only
thing that updates it is:

```bash
cd studio
npm run deploy      # check-schema.mjs, then sanity build + sanity deploy
```

So a single change can have up to three halves that ship three different ways,
and it is easy to finish one and believe you finished all of them:

| What changed | How it ships | Covered by `git push`? |
| --- | --- | --- |
| Website code — `src/`, `public/`, `scripts/` | push to `main` → Actions → Hostinger | yes |
| Studio code — `studio/schemas/`, `studio/components/` | `cd studio && npm run deploy` | **no** |
| Content — documents, images, field values | Publish, or a script writing to the dataset | n/a — it is already live |

**What skipping the Studio half looks like.** Nothing breaks on the website —
it reads the dataset over GROQ and never loads a Studio schema. Instead the
hosted Studio keeps serving its *old* bundle, so editors keep seeing fields
that no longer do anything, and miss fields that now exist. When the two sound
fields were deleted, a Studio left undeployed would still have offered **Play
with sound** on the homepage hero: ticking it would write `sound: true` back
into the dataset, and the site would ignore it. Confusing rather than
dangerous — which is exactly the kind of mismatch that gets a "fix" attempted
later.

**The deploy is gated.** `npm run deploy` runs `studio/scripts/check-schema.mjs`
first, which fails on a reference to an unregistered type or an undefined field
group — two faults `sanity build` compiles happily and that then take the whole
Studio down at runtime. The Studio package is also type-checked separately
(`cd studio && npx tsc --noEmit`); `npm run verify` at the repo root does not
cover it.

**Is the deployed Studio current?** `studio/dist` is exactly what the last
deploy uploaded, so two checks answer it without logging in:

```bash
# 1. Is any Studio source newer than the last build?
find studio/schemas studio/components -newer studio/dist/index.html

# 2. Is a specific change actually in the uploaded bundle?
grep -rl "Poster frame" studio/dist
```

Empty output from the first means nothing has changed since the deploy. After
deploying, editors with the Studio already open should hard-reload
(Ctrl+Shift+R) to drop the cached bundle.

### Live on aniwala.com

**The cutover happened on 14 September 2026.** `aniwala.com` serves this build
from `public_html/`; the WordPress install is gone. `staging.aniwala.com` is
the last staging build, frozen inside `public_html/staging/` (the deploy's
rsync excludes that folder) and **behind a password** set in hPanel → Advanced
→ Password Protect Directories. The rule lives in the staging folder's own
`.htaccess`, so deploys never touch it — re-checked after a deploy on
15 September 2026: both `aniwala.com/staging/` and `staging.aniwala.com` answer
401.

The list below was the cutover checklist. Every item still describes
something that breaks silently if it drifts, so it stays.

- **`SITE_URL` on the Edge Functions.** It is the origin `submit`, `moderate`
  and `schedule` will accept, *and* it builds the Approve/Reject and
  Confirm/Decline links in every notification email. Left on staging after
  cutover, every form on the live site gets `{"error":"Forbidden"}` and every
  email button points at the wrong host. Either move it, or name both while the
  transition is in flight:
  ```bash
  supabase secrets set SITE_URL=https://aniwala.com --project-ref <ref>
  supabase secrets set EXTRA_ORIGINS=https://staging.aniwala.com --project-ref <ref>
  ```
- **Turnstile's hostname list**, at dash.cloudflare.com. Separate from
  everything above, and a missing host is error `110200`: the widget renders
  nothing, issues no token, and the form asks the visitor to complete a check
  that is not on the page.
- **`TURNSTILE_SITE_KEY` in the GitHub Actions secrets**, not only in `.env`. A
  production build without it falls back to posting directly to PostgREST under
  the anon key — and that door is **closed**: section 7 of `supabase/schema.sql`
  has been run, so such a build ships three forms that fail every submission.
- **The CSP travels with the build.** `public/.htaccess` is copied into `dist/`,
  so every header under *Headers* below starts applying the moment `dist/`
  reaches `public_html`. Confirm them against the live host afterwards; on
  WordPress none of them are in effect.
- **The staging safety net stops applying.** `.htaccess` sets
  `X-Robots-Tag: noindex, nofollow` on every hostname that is not
  `aniwala.com`, which is what keeps staging out of the index. On the canonical
  host it is never sent — so the live site becomes indexable by that change
  alone. That is the intent; just know it is the switch.

## One-time setup

1. **hPanel → Advanced → SSH Access** — make sure SSH status is **Active**,
   and note the IP, port and username. Generate a deploy keypair
   (`ssh-keygen -t ed25519 -f deploy_key -N ""`) and paste the **public**
   half (`deploy_key.pub`) into the **SSH keys** section on that page.
2. **GitHub → Settings → Secrets and variables → Actions** — add
   `SSH_HOST`, `SSH_USER`, `SSH_PORT`, and `SSH_KEY`.

   `SSH_KEY` is the **private** half. Store it base64-encoded — one line, no
   internal whitespace:

   ```bash
   base64 -w 0 < deploy_key
   ```

   The workflow accepts raw PEM too, but base64 is immune to the copy-paste
   mangling that raw PEM is not: copying a key on Windows rewrites LF to
   CRLF, and OpenSSH then rejects the file with `error in libcrypto`
   followed by `Permission denied (publickey)` — which reads like the server
   refused a good key and sends you to check the panel, where everything is
   fine. Delete the local `deploy_key` files once both halves are in place.

   Deploys are authenticated by the server's **host key**, pinned in
   `.github/workflows/deploy.yml`. If the server is ever rebuilt, that pin
   fails the deploy on purpose — find out why the identity changed before
   updating it, and never replace it with a fresh `ssh-keyscan`.

3. **hPanel → Websites → aniwala.com → Security → SSL** — install the free
   certificate and enable Force HTTPS.
4. **Sanity** — see *Setting up the CMS* below. The build needs
   `SANITY_PROJECT_ID` and `SANITY_DATASET` as GitHub Actions secrets, or it
   produces a site with no blog, no case studies and no jobs.
5. **Supabase** — see *Setting up Supabase* below. `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` go in `.env` locally and as GitHub Actions secrets for
   the deploy. Without them the booking, application and comment forms render
   but refuse to submit.

## Layout

```
src/
├── components/          Header, Footer, PageHero, PostCard, Faq, CtaBand...
│   └── blocks/          One component per page-builder section type
├── config/              Things that are code, not content
│   ├── site.ts          Supabase + Turnstile keys, studio timezone
│   ├── urls.ts          What an href may point at. A security boundary.
│   ├── nav.ts           The SHAPE of a nav entry — the menus live in Sanity
│   ├── copyFields.ts    The ~200 interface-copy field names. One list.
│   ├── fonts.ts         The typefaces an editor may pick, and the type roles
│   ├── contact.ts       Social icon names
│   ├── disciplines.ts   Portfolio disciplines and employment kinds
│   ├── careers.ts       Career page types
│   └── imageSlots.ts / pageSlots.ts   Named artwork + page-builder slots
├── content.config.ts    Zod schemas every CMS document must pass. The gate.
├── integrations/
│   └── redirects.mjs    Writes the CMS's redirects into dist/.htaccess
├── layouts/Base.astro   Shell: SEO meta, fonts, view transitions, motion + video boot
├── lib/
│   ├── sanity/          client.ts, loader.ts, portableText.ts
│   ├── studio.ts        Every CMS accessor the templates call
│   ├── motion.ts        Lenis + GSAP/ScrollTrigger, lazily imported
│   ├── video.ts         Every autoplaying video: kept playing, kept silent
│   ├── copy.ts          Token substitution, ldJson, inlineHtml escaping
│   ├── supabase.ts      Minimal PostgREST client (no SDK)
│   ├── submit.ts        One path for all three forms; picks Turnstile or not
│   └── searchDocs.ts    Builds the search index, served as /search.json
├── pages/               Every file here becomes a route
└── styles/global.css    Reset, @font-face, and ALL design tokens
scripts/
├── check-links.mjs      Fails CI on a broken link, missing asset or scripted href
├── check-dataset.mjs    Fails CI if the dataset answers a stranger's query
├── build-preview.mjs    A build that shows unpublished drafts
├── upload-r2.mjs        Puts a file in R2. Strips audio, writes a poster, --start trims
├── unset-sound.mjs      One-off: clears the deleted `sound` fields from the dataset
├── r2-cors.mjs          The bucket's CORS policy, so the Studio may upload
├── generate-icons.mjs   Favicon/apple-touch/PWA PNGs from the mark
└── generate-og-image.mjs  The social card. Run by hand, output committed
public/
├── .htaccess            HTTPS, canonical host, caching, security headers, CSP
├── fonts/               Self-hosted woff2 — no third-party font request
├── og-default.jpg       Social card (generated)
└── robots.txt
supabase/
├── schema.sql           Tables, RLS policies, column grants, rate limiter
├── mirror-events.sql    One-time: webhooks fire on UPDATE and DELETE too
└── functions/           submit, notify, moderate, schedule, sign-upload (Deno)
studio/                  The Sanity Studio. A separate npm package, deployed separately.
```

## Checks

```bash
npm run verify        # dataset check + astro check + build + link check. What CI runs.
npm run check         # types and templates only
npm run check:links   # needs an existing dist/
npm run check:dataset # asks Sanity, with no credentials, what a stranger can read
```

`scripts/check-links.mjs` crawls `dist/` and fails on any internal `href`,
`src` or `content` URL that does not resolve to a file. It exists because a
static build will happily emit a link to a page nobody wrote: the announcement
bar pointed at a non-existent `/ai-animation/` on all 64 pages, and `og:image`
pointed at a missing file on all 64, and both survived a clean build.

It also fails on any `href` with a `javascript:`, `data:` or `vbscript:`
scheme. That is a separate scan on purpose — such a URL is not a path, so the
resolver has nothing to look up and it would otherwise sail through as "not
our problem". See *Security* below for why it very much is.

## Security

### Where the boundaries actually are

Three rules that are easy to get backwards:

**Studio validation is not a boundary.** The `validation:` rules in
`studio/schemas/` run in the Studio UI only. The Content Lake API does not
enforce them, so anything holding a write token skips every one. They stop
typos, not attackers.

**`src/content.config.ts` is the boundary.** Those Zod schemas run on every
build, against every document, whatever wrote it — and a failure fails the
build before the deploy job can run. Anything that must be true of CMS
content belongs there, not only in the Studio schema.

**`supabase/schema.sql` is the boundary for form data.** The anon key is
public by design; Row Level Security and the column grants are the only thing
protecting enquiries, applications and comments. Read the header of that file
before changing any policy in it.

**And the Sanity dataset must be Private, or that boundary has a way around
it.** A Sanity dataset is public or private, and a new one is **public** —
meaning an unauthenticated GROQ query from anywhere on the internet is
answered in full. The address is not secret and cannot be made secret: every
CMS image on the site is served from
`cdn.sanity.io/images/<projectId>/<dataset>/...`, so the project id and the
dataset name are in the HTML of every page.

For website content that is fine — it is published anyway. It stops being
fine the moment the Studio mirror is switched on, because `notify` then copies
every enquiry, booking, **job application** (name, phone number, CV link) and
comment into that same dataset. Every policy and grant in `schema.sql` still
holds, and none of them reach a second copy living in another vendor's
database with no access control on it.

Two things enforce this now, and neither replaces setting the dataset to
Private:

- `supabase/functions/_shared/sanity.ts` asks Sanity's management API for the
  dataset's `aclMode` before every write and refuses to mirror unless it is
  `private`. It fails safe — anything short of a definite "private" counts as
  unsafe. Deletes are deliberately exempt, because a delete only ever removes
  personal data.
- `scripts/check-dataset.mjs` runs first in `npm run verify` and in CI. A
  public dataset with submissions in it **fails the build**; a public dataset
  with none is a warning.

To close it properly: confirm `SANITY_READ_TOKEN` is a GitHub Actions secret
(a private dataset is what makes the build need it), then sanity.io/manage →
API → Datasets → **Private**, then confirm CMS images still render.

### Two boundaries the build does not cover

Neither of these is `content.config.ts`, so nothing fails a build when one is
wrong.

**Email is an output boundary.** `notify` and `schedule` assemble HTML from
values a stranger typed into a public form. Every interpolation goes through
`esc()` and every URL through `safeUrl()`, both in
`supabase/functions/_shared/util.ts`; `safeUrl` returns null for anything that
is not plain http(s), so a `javascript:` portfolio link renders as no link at
all. Escaping alone was never enough — it stops a value breaking out of its
attribute and says nothing about where the link points. The moderation email
is the one that matters most: it is read by the person about to press Approve,
so a link in it that goes somewhere unexpected is worth more to an attacker
than one on the public site.

**An email that goes to an address a stranger chose carries nothing that
stranger typed.** Escaping stops markup and does nothing about words. The
booking acknowledgement is sent the moment a public form is submitted, with no
person in between, so it goes to the booker only — no CC — with fixed copy and
a time parsed out of validated columns. It used to CC up to ten guests and
repeat the name and topic back, which let anyone send ten strangers a message
of their own from the studio's verified domain. Emails that repeat a
stranger's words (the confirmation, the decline) are sent only after a person
at the studio has read the request and pressed a button. Keep it that way.

**A timezone from a form is validated before it is used.** `visitor_tz` is free
text, and an unknown zone makes every `Intl` date call throw. `validTz()` in
`_shared/util.ts` falls back to the studio's zone; without it one bad value
stopped the booking notification from being sent at all.

**The mail bill is capped in `notify`, not by the rate limiter.** See
the rate-limiting part of *Setting up Supabase* — the short version is that a
database ceiling low enough to protect a free Resend tier was low enough for
one person with twenty solved captchas to close the forms for a day.

**A media or embed URL is checked in code, not only by the CSP.**
`findUnsafeHref` walks keys ending in `href` — every link on a CMS-built page,
and no media field. So `isSafeMediaSrc` in `src/config/urls.ts` guards the hero
video, and the host pattern in `src/lib/pieces.ts` guards which origin a
Cloudflare Stream iframe may load from. Match the **subdomain** there, never
the suffix: `[^/]*cloudflarestream\.com` also accepts
`evilcloudflarestream.com`, and — because a backslash is a slash inside a URL
authority — `attacker.example\x.cloudflarestream.com`, which a browser resolves
to `attacker.example`. The CSP refuses both, which is why neither was ever a
live hole. It is the backstop, not the check.

### What the build refuses to ship

CI fails, and the deploy never runs, if:

- a **required singleton** is missing — `siteCopy`, `contactDetails`,
  `navigation`, `careersContent`, `bookingSettings`, `uiCopy`, `privacyPage`
- the **menu is empty**, a built page has **no sections**, or the privacy
  policy has **no body**
- any **`href` is not on the allowlist** in `src/config/urls.ts`
- an internal **link or asset does not resolve**
- a **redirect** would hide a real page, duplicate another, or chain
- **`dist/.htaccess` is missing** from the build
- the **CMS dataset is public and has form submissions in it** — personal
  data being served to anonymous callers

### Why `href` is checked at all

Astro escapes attribute values, so a CMS string cannot break out of its
quotes. That is not enough: `javascript:...` is a perfectly well-formed
attribute value that runs on click, and the site's CSP carries
`script-src 'unsafe-inline'` — required for Astro's pre-paint theme script —
which is exactly what permits it.

So `src/config/urls.ts` holds one allowlist (`https? mailto: tel: / #`),
enforced in `content.config.ts` for every href-bearing field, including the
`.passthrough()` page-builder blocks, which are walked for any key ending in
`href`. `scripts/check-links.mjs` is the backstop for anything reaching the
HTML another way. Add to the allowlist deliberately; never widen the backstop
to make a build pass.

A path must not start with a **second slash in disguise**. `//evil.com` is an
absolute URL on another site, and so are `/\evil.com` (a browser reads `\` as
`/`) and `/` + tab + `/evil.com` (a browser deletes tabs and newlines before
parsing). The `/` branch of the allowlist refuses all three. None of them runs
a script; each is a link off the site that reads as a path in the Studio.

`z.url()` is **not** a substitute — it accepts `javascript:alert(1)` and
`data:text/html,...` as valid URLs.

### Headers

`public/.htaccess` carries HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` and the CSP. The deploy asserts they
are actually live afterwards rather than trusting the upload — a site serving
every page perfectly with no headers at all looks completely healthy, and has
happened here before.

`connect-src` names the Supabase project explicitly. **If the Supabase project
ever changes, change it there too** — the failure is silent and total: every
form gets a CSP violation in the console and nothing else.

Two directives carry the video hosts, and both name them **exactly** rather
than by wildcard:

- `media-src` — the R2 bucket, for the hero loop and any portfolio piece with
  an uploaded or linked file. `pub-<id>.r2.dev` is a per-bucket subdomain, so
  `*.r2.dev` would trust every bucket on the platform, including one an
  attacker can create in a minute.
- `frame-src` — `*.cloudflarestream.com` and `iframe.videodelivery.net`, for a
  piece using Cloudflare Stream. The wildcard is on the subdomain only,
  because a Stream embed lives at `customer-<code>.cloudflarestream.com` and
  the code is per-account. Nothing else is needed for Stream: the player's own
  requests are governed by the policy *inside* that frame, not this one.

**If the bucket moves to a custom domain, change `media-src` too.** The
failure is silent in the way that costs the most time: the hero shows its
poster still and never moves, which reads as "the video did not upload"
rather than "the policy is stale".

### Secrets

Public by design, and fine in the bundle: `SANITY_PROJECT_ID`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TURNSTILE_SITE_KEY`.

Never in this repo or the bundle: the Supabase **service role** key,
`TURNSTILE_SECRET_KEY`, `MODERATION_SECRET`, `NOTIFY_SECRET`, any Sanity
**write** token, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Those live on the Edge Functions (`supabase secrets set`) or
in GitHub Actions secrets.

`SANITY_READ_TOKEN` should be a **Viewer** token. It only ever needs to read
drafts for previews, and a Viewer token cannot alter the site if it leaks.

### Settings that live outside this repo

Half of this site's security is dashboard state that no build checks and no
diff shows. It was last reviewed on **15 September 2026**; each line says what
must stay true and why. Re-check them after anyone new gets access to an
account, and whenever something here stops working.

**Supabase**

- **Email sign-ups are disabled** (Authentication → Sign In / Providers →
  "Allow new users to sign up" off). The site has no logins. An open sign-up
  hands anybody an `authenticated` JWT for no purpose. Verify from outside:
  `curl -H "apikey: <anon key>" https://<ref>.supabase.co/auth/v1/settings`
  shows `"disable_signup":true`.
- **`authenticated` holds no grants on the three form tables** — section 4 of
  `schema.sql` revokes them. Supabase grants every `public` table to that role
  by default, including TRUNCATE, which RLS does not govern.
- **anon has no INSERT** — section 7 of `schema.sql`, now active in the file
  so a re-run cannot reopen it. All three forms go through `submit`.
- **`MAIL_DAILY_BUDGET`** (Edge Function secret, default 90) caps the emails
  `notify` sends in 24 hours. Raise it if the Resend plan is upgraded.

**Hostinger**

- **SSH accepts a password and cannot be made key-only** on this shared plan,
  and the account's username, server address and port are public in this
  repository's git history. So the FTP/SSH password (hPanel → Files → Change
  Password) is a long random string held only in a password manager — it was
  rotated on 15 September 2026, because the old one had crossed the network
  unencrypted in early FTP deploys. Deploys never use it; they use the SSH key.
- **hPanel login has two-factor authentication on.** The hPanel login can
  reset that password, open the File Manager and change DNS — it is the key
  above every other key here.
- **Exactly one SSH key** under Advanced → SSH Access: the deploy key,
  `SHA256:4xradlDr6q9YvzUPPEmGQM8IqDaLPMu2apfjXU7vQQY` (also printed by every
  deploy run).
- **No additional FTP accounts** (Files → FTP Accounts). The "Create a new FTP
  account" form on that page makes another login with write access to
  `public_html` — it is not where the password is changed.
- **`public_html/staging` is password protected** (Advanced → Password Protect
  Directories). It is a frozen build whose forms still write to the live
  database. Both addresses must answer 401.

**GitHub**

- **The Sanity publish webhook uses a fine-grained token** created on the
  account that owns the repository, scoped to this repository only, with
  Contents: Read and write, and a one-year expiry. When it expires, publishing
  in the Studio silently stops deploying — set a reminder. No classic token
  should exist for this purpose. A Sanity API token with Editor rights can
  read webhook headers, which is exactly why this one must be narrow.
- **Repository secrets are exactly what the workflows read**: `BACKUP_*`,
  `GA_MEASUREMENT_ID`, `SANITY_DATASET`, `SANITY_PROJECT_ID`,
  `SANITY_READ_TOKEN`, `SSH_HOST`, `SSH_KEY`, `SSH_PORT`, `SSH_USER`,
  `SUPABASE_ANON_KEY`, `SUPABASE_URL`, `TURNSTILE_SITE_KEY`. The old `FTP_*`
  secrets are deleted.
- **Repository visibility.** While the repository is public, anyone signed in
  to GitHub can download the nightly backup artifacts (encrypted — only the
  passphrase protects them) and read every workflow log. Making it private
  loses nothing: the gitleaks step in `deploy.yml` replaces GitHub's free
  secret scanning.

**Sanity**

- **The `production` dataset is Private** — checked by `check-dataset.mjs` on
  every build, see *Where the boundaries actually are*.

## Styling

There is no CSS framework. `src/styles/global.css` carries a hand-written
reset, the `@font-face` block and every design token; components use Astro's
scoped `<style>`.

Tailwind was removed: it was serving one page (404) and generating unscoped
utilities from words it found inside our own CSS — `.grid`, `.block`,
`.filter`, `.sticky` and `.hidden` were all real rules in the built stylesheet,
silently landing on our own elements that happened to share those names.

**Never hardcode a colour.** Every one resolves through a token in
`global.css`, and a raw hex will break in one of the two themes.

The palette is editable in the Studio — **Logo & icons → Page palette** — and
that is the whole palette, not just the accent: page background, cards,
borders and the three levels of text, per theme, plus the error colour. The
ink fields warn when they fail contrast against the background you actually
chose rather than against a fixed guess.

**Layout** is three numbers on the same document: maximum content width,
corner rounding and page margin. The last two are percentages that scale what
the stylesheet already says, for the same reason the type controls are
multipliers — the relationships were designed, and setting each end
independently is how you get a floor above a ceiling.

**Never hardcode a type size either.** Every `font-size`, and every numeric
`font-weight` and `letter-spacing`, is written to scale from its role:

```css
font-size:      calc(1.35rem * var(--type-heading-scale, 1));
font-weight:    calc(750    + var(--type-heading-weight, 0));
letter-spacing: calc(-0.015em + var(--type-heading-track, 0em));
```

A new declaration that skips this is not broken — it just stops responding to
the Typography tab in the Studio, silently, for that one element. The five
roles are `display`, `heading`, `body`, `label` and `mono`, defined in
`src/config/fonts.ts`.

The `var()` fallbacks are the whole safety story: with nothing set in the CMS
every one of these computes to exactly the value written in the source, so the
untouched site is byte-for-byte what it was before any of it was editable.

Two things are deliberately NOT scaled, and should not be: values in `em` or
`%` (their parent has already been scaled — doing it twice compounds), and the
`@font-face` weight ranges.

## Typography in the Studio

**Logo & icons → Typography.** Four typeface dropdowns, one overall size, and
three controls for each of the five roles.

Reach for **Overall text size** first. It scales everything together and so
cannot break the relationship between a heading and the paragraph under it.
The per-role sizes then move one group *relative* to the rest, which is the
part worth being careful with — pushing labels up 30% while headings stay put
will not look like a bigger site, it will look like a broken one.

The typefaces are a **dropdown, not a text box**, because the fonts are
self-hosted files. A typed-in family nothing has loaded would fall silently
through to the next name in the stack: the field would appear to save and then
do nothing at all. To offer a new face, add the `.woff2`, add an `@font-face`
block, add an entry to `src/config/fonts.ts`, and redeploy the Studio.

Weight is an *offset*, not a value — the faces carry a real variable weight
axis, so `+100` is about one step bolder and moves smoothly rather than
snapping to the nearest cut.

## Fonts

Self-hosted from `public/fonts/`, declared at the top of `global.css`. All
three families are variable, so one file covers the whole weight range, and
only `latin` + `latin-ext` are shipped. Which of them each role uses is set in
the Studio — see *Typography in the Studio* above.

To update one: fetch the woff2 from Google's `css2` endpoint **with a modern
browser User-Agent** (an old one gets you `.ttf`), drop it in `public/fonts/`,
and change the `src`. Do not re-add the stylesheet `<link>` — it cost a DNS
lookup, a TLS handshake and a render-blocking request to a third party, and it
put the visitor's IP in front of Google on every page load.

### Adding or renaming a service

Entirely in the Studio, with no deploy. Create a **Service**, and add a row to
the **Menus** document pointing at `/services/<slug>/`.
`src/pages/services/[slug].astro` builds the page, `check-links.mjs` fails the
build if the menu href does not resolve, and search picks the page up on its
own from the document.

The hero picture is the **Hero image** field on the service itself. It used to
be an `artwork` document filed against a slot named `service-<slug>`, from a
hardcoded list of six — so a seventh service could be created and published
from the Studio and then had nowhere to put a picture, falling back to the flat
tint with no warning anywhere. `src/config/imageSlots.ts` carries that story at
length; the short version is that an image belongs to the document it depicts.

**That same upload reaches three places** — it is also what the Studio lists
under *Images → Service heroes*, which is a filtered view of the service
documents rather than a separate library:

1. the band behind the title on `/services/<slug>/`;
2. the tile on the services block when its layout is **Tiles** — full-bleed art
   with the name and blurb on a scrim, matching the discipline tiles;
3. the thumbnail on the same block when its layout is **Rows** — a contained
   picture beside the number, name, tagline and offering chips.

The services block (`ServiceGridBlock.astro`) takes its two layouts from two
sources on purpose. **Tiles** reads the nav's services dropdown for *which*
services and in what order, so the homepage and the Services menu can never
list different disciplines — and joins each nav href to its service document
by path to pick up the picture, because a nav child is only a label, an href
and a blurb. **Rows** reads the service documents directly, since only they
carry taglines and offerings.

**The homepage runs Rows, deliberately.** Both it and the portfolio grid above
it are six things with pictures, and when both were tile walls the page read as
saying the same thing twice — the portfolio tiles already carry the service name
as their kicker, so five of the six service names were on screen before the
services section began. Same content, different shape. Switch it with the
block's **Layout** radio.

The homepage block also has its **Anchor** pinned to `services`. The component
otherwise picks the section id from the layout — `services` for Tiles,
`disciplines` for Rows — so flipping the radio would silently move `#services`
and break any link to it.

The six services are **3D Art, 2D Art, Animation, VFX, Integration** and
**Video Editing**.

Two things have to move together when a `slug` changes:

1. the matching row in **Menus**, or the nav link 404s — the build catches
   this one for you;
2. the **Services** field on any case study in the Studio — a stale slug is
   silently dropped from the cross-links rather than erroring, and nothing
   warns you about it.

Note `shortName` and `article`. They exist because the page writes sentences
like "Have **an** integration brief?" and "Have **a** VFX brief?" — the article
follows the spoken sound, not the first letter, so it is stored rather than
guessed.

### Posting or closing a job

**Open Roles → Create** in the Studio, then Publish. The page builds, `/careers/`
lists it, search indexes it and the JobPosting structured data comes off the
same record — there is nothing else to touch, and no code change.

**Closing a role means UNPUBLISHING it, not annotating it.** Its page stops
being built, it drops out of the listing and it leaves search on the next
build. A listing still live three months after the seat was filled costs you
the next good applicant.

Two fields carry more weight than they look:

- `posted` is emitted as `datePosted` in the structured data. Google drops
  stale postings from its jobs index on its own, so a date left at last
  quarter quietly removes the role from the biggest source of applicants.
- `reelNote` is the "what to send" panel — the single most useful line on a
  creative job ad, and the one almost nobody writes. An animator and a
  character artist are judged on different things; saying which saves a round.

`discipline` is a dropdown rather than free text, because it has to match a
filter chip on `/careers/` or the role becomes unreachable behind every
filter. Adding a new discipline is a code change, in
`src/config/disciplines.ts` — and it has to be added to the site's list *and*
be a value the Studio offers, which that one file handles for both.

Set `hiringOpen = false` in `src/config/careers.ts` to take everything down at
once. The page keeps its open application and explains itself rather than
going blank.

Applications land in the `applications` table, both kinds in one place:
`kind = 'role'` for an application against a listing, `kind = 'open'` for
somebody who wants a seat that is not posted yet. Sort by that column in the
Table Editor and you have two working queues.

### Adding a blog post

**Blog posts → Create** in the Studio, then Publish.

Every field is validated twice: once in the Studio while you type, and again
at build time against the Zod schema in `src/content.config.ts`. The build
fails loudly on a bad document rather than publishing something malformed —
which matters more now that publishing does not go through a code review.

Three fields to get right:

- **URL** — generated from the title. Changing it after publishing breaks
  every existing link to the post. The Studio will let you; don't.
- **Description** — capped at 160 characters, because it is both the card
  excerpt *and* the meta description Google prints under the title. Write it
  for someone deciding whether to click, not as a summary.
- **Cover image** — optional. Without one the card falls back to the colour
  placeholder. With one, it also becomes the post's social card, so a shared
  link shows the artwork instead of the studio logo.

Reading time is counted from the body, never typed. A new post appears on the
blog index, its category page and site search automatically. The homepage does
**not** list posts — the blog is reached from the nav.

Unpublished posts are visible under `astro dev` and excluded from production
builds, so a draft can be previewed on a real page before anyone sees it.

### Blog pages

**The sidebar is on single posts only.** Listing pages — index, category, tag,
archive — run full width with `CategoryBar` as their filter row. `BlogSidebar`
is entirely derived from the collection, so publishing a post adds it to recent
posts, adds its month to the archive and adds its tags to the cloud with no list
to edit. Archive and tag **routes only exist for months and tags that have
posts**, so nothing can link to an empty page.

Filters toggle: whatever is selected in `CategoryBar` links back to `/blog/`
rather than to itself, and renders an ×. Tag and archive pages pass their filter
in as `extraActive` so they get the same clearable chip a category does.

Note the rail highlights a post's own category, which is a label rather than a
filter the reader chose — so it links to that category page, not back to
`/blog/`. Only `CategoryBar` clears.

The sidebar's search box searches **posts only**, in place, against a small
index inlined into the page — no request, no navigation. The header's magnifier
still opens the site-wide overlay for anyone who wants everything.

On desktop the rail is an ordinary column that scrolls with the page. It is
deliberately not sticky-with-its-own-scrollbar: that turns one page into two
scrolling documents where the wheel does different things depending on where
the pointer is. Below 1050px the same markup becomes a drawer, opened by a tab
on the right edge — stacking it under a 2000-word post buries it.

## Where the data lives

Three places, on purpose.

| What | Where |
| --- | --- |
| Posts, case studies, job openings, services, portfolio, the menus | Sanity. Edited at aniwala.com/admin. |
| Every word the templates say — headings, labels, empty states, the privacy policy, both forms | Sanity, under **Interface copy** and **Privacy policy**. |
| Anything that decides a URL or drives code behaviour | This repo. Plain files, in git. |
| Enquiries, bookings, applications, comments | One Supabase project. Optionally mirrored into Sanity as read-only **Form submissions** — see *Reading everything in the Studio*. Supabase stays the source of truth. |
| Every picture | Sanity, on the document it belongs to — a service's hero, a discipline's tile, a post's cover. Gathered in one place under **Images**. |
| Every video | Cloudflare R2, or Cloudflare Stream if it needs transcoding. Never Sanity, and never the web server. See *Video* below. |

The split worth understanding is the last of the three repo/CMS lines. If a
change is *words*, it belongs in the CMS — including the words nobody thinks
of as content, like "Read the case study" or the label a screen reader gives
the menu button. If a change alters what the code *does*, it stays in git,
where it gets a diff and a review.

What that leaves in code is a short list, and each entry is there for a
reason you can point at:

- **Careers disciplines** (`config/disciplines.ts`) validate every role and
  fill the application form's dropdown, and each maps to a `JobPosting`
  constant Google expects.

  Blog categories and portfolio disciplines used to be on this line. Both are
  documents now, and what made that safe was not where the list lives but how
  a post points at one: by **reference**, so Sanity refuses to delete a
  category still in use and renaming its title cannot detach anything. Only
  the slug decides a URL, and the schema says so on that field.
- **The studio timezone.** IST observes no daylight saving, which is why a
  fixed offset is exact — and why nobody should be able to point the booking
  widget at a timezone that does, where every slot offered would be an hour
  wrong for half the year.
- **The social-icon list.** An icon exists because there is an SVG path for
  it in `SocialIcon.astro`; a name with no path renders as nothing, visibly to
  no one. (The Supabase credentials used to be on this line. They are now
  environment variables — infrastructure, but *configuration*, which is not
  the same thing as code and should never have needed a deploy.)
- **`src/config/copyFields.ts`** — the *names* of the CMS copy fields, not
  their text. It is the contract the build validates against.

Everything a visitor submits goes into a single Supabase database, so there is
one dashboard to check and one export to take — not a form service plus a
comment service plus a scheduler.

### Video

**Video never touches Sanity's storage.** The file goes to Cloudflare R2 and
the document stores a URL — Sanity holds a string. That is a deliberate choice:
video is the one asset heavy enough that where it lives is a decision rather
than a detail, and Sanity charges storage and asset bandwidth for something it
does not transcode.

Three places take one: the homepage hero block, a portfolio piece, and a
portfolio discipline. All three use the same field and the same drop zone,
which accepts either

- **a direct `.mp4`/`.webm` URL** — R2, or any host serving one. Renders in a
  native `<video>`. This is what the drop zone produces.
- **a Cloudflare Stream id or embed URL** — renders in Stream's iframe. Worth
  it for anything long enough that a phone should not be handed the 1080p
  master, since Stream is the only one of the three that transcodes.

The site works out which it got. There is deliberately no "what kind is this"
dropdown to get wrong.

**A DISCIPLINE TAKES THE FIRST KIND ONLY**, and the Studio refuses the second
with a message saying why. Its video is the background of the page band, behind
the heading — and a Stream embed is an iframe carrying Stream's own player, so
it cannot be a background without drawing that player's chrome across the top of
the page. A piece tile has no such problem, because a tile *is* somewhere a
player can live.

A discipline's video also **requires its Tile image**, which becomes the poster.
Without one the band is an empty wash until the first frame decodes, which on a
phone is most of what a visitor sees — so the video renders not at all rather
than as a black bar, and the missing still is obvious in the Studio instead of
only on a slow connection.

On a piece, the image stays the **poster**, so a tile shows a frame of the work
from first paint rather than a black box. A piece with a video and no image
falls back to flat tint.

#### Tile controls

A piece tile with a **direct video** carries the browser's own control bar:
play, scrub, volume, full screen, picture-in-picture. Deliberately native
rather than bespoke — it is the same bar the visitor gets in full screen and on
every other site, already understood and already keyboard-accessible.

It replaced a custom cluster of three buttons whose volume only appeared when
an editor had ticked *Has sound worth hearing* — which meant most tiles offered
no way to hear anything at all. That field has since been deleted outright; see
**Sound**, below.

Three things make it work, and all three were bugs before they were fixed:

- **`.piece-inner` gives up its pointer events.** It fills the tile and sits
  over the video, so with it in the way the bar rendered perfectly and ignored
  every click. Everything in that overlay — scrim, badge, title — is
  decoration, so the layer takes no pointer events and the video takes them
  back. The scrim still *paints* over the video, which is wanted: white
  controls read better on a darkened strip than on a bright frame.
- **`.piece-video` drops `pointer-events: none` in full screen**, for exactly
  the same reason one layer up, and switches to `object-fit: contain` — `cover`
  crops to the tile's shape, which is right on a grid and wrong on a screen
  somebody has just asked to fill with the whole frame.
- **`.piece-img` sits at `z-index: -1`, beside the video.** `.piece-inner` is
  `position: relative` with no z-index, so it is not a stacking context and
  every layer paints in `.piece`'s: negatives first, then everything at `auto`
  in DOM order. The still had no z-index, which made it `auto` — *above* the
  video at `-1`, and above the scrim too. A piece with both an image and a video
  would have shown its poster permanently covering the video it is the poster
  for. It went unnoticed only because both video pieces had no image; the Studio
  now offers to fill that field in after every upload, which made the
  combination real. At `-1` alongside the video, DOM order decides, and the
  still is written first.

`.piece--player .piece-body` carries bottom padding so the title is not sitting
under the bar. The bar is only drawn on hover, so that gap is empty most of the
time — the cheaper of the two mistakes.

**A Stream tile is untouched.** It is an iframe carrying Cloudflare's own
player; a control outside it has nothing to talk to, and reaching in is
cross-origin and refused. The player inside has its own.

There is no field controlling any of this. The native bar always has a volume
control, so whether there is audio to hear is a question about the **file**.
`upload-r2.mjs` still strips the track by default, which is why most of these
are silent.

#### Sound

**Nothing on this site ever starts making noise on its own.** That is a rule
enforced in code, not a default somebody can flip.

No browser autoplays audio on a video nobody has interacted with — there is no
flag, policy or workaround that changes that, so a design depending on it does
not work anywhere. What a page *can* do is treat the visitor's first click or
scroll as the gesture and unmute then. The hero used to do exactly that, behind
a **Play with sound** checkbox on the hero block.

It worked, which was the problem. A full-screen showreel that starts talking
the moment you scroll is what people close the tab over, and a checkbox made it
one click away on every hero, with the consequence landing on visitors rather
than on whoever ticked it. **Both sound fields have been deleted** —
`heroBlock.sound` and `piece.sound` — along with the values that were already
in the dataset (`scripts/unset-sound.mjs`, one-off, safe to re-run).

What replaced them:

- **A background video is silent.** The hero loop, and the band behind a
  discipline's heading, are decoration. `src/lib/video.ts` re-applies `muted`
  on every `volumechange`, so the attribute in the markup is a guarantee rather
  than a starting state. There is no control, because there is nothing to
  control.
- **A portfolio tile starts muted and the visitor may unmute it.** The native
  control bar is the whole interface — no bespoke button, nothing gated on a
  CMS field. The mute is re-applied on **every** arrival, including a
  back-navigation, where a browser will otherwise restore the volume somebody
  left behind on a page they are now seeing fresh.
- **Only one tile may have audio at a time.** Unmuting a second mutes the
  first. Nine autoplaying videos that each remember being unmuted is not a
  feature, and hunting for which one is talking is not a task to hand anybody.

If the sound *is* the work, it belongs on a portfolio tile, which has a real
player. A headline does not.

That rule answers a second question too. A silent video's audio track is bytes
every visitor downloads and nobody can ever hear, so `upload-r2.mjs` **strips it
by default** — `-c:v copy`, so the video is not re-encoded and there is no
generation loss. Pass `--keep-audio` for a piece that has some.

The Studio's drop zone cannot do that: stripping a track means rewriting the
container, and a browser has no ffmpeg. **A file dropped into the Studio keeps
whatever it arrived with.** If the bytes matter, upload it with the script.

#### Playback, and why it used to get stuck

Every autoplaying video on the site is marked `data-video="silent"` (decoration)
or `data-video="player"` (a tile), and `src/lib/video.ts` owns both. It is
wired up from `Base.astro` on `astro:page-load`.

**The bug it fixes.** A hero would come back from another page frozen on its
poster — no error, no pattern, just a still frame. The cause is that
`ClientRouter` turns every internal link into a document swap and **does not
re-run an inline script that has already executed**. The only thing calling
`play()` on a hero was an inline reduced-motion snippet inside each hero
component. It ran on the first arrival and never again, and the video element
had been adopted out of a parsed document that never started it.

So playback is no longer started once and hoped for. The conditions under which
a video *should* be playing are stated once, and every event that could have
changed the answer re-asks it:

| Event | What it catches |
| --- | --- |
| `astro:page-load` | The first load **and** every client-side swap |
| `pageshow` | A bfcache restore — the document comes back frozen as it was left, and no router event fires |
| `visibilitychange` | A backgrounded tab has its media paused by the browser and is not given it back on return |
| `pause` / `ended` | Anything else that stopped it, including a `loop` a browser did not honour |
| `stalled` / `waiting` | A cold or rate-limited CDN range request that never finishes — `readyState` sticks below `HAVE_FUTURE_DATA` and no error is ever fired. One `load()` retry per video per page view |

**It does not fight the visitor.** A pause pressed on a tile is detected by a
gesture window — a pause within a second of a pointer or key event on the
element — and honoured from then on. Reading `document.visibilityState` instead
is the obvious approach and it is wrong: a browser pausing media for a hidden
tab and the `visibilitychange` event are not ordered against each other, so
switching tabs was intermittently recorded as a deliberate stop and the tile
stayed dead for the rest of the session.

**Offscreen videos are paused.** An `IntersectionObserver` with a two-viewport
margin gates them. A discipline page can hold nine autoplaying tiles and the
browser decodes every one of them whether or not it is on screen — which shows
up as a janky scroll and a hot fan rather than as anything obviously
video-shaped.

**`preload="auto"` is not the fix for a slow start**, tempting as it looks. A
media element delays the window `load` event until its preload level is
satisfied, `auto` means the frames rather than the header, and the first-load
curtain in `Loader.astro` lifts on `load`. Raising it holds a black screen in
front of the visitor for longer and calls it an improvement.

**Reduced motion** is handled here rather than in CSS, because `autoplay` has
already fired by the time a media query could apply. Pausing leaves the poster:
the same picture, holding still. A tile keeps its control bar, and a visitor who
presses play on one has asked for the motion — so that one keeps running.

#### Posters

**A `<video>` with no poster paints a black rectangle until its first frame
decodes.** On a cold load the poster *is* the hero for as long as the download
takes, so it is not decoration — and it was the one part of a video that nothing
in the pipeline produced. Every still used to be a separate manual upload, which
is how the homepage spent a while opening on a dark frame from the middle of a
*previous* cut while the new video opened on a bright title card. Two fields that
must agree, kept in two places, will not agree.

Both upload paths now offer one.

**In the Studio**, drop a video and a *Poster frame* panel appears under the drop
zone with a frame already picked, a scrubber, and a Save button. It writes to the
image field beside the video — a piece's Image, a discipline's Tile image, the
hero's Still image.

The frame has to come from the file you just dropped, not from the R2 URL
afterwards: a `<video>` fed a `blob:` URL is same-origin, so the canvas it is
drawn onto can be read; a cross-origin one taints the canvas and every pixel read
throws. That is also why the panel appears at upload time and not later.

**From the terminal**, `upload-r2.mjs` writes `<name>-poster.jpg` next to the
source file and prints the path. It does not upload it — the video belongs in R2
and a poster belongs in Sanity, on a field that depends on what the video is for,
and guessing which would be worse than telling you where the file is.

**How the frame is chosen, and why it is only a default.** Frame 0 is the obvious
pick and it is usually wrong: graded work opens on black or fades up, so a poster
grabbed from the first frame is the black rectangle it was meant to prevent.
Frames across the opening are scored on **contrast** — the standard deviation of
luma — rather than brightness, because brightness alone rejects black and then
cheerfully picks a white flash or an empty lit background. Spread asks "is there
anything in this picture", which is nearer the question.

It clears the bar of *never silently producing black*. It does not know that the
title card is the frame you wanted — on the homepage reel it lands on a shape
mid-transition, which is legible and is not what a person would choose. So the
scrubber in the Studio and `--poster-at=<seconds>` on the script are not
escape hatches, they are the expected second step.

**Getting it perfect.** A good poster and an *invisible* one are different
problems. The still being wrong is one; the still not matching where the video
starts is the other, and it is the one people miss — the `poster` attribute is
swapped for the first decoded frame instantly and unfaded, so a beautiful frame
in front of a video that opens on black snaps the moment playback begins, and
again on every loop. A better still makes that worse, because it widens the gap.

Two things close it, from opposite ends:

- **`--start=<seconds>`** trims the front off the video and then takes the
  poster from the trimmed file at t=0 — so the still and the first frame are the
  same bytes and the handover cannot be seen. `-c:v copy`, so no re-encode and
  no generation loss; the cost is that a stream copy can only cut at a keyframe,
  so the real start lands at or before what you asked for. The script prints
  where it actually landed, and the guarantee holds either way because the
  poster is read from the result.
- **The site crossfades the handover** regardless. Each video is faded in over
  the still behind it rather than cutting to it, so a poster that does not match
  lands softly instead of snapping. `src/lib/video.ts` sets `data-fade` on every
  managed video and `data-ready` two painted frames after playback truly starts;
  each component supplies the opacity it fades *to*, because the page-hero band
  sits at `0.38` and a global "fade to 1" would quietly turn it into a video.
  Neither attribute exists without JavaScript, so a page without it renders
  exactly as before.

Together they mean a poster never *has* to be exactly right, and can be when you
want it to be. What neither fixes: the crop must match — both go through the same
`object-fit: cover`, so a still at a different aspect ratio shifts at the swap —
and a loop is only truly seamless if its last frame matches its first.

**The hero's still lives on the hero block**, as a normal image field. It used to
be an `artwork` document named by a `posterSlot` dropdown — the indirection
`config/imageSlots.ts` argues against at length, and the specific reason the still
and the video drifted apart. `posterSlot` is still read as a fallback so nothing
broke on the way across, and it hides itself on any hero not already using it.

#### Uploading

In the Studio, drop the file on the video field. Or from a terminal:

```bash
node --env-file=.env scripts/upload-r2.mjs <file> [key] [--keep-audio]
                                           [--no-poster] [--poster-at=<seconds>]
                                           [--start=<seconds>]
node --env-file=.env scripts/upload-r2.mjs clip.mp4 video/home-hero.mp4
node --env-file=.env scripts/upload-r2.mjs clip.mp4 video/home-hero.mp4 --poster-at=2.5
node --env-file=.env scripts/upload-r2.mjs clip.mp4 video/home-hero.mp4 --start=1.6
```

| Flag | Does |
| --- | --- |
| *(none)* | strips the audio track, adds faststart, uploads, writes `<name>-poster.jpg` beside the source from the highest-contrast frame in the first 15 s |
| `--keep-audio` | leaves the audio track in |
| `--no-poster` | skips the still |
| `--poster-at=<s>` | takes the still from that second instead of scoring |
| `--start=<s>` | trims the front off (stream copy, snaps to a keyframe), then takes the still from the trimmed file's frame 0 — so the poster and the opening frame are the same bytes |

Values take the `=` form. The positional parse drops every `--` argument whole,
so a space-separated value would survive as a stray positional and be read as
the object key.

The script **does not re-encode**. `-c:v copy` throughout, so no generation loss
and no wait — which also means it cannot make a file smaller. Size is decided
before upload; see *Encoding a hero loop*.

Uploaded objects carry `Cache-Control: public, max-age=2592000`. R2 sends no
caching directive of its own, so without one a browser falls back to heuristic
freshness — a couple of hours for a recent file — and then spends a round trip
revalidating before it may play a frame. Not `immutable` and not a year, because
overwriting a key in place is a documented move here and an immutable year would
hide the swap from everyone who had already visited.

The script prints the public URL and then `HEAD`s it — a `200` from the upload
only proves the object landed, and public read is a **separate bucket setting**.
Re-using a key overwrites the object, so uploading over `video/home-hero.mp4`
swaps the hero with no Studio edit at all.

#### Encoding a hero loop

**File size is the whole difference between a hero that is simply there and one
that shows its poster for several seconds.** There is no trick other sites are
using; their loops are small. The Studio's field note says under about 5 MB, and
it means it.

The homepage hero was the counter-example. It was a **16.5 MB, 112-second, 1080p
showreel with an audio track still in it** — the track betrays a Studio drop-zone
upload, which keeps whatever it is given, rather than `upload-r2.mjs`, which
strips it. On a cold load (a first visit, an incognito window) the whole of it
had to arrive before playback, and the poster held the screen meanwhile. It was
re-encoded to:

| | Resolution | Length | Size |
| --- | --- | --- | --- |
| Original | 1920×1080 | 112 s | 16.5 MB, with audio |
| **Live loop** | 1280×720 | 24 s | **1.26 MB**, silent |
| Full-length spare | 1280×720 | 110 s | 5.34 MB, silent |

720p costs nothing behind a scrim and a headline. The recipe:

```bash
ffmpeg -i source.mp4 -ss 1.6 -t 24 -an -vf "scale=1280:-2" \
  -c:v libx264 -crf 27 -preset slow -profile:v high -pix_fmt yuv420p \
  -g 50 -movflags +faststart hero-loop.mp4
```

- **`-ss` after `-i`** is frame-accurate. Before `-i` it snaps to a keyframe.
- **`-ss 1.6`** cut a fade up from black. The reel's real opening was 1.6 s of
  near-black, so even instant playback started on black — and did it again on
  every loop.
- **`-an`** drops the audio. Nothing on the site can play it.
- **`-crf 27`** is the size lever; higher is smaller and softer.
- **`-g 50`** puts a keyframe every 2 s at 25 fps, so seeks and loops restart
  quickly.
- **`+faststart`** moves the index to the front so playback can begin before
  the download ends.

Upload the result with a content hash in the key, and take the poster from its
first frame:

```bash
node --env-file=.env scripts/upload-r2.mjs hero-loop.mp4 video/krazzy-4-hero-loop-720-<hash>.mp4 --poster-at=0
```

Both re-encodes are in the bucket. The 16.5 MB original is untouched, and the
full-length spare can go back in by pasting its URL into the hero's
**Background video** field:

```
video/krazzy-4-hero-loop-720-09d7ed28.mp4   <- live
video/krazzy-4-hero-full-720-42d2f622.mp4   <- full reel, 720p
```

**The seam that remains.** A loop is only seamless if its last frame matches its
first. The live one cuts at 24 s into an unrelated moment — invisible enough
behind the scrim, but it is the remaining edge if the hero ever needs to be
flawless.

#### If the drop zone refuses an upload

**Check the origin before assuming it.** The Studio's address bar now reads
`https://www.sanity.io/@<org>/studio/<id>` — Sanity moved hosted Studios behind
a dashboard — but the Studio itself is served in a **frame** from the old
`https://aniwala.sanity.studio`, and it is the frame that makes the upload
request. So the origin `sign-upload` sees is still `aniwala.sanity.studio`,
which is on its list. Reading the address bar and concluding otherwise is the
easy mistake here; it was made once already.

To see it for certain: DevTools → Console → set the context dropdown (next to
the filter box) to the Studio's frame rather than `top`, and type
`location.origin`.

If that value is ever *not* on the list, every upload is refused before the
session token is read — and because the refusal carries
`Access-Control-Allow-Origin: null` the browser blocks the response too, so
what an editor sees is a failed request rather than the word "Forbidden". It
reads as R2 being down.

That list is `ALLOWED_ORIGINS` in `supabase/functions/sign-upload/index.ts`. It
holds `aniwala.sanity.studio` and `localhost:3333` unconditionally, and appends
anything named in the `STUDIO_ORIGINS` secret — so if Sanity moves the frame
too, it is one command rather than a code change:

```bash
supabase secrets set STUDIO_ORIGINS=https://the-new-origin --project-ref <ref>
supabase functions deploy sign-upload --no-verify-jwt --project-ref <ref>
```

Comma-separate for more than one. Unset, the behaviour is exactly what it
always was. Never `*`, and never `*.sanity.io` or `*.sanity.studio`: that would
trust every studio anyone can deploy on the platform, which is most of what
this list exists to prevent.

**When the origin is fine and an upload still fails**, the causes in order of
likelihood are the bucket's CORS policy (`scripts/r2-cors.mjs` — a missing one
fails at the preflight and reports a bare network error), then the function's
`R2_*` secrets, then the editor's Sanity role: a viewer is a valid identity and
is deliberately refused.

#### How the drop zone works, and why it is not a `file` field

A Sanity `file` field would be one line of schema and look identical. It would
also put the video in Sanity, which is the thing being avoided.

So the browser uploads **straight to R2**, using a short-lived presigned URL
from the `sign-upload` Edge Function. The file never passes through a server:
an Edge Function's request body is capped far below the size of a real video,
so anything that proxies it breaks on the first upload that matters.

That leaves one hard problem — who is allowed to ask for a signed URL. It
cannot be a shared key: the Studio is a static app, so anything compiled into
it (including any `SANITY_STUDIO_*` variable) is readable by anyone who opens
the bundle. The one credential an editor has that an outsider does not is their
own Sanity session, so the browser sends that and the function asks Sanity
whether it is real and belongs to this project.

Two things about that check are worth knowing, because the obvious version of
it is wrong and both were found by asking the endpoint rather than reading
about it:

- **With no token at all, Sanity's `users/me` answers `200` — with `{}`.** So
  checking `response.ok` authorises the entire internet. The identity has to be
  read out of the body.
- **A read-only token is a valid identity.** A viewer has no business writing to
  the bucket, so the role is checked too, against a named list.

Prerequisites, both one-time:

- **A CORS policy on the bucket**, or the browser upload fails at the preflight
  and reports a network error — which reads as "R2 is down" rather than "the
  bucket has no CORS policy". `node --env-file=.env scripts/r2-cors.mjs` sets
  it, or prints the JSON to paste if the token is scoped to objects only
  (which is the correct scope, and worth keeping).
- **The function's secrets**: `supabase secrets set --env-file …` with the five
  `R2_*` values and `SANITY_PROJECT_ID`. Do not `source .env` to do this —
  a single unquoted value stops the shell part-way and the rest are set to
  empty strings, which the CLI reports as a success.

The five `R2_*` variables are documented at the end of `.env.example`. The site
never reads them: it renders whatever URL is on the document, so nothing about
R2 reaches the browser or the build.

The bucket's host has to be named in the CSP or the video is blocked silently.
See *Headers*.


### Interface copy

Two documents in the Studio hold the site's own words:

- **Interface copy** — around two hundred strings, in tabs: site-wide,
  detail pages, listings, comments, the 404, and screen-reader labels. The
  wording of the booking widget lives on **Book a call** instead, and the
  application form's on **Careers page**, because that is where an editor
  would look for them.
- **Privacy policy** — the policy as rich text, plus its hero and its date.

Sentences with a value in the middle use `{{token}}` holes that the templates
fill in — `{{count}} posts`, `Apply for {{role}}`, `Email {{email}} instead`.
The field's description in the Studio names the tokens it accepts. An unknown
token renders as itself rather than as a blank, so a typo is visible rather
than silently eating half a sentence.

Every one of these is REQUIRED: leave one blank and the production build
fails naming the field, rather than shipping a page with a hole in it. The one
exception is the 404 tab, which falls back to the text in `lib/studio.ts` —
that page is what a visitor reaches when something has already gone wrong, so
it must not be able to break in turn.

To seed them into a dataset that does not have them yet:

```
cd studio
SANITY_WRITE_TOKEN=sk... npm run seed:copy -- --dry-run   # look first
SANITY_WRITE_TOKEN=sk... npm run seed:copy                # then do it
```

That script creates the two new documents and FILLS IN missing fields on the
three existing ones. It never overwrites a field somebody has already edited,
so it is safe to re-run and safe to run against production.

There is a second seed, for the pipeline strip's logos:

```
cd studio
SANITY_WRITE_TOKEN=sk... npm run seed:tools -- --dry-run
SANITY_WRITE_TOKEN=sk... npm run seed:tools
```

**Tool logos are a lookup, not a list.** The strip reads its tools from where
they already live — `capabilities` on Site copy, and the `tools` array on each
service — and a `tool` document only attaches a logo to one of those names,
matched by exact spelling. That is what stops a service page and the strip
beneath it from ever disagreeing, and the cost of it is a join key typed by
hand. So nobody types it: `seed:tools` reads the names out of the dataset and
writes the rows, leaving nothing to do in the Studio but drop a file onto one.
Run it again after adding a tool to a service. It uses `createIfNotExists`, so
it never touches a logo already uploaded.

A tool with no logo is not missing from anything — it renders as a text pill.

### Setting up the CMS

1. Create a free project at <https://sanity.io>. Note the **project ID**.
2. `cp .env.example .env` and fill in `SANITY_PROJECT_ID`,
   `SANITY_STUDIO_PROJECT_ID` (same value) and the dataset (`production`).
3. **GitHub → Settings → Secrets and variables → Actions** — add
   `SANITY_PROJECT_ID` and `SANITY_DATASET`. Without them CI builds an empty
   site; the link checker catches it, but only after a wasted run.
4. Install and start the Studio:

   ```
   cd studio
   npm install
   npm run dev          # http://localhost:3333
   ```

   The Studio is **Sanity v6** and needs **Node ≥ 22.12** and React 19 — both
   are pinned in `studio/package.json`. It is a separate npm package from the
   site on purpose: it pulls in React and the whole Sanity toolkit, and the
   site ships no React at all.

   `studio/package.json` also carries an `overrides` block pinning three
   transitive dependencies inside `@sanity/cli`. Read the comment above it
   before touching them — one of the pins looks like it wants upgrading to
   the next major and must not be.

5. Migrate the old Markdown content in (once):

   ```
   SANITY_STUDIO_PROJECT_ID=xxx node scripts/migrate.mjs --dry-run
   SANITY_STUDIO_PROJECT_ID=xxx SANITY_WRITE_TOKEN=sk... node scripts/migrate.mjs
   ```

   Check a long post's formatting in the Studio, then delete
   `src/content/` and revoke the write token.

   **Already done on this project** — `src/content/` is gone and the content
   lives in Sanity. The step is kept because it documents where the dataset
   came from. **Revoking the token is the half that gets forgotten**: check
   sanity.io/manage → API → Tokens and delete anything labelled for the
   migration. A leftover write token is a standing credential that bypasses
   every Studio validation rule — see *Adding an editor safely*.

6. Deploy the Studio so the non-technical editor can reach it:

   ```
   npm run deploy       # -> https://aniwala.sanity.studio
   ```

7. **sanity.io/manage → API → Webhooks** — add a webhook so publishing
   rebuilds the site:

   - URL: `https://api.github.com/repos/<owner>/<repo>/dispatches`
   - Method: `POST`
   - Headers: `Authorization: Bearer <a fine-grained GitHub token, see below>`,
     `Accept: application/vnd.github+json`
   - Body: `{"event_type": "sanity-publish"}`
   - Trigger on: create, update, delete
   - **Filter (GROQ):**

   ```
   !(_id in path("drafts.**")) && !(_type in ["submission", "sanity.imageAsset", "sanity.fileAsset"])
   ```

   **THE TOKEN MUST BE FINE-GRAINED AND SCOPED TO THIS ONE REPOSITORY.** A
   classic token with `repo` scope can read and push to every repository the
   account owns, and this one sits in a webhook header that every Sanity
   project administrator can open. Create it at GitHub → Settings → Developer
   settings → Personal access tokens → **Fine-grained tokens**:

   - Repository access: **Only select repositories** → this repository
   - Permissions → Repository → **Contents: Read and write** (the dispatches
     endpoint requires it; nothing else is needed)
   - Expiration: a year, with a calendar reminder. An expired token fails
     silently — publishing stops deploying and nothing says why.

   Then delete any classic token that was used here before.

   **THE FILTER IS NOT OPTIONAL, and leaving it blank is not a tidiness
   problem.** It is one GROQ boolean expression — the same language the site
   queries content with, so `&&` is required between the two halves. Two
   conditions on separate lines is a syntax error, and an unparseable filter
   fails in whichever direction you were not expecting: firing on everything,
   or silently on nothing.

   Each half earns its place, and each was learned from a real symptom.

   **The drafts clause — otherwise writing is deploying.** Sanity autosaves a draft
   continuously as somebody types, and every save is an `update` this webhook
   triggers on. Without this clause an editor drafting a blog post fires a
   deploy every few seconds, all afternoon, for a page nobody has published.

   **`submission` — otherwise visitors deploy the site.** Every form
   submission is mirrored into this same dataset as a `submission` document
   (see *Reading everything in the Studio*), and the webhook cannot tell that
   copy apart from a published page. Without this clause:

   - somebody filling in the contact form rebuilds and re-uploads the
     entire site;
   - pressing **Confirm** on a booking does it again, because the mirror
     updates the document;
   - approving a comment does it a third time.

   None of those change a single byte of the site. A busy day can reach
   seventy deploys that exist only because a stranger used a form, each one
   an rsync over the live site — and on a PRIVATE repository, where Actions
   minutes are billable, that alone can exhaust a monthly allowance in about
   a week. It is also the one part of this pipeline a visitor can trigger; a
   filter naming what SHOULD rebuild the site is the difference between a
   content webhook and an open deploy button.

   **The asset types — otherwise one edit is two deploys.** Sanity stores
   every upload as its own document, so changing a single image publishes
   TWO things: a `sanity.imageAsset` and the document referencing it. Both
   pass the first two clauses, and the result is two identical deploys
   racing each other over the same directory. Excluding assets loses
   nothing: an upload changes no page until a document points at it, and
   that document's own publish still fires. `sanity.fileAsset` is here for
   the same reason, covering PDFs and video.

   Extend the array as the CMS grows — anything internal rather than
   published belongs in it:

   ```
   !(_id in path("drafts.**")) && !(_type in ["submission", "sanity.imageAsset", "sanity.fileAsset", "someOtherInternalType"])
   ```

   **HOW TO TELL IT IS RIGHT:** publish one small change and count the runs
   in the Actions tab. Exactly one. Three means the filter is not parsing at
   all; two means an asset type is missing from the array; none means it is
   parsing but excluding too much.

   **This lives in Sanity's UI, not in this repository**, which is the same
   hazard as the `validation:` rules in `studio/schemas/`: nothing in a build
   will ever tell you it is missing. If deploys start firing for no reason
   anybody can explain, check this field first.

8. **sanity.io/manage → Members → Invite** — add the editor by email. They
   need no GitHub account and no repo access, which is the entire reason this
   is a headless CMS rather than a git-backed one.

### Adding an editor safely

Invite them as **Contributor**, not Editor and certainly not Administrator.

The roles differ in exactly the way that matters here:

| Role | Can do |
| --- | --- |
| `contributor` | Read and write **draft** content. No publishing, no project settings. |
| `editor` | Read and write everything, **including publishing**, plus limited project settings. |
| `developer` | Everything Editor can, plus project settings, datasets and tokens. |
| `administrator` | Everything. |

Contributor is the one to reach for, and the reason is the deploy pipeline
rather than distrust. Publishing fires a webhook that builds and uploads the
site with **no human in the loop** — so an Editor's mistake is live in about
ninety seconds. With Contributor, their work stacks up as drafts and somebody
with publish rights presses the button.

The build catches *structural* damage: delete a required document or empty
the menu and CI goes red before anything ships (see *What the build refuses
to ship*). It cannot catch **valid but wrong** — a nav trimmed to one item, a
headline with a typo, a service description rewritten badly. All of those are
schema-valid and would deploy. Contributor is the only thing that closes that
gap.

Two things no role or schema prevents, so say them out loud once: changing a
published post's **URL** breaks every existing link to it, and closing a
filled role means **unpublishing** it, not editing the summary to say
"position filled".

**Token hygiene, which is the same problem wearing different clothes.** A
Sanity API token carries the roles of the account that created it, and the
Content Lake API does not enforce Studio validation — so a write token can
put anything into any field, bypassing every `validation:` rule in
`studio/schemas/`. Check **sanity.io/manage → API → Tokens** periodically and
delete anything whose job is finished. The one-off migration in *Setting up
the CMS* is the obvious example: it needs a write token for an afternoon and
never again.

### Setting up Supabase

1. Create a free project at <https://supabase.com>.
2. **SQL Editor → New query → paste all of `supabase/schema.sql` → Run.**
   Do not skip this. It creates the tables *and* the Row Level Security
   policies, and the policies are the only thing protecting the data.
3. **Project Settings → API** — copy "Project URL" and the **anon public** key
   into `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` (see `.env.example`),
   and add the same two as GitHub Actions secrets so the deploy has them.

Until those are filled in, the booking form, the application form and the
comment form all refuse to submit and say so, rather than dropping data into a
void.

They are environment variables rather than constants in a tracked file because
that is the difference between configuration and code. As literals in
`src/config/site.ts` they sat as `PASTE-YOUR-SUPABASE-PROJECT-URL` from the day
the forms were written until the day somebody audited them — connecting a form
meant a commit, a review and a deploy, so it never happened, and three forms
sat dead on the live site while every page that rendered them looked finished.

**The anon key is public.** It ships inside the JavaScript bundle and anyone can
read it — that is how Supabase is designed to work. Security comes entirely from
the RLS policies, which allow anon to INSERT and nothing else (comments can
additionally read rows you have approved). Read the header comment in
`supabase/schema.sql` before changing any policy: adding a SELECT policy to
`enquiries` would make every lead you have ever received world-readable.

**Never put the `service_role` key in this repo.** It bypasses RLS entirely and
this codebase compiles into a public website.

**The forms are rate limited in the database, and that is the only place it
would work.** Section 5 of `supabase/schema.sql` puts a `before insert` trigger
on all three tables. It has to be there rather than in the page, because the
honeypot and the three-second timer on the forms are client-side and a script
posting straight to the REST endpoint with the public anon key never runs any
of it:

```bash
curl -X POST 'https://<project>.supabase.co/rest/v1/enquiries' \
  -H "apikey: <the key anyone can read out of the JS bundle>" \
  -H 'Content-Type: application/json' -d '{"name":"x","email":"x@x.com"}'
```

RLS permits that, correctly — it is an insert, which is what anon is allowed to
do. The problem is not the row. It is that every insert fires the `notify`
webhook and sends an email, so a loop empties a free Resend tier in minutes,
and once it is empty **real enquiries stop reaching your inbox with nothing to
tell you.** The trigger enforces ceilings per address, per hour and per day;
they bound how many rows a run can create. Current limits are in the comments
of section 5 — all far above real traffic.

**The mail quota itself is capped in `notify`, not by those ceilings.** Past
`MAIL_DAILY_BUDGET` emails in 24 hours (default 90, sized for Resend's free
tier) submissions are still saved and mirrored into the Studio, but not
emailed, and the studio inbox gets one alert saying so. The morning backup run
fails when the budget is spent. On a paid Resend plan, raise it:
`supabase secrets set MAIL_DAILY_BUDGET=500 --project-ref <ref>`.

If you ever need to bulk-import rows, do it from the SQL editor or with the
service key: requests with no forwarded client address are deliberately not
limited, so your own maintenance never locks you out.

### Turnstile — the layer in front of the rate limiter

**Live, and no longer optional on this project.** With `TURNSTILE_SITE_KEY` set
— as it is in CI — the three forms post through the `submit` Edge Function,
which verifies a Cloudflare Turnstile token before writing anything, so
automated traffic never reaches the database.

With it unset, the code still falls back to posting straight to PostgREST under
the anon key. That fallback existed for the rollout, because the site, the Edge
Functions and the Cloudflare account are three separate deploys that do not
land at the same moment. **On this project it now fails**: the cutover in step 5
below has been run, anon has no INSERT, and a build without the site key ships
forms that refuse every submission. On a fresh project the fallback still does
its original job until step 5.

`submit` holds the service role key, which bypasses RLS *and* the column grants
in section 4 of the schema. That is why it copies fields through an explicit
allowlist rather than spreading the request body: without it, the internet
could set `approved = true` on a comment — the exact thing the column grants
were written to prevent, undone by the layer meant to protect them. **If you
add a column to a form, add it to `FIELDS` in `supabase/functions/submit/index.ts`
as well**, or it will be silently dropped.

**Setup, in this order:**

1. dash.cloudflare.com → Turnstile → Add site. You get a site key and a secret key.
2. Give the function the secret half:
   ```bash
   supabase secrets set TURNSTILE_SECRET_KEY=0x4AAA... --project-ref <ref>
   supabase functions deploy submit --no-verify-jwt --project-ref <ref>
   ```
3. Put the site key in `.env` **and** in the GitHub Actions repository secrets.
   Setting it in only one place is the failure nobody notices: the widget
   appears locally while the live site quietly keeps taking the fallback path.
4. Deploy the site, then **submit a real form on the host that is actually
   serving it and confirm it arrives.** That is `aniwala.com`.
5. Only once that works, run the cutover in section 7 of `supabase/schema.sql`
   to remove anon's INSERT grants. Doing it earlier breaks every live form.
   **Done on this project** (verified 15 September 2026), and the revokes are
   now active in the file, so a whole-file re-run keeps the door closed. On a
   fresh project, comment them out for the first run.

   Verify it landed, and that the comments **SELECT** grant survived — a bare
   `revoke all` here would take it with everything else and the blog thread
   would stop rendering:

   ```sql
   select table_name, privilege_type, count(*) as cols
   from information_schema.column_privileges
   where grantee = 'anon' and table_schema = 'public'
   group by 1,2 order by 1,2;
   ```

   Before the cutover that is four rows (enquiries INSERT 12, comments INSERT 4,
   comments SELECT 5, applications INSERT 15). Afterwards it should be one:
   `comments | SELECT | 5`. These are **column** grants, so they do not appear
   in `role_table_grants` at all — that view answers empty and looks alarming.
   To roll back, run **only** section 4 of the schema — the whole file ends
   with section 7 and would revoke them again.

The CSP already names `challenges.cloudflare.com` in both `script-src` and
`frame-src`. The widget renders in an iframe, so it needs both — with only the
first, it never produces a token and every form rejects every submission.

### Moderating comments

**Nothing a visitor writes appears on the site until you approve it.**

1. Supabase dashboard → **Table Editor** → `comments`.
2. Filter to `approved = false` to see the queue.
3. Tick `approved` on anything you want live.

It appears the next time someone loads the post — no rebuild, no deploy.

Unapproved comments are not merely hidden by CSS: the RLS read policy is
`using (approved = true)`, so an unapproved comment is never sent to a browser
at all. And `approved` is not in anon's INSERT grant, so a crafted request
cannot publish itself either.

That queue is the real spam control. The honeypot field and the few-second
submit delay only stop naive bots.

Commenter email addresses are stored so you can reply, but are **absent from
anon's SELECT grant** — the website can never read one back. Row policies
control which rows are visible; the column grants in section 4 of the schema
control which columns. Both matter.

### Getting it all by email, and approving from there

Optional, and it is what makes moderation practical — you never have to open
the Supabase dashboard.

```
new row  ->  Database Webhook  ->  notify function  ->  Resend  ->  your inbox
                                          |                           |
                                          └─→ Sanity (optional)       |
                                              read-only copy in       |
                                              the Studio              |
                     comments carry Approve / Reject                  |
                     call requests carry Confirm / Cannot make it     |
                                                                      v
                              moderate / schedule function  ->  confirmation page
                                                                      |
                                                    you click the button
                                                                      v
                                     published / deleted, or invitations sent
```

Enquiries are routed by service — hit Reply and you are writing to the person
who asked. Comments arrive with two buttons. **A call request arrives with two
of its own**, and that is the part worth reading below.

**Clicking a button opens a confirmation page; it does not act on its own.**
That extra click is deliberate and is not politeness. Mail security scanners —
Outlook SafeLinks, Defender's sandbox, corporate URL rewriters, link
previewers — fetch every URL in a message before you have read it. While
Approve and Reject acted on the GET request those scanners make, a robot could
publish a comment or permanently delete one, and you would never be told. The
confirmation page is a form: a GET only ever asks, and only the POST behind
the button changes anything. Scanners do not submit forms.

**Moderation links expire after 30 days.** A link sitting in an archived
thread or a forwarded message is otherwise a permanent key to publishing on
the site. After that window the link says so and you moderate from the
Supabase dashboard, which is unaffected.

**Setup**

1. A [Resend](https://resend.com) account, a verified sending domain, and an
   API key.
2. Generate a signing secret: `openssl rand -base64 48`
3. Set the function secrets:

   ```bash
   supabase secrets set      RESEND_API_KEY=re_xxx      MAIL_FROM="Aniwala <notifications@aniwala.com>"      MAIL_DEFAULT=hello@aniwala.com      MAIL_CAREERS=careers@aniwala.com      MAIL_ROUTES='{"3D Art":"art@aniwala.com","VFX":"vfx@aniwala.com"}'      MODERATION_SECRET=<the string from step 2>      NOTIFY_SECRET=<another random string>      FUNCTIONS_BASE_URL=https://<project-ref>.supabase.co/functions/v1      SITE_URL=https://aniwala.com
   ```

   `MAIL_ROUTES` is optional — anything unmatched goes to `MAIL_DEFAULT`.
   `MAIL_CAREERS` is optional too, and worth setting: job applications go
   there instead of the general inbox. A CV filed in among the client
   briefs is a CV that gets missed.

   Optional, for the booking half: `STUDIO_NAME`, `STUDIO_TZ` if the studio is
   not in `Asia/Kolkata`, and `MEETING_ROOM_BASE` to host the generated
   meeting rooms somewhere other than the public Jitsi instance.
   `MEETING_URL` replaces those generated rooms with one fixed room — see
   *Confirming a call* for why that is usually the worse of the two.
   `BOOKING_SECRET` is optional too: unset, the Confirm links are signed with
   `MODERATION_SECRET`.

4. Deploy the functions:

   ```bash
   supabase functions deploy notify   --no-verify-jwt
   supabase functions deploy moderate --no-verify-jwt
   supabase functions deploy schedule --no-verify-jwt
   ```

   `--no-verify-jwt` is needed because the callers are a database trigger and
   a mail client, neither of which has a Supabase session. They are not open
   endpoints: `notify` checks the `NOTIFY_SECRET` header, and `moderate` and
   `schedule` check an HMAC over the row id **and** the action, so an approve
   link cannot be edited into a reject link, or a confirm link replayed on
   somebody else's booking.

5. Dashboard → **Database → Webhooks → Create**, three times — once for
   `comments`, once for `enquiries`, once for `applications`. All three: event
   `INSERT`, type **HTTP Request**, method
   `POST`, URL `https://<project-ref>.supabase.co/functions/v1/notify`, and
   add the HTTP header `x-notify-secret` with the value from step 3.

   For the Studio mirror below, those webhooks also need to fire on UPDATE and
   DELETE — but do that by running `supabase/mirror-events.sql`, not by
   ticking the boxes. The reason is in that file's header, and it is the
   difference between a mirror that stays honest and one that re-emails your
   clients about calls they already booked.

Create the webhooks in the dashboard rather than as SQL in this repo: the
trigger definition embeds credentials, and those must not be committed.

**Do not put the `service_role` key anywhere in this repo.** `moderate` reads
it from the Edge Function environment, where Supabase provides it
automatically.

If you skip all of this, nothing breaks — comments still queue up and you
approve them in the Table Editor as described above.

### Reading everything in the Studio

Optional, and it exists so that "who wrote in this week" is one list in a place
you already have open, rather than a second dashboard and a second login.

With `SANITY_WRITE_TOKEN` set as a Supabase secret, `notify` copies every
submission into Sanity as a **Form submission** document — call requests,
briefs, job applications and blog comments, in one section at the top of the
Studio sidebar with a filtered list per kind.

> **Before turning this on, set the dataset to Private.** A Sanity dataset is
> public on creation, and a public one answers an unauthenticated query from
> anyone — while the project id and dataset name sit in every CMS image URL on
> the site. Switching the mirror on against a public dataset publishes every
> lead and every job applicant's name, phone number and CV link to the open
> internet. `supabase/functions/_shared/sanity.ts` now refuses to write into a
> public dataset and `npm run verify` reports one, so this cannot happen
> silently — but the setting is still yours to change: sanity.io/manage → API
> → Datasets. Confirm `SANITY_READ_TOKEN` is a GitHub Actions secret first;
> that is what the build needs once the dataset is private.

> **Also check the publish webhook has its filter.**
> These documents land in the same dataset the deploy webhook watches, so
> unless `submission` is excluded by the GROQ filter on it (step 7 of
> *One-time setup*), every enquiry, booking confirmation and comment approval
> rebuilds and re-uploads the whole site. The mirror is what makes that filter
> necessary, so the two belong switched on together.

```bash
supabase secrets set \
  SANITY_PROJECT_ID=20wlzfea \
  SANITY_DATASET=production \
  SANITY_WRITE_TOKEN=sk...        # sanity.io/manage -> API -> Tokens (Editor)
supabase functions deploy notify --no-verify-jwt
```

Then run **`supabase/mirror-events.sql`** once in the SQL editor, so the copy
follows the row: a call you confirm stops reading as "new", an approved comment
shows as published, a rejected one disappears instead of sitting there looking
like it still needs moderating. It ends with a backfill for the rows you
already have, commented out until you have checked the output above it.

**Do not just tick Update and Delete on the webhooks.** It looks like the same
thing and it is not. These webhooks call a hand-written `notify_new_row()` that
hardcodes `'type', 'INSERT'` and reads `NEW` — so an UPDATE would arrive at the
Edge Function looking like a brand new submission (a second notification email
to you, a second acknowledgement to the client, for a call they already had
confirmed), and a DELETE would raise on the unassigned `NEW` and take the
deletion down with it. `mirror-events.sql` makes the function event-aware and
changes the trigger in the same transaction, because the two halves cannot be
applied separately. It lifts the URL and the secret out of the existing
function rather than asking for them, so it carries no credential and needs
none typed.

Three things to be clear about before switching it on:

**Supabase remains the source of truth.** The row policies, the column grants
and the rate limiter are there, and it is what the site and the booking flow
read and write. The Sanity documents are a mirror, written by the webhook.

**It is a reading room, not a control panel.** Every field is read-only, and
the type is kept out of the "create new document" menu. Ticking `approved` on
a mirrored comment would publish nothing — the blog reads comments from
Supabase — and the next mirror would overwrite it anyway. Approve from the
email buttons, or in the Supabase dashboard.

**One copy of personal data becomes two.** Applications carry names, phone
numbers and CV links; enquiries carry client leads. Sanity has no per-document
permissions on the standard plans, so anybody invited to the project can read
all of it — worth remembering on the day you invite an editor just to write a
blog post. And if the dataset is **public**, "anybody invited" is "anybody":
see the warning above. A deletion request now has to be honoured in both
places, and the privacy policy should say where the data lives.

Leave `SANITY_WRITE_TOKEN` unset and none of this happens; everything else
works exactly as before.

### Confirming a call, and what the other person gets

A booking used to stop at your inbox. The row landed in `enquiries`, you read
a slot off an email, and everything after that was manual — writing back,
making a calendar entry, remembering to send the link. On a busy week it did
not happen, and the person who booked was left with a page that said "we will
confirm by email" and no email.

What happens now, end to end:

```
visitor picks a slot, adds guests   ->  enquiries row  ->  notify
        |                                                    |
        |<------ "we have your request" (them only) ----------|
                                                             |
                     "Confirm / Cannot make it" (you) <------|
                              |
                    you press Confirm on /schedule/
                              |
                              v
        one email, one .ics  ->  them + their guests + you
                                 (accept, and it is on the calendar)
```

**Turning it on takes three things**, none of which are new tools:

```bash
# 1. the columns: guest_emails, status, confirmed_at, meeting_url, invite_seq
#    Re-run the whole of supabase/schema.sql in the SQL editor — every
#    statement in it is guarded, so re-running is the intended way to upgrade.

# 2. the function behind the buttons
supabase functions deploy schedule --no-verify-jwt
supabase functions deploy notify   --no-verify-jwt   # the buttons live here

# 3. the new wording, into the CMS (from studio/)
SANITY_WRITE_TOKEN=sk... npm run seed:copy -- --dry-run
SANITY_WRITE_TOKEN=sk... npm run seed:copy
```

Step 3 is not optional: the guest field's labels are CMS copy like every other
string on the site, and the build **fails** while the Book-a-call document is
missing them rather than shipping a form with blank labels. `seed:copy` only
fills what is empty, so nothing you have edited is touched.

**Guests.** The booking form has an *Add guests* line. Anyone added is invited
alongside the person who booked — the same email, the same calendar
invitation. **Guests hear nothing until you press Confirm**: the instant "we
have your request" acknowledgement goes to the booker alone, because a guest
list a stranger typed is a list of strangers. The form takes five; the function takes ten in total, so you can
add a colleague or two yourself on the confirmation screen. `MAX_GUESTS` in
`supabase/functions/_shared/util.ts` is the number that actually binds.

**The confirmation screen** (`/schedule/`) shows you who booked, what they
wrote, and the slot **in both timezones** — theirs and yours. It is also where
the joining link is set, and it arrives already filled in, so confirming really
is one press.

**Every booking gets a room of its own.** The link is derived from the
booking's id — the same booking always resolves to the same room, so
confirming twice does not move it out from under anyone holding the
invitation, and no two bookings ever share one. That last part is the reason
it works this way rather than reusing a single standing room: the calendar
offers slots fifteen minutes apart, so a shared room means an overrunning call
puts one client inside another's. The rooms default to the public Jitsi
instance, which needs no account; `MEETING_ROOM_BASE` moves them to a
self-hosted Jitsi or a Whereby subdomain.

You can always type a different link for one call, or clear the field to send
an invitation carrying just the time. `MEETING_URL` replaces the generated
rooms with one fixed room for everything — reasonable for a Zoom personal
meeting ID, which has a waiting room; not for a bare Meet link, which does
not.

Wiring Confirm to Google Calendar so it creates a real Meet event on your own
calendar is possible and is a bigger job: it needs a Google Cloud project and
either OAuth with a stored refresh token, or a service account with
domain-wide delegation if aniwala.com is on Workspace. The generated rooms
exist so that none of that is on the critical path.

**What gets sent.** One email to everybody, carrying a real calendar
invitation (`METHOD:REQUEST`), plus Add-to-Google / Add-to-Outlook links for
clients that hide the attachment. Accepting it puts the call on their calendar
— you are not asking anyone to retype a time out of a paragraph.

**Pressing Confirm twice is safe, and is the fix for most mistakes.** The
invitation carries the row id as its UID and a `SEQUENCE` that goes up on every
send, which is exactly how a calendar wants an update. Change the joining link,
add a guest, press Confirm again: everybody's existing entry is amended rather
than duplicated.

**Cannot make it** marks the booking declined and writes to them with a link
back to the calendar. If you had already confirmed, a cancellation goes with it
and the event comes off the calendars it was put on.

**A slot that has passed cannot be confirmed.** Opening a week-old email and
pressing the button would otherwise put a meeting in somebody's past and tell
them it is on; the function refuses and says so.

**Two clicks, not one, and deliberately.** The email link opens a page; only
the button on it acts. Mail scanners fetch every URL in a message before you
read it — if the link itself confirmed, Outlook SafeLinks would be sending
calendar invitations to your clients on your behalf. Scanners do not submit
forms. The same reasoning is written out at length in `moderate/index.ts`.

Confirm links last 90 days. Everything above is optional in the sense that the
rest of the site does not depend on it: without the `schedule` function
deployed, a booking still lands in the table and still emails you — it simply
arrives without the buttons.

### Why is the comment form not showing?

Because Supabase is not connected. `Comments.astro` renders a plain fallback
panel for visitors, and under `astro dev` it adds a short note saying exactly
which two steps are missing. That note never ships in a production build.

### Adding portfolio tiles

**One tile is one `piece` document.** There is no grid editor, and there is no
cap: six tiles is six documents, twelve is twelve. The gallery on
`/portfolio/<discipline>/` is `piecesIn(slug)` — a plain filter over every
piece, with no slice anywhere in it.

What each tile decides for itself:

- **Image, video, or both.** A video plays over the image, which becomes its
  poster. Image only is a still tile. They mix freely in one grid.
- **Wide tile**, which spans the full row. The grid is two columns on desktop,
  so wide / narrow / narrow is the rhythm most studio galleries use. The
  schema's "about one in four" is a description string, not a rule.
- **Position**, which orders them. Leave gaps — 10, 20, 30 — so one can be
  slotted in later without renumbering the rest.

By hand: **Portfolio pieces → `+`**, then set **Category** (this is what files
it under a discipline — a piece without one renders nowhere), Image, and the
Credits & display tab. Build the first one properly, then use **Duplicate** in
the document's `⋯` menu for the rest.

To stamp out the scaffolding instead, from `studio/`:

```bash
node --env-file=../.env scripts/seed-pieces.mjs --category=character-design
node --env-file=../.env scripts/seed-pieces.mjs --category=vfx --count=12
node --env-file=../.env scripts/seed-pieces.mjs --category=animation --wide=1,5,9
node --env-file=../.env scripts/seed-pieces.mjs --category=vfx --dry-run
```

It creates empty tiles with Category, Kind, Client, Year, Position and the
wide/narrow pattern already set, leaving one job per tile: drop the artwork in
and press Publish.

**Everything it makes is a Sanity draft.** A production build reads with
`perspective: 'published'`, so none of them can reach staging or the live site
however long they sit there — they become real when a person publishes them.
It uses `createIfNotExists`, so a second run skips what is already there rather
than wiping an image somebody had already uploaded.

### Publishing a lot of things at once

Publish is per-document by design — it is the moment a thing becomes public, and
Sanity makes you say so each time. Two ways round it when that is thirty tiles
rather than one page.

**Releases**, in the Studio's top bar, is the native one and the better choice
when the point is *coordination*: add documents to a release, then publish the
whole release as one action, optionally at a chosen time. A gallery, a case
study and the blog post announcing it can go live together rather than in
whatever order somebody clicked.

**The script** is for the other case — many things that are simply finished and
want no ceremony. From `studio/`:

```bash
node --env-file=../.env scripts/publish-drafts.mjs --type=piece --dry-run
node --env-file=../.env scripts/publish-drafts.mjs --type=piece --require-image
node --env-file=../.env scripts/publish-drafts.mjs --type=piece --category=vfx
```

**`--require-image` is the flag that matters.** Seeding a gallery creates tiles
with placeholder titles and no artwork; a draft like that costs nothing, and
published it is a live page reading "Animation 3" over a flat tint. With the
flag, only the tiles somebody has actually finished go live, and running it
again next week picks up whatever was finished since.

`--dry-run` prints the plan and writes nothing. Start there — a typo in
`--category` is much easier to notice before the write than after.

It publishes in **one transaction**: a run lands completely or not at all,
because a half-published gallery is worse than an unpublished one — it looks
finished.

> The client is created with `perspective: 'raw'`, and without it the script
> silently reports "No drafts match". The default perspective on this API
> version excludes drafts entirely — the same trap documented at length in
> `src/lib/sanity/client.ts`. Anything new that goes looking for drafts needs
> the same setting.

### Adding a case study

Same idea — **Case studies → Create** in the Studio. Newest three appear on
the homepage, all of them at `/case-studies/`.

A few fields behave differently from the blog:

- **Services** references the Service documents. It drives the cross-links
  back to the service pages, so a case study and the service it demonstrates
  always point at each other.
- **Results** wants facts you can point at — shot counts, runtimes, asset
  counts. Not invented percentages: "40% faster" with nothing behind it is
  the kind of claim a producer asks you to substantiate in a meeting.
- **Featured** pins it as the lead card. Use it on one study at a time.

**`kind` is load-bearing, not a label.** `Studio project` renders a gold badge
on every card plus a disclosure panel at the top of the page, so a
self-directed piece can never be mistaken for commissioned work. Only set
`Client project` when there was a client and they have agreed to be named.

`services` drives the cross-links back to the service pages, so a case study
and the service it demonstrates always point at each other.

### About the seed content

The seven blog posts and three case studies now in Sanity were written to give
the site something real to launch with. **The three case studies describe
projects the studio has not actually made.** They are marked `Studio project`
so nothing claims a client, but they must be replaced with real work — or
deleted — before the site goes anywhere near a client. Both listing pages
render an honest empty state when their collection is empty, so deleting is
safe.

## Conventions

- Every full-width band sizes itself with `max-width: var(--shell-max)` and
  `padding-inline: var(--gutter)`. Never hardcode a container width — the two
  tokens in `global.css` are what make the page scale as one thing. `--gutter`
  grows with the viewport; `--shell-max` is where content stops widening, and
  setting it to `none` gives true edge-to-edge at any width.
- Text keeps its own measure cap (`.prose` at 68ch, leads at ~50ch) rather than
  relying on the shell. That is why the shell can widen without producing
  200-character lines.
- Add `data-reveal` to any element that should rise and fade in on scroll.
  Add `data-reveal-delay="0.1"` to stagger it.
- Inner pages start with `<PageHero />`, which carries the offset for the fixed
  header. Only the homepage uses the full-bleed `<VideoHero />`.
- Blog body styling is `.prose` in `global.css`, and it has to stay global —
  `<Content />` emits unscoped HTML, so a `.prose` rule inside a page's
  `<style>` block would not reach a single paragraph of it.
- Animate only `transform` and `opacity`. Anything else drops frames.
- Every motion feature must no-op under `prefers-reduced-motion`.
  `src/lib/motion.ts` handles this centrally — keep it that way.
- Images go through `astro:assets` so they build to AVIF/WebP.
  Never `<img src="/big.jpg">`.
- Video never lives on the web server. Sanity, Cloudflare R2 or Cloudflare
  Stream — see *Video*. (This line used to name Bunny and Vimeo, and the hero
  loop was sitting in `public/video/` regardless, shipping 2.3MB through every
  deploy to change a file nobody was deploying code for.)
- A page's own `<style>` block cannot reach inside a component it renders.
  Astro scopes every element in a selector to the file it is written in, so
  `.grid > *` compiles to `> *[data-astro-cid-thispage]` and a child component's
  root carries its OWN id. Use `:global()` for the child half. The rule silently
  matches nothing otherwise, which looks like a layout bug, not a scoping one.

## Second site

Goes to `aniwala.com/labs/` from its own repo, with `base: '/labs'` in its
Astro config and `server-dir: /public_html/labs/` in its workflow. This
repo's workflow already excludes `labs/**` so the two never overwrite
each other.
