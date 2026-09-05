/**
 * One redirect. Old URL in, new URL out.
 *
 * WHY THIS HAS TO EXIST
 *
 * On this site a slug IS a URL: rename a case study in the Studio and its page
 * moves from `/case-studies/old/` to `/case-studies/new/`. Every link anybody
 * ever shared, every search result, every bookmark then lands on the 404 — and
 * until now there was nothing an editor could do about it, because redirects
 * lived in an `.htaccess` file they cannot see, on a host where a syntax error
 * in that file takes the whole site down with a 500.
 *
 * So redirects are documents, and the build writes them into `.htaccess`
 * inside a fenced block it owns. The hand-written rules above that fence —
 * HTTPS, www, the 404 handler — are never touched.
 *
 * WHAT THE BUILD CHECKS, because none of it can be checked here:
 *
 *   - that `from` does not point at a page that actually exists, which would
 *     make a real page unreachable;
 *   - that no two redirects claim the same `from`;
 *   - that a redirect does not point at another redirect's `from`, which is a
 *     chain at best and a loop at worst.
 *
 * Each of those fails the build with the offending pair named. That is the
 * trade for letting a non-developer edit Apache config: they get a plain form,
 * and anything that would break the server stops the deploy instead.
 */
import { defineType, defineField } from 'sanity';

/** A site path — leading slash, no origin, no query string. */
const PATH = /^\/[^\s?#]*$/;

export default defineType({
  name: 'redirect',
  title: 'Redirect',
  type: 'document',

  fields: [
    defineField({
      name: 'from',
      title: 'Old path',
      type: 'string',
      description:
        'The path that no longer works, exactly as it appears after the domain — "/case-studies/old-name/". Not a full URL, and no query string.',
      validation: (Rule) =>
        Rule.required().custom((v: string | undefined) =>
          !v || PATH.test(v)
            ? true
            : 'Start with / and give the path only — no https://, no ?query.'
        ),
    }),
    defineField({
      name: 'to',
      title: 'Send them to',
      type: 'string',
      description:
        'Where it should go instead. A path on this site, or a full https:// URL if the content moved off it.',
      validation: (Rule) =>
        Rule.required().custom((v: string | undefined, ctx) => {
          /* An empty field is `required()`'s complaint, not this one's. */
          if (!v) return true;
          if (!PATH.test(v) && !/^https?:\/\//.test(v))
            return 'Use a path starting with / or a full http(s) URL.';
          const from = (ctx.document as { from?: string } | undefined)?.from;
          if (from && from === v) return 'This points at itself, which is a redirect loop.';
          return true;
        }),
    }),

    /**
     * Permanent by default, and the default is the one that matters.
     *
     * A 301 tells search engines the move is final and passes the old URL's
     * ranking to the new one — which is the entire point of doing this rather
     * than letting the link 404. A 302 says "back shortly" and passes nothing.
     * Almost every redirect somebody adds here is a rename, and a rename is
     * permanent.
     */
    defineField({
      name: 'permanent',
      title: 'Permanent',
      type: 'boolean',
      description:
        'Leave this on. A permanent redirect (301) hands the old address’s search ranking to the new one. Turn it off only for something genuinely temporary — a page away for a week — because browsers cache a permanent redirect and will not re-check for a long time.',
      initialValue: true,
    }),

    defineField({
      name: 'note',
      title: 'Why',
      type: 'string',
      description:
        'For whoever reads this list in a year. "Renamed when the client approved the case study" is worth thirty seconds now.',
    }),
  ],

  orderings: [{ name: 'from', title: 'Old path', by: [{ field: 'from', direction: 'asc' }] }],

  preview: {
    select: { title: 'from', to: 'to', permanent: 'permanent', note: 'note' },
    prepare: ({ title, to, permanent, note }) => ({
      title: `${title}  →  ${to}`,
      subtitle: [permanent === false ? 'Temporary (302)' : 'Permanent (301)', note]
        .filter(Boolean)
        .join('  ·  '),
    }),
  },
});
