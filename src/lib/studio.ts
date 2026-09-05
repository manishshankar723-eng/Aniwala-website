/**
 * Accessors for the studio's own content — proof, copy, contact details.
 *
 * One module rather than four tiny ones, because these are all read by the
 * same two or three pages and every one of them is a five-line "fetch a
 * collection, sort it, hand back a flat array". Splitting that across
 * `testimonials.ts`, `clients.ts`, `milestones.ts` and `copy.ts` would be
 * four imports for what reads as one concern: what the site says about
 * itself.
 *
 * THE DRAFT RULE, everywhere below: unpublished entries are visible under
 * `astro dev` and dropped from the production build — the same rule the blog
 * follows, so a section can be laid out with realistic content that cannot
 * accidentally ship.
 *
 * THE EMPTY RULE: each of these can legitimately return nothing, and the
 * pages already handle that by hiding the section. An empty testimonial wall
 * or a "meet the team" heading over nothing is worse than no section at all,
 * which is why the old config shipped these as empty arrays rather than as
 * invented placeholders.
 */
import { getCollection, getEntry } from 'astro:content';
import { imageUrl, iconUrl, isSvgAsset, previewMode, type SanityImage } from './sanity/client';
import type { SocialIcon } from '../config/contact';
import {
  UI_COPY_FIELDS,
  type UiCopyField,
  type ApplyCopyField,
  type BookingCopyField,
  type CareersClosingField,
} from '../config/copyFields';

const live = ({ data }: { data: { draft: boolean } }) => previewMode || !data.draft;

const byOrder = (a: { data: { order: number } }, b: { data: { order: number } }) =>
  a.data.order - b.data.order;

/**
 * What to do when a REQUIRED singleton is not in the dataset.
 *
 * Under `astro dev`: warn and hand back the empty shape, so a fresh clone
 * pointed at an empty dataset still starts and someone can work on a layout
 * without first seeding thirteen document types.
 *
 * In a production build: THROW.
 *
 * This is not theoretical. The migration that moved this content to Sanity
 * shipped the accessors but never wrote `contactDetails` or `siteCopy` to the
 * dataset, and for weeks every build exited 0 while producing a site with an
 * empty `mailto:` on all 65 pages, no address in the footer, no marquee and a
 * blank positioning paragraph. Nothing caught it: the credentials were fine,
 * so the loader was happy; `astro check` type-checks code, not content; and
 * `check-links.mjs` does not treat an empty `mailto:` as a broken link.
 *
 * The loaders already fail a production build when Sanity is unreachable —
 * see the note in `sanity/loader.ts` about never letting a missing credential
 * be quieter than a broken link. A missing DOCUMENT is the same failure one
 * layer up, and deserves the same noise.
 *
 * The empty shape is still returned in dev rather than a hardcoded copy of
 * the old text, for the reason the original note gave: a stale duplicate that
 * silently takes over is worse than a visibly empty heading. One of them you
 * notice; the other you ship for a year.
 */
function missingSingleton<T>(type: string, id: string, empty: T): T {
  if (previewMode) {
    console.warn(
      `[content] No "${type}" document — the site will render with that section empty.\n` +
        `          Create it in the Studio (npm run dev in studio/), or seed the dataset.`
    );
    return empty;
  }

  throw new Error(
    `The "${type}" document is missing from Sanity, so this build would produce a\n` +
      `site with that content blank on every page it appears on.\n\n` +
      `  Expected a published document with _id "${id}".\n\n` +
      `  Fix it in the Studio at aniwala.com/admin, or seed the dataset with\n` +
      `  studio/scripts/migrate.mjs. If a section is genuinely meant to be empty,\n` +
      `  publish the document with blank fields — that is a decision someone made,\n` +
      `  which is the difference between an empty section and a broken one.`
  );
}

/* ------------------------------------------------------------------ */
/* Proof                                                               */
/* ------------------------------------------------------------------ */

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const entries = await getCollection('testimonials', live);
  return entries.sort(byOrder).map((e) => ({
    quote: e.data.quote,
    name: e.data.name,
    role: e.data.role,
    company: e.data.company,
  }));
}

export interface Client {
  name: string;
  /** Ready-to-render logo URL, or undefined — the wall falls back to text. */
  logo?: string;
}

