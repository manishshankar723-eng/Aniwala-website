/**
 * The part of the site's navigation that is NOT content.
 *
 * The header and footer menus moved to Sanity as the `navigation` singleton —
 * see `getNavigation()` in `lib/studio.ts`. Adding a page to the menu should
 * not need a developer, and the two guards that make that safe live elsewhere:
 * the schema refuses a malformed href, and `check-links.mjs` fails the build
 * if a path does not resolve.
 *
 * The hand-kept part of the search index went the same way, onto the same
 * `navigation` document — see `searchPages` there. It sat here on the
 * argument that it is "maintained alongside the templates", and that turned
 * out to be the wrong test: adding a page to the menu and adding it to search
 * are the same decision made by the same person, and only one of them needed
 * a developer.
 *
 * What is left is the SHAPE of an entry, which several modules build and one
 * renders, and which is code because it is a type rather than a value.
 */

/**
 * One entry in the search index.
 *
 * Most are derived: `lib/searchDocs.ts` reads posts, services, case studies,
 * roles and disciplines off their own documents at build time, so publishing
 * any of those makes it searchable without anyone remembering anything. Only
 * the pages whose text is written into a template have to be listed by hand.
 */
export interface SearchDoc {
  title: string;
  href: string;
  section: string;
  keywords: string;
}
