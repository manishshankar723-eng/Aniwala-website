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
      /* Where the drop zone files the still it offers after an upload. On a
         piece the Image above IS the poster, so there is nowhere else it
         could go. See components/PosterCapture.tsx. */
      options: { posterField: 'image' },
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

    /*
     * THERE IS NO "HAS SOUND" FIELD, and there has not really been one for a
     * while — this is the tidy-up of a switch that stopped being wired.
     *
     * It used to add a bespoke unmute button to the tile. The tile now ships
     * the browser's own control bar, which always carries a volume control, so
     * whether there is audio to hear became a question about the FILE rather
     * than about the interface — and the field was left promising a button
     * that appears whatever it is set to.
     *
     * What IS guaranteed is the starting state: `src/lib/video.ts` re-mutes
     * every tile on every page load and every client-side navigation, and lets
     * only one tile hold audio at a time. So a visitor never lands on noise,
     * and never has to hunt for which of nine tiles is making it.
     *
     * `scripts/upload-r2.mjs` still strips the audio track unless told
     * otherwise, which is why most of these have nothing to unmute.
     */

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
    /**
     * HOW WIDE THIS TILE IS, in sixths of the row.
     *
     * This replaced a `wide` boolean, and the reason is arithmetic. A boolean
     * gives two widths, so a grid can be rows of three or rows of two but
     * never both: with three columns a "wide" tile takes two of them and the
     * row still has three slots. Composing a row of three, then a row of two,
     * then three again needs a base that divides by both — six.
     *
     *   Third       2/6   three across
     *   Half        3/6   two across
     *   Two thirds  4/6   pairs with a third beside it
     *   Full        6/6   the whole row
     *
     * A row is whatever adds up to six. Three thirds, two halves, a two-thirds
     * and a third. Nothing enforces that they add up — a row that does not
     * simply leaves a gap, which is visible and fixable rather than refused.
     *
     * Documents written before this field fall back to their old `wide` value:
     * full where it was set, half where it was not, which is exactly what they
     * rendered as. No migration.
     */
    defineField({
      name: 'span',
      title: 'Tile width',
      type: 'string',
      group: 'meta',
      options: {
        list: [
          { title: 'Third — three across', value: 'third' },
          { title: 'Half — two across', value: 'half' },
          { title: 'Two thirds', value: 'twoThirds' },
          { title: 'Full width', value: 'full' },
        ],
        layout: 'radio',
      },
      description:
        'How much of the row this tile takes on a wide screen. A row is whatever adds up to a full width: three thirds, two halves, or a two-thirds beside a third. Narrower screens simplify to two across and then one.',
      initialValue: 'half',
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