export async function getClients(): Promise<Client[]> {
  const entries = await getCollection('clients', live);
  return entries.sort(byOrder).map((e) => ({
    name: e.data.name,
    logo: e.data.logo ? imageUrl(e.data.logo as SanityImage, 320) : undefined,
  }));
}

/**
 * How a client can hire the studio.
 *
 * Sorted like the other ordered lists here. Unlike them it is NOT allowed to
 * be empty in practice: the block that draws it renders a heading above it,
 * so nothing published means a heading over blank space. Nothing enforces
 * that — an empty list is a decision somebody has to make on purpose, and the
 * block's own description in the Studio says where the models live.
 */
export interface EngagementModel {
  title: string;
  body: string;
  bestFor: string;
}

export async function getEngagementModels(): Promise<EngagementModel[]> {
  const entries = await getCollection('engagementModels', live);
  return entries.sort(byOrder).map((e) => ({
    title: e.data.title,
    body: e.data.body,
    bestFor: e.data.bestFor,
  }));
}

export interface Milestone {
  when: string;
  title: string;
  body: string;
}

export async function getMilestones(): Promise<Milestone[]> {
  const entries = await getCollection('milestones', live);
  return entries.sort(byOrder).map((e) => ({
    when: e.data.when,
    title: e.data.title,
    body: e.data.body,
  }));
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

export interface SiteCopy {
  positioning: string;
  teamIntro: string;
  marqueeItems: string[];
  capabilities: string[];
  /** The numbered "how we work" sequence. One list, two pages. */
  processSteps: { title: string; body: string }[];
  categoryBlurbs: { category: string; blurb: string }[];
}

/**
 * The dev-only fallback. In a production build a missing `siteCopy` throws
 * instead — see `missingSingleton`.
 *
 * Deliberately NOT a hardcoded copy of the old text. A stale duplicate that
 * silently takes over whenever the CMS document is missing is worse than a
 * visibly empty heading: one of them you notice and fix, the other you ship
 * for a year without realising the site stopped reading from the CMS.
 */
const EMPTY_COPY: SiteCopy = {
  positioning: '',
  teamIntro: '',
  marqueeItems: [],
  capabilities: [],
  processSteps: [],
  categoryBlurbs: [],
};

export async function getSiteCopy(): Promise<SiteCopy> {
  const entry = await getEntry('siteCopy', 'siteCopy');
  if (!entry || (entry.data.draft && !previewMode))
    return missingSingleton('siteCopy', 'siteCopy', EMPTY_COPY);

  return {
    positioning: entry.data.positioning,
    teamIntro: entry.data.teamIntro,
    marqueeItems: entry.data.marqueeItems,
    capabilities: entry.data.capabilities,
    processSteps: entry.data.processSteps,
    categoryBlurbs: entry.data.categoryBlurbs,
  };
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

export interface Social {
  icon: SocialIcon;
  label: string;
  href: string;
}

export interface ContactDetails {
  email: string;
  careersEmail: string;
  /** The copyright holder, and the party the privacy policy names. */
  legalName: string;
  addressLines: string[];
  country: string;
  /** Every social, including ones with no URL yet. */
  socials: Social[];
  /** Only those with a real URL — what the live site should show. */
  publishedSocials: Social[];
  /**
   * Built from the address rather than stored.
   *
   * A pasted Google Maps share link expires and can silently start pointing
   * somewhere else; one derived from the address cannot.
   */
  mapsUrl: string;
}

/* The dev-only fallback, so a clone pointed at an empty dataset still starts.
   A production build throws instead — see `missingSingleton`. */
const EMPTY_CONTACT: ContactDetails = {
  email: '',
  careersEmail: '',
  legalName: '',
  addressLines: [],
  country: '',
  socials: [],
  publishedSocials: [],
  mapsUrl: '',
};

export async function getContactDetails(): Promise<ContactDetails> {
  const entry = await getEntry('contactDetails', 'contactDetails');
  if (!entry || (entry.data.draft && !previewMode))
    return missingSingleton('contactDetails', 'contactDetails', EMPTY_CONTACT);

  const { email, careersEmail, legalName, addressLines, country, socials } = entry.data;

  return {
    email,
    careersEmail,
    legalName,
    addressLines,
    country,
    socials: socials as Social[],
    /* An account that does not exist yet is left blank in the Studio, and a
       blank one is dropped rather than rendered as a link to nowhere. Kept
       visible in dev so the row can still be laid out. */
    publishedSocials: (socials as Social[]).filter((s) => previewMode || s.href !== ''),
    mapsUrl: addressLines.length
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [...addressLines, country].join(', ')
        )}`
      : '',
  };
}

/* ------------------------------------------------------------------ */
/* FAQs                                                                */
/* ------------------------------------------------------------------ */

export interface Faq {
  q: string;
  a: string;
}

/**
 * FAQs for one scope — `'careers'`, or `'service:vfx'`.
 *
 * Returns `{ q, a }` because that is the shape the existing `Faq.astro`
 * component and the FAQPage structured data already expect, and renaming the
 * fields would have meant touching both for no gain.
 */
export async function getFaqs(scope: string): Promise<Faq[]> {
  const entries = await getCollection('faqs', live);
  return entries
    .filter((e) => e.data.scope === scope)
    .sort(byOrder)
    .map((e) => ({ q: e.data.question, a: e.data.answer }));
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export interface NavChild {
  label: string;
  href: string;
  blurb?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  hiddenInHeader: boolean;
  children: NavChild[];
}

/** One hand-listed page in the search index — see `searchPages` below. */
export interface SearchPage {
  title: string;
  href: string;
  section: string;
  keywords: string;
}

export interface Navigation {
  /** Everything, in order. The footer and search index use all of it. */
  items: NavItem[];
  /** Only what the header shows. */
  headerItems: NavItem[];
  ctaLabel: string;
  ctaHref: string;
  /**
   * Pages whose text lives in a template rather than in a document, and which
   * search therefore cannot find on its own. Everything with a document
   * behind it is folded into the index from that document — see
   * `lib/searchDocs.ts` — so this is only the handful that has nothing to be
   * read off.
   */
  searchPages: SearchPage[];
}

/**
 * The header and footer menus.
 *
 * A required singleton, so a missing document fails a production build rather
 * than silently rendering a site with no navigation at all — see
 * `missingSingleton` for why that rule exists.
 *
 * `headerItems` is derived here rather than filtered at each call site: the
 * header and the mobile drawer both need it, and having each do its own
 * `.filter()` is how the two end up disagreeing about which links exist.
 */
const EMPTY_NAV: Navigation = {
  items: [],
  headerItems: [],
  ctaLabel: '',
  ctaHref: '/',
  searchPages: [],
};

export async function getNavigation(): Promise<Navigation> {
  const entry = await getEntry('navigation', 'navigation');
  if (!entry || (entry.data.draft && !previewMode))
    return missingSingleton('navigation', 'navigation', EMPTY_NAV);

  const items = entry.data.items as NavItem[];

  return {
    items,
    headerItems: items.filter((i) => !i.hiddenInHeader),
    ctaLabel: entry.data.ctaLabel,
    ctaHref: entry.data.ctaHref,
    searchPages: entry.data.searchPages as SearchPage[],
  };
}

/* ------------------------------------------------------------------ */
/* Careers page                                                        */
/* ------------------------------------------------------------------ */

export interface CareerValue {
  title: string;
  body: string;
}

export interface HiringStep {
  title: string;
  when: string;
  body: string;
}

/**
 * The careers page's copy and its hiring switch.
 *
 * The page stays a template — it filters listings client-side, prefills the
 * application form from whichever role was clicked, and emits the JobPosting
 * data Google's jobs index reads. What lives here is everything an editor
 * should be able to change without touching any of that.
 *
 * `hiringOpen` is the one that earns its place: turning it off empties the
 * listings and switches the page to its open-application state, which is the
 * honest thing to do when hiring pauses and used to need a developer.
 *
 * The application form’s wording rides on the same document, because the
 * form renders here AND at the foot of every role page — two copies is how
 * those two pages end up promising an applicant two different reply times.
 * `ApplyCopy` types that half; the rest is inferred from the collection.
 */
export interface ApplyPromise {
  label: string;
  body: string;
  linkLabel?: string;
  linkHref?: string;
}

/**
 * The half of `careersContent` that is validated by name rather than declared
 * field by field — the application form's wording, and the page's FAQ heading
 * and closing panel. See config/copyFields.ts for why that trade was made.
 */
export type ApplyCopy = Record<ApplyCopyField | CareersClosingField, string> & {
  applyPromises: ApplyPromise[];
};

export async function getCareersContent() {
  const entry = await getEntry('careers', 'careersContent');
  if (!entry || (entry.data.draft && !previewMode)) {
    return missingSingleton('careersContent', 'careersContent', null as never);
  }
  return entry.data as typeof entry.data & ApplyCopy;
}

/* ------------------------------------------------------------------ */
/* Booking                                                             */
/* ------------------------------------------------------------------ */

/**
 * The booking widget's settings AND its wording.
 *
 * The words live with the settings rather than in `uiCopy`, because an
 * editor changing the call lengths and an editor changing the button that
 * confirms them are the same person doing the same job. `BookingCopy` covers
 * the strings; the operational fields are spelled out below.
 */
export type BookingCopy = Record<BookingCopyField, string> & { weekdayLabels: string[] };

export interface BookingSettings extends BookingCopy {
  hostName: string;
  hostRole: string;
  /** Ready-to-render URL, or undefined — the panel falls back to initials. */
  hostPhoto?: string;
  callDurations: number[];
  dayStart: string;
  dayEnd: string;
  stepMinutes: number;
  closedDays: number[];
  bookingWindowDays: number;
  whatToExpect: string[];
  enquiryTypes: string[];
}

/**
 * The booking widget's settings.
 *
 * Required: the widget renders a name, a set of durations and a calendar
 * unconditionally, so a missing document is a broken form rather than a
 * hidden section.
 *
 * The timezone is NOT here and is not editable. IST observes no daylight
 * saving, which is exactly why the fixed offset in `config/site.ts` is exact
 * — and exactly why nobody should be able to point it at a timezone that
 * does, where every offered slot would be an hour wrong for half the year.
 */
/* Blank strings for every word in the widget, so the dev-only empty shape
   below can be written without listing thirty-odd fields by hand. It is
   never used in a production build — that throws instead. */
const EMPTY_BOOKING = {
  hostName: '',
  hostRole: '',
  callDurations: [30],
  dayStart: '09:00',
  dayEnd: '18:00',
  stepMinutes: 30,
  closedDays: [],
  bookingWindowDays: 60,
  whatToExpect: [],
  enquiryTypes: [],
  weekdayLabels: [],
} as unknown as BookingSettings;

export async function getBookingSettings(): Promise<BookingSettings> {
  const entry = await getEntry('bookingSettings', 'bookingSettings');
  if (!entry || (entry.data.draft && !previewMode))
    return missingSingleton('bookingSettings', 'bookingSettings', EMPTY_BOOKING);

  /* Cast because the wording is validated by name rather than declared
     field by field — see config/copyFields.ts for why that trade was made. */
  return {
    ...entry.data,
    hostPhoto: entry.data.hostPhoto
      ? imageUrl(entry.data.hostPhoto as SanityImage, 240)
      : undefined,
  } as unknown as BookingSettings;
}

/* ------------------------------------------------------------------ */
/* Interface copy                                                      */
/* ------------------------------------------------------------------ */

export interface LegalLink {
  label: string;
  href: string;
}

export interface NotFoundRoute {
  label: string;
  href: string;
  blurb: string;
}

/**
 * Every word the site says that is not attached to a piece of content.
 *
 * The plain strings are typed from the tuple in `config/copyFields.ts` — the
 * same list `content.config.ts` validates against, so a name that exists in
 * one exists in both by construction. The shapes that are not plain strings
 * are spelled out underneath it.
 */
export type UiCopy = Record<UiCopyField, string> & {
  legalLinks: LegalLink[];
  /* The 404. Every one of these is filled in from `NOT_FOUND_FALLBACK` when
     the CMS leaves it blank — see `getUiCopy`. */
  notFoundCode: string;
  notFoundTitle: string;
  notFoundLead: string;
  notFoundRoutes: NotFoundRoute[];
  notFoundCareersLabel: string;
  notFoundCareersHref: string;
  notFoundCareersOne: string;
  notFoundCareersMany: string;
  notFoundFoot: string;
  notFoundFootLinkLabel: string;
  notFoundFootLinkHref: string;
  notFoundSeoTitle: string;
  notFoundSeoDescription: string;
};

/**
 * The 404's text, in code.
 *
 * THE ONE PLACE THIS FILE KEEPS A HARDCODED COPY, and it is worth being
 * explicit about why, because everything else here deliberately renders empty
 * rather than fall back — see `missingSingleton` above for that argument.
 *
 * The 404 is not like the other pages. It is what Apache serves at whatever
 * URL a visitor mistyped, which means it is the page somebody reaches when
 * something has ALREADY gone wrong. A page whose whole job is to catch a
 * failure must not be able to fail in turn because a CMS field was left
 * blank, and there is no editor watching it — nobody browses to their own
 * 404 to check it still reads correctly.
 *
 * The staleness objection still applies and is accepted: change this page in
 * the Studio and this constant goes out of date. That is why every field
 * below is deliberately generic. The CMS wins whenever it has anything to
 * say; this only covers the case where it has nothing.
 *
 * The routes are the exception to the exception — they are left empty. A
 * link list is the one thing that CANNOT be safely guessed: a hardcoded path
 * that stops existing turns the page that catches broken links into a source
 * of them, and `check-links.mjs` only ever sees what is actually rendered.
 */
const NOT_FOUND_FALLBACK = {
  notFoundCode: '404',
  notFoundTitle: 'Nothing here.',
  notFoundLead:
    'That page moved, or never existed. Nothing is broken on your end — here is everywhere else.',
  notFoundRoutes: [] as NotFoundRoute[],
  notFoundCareersLabel: 'Careers',
  notFoundCareersHref: '/careers/',
  notFoundCareersOne: '1 role open',
  notFoundCareersMany: '{{count}} roles open',
  notFoundFoot:
    'Followed a link from somewhere on this site? Tell us where it was and we will fix it — {{link}}.',
  notFoundFootLinkLabel: 'contact the studio',
  notFoundFootLinkHref: '/contact/',
  notFoundSeoTitle: 'Page not found',
  notFoundSeoDescription: "That page doesn't exist.",
};

/**
 * The dev-only empty shape.
 *
 * Deliberately blank rather than a copy of the old markup, for the reason
 * `EMPTY_COPY` gives: a stale duplicate that silently takes over is worse
 * than a visibly empty heading, because one of them you notice. A production
 * build throws instead of using this.
 */
const EMPTY_UI_COPY = {
  ...Object.fromEntries(UI_COPY_FIELDS.map((f) => [f, ''])),
  legalLinks: [] as LegalLink[],
  ...NOT_FOUND_FALLBACK,
} as UiCopy;

export async function getUiCopy(): Promise<UiCopy> {
  const entry = await getEntry('uiCopy', 'uiCopy');
  if (!entry || (entry.data.draft && !previewMode))
    return missingSingleton('uiCopy', 'uiCopy', EMPTY_UI_COPY);

  const data = entry.data as unknown as UiCopy;

  /* Blank 404 fields fall back one at a time rather than all-or-nothing, so
     an editor can reword the title without also having to retype the four
     other strings on that tab. */
  const notFound = Object.fromEntries(
    Object.entries(NOT_FOUND_FALLBACK).map(([key, fallback]) => {
      const value = (data as Record<string, unknown>)[key];
      const empty = Array.isArray(value) ? value.length === 0 : !value;
      return [key, empty ? fallback : value];
    })
  );

  return { ...data, ...notFound } as UiCopy;
}

/* ------------------------------------------------------------------ */
/* Logo and icons                                                      */
/* ------------------------------------------------------------------ */

export interface Brand {
  /** Ready-to-render logo URLs, or undefined — the header falls back to the
      built-in inline mark, which flips with the theme on its own. */
  logoDark?: string;
  logoLight?: string;
  showWordmark: boolean;
  wordmark: string;
  wordmarkSub: string;
  /** Ready-to-render icon URLs at the sizes the head and manifest declare. */
  icon?: { svg?: string; png32: string; png180: string; png192: string; png512: string };
  /** Never blank — the browser-bar tags always render, so these fall back
      to the site palette rather than emitting an empty `content`. */
  themeColor: string;
  themeColorLight: string;
  backgroundColor: string;
  appName: string;
  appShortName: string;
  appDescription: string;
}

/**
 * The logo and the browser icon.
 *
 * OPTIONAL — the only other one is the loading screen, and for the same
 * reason. Every default here is already correct: the built-in inline mark,
 * and the icon set committed in `public/`. A missing document costs nothing,
 * so it returns the empty shape in a production build rather than throwing.
 *
 * The two logos are handed back as a PAIR or not at all. The Studio refuses
 * to publish one without the other, and this is the second line of the same
 * defence: with only one, the header would be blank for every visitor using
 * the other theme — which is invisible to whoever uploaded it.
 */
/* The site palette's two page backgrounds, from styles/global.css. The only
   hardcoded colours left here, and they are the fallback for two tags that
   render unconditionally — see the note on the interface. */
const DARK_GROUND = '#0b0c10';
const LIGHT_GROUND = '#faf9f5';

const EMPTY_BRAND: Brand = {
  showWordmark: true,
  wordmark: '',
  wordmarkSub: '',
  themeColor: DARK_GROUND,
  themeColorLight: LIGHT_GROUND,
  backgroundColor: '',
  appName: '',
  appShortName: '',
  appDescription: '',
};

export async function getBrand(): Promise<Brand> {
  const entry = await getEntry('brand', 'brand');
  if (!entry || (entry.data.draft && !previewMode)) return EMPTY_BRAND;

  const d = entry.data;
  const bothLogos = Boolean(d.logoDark && d.logoLight);
  const favicon = d.favicon as SanityImage | undefined;

  return {
    ...(bothLogos
      ? {
          logoDark: imageUrl(d.logoDark as SanityImage, 320),
          logoLight: imageUrl(d.logoLight as SanityImage, 320),
        }
      : {}),
    showWordmark: d.showWordmark,
    wordmark: d.wordmark,
    wordmarkSub: d.wordmarkSub,
    /* Every size the head and the manifest declare, resolved once here so
       neither has to know the image lives on a CDN. An SVG upload also gets
       its own entry, because the CDN does not transform SVGs and the `type`
       attribute has to say what is actually served. */
    ...(favicon
      ? {
          icon: {
            ...(isSvgAsset(favicon) ? { svg: imageUrl(favicon, 512) } : {}),
            png32: iconUrl(favicon, 32),
            png180: iconUrl(favicon, 180),
            png192: iconUrl(favicon, 192),
            png512: iconUrl(favicon, 512),
          },
        }
      : {}),
    themeColor: d.themeColor || DARK_GROUND,
    themeColorLight: d.themeColorLight || LIGHT_GROUND,
    backgroundColor: d.backgroundColor,
    appName: d.appName,
    appShortName: d.appShortName,
    appDescription: d.appDescription,
  };
}

/* ------------------------------------------------------------------ */
/* Privacy policy                                                      */
/* ------------------------------------------------------------------ */

export interface PrivacyPage {
  eyebrow: string;
  title: string;
  lead: string;
  tint: string;
  /** ISO date. The page prints it as the "last updated" line. */
  lastUpdated: string;
  lastUpdatedLabel: string;
  /** Portable Text. Rendered by the page, not by the loader — see the note
      on `sanityPrivacyPage` for why it does not go through `renderBody`. */
  body: unknown[];
  contactHeading: string;
  contactLead: string;
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * The privacy policy.
 *
 * REQUIRED, and this is the singleton it matters most for. A blank privacy
 * page is not a missing section — it is a legal document the site claims to
 * have and does not, on a page every form on the site links to. A production
 * build fails rather than publish that.
 */
const EMPTY_PRIVACY: PrivacyPage = {
  eyebrow: '',
  title: '',
  lead: '',
  tint: '210 70% 22%',
  lastUpdated: '',
  lastUpdatedLabel: '',
  body: [],
  contactHeading: '',
  contactLead: '',
};

export async function getPrivacyPage(): Promise<PrivacyPage> {
  const entry = await getEntry('privacyPage', 'privacyPage');
  if (!entry || (entry.data.draft && !previewMode))
    return missingSingleton('privacyPage', 'privacyPage', EMPTY_PRIVACY);

  return entry.data as unknown as PrivacyPage;
}
