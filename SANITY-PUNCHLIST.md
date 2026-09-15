# What the site is waiting on

Everything in this file is a **CMS edit, not a code change**. The technical
foundation is sound; what is missing is content, plus a handful of fields that
switch already-shipped code on.

Edit at `aniwala.com/admin`. Compiled from the built output on 13 September
2026 — 67 pages, 41 in the sitemap. Character counts are measured from the live
HTML, not estimated. **The video, poster, service-hero and team items were
re-checked against the dataset on 14 September 2026**; the other counts are
still as of the 13th.

After publishing in the Studio, run `npm run restart` before checking locally —
the dev server caches CMS content until it restarts.

---

## First — worth more than the rest combined

The dataset holds **3 pieces, 3 case studies and 7 posts with zero images
between them**. Every one of the 138 `<img>` tags on the live site is a logo, a
discipline tile or a hero backdrop. For an animation studio this outranks every
technical item here: no image-search presence, nothing that earns a link, and a
portfolio that shows no animation.

- [ ] **Cover image — case study: Kite** · *Case studies → Kite → Cover*
  Three case studies with no cover is the single biggest gap between this site
  and a page-one competitor. The `CreativeWork` markup already has a slot for it
  and emits nothing.

- [ ] **Cover image — case study: Ferrous** · *Case studies → Ferrous → Cover*

- [ ] **Cover image — case study: Downpour** · *Case studies → Downpour → Cover*

- [ ] **Cover images on all 7 blog posts** · *Blog → each post → Cover*
  A post with a cover gets a thumbnail in search and a real card when the link
  is shared. Without one it uses the same generic studio card as every other
  page. — *Article image markup is live and waiting on the file.*

- [ ] **Images on the 3 portfolio pieces** · *Portfolio → each piece → Image*
  The tiles currently fall back to a flat colour tint.

- [x] **Poster frame on the homepage hero video** · *Pages → Home → Hero block → Still image*
  **Done, 14 September.** By then the hero was not the 2.3 MB file this line
  described but a **16.5 MB, 112-second showreel** with a poster taken from a
  dark frame of a previous cut. It is now a 1.26 MB 24-second loop, and the
  poster is that loop's own first frame, so the handover cannot be seen.

  **The field moved.** The still is now **Still image** on the hero block
  itself. *Poster slot* was an `artwork` document in a different part of the
  Studio, which is exactly how the still and the video drifted apart; it is
  still read as a fallback and hides itself on heroes that do not use it.
  Dropping a new video on the hero offers a poster frame straight away.

- [ ] **Publish pieces for the 3 empty disciplines** · *Portfolio → new piece → Character Design / Concept & 2D Art / Motion Graphics*
  These three galleries are empty. Their pages were unreachable from the
  portfolio bar until a code fix this week; they are linked now, so an empty
  gallery is the remaining half of the problem.

  **Where the pictures and videos actually live**, because the two are easy to
  confuse and only one of them is the work:

  - **Portfolio disciplines** (Character Design, VFX, ...) is the *category*.
    It has one **Tile image** - the picture on its tile on the homepage grid
    and the portfolio index. It is on the same Content tab, below Blurb,
    Intro and Tint, so it is under the fold rather than missing. All six
    already have one.
  - **Portfolio pieces** is the *work*, and it is a separate collection in the
    left sidebar. A piece has **Image** and **Video**, and a piece is what
    appears in a discipline's gallery. Setting its **Category** to Character
    Design is what files it under
    `/portfolio/character-design/`.

  So: an empty gallery is not a missing image on the discipline. It is that no
  piece points at it yet.

  On a piece, **Image is still wanted even when there is a video** - it is the
  poster, and the only thing on screen until the player has a frame. A video
  with no image falls back to flat tint.

  **Wait for the site deploy before adding one to Rolex or Nike Jordans.** Those
  are the only two video pieces, and neither has an Image. Until the fix for
  `.piece-img` stacking is live, a piece with both shows its image *covering*
  the video permanently. The Studio side is already deployed and will happily
  offer the frame, so this is the one place the two halves being out of step
  can be seen.

  Video takes a direct `.mp4`/`.webm` URL or a Cloudflare Stream id. **Not a
  YouTube or Vimeo link** - the field refuses one, because neither can play as
  a silent background loop.

  **Uploading the video itself.** Drop the file on the Video field in the
  Studio and it uploads straight to Cloudflare R2 - it never goes into Sanity,
  which does not transcode and charges for storage either way.

  A **Poster frame** panel then appears under the drop zone with a frame
  already picked, a slider, and **Use this frame**, which saves it to the
  piece's Image. The automatic pick avoids black and not much more — drag to the
  frame you actually want before saving.

  The other route is a terminal, and it is the better one when the file is
  large or has an audio track nothing will ever play:

  ```bash
  node --env-file=.env scripts/upload-r2.mjs clip.mp4 video/pieces/kite.mp4
  ```

  It strips the dead audio (a browser cannot), prints the public URL, checks
  the URL actually serves, and writes `clip-poster.jpg` beside your file. Paste
  the URL into the Video field and drop the poster on Image.
  `--poster-at=2.5` picks the frame; `--start=2.5` trims the front off and uses
  the new first frame, so the poster and the opening match exactly.

  It does not make a file smaller. Keep a background loop under about 5 MB —
  see *Video → Encoding a hero loop* in README.md for the recipe.

  If the drop zone fails, the likeliest cause is the bucket's CORS policy
  rather than anything in the CMS - see *Video -> If the drop zone refuses an
  upload* in README.md.

