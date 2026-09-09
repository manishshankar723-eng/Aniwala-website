/**
 * Form submissions — the copy of everything the website receives.
 *
 * Four queues in one type: a booked call, a written brief, a job application
 * and a blog comment. They share most of their fields (somebody's name, their
 * address, what they wrote) and differ in a handful, so one type with those
 * few hidden per kind beats four near-identical ones — an editor looking for
 * "who wrote in this week" should find one list, not four.
 *
 * ------------------------------------------------------------------------
 * NOTHING HERE IS EDITABLE, AND THAT IS THE POINT.
 *
 * These documents are written by the `notify` Edge Function from the Supabase
 * rows, which remain the source of truth — that is where the row policies, the
 * column grants and the rate limiter live, and it is what the site and the
 * booking flow actually read. This is a reading room.
 *
 * So `readOnly` is on the whole type, and the reason is not tidiness. An
 * editable copy of a record you cannot act on is a trap: somebody would
 * eventually tick `approved` on a mirrored comment, watch nothing appear on
 * the blog, and reasonably conclude the site was broken. Approving happens
 * from the buttons in the notification email, or in the Supabase dashboard.
 * Anything typed here would be overwritten by the next mirror anyway.
 *
 * The type is also kept out of the "create new document" menu, in
 * sanity.config.ts. A hand-written submission is a fake lead.
 *
 * ------------------------------------------------------------------------
 * THIS IS PERSONAL DATA, and there is now a second copy of it.
 *
 * Applications carry names, phone numbers and CV links; enquiries carry client
 * leads. Sanity has no per-document permissions on the standard plans, so
 * everybody invited to this project can read all of it — worth remembering on
 * the day somebody is invited just to write a blog post. A deletion request
 * has to be honoured in Supabase AND here.
 */
import { defineType, defineField } from 'sanity';

const KINDS = [
  { title: 'Call request', value: 'booking' },
  { title: 'Brief', value: 'brief' },
  { title: 'Application', value: 'application' },
  { title: 'Comment', value: 'comment' },
];

/** Shown as the second line of every row in the list. */
const KIND_LABEL: Record<string, string> = {
  booking: 'Call request',
  brief: 'Brief',
  application: 'Application',
  comment: 'Comment',
};

/* `document.kind` is what decides which fields are relevant. Typed loosely
   because the callback receives a whole document, most of which is not ours
   to describe. */
const onlyFor =
  (...kinds: string[]) =>
  ({ document }: { document?: Record<string, unknown> | null }) =>
    !kinds.includes(String(document?.kind ?? ''));

