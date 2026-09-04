/**
 * The six disciplines, read from the CMS.
 *
 * Replaces the `services` array and `serviceBySlug` helper that lived in
 * `config/services.ts`. The flat shape below is deliberately the one that
 * config exported, so `services/[slug].astro`, the search index and the case
 * study cross-links did not have to be rewritten around a new object.
 *
 * THE DRAFT RULE, as everywhere: an unpublished service renders under
 * `astro dev` and is dropped from a production build — so a seventh discipline
 * can be written and previewed in full before it is announced.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export interface Offering {
  title: string;
  body: string;
}

export interface PipelineStep {
  title: string;
  body: string;
  /** Software actually touched at this stage. Shown as small print. */
  tools?: string;
}

export interface Service {
  slug: string;
  title: string;
  label: string;
  shortName: string;
  article: 'a' | 'an';
  tagline: string;
  intro: string;
  tint: string;
  order: number;
  offerings: Offering[];
  pipeline: PipelineStep[];
  tools: string[];
  deliverables: string[];
  /** Slugs. Already dereferenced by the loader. */
  related: string[];
}

const live = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

const flatten = (entry: CollectionEntry<'services'>): Service => ({
  slug: entry.id,
  ...entry.data,
});

/** Every published service, in the order the Studio sets. */
export async function getServices(): Promise<Service[]> {
  const entries = await getCollection('services', live);
  return entries
    .map(flatten)
    /* `order` first, then title — so two services sharing an order still come
       out in a stable sequence rather than whatever Sanity returned. */
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * One service by slug, or undefined.
 *
 * Callers that are rendering a page for it should treat undefined as a build
 * error rather than skipping quietly — a service page with no service is a
 * blank page, and `[slug].astro` only ever asks for slugs it just generated.
 */
export async function serviceBySlug(slug: string): Promise<Service | undefined> {
  return (await getServices()).find((s) => s.slug === slug);
}

/**
 * Every tool named on any service page, de-duplicated and sorted.
 *
 * Derived rather than typed out again, so the pipeline list on the services
 * index can never disagree with the individual pages.
 */
export async function allServiceTools(): Promise<string[]> {
  const services = await getServices();
  return [...new Set(services.flatMap((s) => s.tools))].sort((a, b) => a.localeCompare(b));
}

/**
 * Several services by slug, in the order the slugs were given.
 *
 * Exists because every caller that resolves a list of related services was
 * doing `slugs.map(serviceBySlug)` against a synchronous config. That became
 * an array of promises the moment services moved to the CMS, and the type
 * error it produced was the good outcome — the alternative is rendering
 * "[object Promise]" into a card.
 *
 * Unknown slugs are DROPPED rather than rendered, so a stale cross-link goes
 * quiet instead of putting an undefined card on a live page. One lookup for
 * the whole list, not one per slug.
 */
export async function servicesBySlugs(slugs: string[]): Promise<Service[]> {
  const all = await getServices();
  const bySlug = new Map(all.map((s) => [s.slug, s]));
  return slugs.map((slug) => bySlug.get(slug)).filter((s): s is Service => Boolean(s));
}
