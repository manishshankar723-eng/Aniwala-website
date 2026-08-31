/**
 * Team helpers. Same shape as `lib/posts.ts` and `lib/roles.ts` — the about
 * page goes through `getTeam()` so the draft rule and the ordering live in one
 * place rather than being re-derived in the template.
 *
 * This replaces `publishedTeam()` in `config/about.ts`, which did the same job
 * against a hand-written array.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type TeamEntry = CollectionEntry<'team'>;

/**
 * A member as the about page wants it: fields at the top level, id alongside.
 * The same flattening `lib/roles.ts` does, and for the same reason — it keeps
 * the template reading as prose rather than as `.data.` accessors.
 */
export type Member = TeamEntry['data'] & { id: string };

/**
 * The team as the site should show it, in grid order.
 *
 * Unpublished members stay visible under `astro dev` so the layout can be
 * worked on with realistic content, and are dropped from the production build.
 * That was the point of the old `draft: true` flags on the placeholder cards:
 * it makes it impossible to accidentally publish a team page full of people
 * who do not exist. Sanity's own publish state now does the same job.
 *
 * If every member is unpublished, this returns an empty array and the about
 * page renders no team section at all — deliberately. A "meet the team"
 * heading over an empty grid is worse than no section.
 */
export async function getTeam(): Promise<Member[]> {
  const members = await getCollection('team', ({ data }) => import.meta.env.DEV || !data.draft);

  /* `order` first, then name so two members sharing a number hold a stable
     order instead of reshuffling between builds. */
  return members
    .sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name))
    .map((entry) => ({ ...entry.data, id: entry.id }));
}