---

## Second — code is built and idle

Each of these has working code behind it already. The field is blank, so the
code takes its fallback path and nothing appears. Filling it in is the whole
change.

- [ ] **City — set it to Pune** · *Contact details → Office → City*
  This single field flips the studio's structured data from a generic
  `Organization` to a `ProfessionalService`, which is what local results read.
  The code checks this field specifically, because a local business with no city
  cannot be placed on a map. — *The whole local-business record waits on this
  one field.*

- [ ] **Phone number** · *Contact details → Office → Phone*
  Full international form, e.g. `+91 20 1234 5678`. A local result without a
  phone number is a weaker result.

- [ ] **Street address, State and Postcode** · *Contact details → Office*
  The printed footer address stays as it is — these are the same facts entered
  separately so a search engine can read them. There is no safe way to guess
  which line of a free-text address is the city.

- [ ] **Latitude and longitude** · *Contact details → Office*
  Right-click the office in Google Maps; the first item in the menu is the pair.
  Both or neither — one alone publishes nothing.

- [ ] **Opening hours** · *Contact details → Office → Opening hours*
  One line per block, in the format search engines read: `Mo-Fr 10:00-19:00`.
  The build rejects anything it cannot parse, so a typo fails loudly rather than
  silently dropping the record.

- [ ] **Areas served — Pune, Maharashtra, India** · *Contact details → Office → Areas served*
  This also reaches **all six service pages**, which until this week each
  claimed `areaServed: Worldwide` — directly contradicting the local strategy.
  — *Six service pages inherit this automatically.*

- [ ] **Trading name — currently "aniwala.com"** · *Contact details → Office → Trading name*
  That is a domain, not a legal name. It is published as `legalName` in the
  structured data, printed as the copyright holder in the footer, and is what a
  search engine tries to match against a company record.

- [ ] **Real URLs on the social links** · *Contact details → Social links*
  Every link is still a placeholder pointing at the platform's own homepage. The
  code correctly publishes **no** identity claims rather than asserting the
  studio is X Corp — so `sameAs`, a standard entity signal, is currently empty.

- [ ] **Author on each blog post** · *Blog → each post → Author*
  Blank means "the studio". Name a real person and the post's markup switches
  from `Organization` to `Person` — for craft and technical writing, a named
  animator with a track record is the strongest signal the site could carry, and
  it has none today. — *Person markup is live and waiting on a name.*

- [x] **Hero image on each of the 6 service pages** · *Services → each service → Hero*
  **Done — all six have one.** Each now reaches three places from that one
  upload: the band on the service's own page, its social card, and its
  thumbnail in the homepage's *Six disciplines* section. Replacing a hero
  replaces it in all three.

