/**
 * The block library — every section an editor can put on a page.
 *
 * A page is an ordered list of these. Adding, reordering and deleting them is
 * the whole point of the builder, so unlike `pageCopy` (which only filled in
 * slots the template had already decided on) the page's shape now genuinely
 * lives in the CMS.
 *
 * TWO KINDS OF BLOCK, and the distinction is the most important idea here.
 *
 *   CONTENT blocks carry their own words: a statement, a rich-text passage, an
 *   image, a CTA panel. What you type is what renders.
 *
 *   DATA blocks carry only a heading and pull their contents from elsewhere in
 *   the CMS — the work grid reads the portfolio categories, the testimonial
 *   wall reads the testimonials, the FAQ block reads the FAQs for a scope.
 *   They exist so that "show the testimonials here" does not mean copying the
 *   testimonials into this page, where they would immediately start drifting
 *   from the ones on the homepage.
 *
 * So: if something appears in two places, it is a data block reading one
 * source. If it is genuinely written for this page and nowhere else, it is a
 * content block. Getting that wrong is how a site ends up with four slightly
 * different versions of the same paragraph.
 *
 * WHAT A BLOCK DOES NOT CONTROL: colour, spacing, type scale, grid columns.
 * Those come from the components in `src/components/blocks/` and from
 * `global.css`. An editor arranges sections; a designer decides what a section
 * looks like. Fields that would blur that line — a text-colour picker, a
 * padding number — are deliberately absent.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';
import { IMAGE_SLOTS } from '../../src/config/imageSlots';

/* Reused by nearly every block. Defined as plain field arrays rather than a
   shared object type so the Studio renders them inline, at the top of the
   block, instead of behind a collapsed "heading" sub-form. */
const headingFields = [
  defineField({
    name: 'eyebrow',
    title: 'Eyebrow',
    type: 'string',
    description: 'The small label above the heading. Two or three words. Optional.',
  }),
  defineField({
    name: 'title',
    title: 'Heading',
    type: 'string',
    description: 'Leave blank to render the section with no heading.',
  }),
  defineField({
    name: 'anchor',
    title: 'Anchor',
    type: 'string',
    description:
      'Makes the section linkable as /page/#anchor. Only needed when something links straight to this section — most sections do not need one. Lowercase, no spaces.',
    validation: (Rule) =>
      Rule.custom((value) =>
        !value || /^[a-z0-9][a-z0-9-]*$/.test(value)
          ? true
          : 'Lowercase letters, numbers and hyphens only, starting with a letter or number.'
      ),
  }),
];

const linkFields = [
  defineField({
    name: 'linkLabel',
    title: 'Link label',
    type: 'string',
    description: 'Leave blank for no link.',
  }),
  defineField({
    name: 'linkHref',
    title: 'Link target',
    type: 'string',
    description: 'A site path like /portfolio/ , or a full https:// URL.',
    validation: (Rule) =>
      Rule.custom((value) =>
        !value || value.startsWith('/') || /^(https?:\/\/|mailto:)/.test(value)
          ? true
          : 'Use a path starting with / , a full http(s) URL, or a mailto: address.'
      ),
  }),
];

