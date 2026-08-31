/**
 * How to reach the studio.
 *
 * One source. The footer, the contact page, the CTA band, the booking form\'s
 * error message and the comments fallback all read from here — before this
 * file existed the address was typed into six places across five components,
 * which is exactly how a site ends up advertising an inbox nobody reads.
 */

/** The studio inbox. Everything public points here. */
export const email = 'contact@aniwala.com';

/** Shown as the copyright holder and used in the footer base line. */
export const legalName = 'aniwala.com';

/* ------------------------------------------------------------------ */
/* Office                                                              */
/* ------------------------------------------------------------------ */
export const office = {
  /** Split into lines so the footer can break it where it should break. */
  lines: [
    'Crossroads Building, Bhumkar Chowk',
    'Survey 130/123, Service Rd, Shankar Kalat Nagar',
    'Wakad, Pimpri-Chinchwad',
    'Maharashtra 411057',
  ],
  country: 'India',
  /**
   * Opens the address in the visitor\'s map app. Built from the address rather
   * than pasted as a shortened share link, because those expire and this one
   * cannot silently start pointing somewhere else.
   */
  get mapsUrl() {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [...this.lines, this.country].join(', ')
    )}`;
  },
};

/* ------------------------------------------------------------------ */
/* Social                                                              */
/*                                                                     */
/* THESE POINT AT THE PLATFORMS, NOT AT US. Until the studio accounts   */
/* exist, each link goes to the service\'s own homepage so the row is    */
/* live and looks right. Nobody lands on a 404 or a dead '#', but       */
/* nobody reaches an Aniwala profile either — swap each `href` for the  */
/* real profile URL as the accounts are created.                        */
/*                                                                     */
/* WhatsApp wants a wa.me link with the number in full international    */
/* form and no punctuation, e.g. 'https://wa.me/919876543210'.          */
/*                                                                     */
/* An entry left with an empty `href` still degrades safely: it renders */
/* under `astro dev` as an inert row and is dropped from the production */
/* build, the same rule the draft team cards follow in config/about.ts. */
/* ------------------------------------------------------------------ */
/**
 * The icons `SocialIcon.astro` can actually draw.
 *
 * A const array rather than a bare union, so the CMS schema can offer exactly
 * this list and the Zod schema can validate against it. An icon name that is
 * not one of these renders as nothing — visible to no one, with no error —
 * which is precisely the kind of silent failure worth a few lines to prevent.
 */
export const SOCIAL_ICONS = [
  'whatsapp',
  'linkedin',
  'x',
  'youtube',
  'facebook',
  'artstation',
] as const;

export type SocialIcon = (typeof SOCIAL_ICONS)[number];

export interface Social {
  label: string;
  icon: SocialIcon;
  href: string;
}

export const socials: Social[] = [
  { label: 'WhatsApp', icon: 'whatsapp', href: 'https://www.whatsapp.com' },
  { label: 'LinkedIn', icon: 'linkedin', href: 'https://www.linkedin.com' },
  { label: 'X', icon: 'x', href: 'https://x.com' },
  { label: 'YouTube', icon: 'youtube', href: 'https://www.youtube.com' },
  { label: 'Facebook', icon: 'facebook', href: 'https://www.facebook.com' },
  /* Not in the reference footer, but this is where an art studio\'s work
     actually gets found. */
  { label: 'ArtStation', icon: 'artstation', href: 'https://www.artstation.com' },
];

/**
 * The socials the site should show.
 *
 * Unset ones stay visible under `astro dev` so the row can be laid out, and
 * are dropped from the production build.
 */
export const publishedSocials = (): Social[] =>
  socials.filter((s) => (import.meta.env.DEV ? true : s.href !== ''));

/* ------------------------------------------------------------------ */
/* Legal pages linked from the footer base                             */
/* ------------------------------------------------------------------ */
export const legalLinks = [{ label: 'Privacy Policy', href: '/privacy/' }];
