/**
 * One discipline the studio sells. `/services/{slug}/` is built from each.
 *
 * These were six records in a 734-line `config/services.ts`, which meant that
 * rewording a single offering — the most-edited copy on the site after the
 * blog — needed a developer, a review and a deploy.
 *
 * WHAT IS NOT HERE:
 *
 *   FAQs. They are their own document type, filed against `service:<slug>`,
 *   because several answers are shared across disciplines and keeping one copy
 *   is the only way six pages do not drift apart.
 *
 *   Engagement models. Fixed-scope / team extension / co-development is how
 *   the business is structured rather than copy about one service, so it stays
 *   in code where a change gets a diff.
 *
 * THE SLUG IS THE URL. Renaming one breaks every existing link to that page,
 * and case studies reference services by slug too — so a rename orphans those
 * cross-links silently. Rename only if you are willing to chase both.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';
import { seoFields } from './seoFields';

const titleBody = (name: string, title: string, description: string, withTools = false) =>
  defineField({
    name,
    title,
    type: 'array',
    description,
    validation: (Rule) => Rule.min(1),
    of: [
      defineArrayMember({
        type: 'object',
        name: 'entry',
        fields: [
          defineField({
            name: 'title',
            title: 'Title',
            type: 'string',
            validation: (Rule) => Rule.required(),
          }),
          defineField({
            name: 'body',
            title: 'Body',
            type: 'text',
            rows: 3,
            validation: (Rule) => Rule.required(),
          }),
          ...(withTools
            ? [
                defineField({
                  name: 'tools',
                  title: 'Tools',
                  type: 'string',
                  description:
                    'Software actually touched at this stage, as small print. A comma-separated line, not a list.',
                }),
              ]
            : []),
        ],
        preview: { select: { title: 'title', subtitle: 'body' } },
      }),
    ],
  });

export default defineType({
  name: 'service',
  title: 'Service',
  type: 'document',

  groups: [
    { name: 'main', title: 'Page', default: true },
    { name: 'detail', title: 'Offerings & pipeline' },
    { name: 'meta', title: 'Naming & links' },
    { name: 'seo', title: 'Search' },
  ],

  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'main',
      description: 'The heading on the page, and the browser tab.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      group: 'main',
      description: 'Becomes /services/<this>/. Renaming it breaks existing links.',
      options: { source: 'title', maxLength: 60 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      group: 'main',
      description: 'One line under the heading. Also the page’s search-result description.',
      validation: (Rule) => Rule.required().max(300),
    }),
    defineField({
      name: 'intro',
      title: 'Intro',
      type: 'text',
      rows: 4,
      group: 'main',
      description: 'Two or three sentences of real positioning. What this is, and why here.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tint',
      title: 'Tint',
      type: 'string',
      group: 'main',
      description: 'HSL triple driving the page’s placeholder art, e.g. "210 70% 22%".',
      validation: (Rule) =>
        Rule.required().custom((v) =>
          /^\d{1,3} \d{1,3}% \d{1,3}%$/.test(String(v)) ? true : 'Three parts, like "210 70% 22%".'
        ),
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      group: 'main',
      description: 'Lower first. Sets the order on the services page and in the footer.',
      initialValue: 50,
    }),

    /* ---------------------------------------------------------------- */
    titleBody(
      'offerings',
      'Offerings',
      'The work itself, broken into the pieces a client actually orders.',
    ),
    titleBody(
      'pipeline',
      'Pipeline',
      'The route a job takes through the studio. A real sequence — it renders numbered.',
      true,
    ),
    defineField({
      name: 'tools',
      title: 'Tools',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'detail',
      options: { layout: 'tags' },
      description: 'Software. Order is roughly pipeline order, not preference.',
    }),
    defineField({
      name: 'deliverables',
      title: 'Deliverables',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'detail',
      description: 'What lands in the client’s folder at the end. Be specific about formats.',
    }),

    /* ---------------------------------------------------------------- */
    defineField({
      name: 'label',
      title: 'Short name',
      type: 'string',
      group: 'meta',
      description: 'Used in menus, cards and cross-links, where the full title is too long.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'shortName',
      title: 'Name mid-sentence',
      type: 'string',
      group: 'meta',
      description:
        'How the service reads inside a sentence — "a VFX brief", "a 3D art job". Typed out rather than lower-cased from the title, because lower-casing turns VFX into "vfx".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'article',
      title: 'A or an',
      type: 'string',
      group: 'meta',
      description:
        'The word before the name mid-sentence. It follows the spoken sound, not the first letter: "a VFX brief" (vee-eff-ex), but "an integration brief".',
      options: { list: ['a', 'an'], layout: 'radio' },
      initialValue: 'a',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'related',
      title: 'Pairs with',
      type: 'array',
      group: 'meta',
      description: 'The two or three services that most often come with this one.',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'service' }] })],
      validation: (Rule) => Rule.unique(),
    }),

    ...seoFields,
  ],

  orderings: [
    { title: 'Position', name: 'order', by: [{ field: 'order', direction: 'asc' }] },
  ],

  preview: {
    select: { title: 'title', slug: 'slug.current', order: 'order' },
    prepare: ({ title, slug, order }) => ({ title, subtitle: `/services/${slug}/  ·  ${order}` }),
  },
});
