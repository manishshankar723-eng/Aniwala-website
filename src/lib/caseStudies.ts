/**
 * Case study helpers. Same shape as `lib/posts.ts` — every listing goes
 * through `getCaseStudies()` so the draft rule and the ordering are defined
 * once rather than re-derived on each page.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { serviceBySlug, type Service } from '../config/services';

export type CaseStudy = CollectionEntry<'caseStudies'>;

/**
 * Published case studies, newest first, `featured` ones pinned to the top.
 *
 * Drafts stay visible under `astro dev` so work in progress can be previewed,
 * and are dropped from the production build.
 */
export async function getCaseStudies(): Promise<CaseStudy[]> {
  const studies = await getCollection('caseStudies', ({ data }) =>
    import.meta.env.DEV ? true : !data.draft
  );

  /* `featured` picks the lead card, year orders the rest, and title breaks
     the remaining ties — without that last step the order falls back to
     filename, which changes silently when a file is renamed. */
  return studies.sort((a, b) => {
    if (a.data.featured !== b.data.featured) return a.data.featured ? -1 : 1;
    if (a.data.year !== b.data.year) return b.data.year - a.data.year;
    return a.data.title.localeCompare(b.data.title);
  });
}

/** Everything except the given study, for the "more work" row. */
export async function getRelatedCaseStudies(study: CaseStudy, limit = 2): Promise<CaseStudy[]> {
  const others = (await getCaseStudies()).filter((s) => s.id !== study.id);

  /* Prefer studies that share a discipline — a producer looking at a VFX
     piece is more likely to want the other VFX piece than the newest one. */
  const overlapping = others.filter((s) =>
    s.data.services.some((slug) => study.data.services.includes(slug))
  );
  const rest = others.filter((s) => !overlapping.includes(s));

  return [...overlapping, ...rest].slice(0, limit);
}

/**
 * Resolve a study's `services` slugs to real service records.
 *
 * Filtered rather than mapped straight through, so a typo in frontmatter
 * drops the cross-link instead of rendering `undefined` into the page.
 */
export function servicesFor(study: CaseStudy): Service[] {
  return study.data.services.map(serviceBySlug).filter((s): s is Service => Boolean(s));
}