/** Every block gets one, so the Studio's collapsed list is readable. */
const preview = (label: string, subtitleField = 'title') => ({
  select: { title: subtitleField, eyebrow: 'eyebrow' },
  prepare: ({ title, eyebrow }: { title?: string; eyebrow?: string }) => ({
    title: label,
    subtitle: title || eyebrow || '—',
  }),
});

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
export const heroBlock = defineType({
  name: 'heroBlock',
  title: 'Hero',
  type: 'object',
  fields: [
    defineField({
      name: 'variant',
      title: 'Style',
      type: 'string',
      description:
        'Video fills the screen with the showreel and is meant for the homepage — one per site, or it stops being an arrival. Standard is the compact band every inner page uses.',
      options: {
        list: [
          { title: 'Video — full screen', value: 'video' },
          { title: 'Standard — compact band', value: 'page' },
        ],
        layout: 'radio',
      },
      initialValue: 'page',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      description:
        'The biggest text on the page. To stop an awkward two-word break, type a non-breaking space (Alt+0160) rather than a normal one.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'sub', title: 'Sub-heading', type: 'text', rows: 3 }),
    defineField({ name: 'ctaLabel', title: 'Button label', type: 'string' }),
    defineField({
      name: 'ctaHref',
      title: 'Button link',
      type: 'string',
      validation: (Rule) =>
        Rule.custom((value) =>
          !value || value.startsWith('/') || /^(https?:\/\/|mailto:)/.test(value)
            ? true
            : 'Use a path starting with / , a full http(s) URL, or a mailto: address.'
        ),
    }),
    defineField({
      name: 'crumbLabel',
      title: 'Breadcrumb label',
      type: 'string',
      description:
        'The trail above the title reads "Home / <this>". Leave blank for no trail. Not used on a video hero.',
      hidden: ({ parent }) => parent?.variant === 'video',
    }),
    defineField({
      name: 'tint',
      title: 'Tint',
      type: 'string',
      description:
        'Washes the hero background. An HSL triple like "210 70% 22%" — hue, saturation, lightness. Leave blank for the default.',
      validation: (Rule) =>
        Rule.custom((value) =>
          !value || /^\d{1,3} \d{1,3}% \d{1,3}%$/.test(value)
            ? true
            : 'Three parts, like "210 70% 22%".'
        ),
      hidden: ({ parent }) => parent?.variant === 'video',
    }),
    defineField({
      name: 'compact',
      title: 'Compact',
      type: 'boolean',
      description: 'Tighter vertical space. Use on pages that lead straight into a grid or list.',
      initialValue: false,
      hidden: ({ parent }) => parent?.variant === 'video',
    }),
    defineField({
      name: 'posterSlot',
      title: 'Still image',
      type: 'string',
      description:
        'Shown before the video loads and wherever it cannot play — on a slow connection this may be the only thing seen. Upload the picture under Images against the slot you pick here.',
      options: { list: IMAGE_SLOTS.map((s) => ({ title: s.title, value: s.name })) },
      hidden: ({ parent }) => parent?.variant !== 'video',
    }),
  ],
  preview: {
    select: { headline: 'headline', variant: 'variant' },
    prepare: ({ headline, variant }) => ({
      title: variant === 'video' ? 'Hero — video' : 'Hero',
      subtitle: headline,
    }),
  },
});

/* ------------------------------------------------------------------ */
/* Content blocks                                                      */
/* ------------------------------------------------------------------ */
export const statementBlock = defineType({
  name: 'statementBlock',
  title: 'Statement',
  type: 'object',
  description: 'One short paragraph, set large. Use it once per page at most.',
  fields: [
    defineField({
      name: 'source',
      title: 'Where the text comes from',
      type: 'string',
      description:
        'The studio positioning statement is shared with every page that shows it, so editing it once updates all of them. Pick custom only for a paragraph that belongs to this page alone.',
      options: {
        list: [
          { title: 'The studio positioning statement', value: 'positioning' },
          { title: 'A custom paragraph, typed below', value: 'custom' },
        ],
        layout: 'radio',
      },
      initialValue: 'custom',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Statement',
      type: 'text',
      rows: 4,
      description: 'Two or three sentences. It loses its force at five.',
      hidden: ({ parent }) => parent?.source !== 'custom',
    }),
  ],
  preview: {
    select: { body: 'body' },
    prepare: ({ body }) => ({ title: 'Statement', subtitle: body }),
  },
});

export const richTextBlock = defineType({
  name: 'richTextBlock',
  title: 'Text',
  type: 'object',
  description: 'Headings, paragraphs, lists and links — the same editor the blog uses.',
  fields: [
    ...headingFields,
    defineField({
      name: 'body',
      title: 'Text',
      type: 'blockContent',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: preview('Text'),
});

export const imageBlock = defineType({
  name: 'imageBlock',
  title: 'Image',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description:
        'What the picture shows, for people who cannot see it. Describe the content, not the file — "a rigged character mid-run", not "hero image".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'caption', title: 'Caption', type: 'string' }),
    defineField({
      name: 'width',
      title: 'Width',
      type: 'string',
      options: {
        list: [
          { title: 'Text width', value: 'text' },
          { title: 'Full width', value: 'full' },
        ],
        layout: 'radio',
      },
      initialValue: 'text',
    }),
  ],
  preview: {
    select: { media: 'image', alt: 'alt' },
    prepare: ({ media, alt }) => ({ title: 'Image', subtitle: alt, media }),
  },
});

export const tagListBlock = defineType({
  name: 'tagListBlock',
  title: 'Tag list',
  type: 'object',
  description: 'A wrapped row of short labels — the tools list, a list of formats.',
  fields: [
    ...headingFields,
    defineField({
      name: 'source',
      title: 'Where the tags come from',
      type: 'string',
      description:
        'The studio tools list is shared with every other page that shows it, so editing it once updates all of them. Pick custom only for a list that belongs to this page alone.',
      options: {
        list: [
          { title: 'The studio tools list', value: 'capabilities' },
          { title: 'Every tool named on a service page', value: 'serviceTools' },
          { title: 'The enquiry types the booking form offers', value: 'enquiryTypes' },
          { title: 'A custom list, typed below', value: 'custom' },
        ],
        layout: 'radio',
      },
      initialValue: 'capabilities',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'items',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      hidden: ({ parent }) => parent?.source !== 'custom',
    }),
    ...linkFields,
  ],
  preview: preview('Tag list'),
});

export const marqueeBlock = defineType({
  name: 'marqueeBlock',
  title: 'Marquee',
  type: 'object',
  description: 'The scrolling strip of disciplines.',
  fields: [
    defineField({
      name: 'source',
      title: 'Where the items come from',
      type: 'string',
      options: {
        list: [
          { title: 'The studio marquee list', value: 'marquee' },
          { title: 'A custom list, typed below', value: 'custom' },
        ],
        layout: 'radio',
      },
      initialValue: 'marquee',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      hidden: ({ parent }) => parent?.source !== 'custom',
    }),
  ],
  preview: { prepare: () => ({ title: 'Marquee' }) },
});

export const ctaPanelBlock = defineType({
  name: 'ctaPanelBlock',
  title: 'Call to action — panel',
  type: 'object',
  description: 'A bordered panel with a heading, a paragraph and one button.',
  fields: [
    ...headingFields,
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    ...linkFields,
  ],
  preview: preview('Call to action'),
});

export const ctaBandBlock = defineType({
  name: 'ctaBandBlock',
  title: 'Call to action — band',
  type: 'object',
  description:
    'The full-width closing panel most pages end on. Leave the fields blank to use the site-wide default.',
  fields: [
    ...headingFields,
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    ...linkFields,
  ],
  preview: preview('Closing CTA'),
});

/* ------------------------------------------------------------------ */
/* Data blocks — a heading, and contents read from elsewhere           */
/* ------------------------------------------------------------------ */
const dataBlock = (
  name: string,
  title: string,
  description: string,
  extra: ReturnType<typeof defineField>[] = [],
  withLink = false
) =>
  defineType({
    name,
    title,
    type: 'object',
    description,
    fields: [...headingFields, ...extra, ...(withLink ? linkFields : [])],
    preview: preview(title),
  });

export const workGridBlock = dataBlock(
  'workGridBlock',
  'Work grid',
  'The six discipline tiles, with their pictures. Edit them under Portfolio categories and Images.',
  [],
  true
);

export const caseStudyListBlock = dataBlock(
  'caseStudyListBlock',
  'Case studies',
  'Cards for the case studies. Featured ones come first.',
  [
    defineField({
      name: 'layout',
      title: 'Layout',
      type: 'string',
      description:
        'Grid is a row of cards under a heading. Featured leads with the newest at full width and is meant for a page whose whole job is listing them — it also shows a message when there are none, instead of vanishing.',
      options: {
        list: [
          { title: 'Grid', value: 'grid' },
          { title: 'Featured — lead card, then a grid', value: 'featured' },
        ],
        layout: 'radio',
      },
      initialValue: 'grid',
    }),
    defineField({
      name: 'limit',
      title: 'How many',
      type: 'number',
      description: 'Three fits the grid. Leave blank to show them all.',
      validation: (Rule) => Rule.min(1).max(24),
    }),
    defineField({
      name: 'emptyTitle',
      title: 'Empty message — heading',
      type: 'string',
      description: 'Shown when nothing is published yet.',
      hidden: ({ parent }) => parent?.layout !== 'featured',
    }),
    defineField({
      name: 'emptyBody',
      title: 'Empty message — body',
      type: 'text',
      rows: 3,
      hidden: ({ parent }) => parent?.layout !== 'featured',
    }),
    defineField({
      name: 'emptyCtaLabel',
      title: 'Empty message — link label',
      type: 'string',
      hidden: ({ parent }) => parent?.layout !== 'featured',
    }),
    defineField({
      name: 'emptyCtaHref',
      title: 'Empty message — link target',
      type: 'string',
      hidden: ({ parent }) => parent?.layout !== 'featured',
    }),
  ],
  true
);

export const serviceGridBlock = dataBlock(
  'serviceGridBlock',
  'Services',
  'The six services, read from the services list.',
  [
    defineField({
      name: 'layout',
      title: 'Layout',
      type: 'string',
      description:
        'Tiles is the compact grid. Rows is the full-width numbered list, which has room for each service to say something — use it on a page about the services themselves, not as a summary.',
      options: {
        list: [
          { title: 'Tiles', value: 'grid' },
          { title: 'Rows — numbered, full width', value: 'rows' },
        ],
        layout: 'radio',
      },
      initialValue: 'grid',
    }),
  ]
);

export const engagementBlock = dataBlock(
  'engagementBlock',
  'Engagement models',
  'How a client can hire the studio — fixed-scope, team extension, co-development. Read from the services config so the three mean the same thing everywhere.'
);

export const processBlock = dataBlock(
  'processBlock',
  'Process steps',
  'The numbered "how we work" sequence.'
);

export const clientWallBlock = dataBlock(
  'clientWallBlock',
  'Client logos',
  'Hides itself entirely while no clients are published — an empty logo wall reads worse than none.'
);

export const testimonialBlock = dataBlock(
  'testimonialBlock',
  'Testimonials',
  'Hides itself while no testimonials are published.'
);

export const pieceGridBlock = dataBlock(
  'pieceGridBlock',
  'Portfolio pieces',
  'Cards for individual pieces.',
  [
    defineField({
      name: 'category',
      title: 'Only this discipline',
      type: 'string',
      description: 'Leave blank to show every piece.',
    }),
    defineField({
      name: 'limit',
      title: 'How many',
      type: 'number',
      validation: (Rule) => Rule.min(1).max(48),
    }),
    defineField({
      name: 'showFilter',
      title: 'Show the filter row',
      type: 'boolean',
      description:
        'Only on a page whose job IS the listing. On a marketing page a filter row navigates the reader away from what they were reading.',
      initialValue: false,
    }),
    defineField({
      name: 'emptyTitle',
      title: 'Empty message — heading',
      type: 'string',
      description:
        'Shown instead of the list when nothing is published. Leave blank and the whole section vanishes instead, which is what you want anywhere except the listing page itself.',
    }),
    defineField({ name: 'emptyBody', title: 'Empty message — body', type: 'text', rows: 3 }),
    defineField({ name: 'emptyCtaLabel', title: 'Empty message — link label', type: 'string' }),
    defineField({ name: 'emptyCtaHref', title: 'Empty message — link target', type: 'string' }),
  ],
  true
);

export const postListBlock = dataBlock(
  'postListBlock',
  'Blog posts',
  'The newest post at full width, the rest in a grid below.',
  [
    defineField({
      name: 'limit',
      title: 'How many',
      type: 'number',
      validation: (Rule) => Rule.min(1).max(48),
    }),
    defineField({
      name: 'showFilter',
      title: 'Show the filter row',
      type: 'boolean',
      description:
        'Only on a page whose job IS the listing. On a marketing page a filter row navigates the reader away from what they were reading.',
      initialValue: false,
    }),
    defineField({
      name: 'emptyTitle',
      title: 'Empty message — heading',
      type: 'string',
      description:
        'Shown instead of the list when nothing is published. Leave blank and the whole section vanishes instead, which is what you want anywhere except the listing page itself.',
    }),
    defineField({ name: 'emptyBody', title: 'Empty message — body', type: 'text', rows: 3 }),
    defineField({ name: 'emptyCtaLabel', title: 'Empty message — link label', type: 'string' }),
    defineField({ name: 'emptyCtaHref', title: 'Empty message — link target', type: 'string' }),
  ],
  true
);

export const factGridBlock = defineType({
  name: 'factGridBlock',
  title: 'Fact strip',
  type: 'object',
  description:
    'A row of label + value facts. NOT a stat counter: every row should be something a visitor could check, not a number that grows to flatter us. "0 years" behind a big number is worse than no section.',
  fields: [
    ...headingFields,
    defineField({
      name: 'facts',
      title: 'Facts',
      type: 'array',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'fact',
          fields: [
            defineField({ name: 'label', title: 'Label', type: 'string', validation: (R) => R.required() }),
            defineField({ name: 'value', title: 'Value', type: 'string', validation: (R) => R.required() }),
            defineField({ name: 'note', title: 'Note', type: 'string', description: 'One line of context. Optional.' }),
          ],
          preview: {
            select: { title: 'value', subtitle: 'label' },
          },
        }),
      ],
    }),
  ],
  preview: preview('Fact strip'),
});

export const principleListBlock = defineType({
  name: 'principleListBlock',
  title: 'Titled list',
  type: 'object',
  description:
    'Titled paragraphs. Write commitments somebody could hold you to rather than adjectives about yourself — "we quote in shots, not days" beats "passionate about quality".',
  fields: [
    ...headingFields,
    defineField({
      name: 'variant',
      title: 'Style',
      type: 'string',
      options: {
        list: [
          { title: 'Numbered — two across, large', value: 'numbered' },
          { title: 'Compact — four across, small', value: 'compact' },
        ],
        layout: 'radio',
      },
      initialValue: 'numbered',
    }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'item',
          fields: [
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (R) => R.required() }),
            defineField({ name: 'body', title: 'Body', type: 'text', rows: 4, validation: (R) => R.required() }),
          ],
          preview: { select: { title: 'title', subtitle: 'body' } },
        }),
      ],
    }),
  ],
  preview: preview('Titled list'),
});