export default defineType({
  name: 'submission',
  title: 'Form submission',
  type: 'document',

  /* The whole document, not field by field — see the header. */
  readOnly: true,

  groups: [
    { name: 'who', title: 'Who', default: true },
    { name: 'what', title: 'What they sent' },
    { name: 'call', title: 'The call' },
    { name: 'job', title: 'The role' },
    { name: 'trace', title: 'Where it came from' },
  ],

  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      group: 'who',
      options: { list: KINDS },
    }),
    defineField({
      name: 'receivedAt',
      title: 'Received',
      type: 'datetime',
      group: 'who',
    }),
    /*
     * Where it has got to, as of the last time the row changed.
     *
     * Free text rather than a list: it carries three different vocabularies —
     * new/confirmed/declined for a call, pending/published for a comment,
     * new/handled for an application — and a constrained list would have to
     * be widened every time one of those gained a state. It is a mirror of a
     * column, not a control.
     */
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'who',
    }),
    defineField({
      name: 'handled',
      title: 'Dealt with',
      type: 'boolean',
      group: 'who',
      description: 'Ticked in the Supabase dashboard, not here.',
      hidden: onlyFor('booking', 'brief', 'application'),
    }),
    defineField({
      name: 'approved',
      title: 'Published on the blog',
      type: 'boolean',
      group: 'who',
      description:
        'Set by the Approve button in the notification email. Changing it here would do nothing — the blog reads comments from Supabase.',
      hidden: onlyFor('comment'),
    }),

    defineField({ name: 'name', title: 'Name', type: 'string', group: 'who' }),
    defineField({ name: 'email', title: 'Email', type: 'string', group: 'who' }),
    defineField({
      name: 'phone',
      title: 'Phone',
      type: 'string',
      group: 'who',
      hidden: onlyFor('booking', 'brief', 'application'),
    }),
    defineField({
      name: 'company',
      title: 'Company',
      type: 'string',
      group: 'who',
      hidden: onlyFor('booking', 'brief'),
    }),

    /*
     * One heading for four different questions: which service a client is
     * asking about, which job an applicant wants, which post a comment is on.
     * Kept as one field so the list view has something to show on every row.
     */
    defineField({ name: 'topic', title: 'About', type: 'string', group: 'what' }),
    defineField({
      name: 'message',
      title: 'What they wrote',
      type: 'text',
      rows: 6,
      group: 'what',
    }),
    defineField({
      name: 'postSlug',
      title: 'On post',
      type: 'string',
      group: 'what',
      hidden: onlyFor('comment'),
    }),

    /* ---------------- The call ---------------- */

    defineField({
      name: 'slotLabel',
      title: 'Slot, in their words',
      type: 'string',
      group: 'call',
      description: 'Exactly as the visitor saw it, in their own timezone.',
      hidden: onlyFor('booking'),
    }),
    defineField({
      name: 'slotUtc',
      title: 'Slot',
      type: 'datetime',
      group: 'call',
      description: 'The real instant. Shown here in your own timezone.',
      hidden: onlyFor('booking'),
    }),
    defineField({
      name: 'durationMins',
      title: 'Duration (minutes)',
      type: 'number',
      group: 'call',
      hidden: onlyFor('booking'),
    }),
    defineField({
      name: 'visitorTz',
      title: 'Their timezone',
      type: 'string',
      group: 'call',
      hidden: onlyFor('booking'),
    }),
    defineField({
      name: 'guests',
      title: 'Guests',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'call',
      description: 'Everyone invited alongside them.',
      hidden: onlyFor('booking'),
    }),
    defineField({
      name: 'meetingUrl',
      title: 'Joining link',
      type: 'url',
      group: 'call',
      hidden: onlyFor('booking'),
    }),
    defineField({
      name: 'confirmedAt',
      title: 'Confirmed',
      type: 'datetime',
      group: 'call',
      hidden: onlyFor('booking'),
    }),

    /* ---------------- The role ---------------- */

    defineField({
      name: 'applicationKind',
      title: 'Applied for',
      type: 'string',
      group: 'job',
      options: {
        list: [
          { title: 'A listed role', value: 'role' },
          { title: 'Anything going (open application)', value: 'open' },
        ],
      },
      hidden: onlyFor('application'),
    }),
    defineField({
      name: 'roleSlug',
      title: 'Role',
      type: 'string',
      group: 'job',
      hidden: onlyFor('application'),
    }),
    defineField({
      name: 'discipline',
      title: 'Area',
      type: 'string',
      group: 'job',
      hidden: onlyFor('application'),
    }),
    defineField({
      name: 'location',
      title: 'Based in',
      type: 'string',
      group: 'job',
      hidden: onlyFor('application'),
    }),
    defineField({
      name: 'experience',
      title: 'Experience',
      type: 'string',
      group: 'job',
      hidden: onlyFor('application'),
    }),
    defineField({
      name: 'availability',
      title: 'Available',
      type: 'string',
      group: 'job',
      hidden: onlyFor('application'),
    }),
    defineField({
      name: 'portfolioUrl',
      title: 'Portfolio / reel',
      type: 'url',
      group: 'job',
      hidden: onlyFor('application'),
    }),
    defineField({
      name: 'cvUrl',
      title: 'CV',
      type: 'url',
      group: 'job',
      hidden: onlyFor('application'),
    }),

    /* ---------------- Provenance ---------------- */

    defineField({
      name: 'sourcePath',
      title: 'Sent from',
      type: 'string',
      group: 'trace',
      description: 'The page they were on.',
    }),
    /*
     * The row this is a copy of.
     *
     * Here so that "the Studio says one thing and the database says another"
     * is a question somebody can actually answer, rather than a hunt through a
     * table by name and date.
     */
    defineField({
      name: 'supabaseId',
      title: 'Database row',
      type: 'string',
      group: 'trace',
      description: 'The id of the row in Supabase. This document is a copy of it.',
    }),
  ],

  orderings: [
    {
      title: 'Newest first',
      name: 'newest',
      by: [{ field: 'receivedAt', direction: 'desc' }],
    },
  ],

  preview: {
    select: { name: 'name', kind: 'kind', topic: 'topic', at: 'receivedAt', status: 'status' },
    prepare: ({ name, kind, topic, at, status }) => {
      /* Date only. A list of thirty rows does not need thirty timestamps, and
         the exact minute is on the document itself. */
      const when = at
        ? new Date(at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '';
      return {
        title: name || '(no name)',
        subtitle: [KIND_LABEL[kind] ?? kind, topic, when, status && `· ${status}`]
          .filter(Boolean)
          .join(' · '),
      };
    },
  },
});
