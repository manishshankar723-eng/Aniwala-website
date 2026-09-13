/**
 * Portfolio pieces.
 *
 * Replaces `pieces`, `piecesIn` and `pieceCounts` in `config/portfolio.ts`.
 * The disciplines they are filed under are `workCategory` documents — they
 * drive the `/portfolio/[category]/` routes, and a piece points at one by
 * reference so a rename cannot detach it.
 *
 * The flat `Piece` shape below is the one the old config exported, kept
 * deliberately so `PieceCard.astro` and both portfolio pages did not need
 * rewriting around `.data.` accessors for a change with no behaviour in it.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { previewMode } from './sanity/client';
import { imageUrl, imageSrcSet, type SanityImage } from './sanity/client';

export interface Piece {
  slug: string;
  title: string;
  category: string;
  blurb: string;
  kind: 'Client project' | 'Studio project';
  client: string;
  year: number;
  tools: string[];
  tint: string;
  /** Ready-to-render, or undefined — the tile falls back to `tint`. */
  image?: string;
  srcset?: string;
  imageAlt?: string;
  /** How to play this piece's video, or undefined for a still. */
  video?: PieceVideo;
  caseStudy?: string;
  wide?: boolean;
}

/**
 * How a piece's video should be played.
 *
 * Two shapes, because two hosts answer two different needs and the studio uses
 * both. A FILE is a direct .mp4/.webm — R2, or anywhere else that serves one —
 * and plays in a native <video>: cheap, no third-party player, and the right
 * answer for the short silent loops a gallery actually wants. A STREAM is
 * Cloudflare Stream, which transcodes and serves adaptive bitrate, and earns
 * its iframe on anything long enough that a phone should not be handed the
 * 1080p master.
 *
 * The field takes either and this decides which, so an editor pastes a URL
 * and never has to know there was a choice to make.
 */
export type PieceVideo = { kind: 'file'; src: string } | { kind: 'stream'; src: string };

/** Direct video file, possibly with a query string or fragment after it. */
const FILE_RE = /\.(mp4|webm|ogv|ogg)(\?|#|$)/i;

/**
 * Resolve whatever the editor pasted.
 *
 * File first: a direct link is unambiguous, and checking it before the Stream
 * id avoids a filename that happens to contain 32 hex characters being read
 * as a video id.
 *
 * For a Stream value the ORIGIN IS KEPT when there is one, and that is the
 * point. A Stream embed normally lives at `customer-<code>.cloudflarestream.com`,
 * where the code is per-account and nothing in this repo knows it. Reusing the
 * origin off the pasted URL means it never has to: paste the dashboard's embed
 * address and the account's own subdomain comes with it.
 * `iframe.videodelivery.net` is the fallback for a bare id — account-agnostic,
 * so it works without configuration.
 *
 * Returns undefined for anything that is neither, so a malformed value shows
 * the still rather than an empty player.
 */
export function resolveVideo(value: string | undefined): PieceVideo | undefined {
  const v = value?.trim();
  if (!v) return undefined;

  if (/^(https?:\/\/|\/)/i.test(v) && FILE_RE.test(v)) return { kind: 'file', src: v };

  const id = v.match(/[0-9a-f]{32}/i)?.[0];
  if (!id) return undefined;

  const host = v.match(/^https:\/\/([^/]*cloudflarestream\.com)\//i)?.[1];
  return { kind: 'stream', src: `https://${host ?? 'iframe.videodelivery.net'}/${id}/iframe` };
}

const flatten = (entry: CollectionEntry<'pieces'>): Piece => {
  const cover = entry.data.image as (SanityImage & { alt?: string }) | undefined;

  return {
    slug: entry.id,
    title: entry.data.title,
    category: entry.data.category,
    blurb: entry.data.blurb,
    kind: entry.data.kind,
    client: entry.data.client,
    year: entry.data.year,
    tools: entry.data.tools,
    tint: entry.data.tint,
    video: resolveVideo(entry.data.video),
    image: cover?.asset ? imageUrl(cover, 1200) : undefined,
    srcset: cover?.asset ? imageSrcSet(cover, [480, 768, 1200, 1800]) : undefined,
    imageAlt: cover?.alt,
    caseStudy: entry.data.caseStudy,
    wide: entry.data.wide,
  };
};

/**
 * Every published piece, in grid order.
 *
 * Unpublished ones show under `astro dev` and are dropped from production —
 * the same rule the rest of the content follows, so a piece can be staged
 * with its image before it goes live.
 */
export async function getPieces(): Promise<Piece[]> {
  const entries = await getCollection('pieces', ({ data }) => previewMode || !data.draft);

  /* `order` first, then newest, then title — so two pieces sharing an order
     hold a stable position instead of reshuffling between builds. */
  return entries
    .sort(
      (a, b) =>
        a.data.order - b.data.order ||
        b.data.year - a.data.year ||
        a.data.title.localeCompare(b.data.title)
    )
    .map(flatten);
}

/** Pieces in one category, or everything when no category is given. */
export async function piecesIn(categorySlug?: string): Promise<Piece[]> {
  const all = await getPieces();
  return categorySlug ? all.filter((p) => p.category === categorySlug) : all;
}

/**
 * How many pieces sit under each category, for the filter chips.
 *
 * Derived rather than stored: a chip claiming four pieces when three are
 * published is the kind of thing nobody notices until a visitor clicks it.
 */
export async function pieceCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const piece of await getPieces()) {
    counts[piece.category] = (counts[piece.category] ?? 0) + 1;
  }
  return counts;
}
