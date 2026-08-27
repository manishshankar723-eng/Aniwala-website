/**
 * Site navigation. Header and mobile drawer both read this, so a link
 * never has to be added in two places.
 */
export interface NavChild {
  label: string;
  href: string;
  /** Optional one-liner shown under the label in the dropdown. */
  blurb?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  children?: NavChild[];
  /**
   * Keep the item out of the header, but still list it in the footer and in
   * search. For pages that deserve a route and a link without spending one of
   * the six slots a header can carry before it starts to read as a directory.
   */
  hiddenInHeader?: boolean;
}

/**
 * An item may have BOTH `href` and `children`. The header then renders the
 * label as a link to `href` and the caret beside it as the dropdown toggle,
 * and the mobile drawer adds an "All <label>" row at the top of the sublist.
 * So a parent page never needs a hand-written row of its own in `children`.
 */

export const nav: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Portfolio', href: '/portfolio/' },
  /* Reachable from the homepage section, the footer and search — the header
     stays short. */
  { label: 'Case Studies', href: '/case-studies/', hiddenInHeader: true },
  {
    label: 'Services',
    href: '/services/',
    children: [
      {
        label: '3D Art',
        href: '/services/3d-art/',
        blurb: 'Characters, environments, props and vehicles',
      },
      { label: '2D Art', href: '/services/2d-art/', blurb: 'Concept, illustration, UI and key art' },
      {
        label: 'Animation',
        href: '/services/animation/',
        blurb: '2D and 3D performance, gameplay and cinematic',
      },
      { label: 'VFX', href: '/services/vfx/', blurb: 'Simulation, compositing and finishing' },
      {
        label: 'Integration',
        href: '/services/integration/',
        blurb: 'Engine setup, materials and profiling',
      },
      {
        label: 'Video Editing',
        href: '/services/video-editing/',
        blurb: 'Trailers, cutdowns, titles and grade',
      },
    ],
  },
  { label: 'About Us', href: '/about/' },
  { label: 'Blog', href: '/blog/' },
  /* Footer and search only. Careers earns a route and a link, but not one of
     the six header slots — a header carrying seven items starts to read as a
     directory, and the people looking for this page look in the footer. */
  { label: 'Careers', href: '/careers/', hiddenInHeader: true },
  { label: 'Contact', href: '/contact/' },
];

/**
 * The slim strip above the header.
 *
 * `id` versions the dismissal: bump it and the bar returns for people who
 * dismissed the previous one, instead of staying hidden forever.
 */
export const announce = {
  enabled: true,
  id: 'ai-animation-2026',
  text: 'AI + Animation — faster iteration, same hand-finished craft.',
  cta: 'See how we use it',
  href: '/ai-animation/',
};

/** The gold call-to-action button at the end of the header. */
export const cta = { label: 'Book Appointment', href: '/contact/' };

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