- [ ] **Team members, clients and testimonials** · *Team / Clients / Testimonials*
  Clients and testimonials are still empty, and the build warns about both on
  every run. These are the pages that convert and the pages that earn links.

  Team has **one published member**, and their photo is the problem: it is
  **200 × 200 pixels**, displayed at roughly 570 px wide, so it renders blurred.
  Sanity's image CDN upscales without complaint, so the page downloads a 960-px
  file holding 200 px of real detail. **Re-upload at 1400 × 1050 or larger**
  (4:3; faces sit high in the crop). A separate sizing bug in the team grid
  would still soften a good photo on a wide monitor, and is not yet fixed.

---

## Third — the words in the search result

Every page has a **Search-result title** and **Search-result description** under
its SEO tab. Both are blank almost everywhere.

- [ ] **Search-result title on all 6 services** · *Services → each → SEO*
  All six are blank, so each page spends its most valuable characters on a brand
  nobody searches for yet. Something like `2D & 3D Animation Studio in Pune |
  Aniwala` puts three ranking terms in front of the brand instead of behind it.
  Cap is 60 characters.

  | Service | Current title | Chars |
  |---|---|---|
  | vfx | VFX — Aniwala Studios | 23 |
  | 2d-art | 2D Art — Aniwala Studios | 26 |
  | 3d-art | 3D Art — Aniwala Studios | 26 |
  | animation | Animation — Aniwala Studios | 29 |
  | integration | Integration — Aniwala Studios | 31 |
  | video-editing | Video Editing — Aniwala Studios | 33 |

- [ ] **Search-result description on all 6 services** · *Services → each → SEO*
  You get about 155 characters and these use 55 to 70 — on the six pages that
  matter most. This is not a ranking factor; it is the sentence that decides
  whether somebody clicks.

  | Service | Chars used | Unused |
  |---|---|---|
  | integration | 55 | 100 |
  | vfx | 62 | 93 |
  | video-editing | 63 | 92 |
  | 2d-art | 65 | 90 |
  | 3d-art | 66 | 89 |
  | animation | 70 | 85 |

- [ ] **4 blog titles get truncated in results** · *Blog → each post → SEO*
  The on-page headline can stay as it is — set a shorter search-result title and
  only Google sees it.

  | Post | Chars |
  |---|---|
  | texel-density-is-a-design-decision | 75 |
  | rigged-or-frame-by-frame | 74 |
  | the-animatic-is-the-cheapest-edit | 72 |
  | what-vfx-needs-from-your-shoot | 72 |

- [ ] **7 descriptions run past 160 characters** · *Each page → SEO*
  The overflow is still indexed, just not shown — so the sentence gets cut
  mid-thought where it was meant to persuade.

  | Page | Chars |
  |---|---|
  | /blog/real-time-is-not-a-shortcut/ | 204 |
  | /careers/ | 193 |
  | /portfolio/character-design/ | 183 |
  | /blog/texel-density-is-a-design-decision/ | 174 |
  | /portfolio/environments/ | 168 |
  | /blog/we-quote-in-shots-not-days/ | 165 |
  | /blog/approve-the-blocking-not-the-render/ | 162 |

---

## Already right — don't spend time here

- **All 49 FAQs are already reaching search.** They render as 7 questions each
  across the 6 service pages and careers, all inside valid `FAQPage` markup. An
  earlier audit read "7 FAQPage blocks" as "only 7 FAQs live" — that was wrong.
  The opportunity is writing more, not surfacing hidden ones.
- Canonicals, `robots.txt`, sitemap, breadcrumbs, one `<h1>` per page and
  `noindex` on the admin pages are all correct.
- Tag and archive pages were de-indexed in code — no CMS action needed.
- All six portfolio category pages now carry their own social card, using
  discipline tiles that were already uploaded.

---

## Not a CMS job — but the biggest lever you have

A new domain with no inbound links will not reach page one on better titles,
however good they are. None of the on-page work above substitutes for:

- A **Google Business Profile** for the Wakad office.
- Links from **ArtStation, Behance and Vimeo** project pages, local Pune and
  Maharashtra directories, game-dev communities, and credits on clients' own
  sites.
