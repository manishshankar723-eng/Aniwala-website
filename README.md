# Aniwala

Animation studio site. Astro (static) + Tailwind + GSAP/Lenis, deployed to
Hostinger shared hosting over FTP by GitHub Actions.

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

Push to `main`. GitHub Actions builds and FTPs `dist/` into `public_html`.
Live in roughly 90 seconds. Watch it in the repo's **Actions** tab.

Hostinger runs PHP, not Node — it only ever receives finished HTML.
Never point the workflow at a Node runtime; there isn't one on this plan.

## One-time setup

1. **hPanel → Files → FTP Accounts** — note hostname, username, password.
2. **GitHub → Settings → Secrets and variables → Actions** — add
   `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
3. **hPanel → Websites → aniwala.com → Security → SSL** — install the free
   certificate and enable Force HTTPS.

## Layout

```
src/
├── components/          Header, Footer, PageHero, PostCard, Faq, CtaBand...
├── config/
│   ├── nav.ts           Header, footer and search links. One source.
│   ├── site.ts          Homepage content
│   ├── services.ts      One record per service = one service page
│   ├── careers.ts       One record per opening = one careers page
│   └── categories.ts    Journal categories, shared by schema and UI
├── content/
│   ├── blog/            Blog posts, one Markdown file each
│   └── case-studies/    Case studies, one Markdown file each
├── content.config.ts    Frontmatter schemas for both collections
├── layouts/Base.astro   Shell: SEO meta, fonts, view transitions, motion boot
├── lib/
│   ├── motion.ts        Lenis + GSAP/ScrollTrigger, reduced-motion guarded
│   ├── posts.ts         Post fetching, draft rule, dates, reading time
│   └── caseStudies.ts   Case study fetching, ordering, service cross-links
├── pages/               Every file here becomes a route
└── styles/global.css    ALL design tokens — colour and type change here only
public/
├── .htaccess            HTTPS, canonical host, cache headers, 404
└── robots.txt
```

### Adding or renaming a service

Add an object to `src/config/services.ts` and a link to `src/config/nav.ts`.
`src/pages/services/[slug].astro` builds the page — there is no template to
copy, and search picks it up on its own.

The six services are **3D Art, 2D Art, Animation, VFX, Integration** and
**Video Editing**.

Three things have to move together when a `slug` changes, and nothing will
warn you about the last one:

1. the matching `href` in `src/config/nav.ts`, or the nav link 404s;
2. any `services:` entry in `src/content/case-studies/*.md` — a stale slug is
   silently dropped from the case study's cross-links rather than erroring;
3. `enquiryTypes` in `src/config/site.ts`, which fills the contact form's
   dropdown and is matched by label rather than slug.

Note `shortName` and `article`. They exist because the page writes sentences
like "Have **an** integration brief?" and "Have **a** VFX brief?" — the article
follows the spoken sound, not the first letter, so it is stored rather than
guessed.

### Posting or closing a job

Add an object to `openRoles` in `src/config/careers.ts`.
`src/pages/careers/[slug].astro` builds the page, `/careers/` lists it, search
indexes it and the JobPosting structured data is emitted from the same record —
there is nothing else to touch.

**Closing a role means deleting its object, not annotating it.** Its page stops
being built, it drops out of the listing and it leaves search the same day. A
listing still live three months after the seat was filled costs you the next
good applicant.

Two fields carry more weight than they look:

- `posted` is emitted as `datePosted` in the structured data. Google drops
  stale postings from its jobs index on its own, so a date left at last
  quarter quietly removes the role from the biggest source of applicants.
- `reelNote` is the "what to send" panel — the single most useful line on a
  creative job ad, and the one almost nobody writes. An animator and a
  character artist are judged on different things; saying which saves a round.

Set `hiringOpen = false` to take everything down at once. The page keeps its
open application and explains itself rather than going blank.

Applications land in the `applications` table, both kinds in one place:
`kind = 'role'` for an application against a listing, `kind = 'open'` for
somebody who wants a seat that is not posted yet. Sort by that column in the
Table Editor and you have two working queues.

### Adding a blog post

Drop a Markdown file in `src/content/blog/`. **The filename becomes the URL**,
so renaming one breaks its link. Frontmatter is validated against
`src/content.config.ts`, and the build fails loudly on a bad field rather than
publishing something malformed.

```yaml
---
title: 'Approve the blocking, not the render'
description: 'One or two lines. Also used as the meta description.'
pubDate: 2026-08-12
category: 'Craft'        # Craft | Pipeline | Studio | Industry
tags: ['3d animation', 'review']
tint: '210 70% 22%'      # HSL triple for the card art
draft: false             # true = visible in dev, absent from the live build
---
```

Reading time is counted from the body, never typed. A new post appears on the
blog index, its category page and site search automatically. The homepage does
**not** list posts — the blog is reached from the nav.

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

Two places, on purpose.

| What | Where |
| --- | --- |
| Posts, case studies, services, nav | This repo. Plain files, diffable, in git. |
| Enquiries, bookings, applications, comments | One Supabase project. |

Everything a visitor submits goes into a single Supabase database, so there is
one dashboard to check and one export to take — not a form service plus a
comment service plus a scheduler.

### Setting up Supabase

1. Create a free project at <https://supabase.com>.
2. **SQL Editor → New query → paste all of `supabase/schema.sql` → Run.**
   Do not skip this. It creates the tables *and* the Row Level Security
   policies, and the policies are the only thing protecting the data.
3. **Project Settings → API** — copy "Project URL" and the **anon public** key
   into `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `src/config/site.ts`.

Until those are filled in, the booking form and the comment form both refuse to
submit and say so, rather than dropping data into a void.

**The anon key is public.** It ships inside the JavaScript bundle and anyone can
read it — that is how Supabase is designed to work. Security comes entirely from
the RLS policies, which allow anon to INSERT and nothing else (comments can
additionally read rows you have approved). Read the header comment in
`supabase/schema.sql` before changing any policy: adding a SELECT policy to
`enquiries` would make every lead you have ever received world-readable.

**Never put the `service_role` key in this repo.** It bypasses RLS entirely and
this codebase compiles into a public website.

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
                                                                      |
                        comment emails carry Approve / Reject buttons  |
                                                                      v
                                        moderate function  ->  published / deleted
```

Enquiries are routed by service and are pure notification — hit Reply and you
are writing to the person who asked. Comments arrive with two buttons.

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

4. Deploy both functions:

   ```bash
   supabase functions deploy notify   --no-verify-jwt
   supabase functions deploy moderate --no-verify-jwt
   ```

   `--no-verify-jwt` is needed because the callers are a database trigger and
   a mail client, neither of which has a Supabase session. They are not open
   endpoints: `notify` checks the `NOTIFY_SECRET` header, and `moderate`
   checks an HMAC over the row id **and** the action, so an approve link
   cannot be edited into a reject link or reused on another comment.

5. Dashboard → **Database → Webhooks → Create**, three times — once for
   `comments`, once for `enquiries`, once for `applications`. All three: event
   `INSERT`, type **HTTP Request**, method
   `POST`, URL `https://<project-ref>.supabase.co/functions/v1/notify`, and
   add the HTTP header `x-notify-secret` with the value from step 3.

Create the webhooks in the dashboard rather than as SQL in this repo: the
trigger definition embeds credentials, and those must not be committed.

**Do not put the `service_role` key anywhere in this repo.** `moderate` reads
it from the Edge Function environment, where Supabase provides it
automatically.

If you skip all of this, nothing breaks — comments still queue up and you
approve them in the Table Editor as described above.

### Why is the comment form not showing?

Because Supabase is not connected. `Comments.astro` renders a plain fallback
panel for visitors, and under `astro dev` it adds a short note saying exactly
which two steps are missing. That note never ships in a production build.

### Adding a case study

Same idea, in `src/content/case-studies/`. Newest three appear on the homepage,
all of them at `/case-studies/`.

```yaml
---
title: 'Kite'
description: 'One line. Also the meta description.'
kind: 'Studio project'   # or 'Client project'
client: 'Aniwala Studios'
sector: 'Short film'
year: 2026
services: ['animation']  # slugs from config/services.ts
deliverables: ['ProRes 4444 master at 2K, 24fps']
tools: ['Toon Boom Harmony']
results:                          # facts you can point at, NOT invented %
  - { label: 'Runtime', value: '40 seconds' }
tint: '28 75% 26%'
featured: false          # pins it as the lead card. Use on ONE study.
draft: false
---
```

**`kind` is load-bearing, not a label.** `Studio project` renders a gold badge
on every card plus a disclosure panel at the top of the page, so a
self-directed piece can never be mistaken for commissioned work. Only set
`Client project` when there was a client and they have agreed to be named.

`services` drives the cross-links back to the service pages, so a case study
and the service it demonstrates always point at each other.

### About the seed content

Everything in `src/content/blog/` and `src/content/case-studies/` was written
to give the site something real to launch with. **The three case studies
describe projects the studio has not actually made.** They are marked
`Studio project` so nothing claims a client, but they must be replaced with
real work — or deleted — before the site goes anywhere near a client. Both
listing pages render an honest empty state when their folder is empty, so
deleting is safe.

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
