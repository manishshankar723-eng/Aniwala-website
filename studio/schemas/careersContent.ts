/**
 * The careers page's content. A SINGLETON.
 *
 * WHY THIS IS A SINGLETON AND NOT A BUILT PAGE, when every other page on the
 * site moved to the block builder.
 *
 * The careers page is a template, not an arrangement of sections. It filters
 * listings client-side, prefills the application form from whichever role you
 * clicked, emits JobPosting structured data that Google's jobs index reads,
 * and changes its own headings depending on whether anything is open. Turning
 * that into blocks would mean four block types used on exactly one page each,
 * and the only thing the editor would gain is the ability to reorder five
 * sections — at the risk of breaking a working application form.
 *
 * So the page keeps its template and everything an editor should be able to
 * change lives here: whether hiring is open at all, the values, the hiring
 * steps, and every heading and empty state on the page.
 *
 * `hiringOpen` is the field that matters most. Turning it off empties the
 * listings and switches the page to its open-application state — which is the
 * honest thing to do when hiring pauses, and previously took a developer.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';

export default defineType({
  name: 'careersContent',
  title: 'Careers page',
  type: 'document',

  groups: [
    { name: 'state', title: 'Hiring', default: true },
    { name: 'hero', title: 'Hero' },
    { name: 'roles', title: 'Roles section' },
    { name: 'studio', title: 'Working here' },
    { name: 'process', title: 'Hiring process' },
  ],

  fields: [
    defineField({
      name: 'hiringOpen',
      title: 'Hiring is open',
      type: 'boolean',
      group: 'state',
      description:
        'Turn this off to pause hiring: the listings disappear and the page switches to its open-application state. The roles themselves are not deleted — publish this again and they come back.',
      initialValue: true,
    }),

    /* ---------------------------------------------------------------- */
    defineField({ name: 'heroEyebrow', title: 'Eyebrow', type: 'string', group: 'hero' }),
    defineField({ name: 'heroTitle', title: 'Headline', type: 'string', group: 'hero' }),
    defineField({ name: 'heroLead', title: 'Sub-heading', type: 'text', rows: 4, group: 'hero' }),
    defineField({
      name: 'heroStatDays',
      title: 'Stat — days to an answer',
      type: 'string',
      group: 'hero',
      description:
        'The number and its label. This is a promise applicants will hold you to, so change it only if the studio can actually meet it.',
    }),
    defineField({
      name: 'heroStatDaysLabel',
      title: 'Stat — days label',
      type: 'string',
      group: 'hero',
    }),
    defineField({ name: 'heroStatMonths', title: 'Stat — months on file', type: 'string', group: 'hero' }),
    defineField({
      name: 'heroStatMonthsLabel',
      title: 'Stat — months label',
      type: 'string',
      group: 'hero',
    }),
    defineField({ name: 'heroActRoles', title: 'Button — see roles', type: 'string', group: 'hero' }),
    defineField({ name: 'heroActOpen', title: 'Button — open application', type: 'string', group: 'hero' }),

    /* ---------------------------------------------------------------- */
    defineField({
      name: 'rolesEyebrow',
      title: 'Eyebrow',
      type: 'string',
      group: 'roles',
      initialValue: 'Open roles',
    }),
    defineField({
      name: 'rolesTitle',
      title: 'Heading when roles are open',
      type: 'string',
      group: 'roles',
    }),
    defineField({
      name: 'rolesTitleEmpty',
      title: 'Heading when nothing is open',
      type: 'string',
      group: 'roles',
    }),
    defineField({
      name: 'rolesLinkLabel',
      title: 'Link label',
      type: 'string',
      group: 'roles',
      description: 'Goes to the careers inbox from Contact details.',
    }),
    defineField({
      name: 'emptyOpen',
      title: 'Empty state — while hiring',
      type: 'text',
      rows: 2,
      group: 'roles',
      description: 'Shown when hiring is on but every seat is filled.',
    }),
    defineField({
      name: 'emptyPaused',
      title: 'Empty state — while paused',
      type: 'text',
      rows: 2,
      group: 'roles',
      description: 'Shown when hiring is switched off above.',
    }),
    defineField({
      name: 'emptyBody',
      title: 'Empty state — body',
      type: 'text',
      rows: 4,
      group: 'roles',
    }),
    defineField({
      name: 'emptyAct',
      title: 'Empty state — button',
      type: 'string',
      group: 'roles',
    }),
    defineField({
      name: 'specEyebrow',
      title: 'Speculative panel — eyebrow',
      type: 'string',
      group: 'roles',
    }),
    defineField({
      name: 'specTitle',
      title: 'Speculative panel — heading',
      type: 'string',
      group: 'roles',
    }),
    defineField({
      name: 'specBody',
      title: 'Speculative panel — body',
      type: 'text',
      rows: 4,
      group: 'roles',
    }),
    defineField({
      name: 'specAct',
      title: 'Speculative panel — button',
      type: 'string',
      group: 'roles',
    }),

    /* ---------------------------------------------------------------- */
    defineField({
      name: 'studioEyebrow',
      title: 'Eyebrow',
      type: 'string',
      group: 'studio',
    }),
    defineField({
      name: 'studioTitle',
      title: 'Heading',
      type: 'string',
      group: 'studio',
    }),
    defineField({
      name: 'studioNote',
      title: 'Note',
      type: 'text',
      rows: 3,
      group: 'studio',
      description:
        'The paragraph above the list. This is the place the page is most honest — it says what the studio cannot offer before it says what it can.',
    }),
    defineField({
      name: 'values',
      title: 'What we can offer',
      type: 'array',
      group: 'studio',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'value',
          fields: [
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (R) => R.required() }),
            defineField({ name: 'body', title: 'Body', type: 'text', rows: 3, validation: (R) => R.required() }),
          ],
          preview: { select: { title: 'title', subtitle: 'body' } },
        }),
      ],
    }),

    /* ---------------------------------------------------------------- */
    defineField({
      name: 'processEyebrow',
      title: 'Eyebrow',
      type: 'string',
      group: 'process',
    }),
    defineField({
      name: 'processTitle',
      title: 'Heading',
      type: 'string',
      group: 'process',
    }),
    defineField({
      name: 'hiringSteps',
      title: 'Steps',
      type: 'array',
      group: 'process',
      description:
        'The stages an application goes through. The timings are a promise somebody will hold you to — do not put one here you are not willing to meet.',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'step',
          fields: [
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (R) => R.required() }),
            defineField({
              name: 'when',
              title: 'When',
              type: 'string',
              description: 'The timing shown beside the title — "Within 5 working days".',
              validation: (R) => R.required(),
            }),
            defineField({ name: 'body', title: 'Body', type: 'text', rows: 3, validation: (R) => R.required() }),
          ],
          preview: { select: { title: 'title', subtitle: 'when' } },
        }),
      ],
    }),
  ],

  preview: { prepare: () => ({ title: 'Careers page' }) },
});
