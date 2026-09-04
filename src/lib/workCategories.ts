/**
 * The portfolio disciplines, read from the CMS.
 *
 * Replaces the `workCategories` array in `config/portfolio.ts`. The flat shape
 * is the one that config exported, so the homepage grid, the discipline pages
 * and the search index did not have to be rewritten around a new object.
 *
 * `categoryHref` stays derived rather than stored, so a slug is never written
 * out twice and a rename cannot leave one of the two behind.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { previewMode } from './sanity/client';

export interface WorkCategory {
  slug: string;
  title: string;
  shortName: string;
  blurb: string;
  intro: string;
  tint: string;
  wide: boolean;
  order: number;
  /** Service slugs. Already dereferenced by the loader. */
  services: string[];
  seoTitle?: string;
  seoDescription?: string;
}

const live = ({ data }: { data: { draft: boolean } }) => previewMode || !data.draft;

const flatten = (entry: CollectionEntry<'workCategories'>): WorkCategory => ({
  slug: entry.id,
  ...entry.data,
});

export async function getWorkCategories(): Promise<WorkCategory[]> {
  const entries = await getCollection('workCategories', live);
  return entries
    .map(flatten)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export async function categoryBySlug(slug: string): Promise<WorkCategory | undefined> {
  return (await getWorkCategories()).find((c) => c.slug === slug);
}

/** `/portfolio/animation/`. Derived, so a slug is never written out twice. */
export const categoryHref = (slug: string) => `/portfolio/${slug}/`;
