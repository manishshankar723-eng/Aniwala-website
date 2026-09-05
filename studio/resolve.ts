/**
 * Which URL a document is published at.
 *
 * ONE MAP, because two would disagree. The Presentation tool uses it to show
 * an editor the page they are editing, and the SEO panel uses it to draw the
 * green URL line in its Google preview. Writing the route shapes out twice is
 * how the Studio ends up previewing one URL and linking to another.
 *
 * KEEP IT IN STEP WITH `src/pages/`. Nothing can check this automatically —
 * the routes live in the website package and this file lives in the Studio,
 * which is a different npm project with no import path between them. A wrong
 * entry here shows an editor the wrong page; it cannot break the site.
 *
 * WHAT IS DELIBERATELY ABSENT: every singleton that is not a page of its own.
 * Interface copy, Menus, Contact details and the rest appear on every page at
 * once, so there is no single URL to send somebody to, and offering one would
 * be a guess.
 */
import { defineLocations } from 'sanity/presentation';

/**
 * Where each type lives, and what to call that section.
 *
 * The single table both consumers read. `prefix` is empty for a type whose
 * slug sits at the root, and `fixed` marks a document that is one specific
 * page rather than one of many.
 */
const ROUTES: Record<string, { prefix?: string; fixed?: string; section: string }> = {
  post: { prefix: '/blog', section: 'Blog' },
  caseStudy: { prefix: '/case-studies', section: 'Case studies' },
  role: { prefix: '/careers', section: 'Careers' },
  service: { prefix: '/services', section: 'Services' },
  workCategory: { prefix: '/portfolio', section: 'Portfolio' },

  careersContent: { fixed: '/careers/', section: 'Careers' },
  privacyPage: { fixed: '/privacy/', section: 'Privacy policy' },

  /* Documents with no page of their own, shown where they actually appear. A
     team member is not a URL — they are a card on the about page, and saying
     so is more useful than offering nothing. */
  teamMember: { fixed: '/about/', section: 'About' },
  testimonial: { fixed: '/about/', section: 'About' },
  client: { fixed: '/about/', section: 'About' },
  milestone: { fixed: '/about/', section: 'About' },
  engagementModel: { fixed: '/services/', section: 'Services' },
  piece: { fixed: '/portfolio/', section: 'Portfolio' },
};

/**
 * The path a document publishes at, or undefined when it has no page.
 *
 * The home page is the exception worth knowing about: its slug is `home` and
 * its URL is `/`, because a page called "home" living at `/home/` only makes
 * sense to whoever set it up.
 */
export function pathFor(type: string | undefined, slug?: string): string | undefined {
  if (!type) return undefined;

  if (type === 'page') {
    if (!slug) return undefined;
    return slug === 'home' ? '/' : `/${slug}/`;
  }

  const route = ROUTES[type];
  if (!route) return undefined;
  if (route.fixed) return route.fixed;
  return slug ? `${route.prefix}/${slug}/` : undefined;
}

/** The section a type belongs to, for a preview's breadcrumb line. */
export const sectionFor = (type: string | undefined): string | undefined =>
  type === 'page' ? 'Pages' : type ? ROUTES[type]?.section : undefined;

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

const bySlug = (type: string) =>
  defineLocations({
    select: { title: 'title', slug: 'slug.current' },
    resolve: (doc) => {
      const href = pathFor(type, doc?.slug as string | undefined);
      if (!href) return null;
      const section = sectionFor(type) ?? 'Page';
      const route = ROUTES[type];
      return {
        locations: [
          { title: (doc?.title as string) || section, href },
          ...(route?.prefix ? [{ title: section, href: `${route.prefix}/` }] : []),
        ],
      };
    },
  });

/**
 * A document that always appears at one fixed URL.
 *
 * `select` is required by the API even when nothing is selected — the resolver
 * is handed whatever it names, and this one needs nothing because the answer
 * does not depend on the document.
 */
const fixed = (type: string) =>
  defineLocations({
    select: {},
    resolve: () => {
      const href = pathFor(type);
      return href ? { locations: [{ title: sectionFor(type) ?? 'Page', href }] } : null;
    },
  });

/* Built from the same table, so a route added above reaches Presentation
   without a second edit. */
export const locations = {
  page: defineLocations({
    select: { title: 'title', slug: 'slug.current' },
    resolve: (doc) => {
      const href = pathFor('page', doc?.slug as string | undefined);
      return href ? { locations: [{ title: (doc?.title as string) || 'Page', href }] } : null;
    },
  }),
  ...Object.fromEntries(
    Object.entries(ROUTES).map(([type, route]) => [type, route.fixed ? fixed(type) : bySlug(type)])
  ),
};
