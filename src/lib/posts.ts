/**
 * Blog helpers. Every page that lists posts goes through `getPosts()` so the
 * draft rule and the sort order are defined once — a listing that forgets to
 * filter drafts leaks unfinished writing onto the live site.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/**
 * Published posts, newest first.
 *
 * Drafts stay visible while running `astro dev` so you can preview what you
 * are writing, and are dropped from the production build.
 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/** Posts in one category, newest first. */
export async function getPostsByCategory(category: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.data.category === category);
}

/**
 * Everything except the given post, most recent first, preferring the same
 * category. Used for "keep reading" — falls back to recency so a lone post
 * in its category still gets neighbours rather than an empty row.
 */
export async function getRelatedPosts(post: Post, limit = 3): Promise<Post[]> {
  const others = (await getPosts()).filter((p) => p.id !== post.id);
  const sameCategory = others.filter((p) => p.data.category === post.data.category);
  const rest = others.filter((p) => p.data.category !== post.data.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

/**
 * Reading time from the raw Markdown body.
 *
 * 200 wpm is the usual figure for considered non-fiction. Counted rather than
 * stored so it can never disagree with the post.
 */
export function readingTime(body = ''): string {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/** "12 March 2026" — unambiguous internationally, unlike 03/12/2026. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Machine-readable date for <time datetime> and structured data. */
export function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** 'Pipeline' -> 'pipeline'. Category URLs are lowercase. */
export const categorySlug = (category: string) => category.toLowerCase();

/** '3D Animation' -> '3d-animation'. Tags are free text, so this has to cope
    with spaces, slashes and punctuation, not just case. */
export const tagSlug = (tag: string) =>
  tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface TagCount {
  tag: string;
  slug: string;
  count: number;
}

/**
 * Every tag in use, most-used first, then alphabetical.
 *
 * Keyed by slug rather than by the raw string, so 'Game Art' and 'game art'
 * collapse into one tag instead of rendering two chips that lead to the
 * same page.
 */
export async function getTags(): Promise<TagCount[]> {
  const posts = await getPosts();
  const byslug = new Map<string, TagCount>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const existing = byslug.get(slug);
      if (existing) existing.count += 1;
      else byslug.set(slug, { tag, slug, count: 1 });
    }
  }

  return [...byslug.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
  );
}

export interface ArchivePeriod {
  /** URL segment, e.g. '2026-08'. Sorts correctly as a string. */
  period: string;
  /** 'August 2026' */
  label: string;
  count: number;
}

/**
 * Posts grouped by month, newest first.
 *
 * Built from the post dates rather than a hand-kept list, so a month appears
 * the moment something is published into it and never appears empty.
 */
export async function getArchive(): Promise<ArchivePeriod[]> {
  const posts = await getPosts();
  const byPeriod = new Map<string, ArchivePeriod>();

  for (const post of posts) {
    const d = post.data.pubDate;
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = byPeriod.get(period);
    if (existing) {
      existing.count += 1;
    } else {
      byPeriod.set(period, {
        period,
        label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        count: 1,
      });
    }
  }

  return [...byPeriod.values()].sort((a, b) => b.period.localeCompare(a.period));
}

/** Posts published in one 'YYYY-MM' period, newest first. */
export async function getPostsByPeriod(period: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => {
    const d = p.data.pubDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === period;
  });
}

/** Posts carrying one tag, matched by slug so casing never splits a tag. */
export async function getPostsByTag(slug: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.data.tags.some((t) => tagSlug(t) === slug));
}
