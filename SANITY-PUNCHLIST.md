# What the site is waiting on

Everything in this file is a **CMS edit, not a code change**. The technical
foundation is sound; what is missing is content, plus a handful of fields that
switch already-shipped code on.

Edit at `aniwala.com/admin`. Compiled from the built output on 13 September
2026 — 67 pages, 41 in the sitemap. Character counts are measured from the live
HTML, not estimated.

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

- [ ] **Poster frame on the homepage hero video** · *Pages → Home → Hero block → Poster slot*
  The hero is a **2.3 MB autoplaying MP4 with no poster**, above the fold.
  Nothing paints in that area until the first frame decodes — this is the
  homepage's largest-contentful-paint on a phone. — *The field already exists
  and is empty.*

- [ ] **Publish pieces for the 3 empty disciplines** · *Portfolio → new piece → Character Design / Concept & 2D Art / Motion Graphics*
  These three galleries are empty. Their pages were unreachable from the
  portfolio bar until a code fix this week; they are linked now, so an empty
  gallery is the remaining half of the problem.

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

- [ ] **Hero image on each of the 6 service pages** · *Services → each service → Hero*
  All six currently share one site-wide fallback picture, so all six share the
  generic social card. Uploading a hero gives that service its own card
  automatically.

- [ ] **Team members, clients and testimonials** · *Team / Clients / Testimonials*
  All three collections are empty, and the build warns about each one on every
  run. These are the pages that convert and the pages that earn links.

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
