/**
 * Builds the search index.
 *
 * This used to live in the frontmatter of Search.astro, which put the whole
 * index inline in the markup of every page. That was defensible at seven
 * pages and stopped being defensible somewhere around thirty: the index was
 * ~10KB of JSON repeated in all 64 HTML files, and it grew with every post,
 * case study and job listing — so publishing an article made every unrelated
 * page on the site heavier.
 *
 * It is now served once from `/search.json` and fetched the first time
 * somebody opens the search bar, which for most visitors is never.
 *
 * The derivation rule is the point of this file: everything except the handful
 * of hand-written entries in `nav.ts` is read from the same config and content
 * the pages themselves are built from. A hand-kept index fails silently — it
 * stops matching the site and nobody notices until a search for a real page
 * returns nothing.
 */
import { searchIndex, type SearchDoc } from '../config/nav';
import { getPosts } from './posts';
import { getCaseStudies } from './caseStudies';
import { services } from '../config/services';
import { workCategories, categoryHref } from '../config/portfolio';
import { openRoles } from '../config/careers';

export async function buildSearchDocs(): Promise<SearchDoc[]> {
  const posts = await getPosts();
  const studies = await getCaseStudies();

  /* Derived, not listed by hand — renaming a service in config/services.ts
     must not be able to leave a dead entry behind in search. */
  const serviceDocs = services.map((s) => ({
    title: s.label,
    href: `/services/${s.slug}/`,
    section: 'Services',
    keywords: [s.tagline, ...s.offerings.map((o) => o.title), ...s.tools].join(' ').toLowerCase(),
  }));

  /* Tags and category go into `keywords` so a search for "unreal" or
     "pricing" finds the post even when neither word is in its title. */
  const postDocs = posts.map((p) => ({
    title: p.data.title,
    href: `/blog/${p.id}/`,
    section: 'Blog',
    keywords: [p.data.description, p.data.category, ...p.data.tags].join(' ').toLowerCase(),
  }));

  const caseDocs = studies.map((c) => ({
    title: c.data.title,
    href: `/case-studies/${c.id}/`,
    section: 'Case studies',
    keywords: [c.data.description, c.data.sector, c.data.client, ...c.data.tools]
      .join(' ')
      .toLowerCase(),
  }));

  /* The portfolio disciplines, on the same rule as the services above.

     Individual pieces are deliberately NOT folded in. The ones worth finding
     already have a case study, which `caseDocs` covers — listing both would
     put two "Kite" rows in the results, pointing at the same place. */
  const portfolioDocs = workCategories.map((c) => ({
    title: c.title,
    href: categoryHref(c.slug),
    section: 'Portfolio',
    keywords: [c.blurb, c.intro].join(' ').toLowerCase(),
  }));

  /* Open roles, on the same rule again — and here it matters more than
     anywhere else on the site, because a listing is deleted the moment it is
     filled. Deriving these means a filled role leaves search the same day it
     leaves the careers page, instead of lingering as a hand-written entry
     pointing at a 404. */
  const roleDocs = openRoles.map((r) => ({
    title: r.title,
    href: `/careers/${r.slug}/`,
    section: 'Careers',
    keywords: [r.summary, r.discipline, r.kind, r.location, r.experience, ...r.software]
      .join(' ')
      .toLowerCase(),
  }));

  return [
    ...searchIndex,
    ...serviceDocs,
    ...portfolioDocs,
    ...caseDocs,
    ...roleDocs,
    ...postDocs,
  ];
}
