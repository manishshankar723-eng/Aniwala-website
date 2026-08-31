/**
 * The announcement strip.
 *
 * A singleton in the CMS, read here so every caller gets the same shape the
 * old `announce` object in `config/nav.ts` had — `Base.astro` and
 * `Announce.astro` both read it and neither needed rewriting around a new
 * one.
 *
 * Falls back to "off" whenever there is nothing published. That is the safe
 * direction in both senses: a site with no announcement document renders no
 * strip rather than an empty bar, and — because `--announce-h` collapses to
 * zero only when the strip is off — the header sits flush at the top instead
 * of 2.75rem down with a gap above it.
 */
import { getEntry } from 'astro:content';

export interface Announcement {
  enabled: boolean;
  text: string;
  cta: string;
  href: string;
  /** Versions the dismissal — see the schema. */
  id: string;
}

const OFF: Announcement = { enabled: false, text: '', cta: '', href: '', id: 'none' };

export async function getAnnouncement(): Promise<Announcement> {
  const entry = await getEntry('announcement', 'announcement');
  if (!entry) return OFF;

  /* Unpublished behaves as off in production. The loader marks drafts, and
     showing one would put unfinished marketing copy on every page. */
  if (entry.data.draft && !import.meta.env.DEV) return OFF;

  /* Enabled but with nothing to say is treated as off rather than rendered as
     an empty strip — an easy state to leave behind after clearing the text. */
  if (!entry.data.enabled || !entry.data.text) return OFF;

  return {
    enabled: true,
    text: entry.data.text,
    cta: entry.data.cta,
    href: entry.data.href,
    id: entry.data.id,
  };
}
