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
<https://aniwala.com/admin> (which redirects to `aniwala.sanity.studio`).

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
├── layouts/Base.astro   Shell: SEO meta, fonts, view transitions, motion boot
├── lib/
│   ├── sanity/          client.ts, loader.ts, portableText.ts
│   ├── studio.ts        Every CMS accessor the templates call
│   ├── motion.ts        Lenis + GSAP/ScrollTrigger, lazily imported
│   ├── copy.ts          Token substitution, ldJson, inlineHtml escaping
│   ├── supabase.ts      Minimal PostgREST client (no SDK)
│   ├── submit.ts        One path for all three forms; picks Turnstile or not
│   └── searchDocs.ts    Builds the search index, served as /search.json
├── pages/               Every file here becomes a route
└── styles/global.css    Reset, @font-face, and ALL design tokens
scripts/
├── check-links.mjs      Fails CI on a broken link, missing asset or scripted href
├── build-preview.mjs    A build that shows unpublished drafts
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
└── functions/           submit, notify, moderate, schedule (Deno, run on Supabase)
studio/                  The Sanity Studio. A separate npm package.
```

## Checks

```bash
npm run verify      # astro check + build + link check. What CI runs.
npm run check       # types and templates only
npm run check:links # needs an existing dist/
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

### Secrets

Public by design, and fine in the bundle: `SANITY_PROJECT_ID`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TURNSTILE_SITE_KEY`.

Never in this repo or the bundle: the Supabase **service role** key,
`TURNSTILE_SECRET_KEY`, `MODERATION_SECRET`, `NOTIFY_SECRET`, any Sanity
**write** token. Those live on the Edge Functions (`supabase secrets set`) or
in GitHub Actions secrets.

`SANITY_READ_TOKEN` should be a **Viewer** token. It only ever needs to read
drafts for previews, and a Viewer token cannot alter the site if it leaks.

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
   - Headers: `Authorization: Bearer <a GitHub PAT with repo scope>`,
     `Accept: application/vnd.github+json`
   - Body: `{"event_type": "sanity-publish"}`
   - Trigger on: create, update, delete

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
tell you.** The trigger enforces two ceilings, per address and global; the
global one is what protects the mail quota against a run from many addresses.
Current limits are in the comments of section 5 — all far above real traffic.

If you ever need to bulk-import rows, do it from the SQL editor or with the
service key: requests with no forwarded client address are deliberately not
limited, so your own maintenance never locks you out.

### Turnstile — the layer in front of the rate limiter

**Optional, and off until you add the keys.** With `TURNSTILE_SITE_KEY` unset
the three forms behave exactly as they always did: straight to PostgREST under
the anon key, protected by RLS and the rate limiter. Set it and they post
through the `submit` Edge Function, which verifies a Cloudflare Turnstile token
before writing anything — so automated traffic never reaches the database.

That fallback exists because the site, the Edge Functions and the Cloudflare
account are three separate deploys that do not land at the same moment. A build
made before the keys exist has to keep working, or the forms go dark in the gap.

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
4. Deploy the site, then **submit a real form on aniwala.com and confirm it
   arrives.**
5. Only once that works, run the cutover in section 7 of `supabase/schema.sql`
   to remove anon's INSERT grants. Doing it earlier breaks every live form.

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
blog post. A deletion request now has to be honoured in both places, and the
privacy policy should say where the data lives.

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
        |<--- "we have your request" (them + their guests) ---|
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
invitation. The form takes five; the function takes ten in total, so you can
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
- Video never lives on Hostinger. Bunny Stream or Vimeo, embed by ID.

## Second site

Goes to `aniwala.com/labs/` from its own repo, with `base: '/labs'` in its
Astro config and `server-dir: /public_html/labs/` in its workflow. This
repo's workflow already excludes `labs/**` so the two never overwrite
each other.