export const teamGridBlock = dataBlock(
  'teamGridBlock',
  'Team',
  'The people cards. Unpublished members show only in preview.',
  [defineField({ name: 'intro', title: 'Intro line', type: 'text', rows: 2 })]
);

export const milestoneBlock = dataBlock(
  'milestoneBlock',
  'Timeline',
  'Studio milestones. Hides itself while empty.'
);

export const faqBlock = dataBlock(
  'faqBlock',
  'FAQs',
  'Questions for one scope, read from the FAQs list.',
  [
    defineField({
      name: 'scope',
      title: 'Which set',
      type: 'string',
      description: 'For example "careers", or "service:vfx".',
      validation: (Rule) => Rule.required(),
    }),
  ]
);

export const reachBlock = defineType({
  name: 'reachBlock',
  title: 'Contact details',
  type: 'object',
  description:
    'The inbox, the address and the social accounts, read from Contact details. Change any of those there and every page showing them follows.',
  fields: [
    ...headingFields,
    defineField({
      name: 'note',
      title: 'Note beside the email',
      type: 'text',
      rows: 4,
      description: 'What to send, and what happens next.',
    }),
    defineField({
      name: 'hints',
      title: 'Hints',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Short lines under the note. Advice on writing a brief worth answering.',
    }),
    defineField({ name: 'emailLabel', title: 'Email card label', type: 'string' }),
    defineField({ name: 'studioLabel', title: 'Address card label', type: 'string' }),
    defineField({ name: 'mapsLabel', title: 'Maps link label', type: 'string' }),
    defineField({ name: 'socialLabel', title: 'Social card label', type: 'string' }),
  ],
  preview: preview('Contact details'),
});

