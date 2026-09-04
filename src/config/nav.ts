/**
 * The part of the site's navigation that is NOT content.
 *
 * The header and footer menus moved to Sanity as the `navigation` singleton —
 * see `getNavigation()` in `lib/studio.ts`. Adding a page to the menu should
 * not need a developer, and the two guards that make that safe live elsewhere:
 * the schema refuses a malformed href, and `check-links.mjs` fails the build
 * if a path does not resolve.
 *
 * What stays here is the search index below, which is a different thing: a
 * list of pages whose text lives in markup rather than in a document, so the
 * search box can find them. It is maintained alongside the templates, not by
 * an editor.
 */

/**
 * The hand-kept part of the search index: pages whose text is written in
 * markup rather than content files.
 *
 * Blog posts are NOT listed here — Search.astro reads the blog collection at
 * build time and merges them in, so publishing a post makes it searchable
 * without anyone remembering to edit this array. Services, case studies and
 * the portfolio disciplines are folded in the same way.
 */
export interface SearchDoc {
  title: string;
  href: string;
  section: string;
  keywords: string;
}

export const searchIndex: SearchDoc[] = [
  { title: 'Home', href: '/', section: 'Pages', keywords: 'aniwala studios animation showreel' },
  {
    title: 'Portfolio',
    href: '/portfolio/',
    section: 'Pages',
    keywords: 'work projects case studies reel',
  },
  { title: 'About Us', href: '/about/', section: 'Pages', keywords: 'studio team story pipeline' },
  { title: 'Blog', href: '/blog/', section: 'Pages', keywords: 'journal news breakdowns articles' },
  {
    title: 'Contact',
    href: '/contact/',
    section: 'Pages',
    keywords: 'book appointment enquiry email hire quote',
  },
  {
    title: 'Case Studies',
    href: '/case-studies/',
    section: 'Pages',
    keywords: 'work projects breakdown process results portfolio examples',
  },
  {
    title: 'Services',
    href: '/services/',
    section: 'Pages',
    keywords: 'disciplines pipeline engagement outsourcing capabilities what we do',
  },
  {
    /* Only the landing page is listed here. The individual openings are
       derived from config/careers.ts inside Search.astro, so a filled role
       leaves search on the same day it leaves the page. */
    title: 'Careers',
    href: '/careers/',
    section: 'Pages',
    keywords:
      'jobs hiring vacancies openings apply application internship intern recruitment work with us animator artist vfx editor pune',
  },
];
