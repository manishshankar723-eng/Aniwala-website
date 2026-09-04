/**
 * The "book a call" widget. A SINGLETON.
 *
 * Who the call is with, how long it runs, when the studio takes them, and what
 * the visitor is told to expect. All of it was hardcoded, which meant that
 * changing the host's name after a hire, or closing Saturdays, needed a
 * developer.
 *
 * WHAT IS NOT HERE, and will not be:
 *
 *   The timezone and its UTC offset. IST is +5:30 with no daylight saving, so
 *   a fixed offset is exact — and that is precisely why it must not be edited.
 *   Point this at a timezone that observes DST and every slot the widget
 *   offers is an hour wrong for half the year, silently, in a way nobody
 *   notices until a client dials in to an empty room.
 *
 *   The Supabase credentials the form submits to. Those are infrastructure.
 */
import { defineType, defineField } from 'sanity';

const DAYS = [
  { title: 'Sunday', value: 0 },
  { title: 'Monday', value: 1 },
  { title: 'Tuesday', value: 2 },
  { title: 'Wednesday', value: 3 },
  { title: 'Thursday', value: 4 },
  { title: 'Friday', value: 5 },
  { title: 'Saturday', value: 6 },
];

export default defineType({
  name: 'bookingSettings',
  title: 'Book a call',
  type: 'document',

  groups: [
    { name: 'host', title: 'Who', default: true },
    { name: 'when', title: 'When' },
    { name: 'copy', title: 'What to expect' },
  ],

  fields: [
    defineField({
      name: 'hostName',
      title: 'Host name',
      type: 'string',
      group: 'host',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'hostRole',
      title: 'Host role',
      type: 'string',
      group: 'host',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'hostPhoto',
      title: 'Host photo',
      type: 'image',
      group: 'host',
      options: { hotspot: true },
      description: 'Square works best. Without one the panel shows their initials.',
    }),

    defineField({
      name: 'callDurations',
      title: 'Call lengths',
      type: 'array',
      of: [{ type: 'number' }],
      group: 'when',
      description: 'Minutes. The MIDDLE one is preselected, so order them shortest to longest.',
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'dayStart',
      title: 'First slot',
      type: 'string',
      group: 'when',
      description: '24-hour, studio time — "09:00".',
      validation: (Rule) =>
        Rule.required().regex(/^\d{2}:\d{2}$/, { name: 'time' }).error('Use HH:MM, like 09:00.'),
    }),
    defineField({
      name: 'dayEnd',
      title: 'Last slot',
      type: 'string',
      group: 'when',
      validation: (Rule) =>
        Rule.required().regex(/^\d{2}:\d{2}$/, { name: 'time' }).error('Use HH:MM, like 18:00.'),
    }),
    defineField({
      name: 'stepMinutes',
      title: 'Slot spacing',
      type: 'number',
      group: 'when',
      description: 'Minutes between offered start times.',
      initialValue: 30,
      validation: (Rule) => Rule.required().min(5).max(120),
    }),
    defineField({
      name: 'closedDays',
      title: 'Closed on',
      type: 'array',
      of: [{ type: 'number' }],
      group: 'when',
      options: { list: DAYS },
      description: 'Days the studio takes no calls.',
    }),
    defineField({
      name: 'bookingWindowDays',
      title: 'Book up to',
      type: 'number',
      group: 'when',
      description: 'Days ahead somebody may book.',
      initialValue: 60,
      validation: (Rule) => Rule.required().min(1).max(365),
    }),

    defineField({
      name: 'whatToExpect',
      title: 'What to expect',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'copy',
      description:
        'The numbered list beside the calendar. A real sequence — what actually happens on the call, in order.',
    }),
    defineField({
      name: 'enquiryTypes',
      title: 'Enquiry types',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'copy',
      options: { layout: 'tags' },
      description:
        'The dropdown on the form, and the tag row on the contact page. Keep these in step with the services — somebody picking one that has no page behind it is a dead end.',
    }),
  ],

  preview: {
    select: { name: 'hostName', media: 'hostPhoto' },
    prepare: ({ name, media }) => ({ title: 'Book a call', subtitle: name, media }),
  },
});
