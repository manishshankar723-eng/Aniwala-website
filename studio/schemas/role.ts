/**
 * An open role.
 *
 * WHY THIS SCHEMA IS STRICTER THAN THE OTHERS
 * Every published role emits `JobPosting` structured data, which is how these
 * listings get into Google's job results. Google does not report problems with
 * a posting — a malformed date or a missing field means the role quietly never
 * appears in the jobs index, and nobody finds out for weeks, by which point the
 * seat has been open a month with no applicants and the obvious conclusion is
 * that nobody wants the job.
 *
 * So `posted` is required with a real date type, and `discipline` and `kind`
 * are dropdowns rather than free text. `kind` in particular maps to the exact
 * string Google expects in `employmentType`; a typo there is not a typo, it is
 * a delisting.
 *
 * CLOSING A ROLE
 * Unpublish it. Do not leave it up with "position filled" in the summary. A
 * listing still live after the seat is filled is the fastest way to lose the
 * next good applicant, and applicants talk.
 */
import { defineType, defineField } from 'sanity';
import { seoFields } from './seoFields';
import { DISCIPLINES, EMPLOYMENT_KINDS } from '../../src/config/disciplines';

export default defineType({
  name: 'role',
  title: 'Open role',
  type: 'document',

  groups: [
    { name: 'basics', title: 'The basics', default: true },
    { name: 'detail', title: 'The job itself' },
    { name: 'seo', title: 'Search' },
  ],

  fields: [
    defineField({
      name: 'title',
      title: 'Job title',
      type: 'string',
      group: 'basics',
      description: 'As it would appear on a contract. "3D Character Artist", not "Art Ninja".',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      group: 'basics',
      description: 'The web address: aniwala.com/careers/THIS-BIT/. Click Generate.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'discipline',
      title: 'Discipline',
      type: 'string',
      group: 'basics',
      description:
        'Which filter chip this role appears under on the careers page. If the right one is not in this list, a developer has to add it — picking a near-miss hides the role behind the wrong filter.',
      options: { list: DISCIPLINES.map((d) => ({ title: d, value: d })) },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'kind',
      title: 'Employment type',
      type: 'string',
      group: 'basics',
      options: {
        list: EMPLOYMENT_KINDS.map((k) => ({ title: k, value: k })),
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      group: 'basics',
      description:
        'Plain English, and say on-site or remote explicitly — it is the first thing people filter on. E.g. "Wakad, Pune — on-site".',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'experience',
      title: 'Experience',
      type: 'string',
      group: 'basics',
      description:
        'A band, not a number. "2–5 years" is honest; "3 years" is a lie by precision and puts off the person with two and a half.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'openings',
      title: 'Number of openings',
      type: 'number',
      group: 'basics',
      initialValue: 1,
      validation: (Rule) => Rule.required().integer().positive(),
    }),

    defineField({
      name: 'posted',
      title: 'Date posted',
      type: 'date',
      group: 'basics',
      options: { dateFormat: 'YYYY-MM-DD' },
      description:
        'Shown on the page and sent to Google as datePosted. Keep it current — a posting dated eight months ago reads as abandoned, and Google drops stale postings from the jobs index on its own.',
      initialValue: () => new Date().toISOString().split('T')[0],
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'closes',
      title: 'Closing date (optional)',
      type: 'date',
      group: 'basics',
      options: { dateFormat: 'YYYY-MM-DD' },
      description: 'Sent to Google as validThrough. Leave blank if the role is open-ended.',
    }),

    defineField({
      name: 'summary',
      title: 'One-line summary',
      type: 'string',
      group: 'basics',
      description:
        'Shown under the title on the careers listing. One line describing the actual work.',
      validation: (Rule) => Rule.required().max(200),
    }),

    defineField({
      name: 'tint',
      title: 'Page colour',
      type: 'string',
      group: 'basics',
      description: 'An HSL triple like "265 60% 28%". Leave the default unless you have a reason.',
      initialValue: '265 60% 28%',
    }),

    defineField({
      name: 'about',
      title: 'About the role',
      type: 'text',
      rows: 5,
      group: 'detail',
      description:
        'Two or three sentences of real context: what the work actually is, what it ships into. Concrete beats enthusiastic — "most of it ships into an engine, so the polycount conversation happens at the start" tells someone more than "exciting opportunity".',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'responsibilities',
      title: 'Responsibilities',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'detail',
      description: 'What the person actually does, day to day. One per line.',
      validation: (Rule) => Rule.required().min(1),
    }),

    defineField({
      name: 'requirements',
      title: 'Requirements',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'detail',
      description:
        'The floor — what someone genuinely cannot do the job without. If a person missing one of these should still apply, it belongs in Nice to have instead. Long requirement lists filter out good applicants who read them honestly.',
      validation: (Rule) => Rule.required().min(1),
    }),

    defineField({
      name: 'niceToHave',
      title: 'Nice to have',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'detail',
      description: 'Genuinely optional. Never park a real requirement here.',
    }),

    defineField({
      name: 'software',
      title: 'Software',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'detail',
      description: 'What they will be in every day. "ZBrush", "Maya", "Substance Painter".',
      options: { layout: 'tags' },
    }),

    defineField({
      name: 'reelNote',
      title: 'What to show in the portfolio',
      type: 'text',
      rows: 3,
      group: 'detail',
      description:
        'The single most useful line on a creative job ad and the one almost nobody writes. An animator and a character artist are judged on completely different things — say which, for THIS role, and save everyone a round.',
      validation: (Rule) => Rule.required(),
    }),

    ...seoFields,
  ],

  preview: {
    select: { title: 'title', discipline: 'discipline', kind: 'kind', posted: 'posted' },
    prepare: ({ title, discipline, kind, posted }) => ({
      title,
      subtitle: [discipline, kind, posted].filter(Boolean).join(' · '),
    }),
  },
});
