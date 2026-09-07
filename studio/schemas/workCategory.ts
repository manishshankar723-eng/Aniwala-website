/**
 * A portfolio discipline. `/portfolio/{slug}/` is built from each.
 *
 * These are how an art director shops: they arrive wanting a character
 * designer or an FX artist, not "3D art". That is why they are their own
 * taxonomy rather than a view of the services — a craft and a service are
 * genuinely different things, and character design draws on three services.
 *
 * THE SLUG IS THE URL and the key the pieces are filed against. Renaming one
 * breaks that page's links and detaches every piece filed under it. It is the
 * one field here worth being frightened of.
 *
 * It no longer orphans the tile image: that used to be an `artwork` document
 * filed against `portfolio-<slug>`, and now lives on this document — see the
 * note on the `image` field.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';
import { seoFields } from './seoFields';

export default defineType({
  name: 'workCategory',
  title: 'Portfolio discipline',
  type: 'document',

  groups: [
    { name: 'main', title: 'Content', default: true },
    { name: 'seo', title: 'Search' },
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
      title: 'URL',
      type: 'slug',
      group: 'main',
      description: 'Becomes /portfolio/<this>/. Pieces are filed against it.',
      options: { source: 'title', maxLength: 60 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'shortName',
      title: 'Name mid-sentence',
      type: 'string',
      group: 'main',
      description:
        'How it reads inside a sentence — "Have VFX on your brief?". Typed out rather than lower-cased from the title, because lower-casing turns VFX into "vfx".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'blurb',
      title: 'Blurb',
      type: 'string',
      group: 'main',
      description: 'One line on the homepage tile. What the discipline covers, not how good it is.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'intro',
      title: 'Intro',
      type: 'text',
      rows: 4,
      group: 'main',
      description: 'One or two sentences at the top of the discipline page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tint',
      title: 'Tint',
      type: 'string',
      group: 'main',
      description:
        'HSL triple behind the tile, e.g. "210 70% 22%". Stays underneath the image below rather than being replaced by it, so the tile holds its colour while the picture loads and still looks deliberate when there is none.',
      validation: (Rule) =>
        Rule.required().custom((v) =>
          /^\d{1,3} \d{1,3}% \d{1,3}%$/.test(String(v)) ? true : 'Three parts, like "210 70% 22%".'
        ),
    }),

    /*
     * The tile image, ON THE DISCIPLINE rather than in the Images list.
     *
     * It used to be an `artwork` document filed against the slot name
     * `portfolio-<slug>`, from a hardcoded list of six in the website's
     * `src/config/imageSlots.ts` — so a seventh discipline created in the
     * Studio had nowhere to put a picture, fell back to the flat tint with no
     * warning, and needed a code change plus a Studio redeploy to fix.
     *
     * See the same note on `service.ts`. Here the image is created with the
     * discipline, deleted with it, and cannot be orphaned by a slug rename.
     */
    defineField({
      name: 'image',
      title: 'Tile image',
      type: 'image',
      group: 'main',
      options: { hotspot: true },
      description:
        'Optional. The picture on this discipline’s tile — on the homepage grid and the portfolio index. Landscape, at least 1600px wide. Every tile is the same size and is cropped to it, so use the crop tool to mark what must stay in frame. Leave it empty and the tint above is used on its own.',
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description:
            'What the image shows. The tile’s own title and blurb sit beside it, so this is only read when the picture fails to load.',
          validation: (Rule) => Rule.required().warning('Every image needs alt text.'),
        }),
      ],
    }),
    defineField({
      name: 'services',
      title: 'Hired as',
      type: 'array',
      group: 'main',
      description:
        'The services somebody actually commissions to get this work. Stated rather than derived, because a craft and a service are not the same thing.',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'service' }] })],
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      group: 'main',
      initialValue: 50,
    }),

    ...seoFields,
  ],

  orderings: [{ title: 'Position', name: 'order', by: [{ field: 'order', direction: 'asc' }] }],

  preview: {
    /* `media` so the "Portfolio disciplines" list under Images reads as a
       contact sheet rather than a column of identical placeholder squares. */
    select: { title: 'title', slug: 'slug.current', order: 'order', media: 'image' },
    prepare: ({ title, slug, order, media }) => ({
      title,
      subtitle: `/portfolio/${slug}/  ·  ${order}`,
      media,
    }),
  },
});
