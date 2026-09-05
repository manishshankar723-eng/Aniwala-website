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
    { name: 'wording', title: 'Wording' },
    { name: 'messages', title: 'Messages' },
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

    /* ---------------------------------------------------------------- */
    /* Wording                                                           */
    /*                                                                   */
    /* Every visible word in the widget, including the ones the client   */
    /* script writes after the page has loaded. Those are handed to the  */
    /* browser with the rest of the config — see BookCall.astro.         */
    /* ---------------------------------------------------------------- */

    defineField({
      name: 'sectionEyebrow',
      title: 'Section eyebrow',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sectionTitle',
      title: 'Section title',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'panelTitle',
      title: 'Panel title',
      type: 'string',
      group: 'wording',
      description: 'The heading inside the host panel, under their name.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'meetingKind',
      title: 'Meeting kind',
      type: 'string',
      group: 'wording',
      description: 'The line beside the pin icon — "Online meeting".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'durationUnit',
      title: 'Duration unit',
      type: 'string',
      group: 'wording',
      description: 'Printed after each call length: 30 "min".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'expectTitle',
      title: 'What-to-expect heading',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),

    /**
     * The weekday strip above the calendar.
     *
     * Typed rather than generated from the browser's locale, and that is
     * deliberate: the grid is laid out Sunday-first in CSS, so a locale that
     * starts its week on Monday would label every column one day out.
     */
    defineField({
      name: 'weekdayLabels',
      title: 'Weekday labels',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'wording',
      description:
        'Exactly seven, STARTING WITH SUNDAY — the grid is laid out Sunday-first, so a Monday-first list labels every column one day out.',
      validation: (Rule) => Rule.required().length(7),
    }),
    defineField({
      name: 'timezoneLabel',
      title: 'Timezone label',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slotNextLabel',
      title: 'Slot confirm button',
      type: 'string',
      group: 'wording',
      description: 'The button beside a chosen time that moves on to the details step.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'noSlots',
      title: 'No times left',
      type: 'string',
      group: 'wording',
      description: 'Shown when every slot on the chosen day has gone.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'detailsTitle',
      title: 'Details step title',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'nameLabel',
      title: 'Name label',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'namePlaceholder',
      title: 'Name placeholder',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'emailLabel',
      title: 'Email label',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'emailPlaceholder',
      title: 'Email placeholder',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'enquiryLabel',
      title: 'Enquiry-type label',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'messageLabel',
      title: 'Message label',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'messagePlaceholder',
      title: 'Message placeholder',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'submitLabel',
      title: 'Submit button',
      type: 'string',
      group: 'wording',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'submitBusy',
      title: 'Submit button, while sending',
      type: 'string',
      group: 'wording',
      description: 'Replaces the button label while the request is in flight.',
      validation: (Rule) => Rule.required(),
    }),

    /* ---------------------------------------------------------------- */
    /* Messages                                                          */
    /*                                                                   */
    /* {{name}}, {{when}} and {{error}} are filled in by the widget.     */
    /* {{email}} is the studio inbox from Contact details, so an error   */
    /* message can never point somebody at a stale address.              */
    /* ---------------------------------------------------------------- */

    /*
     * What the studio's own notification email says.
     *
     * Never seen by a visitor — these ride along with the submission so the
     * inbox can tell a booking apart from an enquiry at a glance. Editable
     * because "which forwarded email is this" is an inbox problem, and the
     * person with that problem is not a developer.
     */
    defineField({
      name: 'emailSubject',
      title: 'Notification subject',
      type: 'string',
      group: 'messages',
      description: 'The subject line on the copy forwarded to the studio inbox.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'emailFromName',
      title: 'Notification sender name',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'errName',
      title: 'Error — no name',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'errEmail',
      title: 'Error — bad email',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'errNotConfigured',
      title: 'Error — booking not connected',
      type: 'string',
      group: 'messages',
      description:
        'Shown when the site has no database credentials. A visitor should never see this; if they do, the form is saving nothing.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'errSendFailed',
      title: 'Error — send failed',
      type: 'text',
      rows: 2,
      group: 'messages',
      description: '{{error}} is the reason the server gave. {{email}} is the studio inbox.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'errUnreachable',
      title: 'Error — server unreachable',
      type: 'text',
      rows: 2,
      group: 'messages',
      description: '{{email}} is the studio inbox.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'doneTitle',
      title: 'Confirmation title',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'doneBody',
      title: 'Confirmation body',
      type: 'text',
      rows: 3,
      group: 'messages',
      description:
        '{{name}} is who booked it. {{when}} is the slot they picked, already formatted.',
      validation: (Rule) => Rule.required(),
    }),

    /* ---------------------------------------------------------------- */
    /* Screen-reader labels                                              */
    /*                                                                   */
    /* Every control in this widget is an icon or a bare date cell, so   */
    /* these are the only names a screen reader has for them. Blank is   */
    /* not "no label" — it is a button announced as "button".            */
    /* ---------------------------------------------------------------- */

    defineField({
      name: 'a11yDurations',
      title: 'Label — call lengths',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'a11yPrevMonth',
      title: 'Label — previous month',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'a11yNextMonth',
      title: 'Label — next month',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'a11yGrid',
      title: 'Label — date grid',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'a11yTimeFormat',
      title: 'Label — 12/24 hour switch',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'a11ySlots',
      title: 'Label — times list',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'a11yBack',
      title: 'Label — back to calendar',
      type: 'string',
      group: 'messages',
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: { name: 'hostName', media: 'hostPhoto' },
    prepare: ({ name, media }) => ({ title: 'Book a call', subtitle: name, media }),
  },
});
