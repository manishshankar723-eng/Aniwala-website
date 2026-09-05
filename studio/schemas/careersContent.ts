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
import { seoFields } from './seoFields';

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
    { name: 'apply', title: 'Application form' },
    { name: 'applyMsg', title: 'Form messages' },
    { name: 'closing', title: 'FAQ & closing' },
    { name: 'seo', title: 'Search' },
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

    /* ================================================================= */
    /* The application form                                              */
    /*                                                                   */
    /* One form, two jobs: applying to a listing, and applying when       */
    /* nothing listed fits. It renders on this page AND at the foot of   */
    /* every role page, so its wording lives here rather than in either  */
    /* — two copies is how the listing page and the role page end up     */
    /* promising an applicant two different reply times.                 */
    /*                                                                   */
    /* Tokens the form fills in: {{role}} is whichever job is being      */
    /* applied for, {{count}} the number of open listings, {{note}} the  */
    /* chosen role's own "what to send" line, {{name}} the applicant,    */
    /* and {{careersEmail}} the hiring inbox from Contact details.       */
    /* ================================================================= */

    defineField({
      name: 'applyEyebrow',
      title: 'Eyebrow',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyTitleRole',
      title: 'Title — on a role page',
      type: 'string',
      group: 'apply',
      description: '{{role}} is the job title.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyTitleOpen',
      title: 'Title — on the careers page',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyLeadRole',
      title: 'Lead — on a role page',
      type: 'text',
      rows: 3,
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyLeadOpen',
      title: 'Lead — on the careers page',
      type: 'text',
      rows: 3,
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),

    /**
     * The left rail: what happens after somebody presses send.
     *
     * Kept as a list rather than a paragraph because it is the part an
     * applicant scans, and because each row is a promise the studio has to
     * keep. Anything here that stops being true should come out of the list,
     * not get softened inside it.
     */
    defineField({
      name: 'applyPromises',
      title: 'What happens next',
      type: 'array',
      group: 'apply',
      description:
        'The list beside the form. Each row is a promise an applicant will hold you to — take one out rather than softening it.',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'promise',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              description: 'The short left-hand word — "Reply", "Kept".',
              validation: (R) => R.required(),
            }),
            defineField({
              name: 'body',
              title: 'Body',
              type: 'string',
              validation: (R) => R.required(),
            }),
            defineField({
              name: 'linkLabel',
              title: 'Link text (optional)',
              type: 'string',
              description: 'Appended to the body as a link. Leave blank for a plain row.',
            }),
            defineField({
              name: 'linkHref',
              title: 'Link target',
              type: 'string',
              description: 'A path such as /privacy/#applications. Required if there is link text.',
              validation: (R) =>
                R.custom((href, ctx) => {
                  const label = (ctx.parent as { linkLabel?: string } | undefined)?.linkLabel;
                  if (label && !href) return 'Link text needs somewhere to point.';
                  if (href && !/^(\/|https?:\/\/|mailto:)/.test(href))
                    return 'Use a path starting with / , a full http(s) URL, or a mailto: address.';
                  return true;
                }),
            }),
          ],
          preview: { select: { title: 'label', subtitle: 'body' } },
        }),
      ],
    }),

    defineField({
      name: 'applyAltNote',
      title: 'Rather send a file?',
      type: 'text',
      rows: 2,
      group: 'apply',
      description:
        'The note under the list. {{careersEmail}} becomes a mailto link. The form takes no uploads by design — see the privacy policy for why.',
      validation: (Rule) => Rule.required(),
    }),

    /* ---------------------------------------------------------------- */
    /* The mode switch — shown only where the role is not already known  */
    /* ---------------------------------------------------------------- */

    defineField({
      name: 'applyModeRoleTitle',
      title: 'Mode — apply for a listing',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyModeRoleCountOne',
      title: 'Mode — count, one listing',
      type: 'string',
      group: 'apply',
      description: 'The small line under it when exactly one role is open.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyModeRoleCountMany',
      title: 'Mode — count, several listings',
      type: 'string',
      group: 'apply',
      description: '{{count}} is how many are open.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyModeOpenTitle',
      title: 'Mode — nothing fits',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyModeOpenSub',
      title: 'Mode — nothing fits, sub-line',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),

    /* ---------------------------------------------------------------- */
    /* Field labels                                                      */
    /* ---------------------------------------------------------------- */

    defineField({
      name: 'applyRoleLabel',
      title: 'Label — which role',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyRolePlaceholder',
      title: 'Placeholder — which role',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyRoleHint',
      title: 'Hint — chosen role',
      type: 'string',
      group: 'apply',
      description:
        'Shown the moment a role is picked. {{note}} is that role’s own "what to send" line — the most useful sentence on any listing, which is why it is surfaced here rather than left on the full page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyAreaLabel',
      title: 'Label — which area',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyAreaPlaceholder',
      title: 'Placeholder — which area',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyDesiredLabel',
      title: 'Label — the role you want',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyDesiredPlaceholder',
      title: 'Placeholder — the role you want',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyOpenNote',
      title: 'Note — open applications',
      type: 'text',
      rows: 3,
      group: 'apply',
      description: 'Under the two open-application fields.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyLockedLabel',
      title: 'Label — applying for',
      type: 'string',
      group: 'apply',
      description:
        'On a role page the job is stated as a fact rather than asked as a question. This is the word above it.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'applyNameLabel',
      title: 'Label — name',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyNamePlaceholder',
      title: 'Placeholder — name',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyEmailLabel',
      title: 'Label — email',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyEmailPlaceholder',
      title: 'Placeholder — email',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyPhoneLabel',
      title: 'Label — phone',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyPhonePlaceholder',
      title: 'Placeholder — phone',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyLocationLabel',
      title: 'Label — where you are',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyLocationPlaceholder',
      title: 'Placeholder — where you are',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyExperienceLabel',
      title: 'Label — experience',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyAvailabilityLabel',
      title: 'Label — available from',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyChoosePlaceholder',
      title: 'Placeholder — empty dropdown',
      type: 'string',
      group: 'apply',
      description: 'The blank first option on the experience and availability menus.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyPortfolioLabel',
      title: 'Label — portfolio link',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyPortfolioPlaceholder',
      title: 'Placeholder — portfolio link',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyPortfolioHint',
      title: 'Hint — portfolio link',
      type: 'text',
      rows: 2,
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyCvLabel',
      title: 'Label — CV link',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyCvPlaceholder',
      title: 'Placeholder — CV link',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyMessageLabelRole',
      title: 'Label — message, applying to a listing',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyMessageLabelOpen',
      title: 'Label — message, open application',
      type: 'string',
      group: 'apply',
      description:
        'The field is asking for a different thing in each mode, so it says a different thing. Swapped live when the mode changes.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyMessagePlaceholder',
      title: 'Placeholder — message',
      type: 'text',
      rows: 3,
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyMessageHint',
      title: 'Hint — message',
      type: 'text',
      rows: 2,
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'applySubmitRole',
      title: 'Submit — on a role page',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applySubmitOpen',
      title: 'Submit — on the careers page',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applySubmitBusy',
      title: 'Submit — while sending',
      type: 'string',
      group: 'apply',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyConsent',
      title: 'Consent line',
      type: 'text',
      rows: 2,
      group: 'apply',
      description:
        'Beside the send button. Keep it true to what the privacy policy says, because it is the same promise said twice.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyA11yModes',
      title: 'Label — the mode switch',
      type: 'string',
      group: 'apply',
      description:
        'Names the pair of buttons for a screen reader. Blank is not "no label" — it is a group announced as nothing.',
      validation: (Rule) => Rule.required(),
    }),

    /* ================================================================= */
    /* Form messages                                                     */
    /*                                                                   */
    /* Validation is deliberately one message at a time, naming the      */
    /* field it is about — a list of six red lines reads as a broken     */
    /* form. Write each as an instruction, not as a complaint.           */
    /* ================================================================= */

    defineField({
      name: 'applyErrRole',
      title: 'Error — no role chosen',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrArea',
      title: 'Error — no area chosen',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrDesired',
      title: 'Error — no desired role',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrName',
      title: 'Error — no name',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrEmail',
      title: 'Error — bad email',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrLocation',
      title: 'Error — no location',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrExperience',
      title: 'Error — no experience band',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrPortfolio',
      title: 'Error — no portfolio link',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrPortfolioUrl',
      title: 'Error — portfolio link unreadable',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrCvUrl',
      title: 'Error — CV link unreadable',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrMessage',
      title: 'Error — message too short',
      type: 'string',
      group: 'applyMsg',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrGeneric',
      title: 'Error — rejected submission',
      type: 'string',
      group: 'applyMsg',
      description:
        'Shown when the hidden bot field was filled in. A real applicant never sees it, so it says nothing about why.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrTooFast',
      title: 'Error — submitted too fast',
      type: 'string',
      group: 'applyMsg',
      description: 'Anything sent within three seconds of the page painting was not typed.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrNotConfigured',
      title: 'Error — applications not connected',
      type: 'text',
      rows: 2,
      group: 'applyMsg',
      description: '{{careersEmail}} is the hiring inbox.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrSendFailed',
      title: 'Error — send failed',
      type: 'text',
      rows: 2,
      group: 'applyMsg',
      description: '{{error}} is the reason the server gave. {{careersEmail}} is the hiring inbox.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyErrUnreachable',
      title: 'Error — server unreachable',
      type: 'text',
      rows: 2,
      group: 'applyMsg',
      description: '{{careersEmail}} is the hiring inbox.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'applyDoneTitle',
      title: 'Sent — title',
      type: 'string',
      group: 'applyMsg',
      description: '{{name}} is the applicant’s first name.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyDoneWhatRole',
      title: 'Sent — what was sent, a listing',
      type: 'string',
      group: 'applyMsg',
      description: 'Substituted into the body as {{what}}. {{role}} is the job title.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyDoneWhatOpen',
      title: 'Sent — what was sent, open application',
      type: 'string',
      group: 'applyMsg',
      description: 'Substituted into the body as {{what}}. {{role}} is the job they asked for.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyDoneBody',
      title: 'Sent — body',
      type: 'text',
      rows: 3,
      group: 'applyMsg',
      description: '{{what}} is one of the two lines above.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'applyDoneNote',
      title: 'Sent — note',
      type: 'text',
      rows: 2,
      group: 'applyMsg',
      description: '{{careersEmail}} becomes a mailto link.',
      validation: (Rule) => Rule.required(),
    }),

    ...seoFields,

    /* ================================================================= */
    /* The FAQ and the closing panel                                     */
    /*                                                                   */
    /* The last two sections on the page, and the last two that were     */
    /* typed into the template. The closing panel is the one place the   */
    /* careers page deliberately talks to somebody who is NOT job        */
    /* hunting — so its two actions point away from hiring, and both     */
    /* are set here rather than defaulting to the site-wide ones.        */
    /* ================================================================= */

    defineField({
      name: 'faqEyebrow',
      title: 'FAQ eyebrow',
      type: 'string',
      group: 'closing',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'faqTitle',
      title: 'FAQ title',
      type: 'string',
      group: 'closing',
      description: 'The questions themselves are FAQ documents scoped to "careers".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'ctaEyebrow',
      title: 'Closing panel — eyebrow',
      type: 'string',
      group: 'closing',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'ctaTitle',
      title: 'Closing panel — title',
      type: 'string',
      group: 'closing',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'ctaBody',
      title: 'Closing panel — body',
      type: 'text',
      rows: 3,
      group: 'closing',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'ctaPrimaryLabel',
      title: 'Closing panel — first action',
      type: 'string',
      group: 'closing',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'ctaPrimaryHref',
      title: 'Closing panel — first action target',
      type: 'string',
      group: 'closing',
      validation: (Rule) =>
        Rule.required().custom((v: string) =>
          /^(\/|https?:\/\/|mailto:)/.test(v)
            ? true
            : 'Use a path starting with / , a full URL, or a mailto: address.'
        ),
    }),
    defineField({
      name: 'ctaSecondaryLabel',
      title: 'Closing panel — second action',
      type: 'string',
      group: 'closing',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'ctaSecondaryHref',
      title: 'Closing panel — second action target',
      type: 'string',
      group: 'closing',
      validation: (Rule) =>
        Rule.required().custom((v: string) =>
          /^(\/|https?:\/\/|mailto:)/.test(v)
            ? true
            : 'Use a path starting with / , a full URL, or a mailto: address.'
        ),
    }),
  ],

  preview: { prepare: () => ({ title: 'Careers page' }) },
});
