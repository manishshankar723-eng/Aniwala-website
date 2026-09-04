/**
 * Open-role helpers. Same shape as `lib/posts.ts` and `lib/caseStudies.ts` —
 * every listing goes through `getRoles()` so the draft rule and the ordering
 * are defined once rather than re-derived on each page.
 *
 * These used to be a plain array exported from `config/careers.ts`, imported
 * synchronously. They now come from the CMS, which makes them async. That is
 * the only reason the four call sites changed; the data shape did not.
 *
 * The rest of `config/careers.ts` — the values, the hiring steps, the FAQs,
 * the employment-type mapping — deliberately stayed as code. Those describe
 * how the studio hires, change roughly never, and are not something a person
 * posting a job should be able to edit by accident.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { previewMode } from './sanity/client';

export type RoleEntry = CollectionEntry<'roles'>;

/**
 * A role as the templates want it: the fields at the top level, with the slug
 * alongside them.
 *
 * This is the shape `config/careers.ts` used to export, kept deliberately.
 * A collection entry nests everything under `.data` and puts the slug on
 * `.id`, and threading that through the careers markup would have meant
 * touching sixty lines of template to change where a string comes from —
 * a large diff with no behaviour in it and plenty of room for a typo.
 */
export type Role = RoleEntry['data'] & { slug: string };

/** Collection entry -> the flat shape above. */
export const flatten = (entry: RoleEntry): Role => ({ ...entry.data, slug: entry.id });

/** Open roles, flattened. What the pages actually call. */
export async function getFlatRoles(): Promise<Role[]> {
  return (await getRoles()).map(flatten);
}

/**
 * Open roles, newest posting first.
 *
 * Unpublished roles stay visible under `astro dev` so a listing can be drafted
 * and previewed, and are dropped from the production build — the same rule the
 * blog uses.
 */
export async function getRoles(): Promise<RoleEntry[]> {
  const roles = await getCollection('roles', ({ data }) => previewMode || !data.draft);

  /* `posted` is a validated YYYY-MM-DD string, so a plain string comparison
     sorts it correctly and avoids constructing a Date per comparison. Title
     breaks ties so two roles posted the same day hold a stable order rather
     than reshuffling between builds. */
  return roles.sort(
    (a, b) => b.data.posted.localeCompare(a.data.posted) || a.data.title.localeCompare(b.data.title)
  );
}

/** One role by slug, or undefined. */
export async function getRoleBySlug(slug: string): Promise<RoleEntry | undefined> {
  return (await getRoles()).find((role) => role.id === slug);
}

/**
 * Whether anything is open right now.
 *
 * The careers page uses this to choose between listing roles and showing the
 * open-application state. Derived rather than hand-set, so an empty roster
 * cannot leave the page claiming to be hiring.
 */
export async function hasOpenRoles(): Promise<boolean> {
  return (await getRoles()).length > 0;
}
