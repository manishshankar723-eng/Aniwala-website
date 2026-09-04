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
import { imageUrl, type SanityImage } from './sanity/client';
import type { SocialIcon } from '../config/contact';

const live = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

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
  if (import.meta.env.DEV) {
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
};

export async function getSiteCopy(): Promise<SiteCopy> {
  const entry = await getEntry('siteCopy', 'siteCopy');
  if (!entry || (entry.data.draft && !import.meta.env.DEV))
    return missingSingleton('siteCopy', 'siteCopy', EMPTY_COPY);

  return {
    positioning: entry.data.positioning,
    teamIntro: entry.data.teamIntro,
    marqueeItems: entry.data.marqueeItems,
    capabilities: entry.data.capabilities,
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
  addressLines: [],
  country: '',
  socials: [],
  publishedSocials: [],
  mapsUrl: '',
};

export async function getContactDetails(): Promise<ContactDetails> {
  const entry = await getEntry('contactDetails', 'contactDetails');
  if (!entry || (entry.data.draft && !import.meta.env.DEV))
    return missingSingleton('contactDetails', 'contactDetails', EMPTY_CONTACT);

  const { email, careersEmail, addressLines, country, socials } = entry.data;

  return {
    email,
    careersEmail,
    addressLines,
    country,
    socials: socials as Social[],
    /* An account that does not exist yet is left blank in the Studio, and a
       blank one is dropped rather than rendered as a link to nowhere. Kept
       visible in dev so the row can still be laid out. */
    publishedSocials: (socials as Social[]).filter((s) => import.meta.env.DEV || s.href !== ''),
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
