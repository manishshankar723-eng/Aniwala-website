/**
 * A portfolio piece.
 *
 * The nine of these lived in `config/portfolio.ts` with a `tint` placeholder
 * and a comment reading "swap for a real import once art exists". This is
 * that swap: the art now comes from the CMS, and so does everything else
 * about a piece, because a portfolio entry is content by any definition — it
 * is added the week the work clears.
 *
 * THE CATEGORIES MOVED TOO, and this field became a reference because of it.
 * A dropdown built from a config array went stale the moment disciplines
 * became documents; a reference cannot, and Sanity additionally refuses to
 * delete a discipline while a piece is still filed under it. The site sees
 * the same slug string it always did — the loader dereferences it.
 *
 * WHAT DID NOT MOVE: the CATEGORIES. Those drive the /portfolio/ URLs and the
 * filter chips, so they stay in code and this picks from them.
 */
import { defineType, defineField } from 'sanity';
import { R2VideoInput } from '../components/R2VideoInput';

export default defineType({
  name: 'piece',
  title: 'Portfolio piece',
  type: 'document',

  groups: [
    { name: 'main', title: 'The piece', default: true },
    { name: 'meta', title: 'Credits & display' },
  ],

  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'main',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Identifier',
      type: 'slug',
      group: 'main',
      description:
        'Used in the lightbox link, so it appears in the address bar when a piece is opened. Click Generate.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'workCategory' }],
      group: 'main',
      description: 'Which discipline it is filed under on /portfolio/.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'blurb',
      title: 'Blurb',
      type: 'string',
      group: 'main',
      description:
        'One line: what the piece actually is, not how good it looks. "Rigged hero character, 42k tris" tells a producer more than "stunning character work".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      group: 'main',
      options: { hotspot: true },
      description:
        'The artwork. Leave empty and the tile falls back to its colour placeholder, which is fine for a piece not yet shot.',
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt text',
          description: 'What the image shows, for screen readers.',
          validation: (Rule) => Rule.required().error('Every image needs alt text.'),
        },
      ],
    }),

    /**
     * A moving piece. Two hosts, one field.
     *
     * A DIRECT FILE — R2, or anything serving an .mp4/.webm — plays in a
     * native <video>. That is the right answer for the short silent loops a
     * gallery wants: no player, no iframe, no third party, and the studio is
     * already paying nothing for R2.
     *
     * CLOUDFLARE STREAM earns its iframe on anything long enough that a phone
     * should not be handed the 1080p master: it transcodes and serves adaptive
     * bitrate, which a file on R2 does not.
     *
     * Whichever is pasted, the site works it out. There is deliberately no
     * "which kind is this" dropdown to get wrong.
     *
     * NOT SANITY. Its asset pipeline is built for stills — an upload there is
     * served as one undivided file with no transcode and no poster, so a phone
     * downloads the desktop cut in full before anything moves.
     *
     * The IMAGE above still earns its place when this is set: it is the poster,
     * and the only thing on screen until the player has something to show.
     */
    defineField({
      name: 'video',
      title: 'Video',
      type: 'string',
      group: 'main',
      components: { input: R2VideoInput },
      description:
        'A video URL. For R2: run `node --env-file=.env scripts/upload-r2.mjs <file> video/pieces/<name>.mp4` and paste the URL it prints. For Cloudflare Stream: paste the video id or its embed URL. Leave blank for a piece that is not a video.',
      validation: (Rule) =>
        Rule.custom((v: string | undefined) => {
          if (!v) return true;
          const s = v.trim();
          if (/youtube\.com|youtu\.be|vimeo\.com/i.test(s))
            return 'That is a YouTube or Vimeo page, which cannot be played as a silent background loop.';
          /* A direct file, checked first: a link is unambiguous, and a
             filename that happens to hold 32 hex characters should not be
             mistaken for a Stream id. */
          if (/^(https?:\/\/|\/)/i.test(s) && /\.(mp4|webm|ogv|ogg)(\?|#|$)/i.test(s)) return true;
          if (/^[0-9a-f]{32}$/i.test(s)) return true;
          if (/^https:\/\/[^/]*(cloudflarestream\.com|videodelivery\.net)\//i.test(s)) {
            return /[0-9a-f]{32}/i.test(s) ? true : 'That address has no video id in it.';
          }
          /* Refused here rather than rendered as a dead frame: a silently
             empty player looks identical to a video that has not loaded. */
          return 'Use a direct .mp4 or .webm URL, or a Cloudflare Stream id.';
        }),
    }),

    /**
     * Does this piece have sound worth hearing?
     *
     * IT DOES NOT MEAN "AUTOPLAY WITH SOUND". No browser permits that — a
     * video that has not been interacted with is muted or it does not play at
     * all, and there is no flag, policy or workaround that changes it. So this
     * decides whether the tile offers an unmute BUTTON, which a visitor may
     * then press.
     *
     * Off is the right default and not just a safe one: a wall of tiles that
     * could each start talking is a worse gallery, and an audio track nothing
     * ever plays is bytes every visitor downloads for nothing — which is why
     * `scripts/upload-r2.mjs` strips it unless told otherwise.
     */
    defineField({
      name: 'sound',
      title: 'Has sound worth hearing',
      type: 'boolean',
      group: 'meta',
      description:
        'Adds an unmute button to the tile. Leave off for silent work — the video still plays, it just never offers audio. Nothing autoplays with sound; browsers do not allow it.',
      initialValue: false,
    }),

    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      group: 'meta',
      description:
        'Be accurate. "Client project" on a self-directed piece is a claim about your track record that a prospective client may check.',
      options: {
        list: [
          { title: 'Client project', value: 'Client project' },
          { title: 'Studio project', value: 'Studio project' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'client',
      title: 'Client',
      type: 'string',
      group: 'meta',
      description:
        'Use the studio own name on a self-directed piece. Only name a real client who has agreed to be named.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      group: 'meta',
      validation: (Rule) => Rule.required().integer().min(2000).max(2100),
    }),
    defineField({
      name: 'tools',
      title: 'Tools',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'meta',
      description: 'A few, not the whole pipeline. Shown as small print on the card.',
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'caseStudy',
      title: 'Linked case study',
      type: 'string',
      group: 'meta',
      description:
        'The URL of a case study, if one has been written — the part after /case-studies/. Leave blank and the tile is deliberately not clickable: a dead end is worse than a tile that plainly does not link anywhere.',
    }),
    defineField({
      name: 'tint',
      title: 'Placeholder colour',
      type: 'string',
      group: 'meta',
      description: 'Shown when there is no image. An HSL triple like "210 70% 22%".',
      initialValue: '210 70% 22%',
    }),
    /**
     * Crop to the tile, or show the whole picture.
     *
     * Every tile is the same box, so a picture that is not that shape has to
     * give somewhere. `cover` fills the box and cuts the overflow — right for
     * a render framed with room around the subject, and the default because it
     * is what makes a grid read as a grid.
     *
     * `contain` fits the whole image inside the box and lets the tint show
     * around it. Right for a character sheet, a turnaround or a line-up, where
     * the thing being judged is the WHOLE image and a crop through it loses
     * the point of the piece.
     *
     * The hotspot tool is the third answer and often the best one: it keeps
     * `cover` and tells the crop what it may not cut.
     */
    defineField({
      name: 'fit',
      title: 'How the image sits',
      type: 'string',
      group: 'meta',
      options: {
        list: [
          { title: 'Fill the tile, cropping the edges', value: 'cover' },
          { title: 'Show the whole image', value: 'contain' },
        ],
        layout: 'radio',
      },
      description:
        'Fill is right for most renders. Choose "show the whole image" for a character sheet or turnaround, where cropping through it loses the point \u2014 the tint fills whatever is left around it.',
      initialValue: 'cover',
    }),
    defineField({
      name: 'wide',
      title: 'Wide tile',
      type: 'boolean',
      group: 'meta',
      description:
        'Spans two columns. Use sparingly — about one in four, or the grid stops reading as a grid.',
      initialValue: false,
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      group: 'meta',
      description: 'Lower first. Leave gaps (10, 20, 30) so one can be slotted in later.',
      initialValue: 50,
    }),
  ],

  orderings: [
    { title: 'Grid order', name: 'gridOrder', by: [{ field: 'order', direction: 'asc' }] },
  ],

  preview: {
    select: { title: 'title', client: 'client', year: 'year', media: 'image', order: 'order' },
    prepare: ({ title, client, year, media, order }) => ({
      title: order != null ? order + '. ' + title : title,
      subtitle: [client, year].filter(Boolean).join(' · '),
      media,
    }),
  },
});