export const bookCallBlock = defineType({
  name: 'bookCallBlock',
  title: 'Book a call',
  type: 'object',
  description: 'The multi-step booking widget. Settings live in the site config.',
  fields: [
    defineField({
      name: 'note',
      title: 'Note',
      type: 'string',
      readOnly: true,
      initialValue: 'This block has no options — it renders the booking widget.',
    }),
  ],
  preview: { prepare: () => ({ title: 'Book a call' }) },
});

/** Every block type, for registration and for the page's array. */
export const blockTypes = [
  heroBlock,
  statementBlock,
  richTextBlock,
  imageBlock,
  tagListBlock,
  factGridBlock,
  principleListBlock,
  marqueeBlock,
  ctaPanelBlock,
  ctaBandBlock,
  workGridBlock,
  caseStudyListBlock,
  serviceGridBlock,
  engagementBlock,
  processBlock,
  clientWallBlock,
  testimonialBlock,
  pieceGridBlock,
  postListBlock,
  teamGridBlock,
  milestoneBlock,
  faqBlock,
  reachBlock,
  bookCallBlock,
];

/** Array members for the page builder, in the order the "Add" menu shows them. */
export const blockArrayMembers = blockTypes.map((b) =>
  defineArrayMember({ type: b.name, name: b.name })
);
