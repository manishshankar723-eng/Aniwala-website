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
import { isSafeMediaSrc } from '../config/urls';
import { imageUrl, imageSrcSet, type SanityImage } from './sanity/client';

export interface Piece {
  slug: string;
  title: string;
  category: string;
  blurb?: string;
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
  /** `cover` crops to the tile; `contain` fits the whole picture inside it. */
  fit: 'cover' | 'contain';
  /** How much of the row this tile takes, in sixths. */
  span: 'third' | 'half' | 'twoThirds' | 'full';
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
 * A Stream value — a bare id or any pasted embed URL — is reduced to its id and
 * embedded from `iframe.videodelivery.net`, which is account-agnostic. See the
 * comment above the return for why the pasted host is never reused.
 *
 * Returns undefined for anything that is neither, so a malformed value shows
 * the still rather than an empty player.
 */
export function resolveVideo(value: string | undefined): PieceVideo | undefined {
  const v = value?.trim();
  if (!v) return undefined;

  // isSafeMediaSrc, not a bare `/`: `//evil/x.mp4` and `/\evil/x.mp4` are
  // other origins, and without it the CSP was the only thing refusing them.
  if (isSafeMediaSrc(v) && FILE_RE.test(v)) return { kind: 'file', src: v };

  const id = v.match(/[0-9a-f]{32}/i)?.[0];
  if (!id) return undefined;

  /*
   * ONLY THE ID IS TAKEN FROM THE VALUE; THE HOST NEVER IS.
   *
   * This used to keep the origin off a pasted `customer-<code>.cloudflarestream.com`
   * URL, and so it needed a host regex — anchored on the subdomain, because a
   * suffix test also accepts `evilcloudflarestream.com` and, a backslash being
   * a slash inside a URL authority, `attacker.example\x.cloudflarestream.com`.
   * It also needed `frame-src https://*.cloudflarestream.com` in the CSP, and
   * that wildcard trusts EVERY Stream customer's subdomain, not this studio's.
   *
   * `iframe.videodelivery.net` plays any Stream video by id, whichever account
   * it is on, and no content here ever used a customer subdomain. So the id is
   * the only thing read, the host is fixed, and the CSP names one host exactly.
   * A value pasted from the dashboard still works: its id is extracted above.
   */
  return { kind: 'stream', src: `https://iframe.videodelivery.net/${id}/iframe` };
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
    /*
     * QUALITY 92, not the 80 every other image on the site gets.
     *
     * A portfolio tile is the one picture here that IS the product — a client
     * is looking at it to judge whether the work is good. Everywhere else an
     * image supports the words and 80 is invisible; on a 3D render with smooth
     * gradients it is where banding starts to show. `auto('format')` still
     * serves AVIF/WebP, so the cost of the extra fidelity is small.
     */
    image: cover?.asset ? imageUrl(cover, 2400, 92) : undefined,
    /*
     * UP TO 2400, because a WIDE tile spans the full row: about 1400 CSS px on
     * a large monitor, which is 2800 device pixels at 2x. The old ladder
     * stopped at 1800 and the top rung was never requested anyway — nothing
     * rendered this srcset, so every tile loaded the single 1200px `src` and
     * stretched it. That is what "compressed" looked like.
     */
    srcset: cover?.asset
      ? imageSrcSet(cover, [480, 768, 1200, 1800, 2400], 92)
      : undefined,
    imageAlt: cover?.alt,
    caseStudy: entry.data.caseStudy,
    fit: entry.data.fit,
    span: entry.data.span,
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
