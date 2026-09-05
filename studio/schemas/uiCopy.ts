/**
 * Interface copy. A SINGLETON.
 *
 * WHAT THIS IS
 *
 * Every word the site says that is not attached to a piece of content: the
 * headings a template prints above somebody else's writing, the labels on
 * cards, the empty states, the two blog rails, the 404, and the names screen
 * readers give to controls that are drawn as icons.
 *
 * WHY IT IS ONE DOCUMENT AND NOT TWELVE
 *
 * These strings share one property: each is written once and appears on many
 * pages. Splitting them by component would put "Read the case study" in three
 * places — the post card, the piece card and the case card all print it — and
 * three copies of one label is how a site ends up saying three slightly
 * different things about the same link. One document, grouped into tabs.
 *
 * WHAT IS NOT HERE
 *
 *   - Anything attached to a document that already exists. A service's own
 *     headings live on the service; the careers page's live on `careersContent`;
 *     the booking widget's live on `bookingSettings`. An editor changing the
 *     booking form should not have to know that half of it is filed elsewhere.
 *   - The menus. Those are `navigation`, because a menu is a set of links and
 *     not a set of words.
 *   - Anything that drives a URL. Category names, discipline slugs and the
 *     blog taxonomy stay in code, because changing one silently breaks every
 *     link anybody has ever shared.
 *
 * THE ONE EXEMPTION, and it is deliberate: the 404 group. Every other field
 * here is required, and a missing `uiCopy` document fails a production build
 * — see `missingSingleton` in `lib/studio.ts` for why that rule exists. The
 * 404 is the page somebody reaches when something has ALREADY gone wrong, so
 * it is the one page that must not be able to break in turn. Its fields fall
 * back to the text in `lib/studio.ts` when they are blank, exactly as the
 * loading screen does.
 *
 * ACCESSIBILITY LABELS. The last tab is not decoration. Those strings are the
 * only names a screen reader has for a row of icon buttons, and a blank one
 * is not "no label" — it is a control announced as "button". They are
 * required for that reason.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';

/** Every visible label in this document is required — see the note above. */
const req = (Rule: any) => Rule.required();

export default defineType({
  name: 'uiCopy',
  title: 'Interface copy',
  type: 'document',

  groups: [
    { name: 'chrome', title: 'Site-wide', default: true },
    { name: 'detail', title: 'Detail pages' },
    { name: 'listing', title: 'Listings' },
    { name: 'comments', title: 'Comments' },
    { name: 'error', title: '404' },
    { name: 'a11y', title: 'Screen readers' },
  ],

  fields: [
    /* ================================================================= */
    /* Site-wide                                                         */
    /* ================================================================= */

    defineField({
      name: 'siteName',
      title: 'Site name',
      type: 'string',
      group: 'chrome',
      description:
        'Appended to the browser-tab title of every templated page — "3D Art — {name}". Pages built in the page builder carry their own full title instead.',
      validation: req,
    }),
    defineField({
      name: 'defaultDescription',
      title: 'Default search description',
      type: 'text',
      rows: 2,
      group: 'chrome',
      description:
        'Used by any page that does not supply its own. Most do, so this is a floor rather than a default anybody should be relying on.',
      validation: req,
    }),

    /* --- Footer ------------------------------------------------------ */
    defineField({
      name: 'footerEyebrow',
      title: 'Footer eyebrow',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'footerNote',
      title: 'Footer note',
      type: 'text',
      rows: 2,
      group: 'chrome',
      description: 'The line under the studio inbox.',
      validation: req,
    }),
    defineField({
      name: 'footerAddressLabel',
      title: 'Footer — address label',
      type: 'string',
      group: 'chrome',
      description:
        'Above the postal address. The address itself is on Contact details; a real street address is one of the few cheap signals that there is a building and people in it.',
      validation: req,
    }),
    defineField({
      name: 'footerColStudio',
      title: 'Footer — first column heading',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'footerColServices',
      title: 'Footer — second column heading',
      type: 'string',
      group: 'chrome',
      description:
        'Headings the services column. It is also the link to the services index, so it should read as the name of that section.',
      validation: req,
    }),
    defineField({
      name: 'footerColFollow',
      title: 'Footer — socials heading',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'footerCopyright',
      title: 'Copyright line',
      type: 'string',
      group: 'chrome',
      description:
        '{{year}} is the current year, so this never goes stale. {{legalName}} is the trading name from Contact details.',
      validation: req,
    }),

    /**
     * The legal links in the footer base.
     *
     * A route has to exist for each of these. Nothing in Sanity can check
     * that, which is why `check-links.mjs` runs at the end of every build and
     * fails it over a path that does not resolve — adding a row here without
     * adding the page is caught there rather than on the live site.
     */
    defineField({
      name: 'legalLinks',
      title: 'Legal links',
      type: 'array',
      group: 'chrome',
      description:
        'The small print at the very bottom. Every path must be a page that exists — the build fails on one that does not, which is the behaviour you want.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'legalLink',
          fields: [
            defineField({ name: 'label', title: 'Label', type: 'string', validation: req }),
            defineField({
              name: 'href',
              title: 'Path',
              type: 'string',
              validation: (Rule) =>
                Rule.required().custom((v: string) =>
                  /^(\/|https?:\/\/)/.test(v) ? true : 'Use a path starting with / or a full URL.'
                ),
            }),
          ],
          preview: { select: { title: 'label', subtitle: 'href' } },
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),

    /* --- Search ------------------------------------------------------ */
    defineField({
      name: 'searchPlaceholder',
      title: 'Search placeholder',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'searchEmpty',
      title: 'Search — nothing found',
      type: 'string',
      group: 'chrome',
      description:
        'Worth naming two or three things the site definitely does have. A bare "no results" tells somebody nothing about what to try instead.',
      validation: req,
    }),

    /* --- Cards and filter bars --------------------------------------- */
    defineField({
      name: 'cardReadMore',
      title: 'Card link — blog post',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'cardCaseMore',
      title: 'Card link — case study',
      type: 'string',
      group: 'chrome',
      description: 'Printed on case-study cards and on portfolio tiles that have one behind them.',
      validation: req,
    }),
    defineField({
      name: 'barAllCategories',
      title: 'Filter bar — all posts',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'barAllWork',
      title: 'Filter bar — all work',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'barClearFilter',
      title: 'Filter bar — clear',
      type: 'string',
      group: 'chrome',
      description: 'The tooltip on the chip that is currently filtering.',
      validation: req,
    }),

    /* --- Defaults for the shared closing panels ---------------------- */
    defineField({
      name: 'ctaEyebrow',
      title: 'Closing panel — eyebrow',
      type: 'string',
      group: 'chrome',
      description:
        'The panel every inner page ends on. Pages that need their own wording override all of this; these are the defaults.',
      validation: req,
    }),
    defineField({
      name: 'ctaTitle',
      title: 'Closing panel — title',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'ctaBody',
      title: 'Closing panel — body',
      type: 'text',
      rows: 3,
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'ctaSecondaryLabel',
      title: 'Closing panel — second action',
      type: 'string',
      group: 'chrome',
      description: 'Points at the studio inbox from Contact details.',
      validation: req,
    }),
    defineField({
      name: 'faqEyebrow',
      title: 'FAQ — default eyebrow',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'faqTitle',
      title: 'FAQ — default title',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),

    /* --- Breadcrumbs -------------------------------------------------- */
    defineField({
      name: 'crumbHome',
      title: 'Breadcrumb — home',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'crumbBlog',
      title: 'Breadcrumb — blog',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'crumbPortfolio',
      title: 'Breadcrumb — portfolio',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'crumbCaseStudies',
      title: 'Breadcrumb — case studies',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'crumbServices',
      title: 'Breadcrumb — services',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'crumbCareers',
      title: 'Breadcrumb — careers',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),

    /* ================================================================= */
    /* Detail pages                                                      */
    /*                                                                   */
    /* The headings a template prints around content somebody else       */
    /* wrote. {{...}} tokens are filled in from the piece being shown.   */
    /* ================================================================= */

    /* --- Blog post ---------------------------------------------------- */
    defineField({
      name: 'postUpdatedPrefix',
      title: 'Post — updated prefix',
      type: 'string',
      group: 'detail',
      description: 'Followed by the date. "Updated 4 March 2026".',
      validation: req,
    }),
    defineField({
      name: 'postBackLabel',
      title: 'Post — back link',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'postRelatedEyebrow',
      title: 'Post — related eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'postRelatedTitle',
      title: 'Post — related title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'postRelatedLink',
      title: 'Post — related link',
      type: 'string',
      group: 'detail',
      validation: req,
    }),

    /* --- Case study ---------------------------------------------------- */
    defineField({
      name: 'caseEyebrow',
      title: 'Case study — eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseOwnNoteLead',
      title: 'Case study — self-directed, lead',
      type: 'string',
      group: 'detail',
      description:
        'Said once, at the top, before anything below it can be misread. A visitor must never mistake the studio’s own piece for commissioned work.',
      validation: req,
    }),
    defineField({
      name: 'caseOwnNoteBody',
      title: 'Case study — self-directed, body',
      type: 'text',
      rows: 3,
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseFactMadeBy',
      title: 'Case study — fact, made by',
      type: 'string',
      group: 'detail',
      description: 'Used on a self-directed piece, where "Client" would be a lie.',
      validation: req,
    }),
    defineField({
      name: 'caseFactClient',
      title: 'Case study — fact, client',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseFactType',
      title: 'Case study — fact, type',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseFactYear',
      title: 'Case study — fact, year',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseFactEngagement',
      title: 'Case study — fact, engagement',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseRailDisciplines',
      title: 'Case study — rail, disciplines',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseRailDelivered',
      title: 'Case study — rail, delivered',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseRailTools',
      title: 'Case study — rail, tools',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseRelatedEyebrow',
      title: 'Case study — related eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseRelatedTitle',
      title: 'Case study — related title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'caseRelatedLink',
      title: 'Case study — related link',
      type: 'string',
      group: 'detail',
      validation: req,
    }),

    /* --- Role page ----------------------------------------------------- */
    defineField({
      name: 'roleApplyAct',
      title: 'Role — apply button',
      type: 'string',
      group: 'detail',
      description: 'Used in the hero and again in the sticky rail.',
      validation: req,
    }),
    defineField({
      name: 'roleAskAct',
      title: 'Role — ask a question',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleAskSubject',
      title: 'Role — question email subject',
      type: 'string',
      group: 'detail',
      description: '{{role}} is the job title.',
      validation: req,
    }),
    defineField({
      name: 'roleWorkTitle',
      title: 'Role — heading, the work',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleDoingTitle',
      title: 'Role — heading, responsibilities',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleNeedTitle',
      title: 'Role — heading, requirements',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleNeedAside',
      title: 'Role — requirements aside',
      type: 'text',
      rows: 3,
      group: 'detail',
      description:
        'Said out loud, because the people who most often talk themselves out of applying are the ones worth reading.',
      validation: req,
    }),
    defineField({
      name: 'roleNiceTitle',
      title: 'Role — heading, nice to have',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleNiceNote',
      title: 'Role — nice to have note',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleSoftwareTitle',
      title: 'Role — heading, software',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleReelEyebrow',
      title: 'Role — what to send, eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleReelFoot',
      title: 'Role — what to send, footnote',
      type: 'text',
      rows: 2,
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleGlanceTitle',
      title: 'Role — facts rail title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleFactDiscipline',
      title: 'Role — fact, discipline',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleFactType',
      title: 'Role — fact, type',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleFactLocation',
      title: 'Role — fact, location',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleFactExperience',
      title: 'Role — fact, experience',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleFactOpenings',
      title: 'Role — fact, openings',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleFactPosted',
      title: 'Role — fact, posted',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleFactCloses',
      title: 'Role — fact, closing date',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleSeatOne',
      title: 'Role — one seat',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleSeatMany',
      title: 'Role — several seats',
      type: 'string',
      group: 'detail',
      description: '{{count}} is how many.',
      validation: req,
    }),
    defineField({
      name: 'roleRailNote',
      title: 'Role — rail note',
      type: 'text',
      rows: 2,
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleProcessTitle',
      title: 'Role — process rail title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleProcessLink',
      title: 'Role — process rail link',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleOthersEyebrow',
      title: 'Role — other roles eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleOthersTitle',
      title: 'Role — other roles title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'roleOthersLink',
      title: 'Role — other roles link',
      type: 'string',
      group: 'detail',
      validation: req,
    }),

    /* --- Service page --------------------------------------------------- */
    defineField({
      name: 'serviceEyebrow',
      title: 'Service — eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceHeroPrimary',
      title: 'Service — hero, first action',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceHeroSecondary',
      title: 'Service — hero, second action',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceOfferEyebrow',
      title: 'Service — offerings eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceOfferTitle',
      title: 'Service — offerings title',
      type: 'string',
      group: 'detail',
      description:
        '{{article}} is the service’s own "a" or "an" and {{name}} its short name, so this reads correctly for every discipline.',
      validation: req,
    }),
    defineField({
      name: 'serviceProcessEyebrow',
      title: 'Service — pipeline eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceProcessTitle',
      title: 'Service — pipeline title',
      type: 'string',
      group: 'detail',
      description: '{{article}} and {{name}} as above.',
      validation: req,
    }),
    defineField({
      name: 'serviceProcessLead',
      title: 'Service — pipeline lead',
      type: 'text',
      rows: 3,
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceToolsEyebrow',
      title: 'Service — software eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceToolsTitle',
      title: 'Service — software title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceToolsNote',
      title: 'Service — software note',
      type: 'text',
      rows: 2,
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceDeliverEyebrow',
      title: 'Service — hand-off eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceDeliverTitle',
      title: 'Service — hand-off title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceRelatedEyebrow',
      title: 'Service — related eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceRelatedTitle',
      title: 'Service — related title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceRelatedLink',
      title: 'Service — related link',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceFaqTitle',
      title: 'Service — FAQ title',
      type: 'string',
      group: 'detail',
      description: '{{label}} is the service’s menu label.',
      validation: req,
    }),
    defineField({
      name: 'serviceCtaEyebrow',
      title: 'Service — closing eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'serviceCtaTitle',
      title: 'Service — closing title',
      type: 'string',
      group: 'detail',
      description: '{{article}} and {{name}} as above.',
      validation: req,
    }),
    defineField({
      name: 'serviceCtaBody',
      title: 'Service — closing body',
      type: 'text',
      rows: 3,
      group: 'detail',
      validation: req,
    }),

    /* --- Portfolio discipline page --------------------------------------- */
    defineField({
      name: 'portfolioEyebrow',
      title: 'Discipline — eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'portfolioEmptyTitle',
      title: 'Discipline — nothing published, title',
      type: 'string',
      group: 'detail',
      description:
        '{{name}} is the discipline’s short name. Every discipline gets a page whether or not there is anything in it yet, because the homepage tiles link straight at these — so this state has to read as honest rather than broken.',
      validation: req,
    }),
    defineField({
      name: 'portfolioEmptyBodyOne',
      title: 'Discipline — nothing published, first paragraph',
      type: 'text',
      rows: 3,
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'portfolioEmptyBodyTwo',
      title: 'Discipline — nothing published, second paragraph',
      type: 'text',
      rows: 3,
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'portfolioEmptyCta',
      title: 'Discipline — nothing published, action',
      type: 'string',
      group: 'detail',
      description: '{{name}} is the discipline’s short name.',
      validation: req,
    }),
    defineField({
      name: 'portfolioOwnNote',
      title: 'Discipline — all self-directed note',
      type: 'text',
      rows: 3,
      group: 'detail',
      description: 'Shown only when every piece on the page is the studio’s own work.',
      validation: req,
    }),
    defineField({
      name: 'portfolioWorkHeading',
      title: 'Discipline — hidden gallery heading',
      type: 'string',
      group: 'detail',
      description:
        'Not visible. It gives the gallery a heading in the document outline, which is how a screen reader user skips to it. {{title}} is the discipline.',
      validation: req,
    }),
    defineField({
      name: 'portfolioServicesEyebrow',
      title: 'Discipline — services eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'portfolioServicesTitle',
      title: 'Discipline — services title',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'portfolioServicesLink',
      title: 'Discipline — services link',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'portfolioCtaEyebrow',
      title: 'Discipline — closing eyebrow',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'portfolioCtaTitle',
      title: 'Discipline — closing title',
      type: 'string',
      group: 'detail',
      description: '{{name}} is the discipline’s short name.',
      validation: req,
    }),
    defineField({
      name: 'portfolioCtaBody',
      title: 'Discipline — closing body',
      type: 'text',
      rows: 3,
      group: 'detail',
      validation: req,
    }),

    /* --- The page-builder blocks ----------------------------------------
       Text the blocks print around content they read from elsewhere. It
       lives here rather than on each block for the reason the whole
       document exists: the same words appear on several pages, and a copy
       per block is how they stop matching. */
    defineField({
      name: 'engagementBestFor',
      title: 'Engagement — "best for" label',
      type: 'string',
      group: 'detail',
      description: 'The small label above each model’s "best for" line.',
      validation: req,
    }),
    defineField({
      name: 'blockWorkHeading',
      title: 'Hidden heading — portfolio grid',
      type: 'string',
      group: 'detail',
      description:
        'Not visible. It gives the grid a heading in the document outline, which is how somebody using a screen reader skips to it.',
      validation: req,
    }),
    defineField({
      name: 'blockPostsHeading',
      title: 'Hidden heading — post list',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'blockCaseStudiesHeading',
      title: 'Hidden heading — case study list',
      type: 'string',
      group: 'detail',
      validation: req,
    }),
    defineField({
      name: 'heroScrollLabel',
      title: 'Homepage scroll hint',
      type: 'string',
      group: 'detail',
      description: 'Under the video hero, on the link down to the page.',
      validation: req,
    }),

    /* ================================================================= */
    /* Listings                                                          */
    /* ================================================================= */

    /* --- The blog rail ------------------------------------------------- */
    defineField({
      name: 'railSearchTitle',
      title: 'Blog rail — search heading',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railSearchPlaceholder',
      title: 'Blog rail — search placeholder',
      type: 'string',
      group: 'listing',
      description:
        'This box searches the posts only. The header search covers the whole site — on a blog page, people expect the box beside the posts to search the posts.',
      validation: req,
    }),
    defineField({
      name: 'railSearchEmpty',
      title: 'Blog rail — nothing found',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railTocTitle',
      title: 'Blog rail — contents heading',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railRecentTitle',
      title: 'Blog rail — recent heading',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railCategoriesTitle',
      title: 'Blog rail — categories heading',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railArchiveTitle',
      title: 'Blog rail — archive heading',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railTagsTitle',
      title: 'Blog rail — tags heading',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railPromoTitle',
      title: 'Blog rail — promo title',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railPromoText',
      title: 'Blog rail — promo body',
      type: 'text',
      rows: 2,
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railPromoCta',
      title: 'Blog rail — promo link',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'railPromoHref',
      title: 'Blog rail — promo target',
      type: 'string',
      group: 'listing',
      validation: (Rule) =>
        Rule.required().custom((v: string) =>
          /^(\/|https?:\/\/)/.test(v) ? true : 'Use a path starting with / or a full URL.'
        ),
    }),

    /* --- Filtered blog views --------------------------------------------- */
    defineField({
      name: 'blogEyebrow',
      title: 'Blog — category page eyebrow',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'tagEyebrow',
      title: 'Blog — tag page eyebrow',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'archiveEyebrow',
      title: 'Blog — archive page eyebrow',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'postCountOne',
      title: 'Blog — one post',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'postCountMany',
      title: 'Blog — several posts',
      type: 'string',
      group: 'listing',
      description: '{{count}} is how many.',
      validation: req,
    }),
    defineField({
      name: 'categoryHeading',
      title: 'Blog — hidden heading, category',
      type: 'string',
      group: 'listing',
      description:
        'Not visible. Gives the grid a heading in the document outline. {{name}} is the category.',
      validation: req,
    }),
    defineField({
      name: 'tagLead',
      title: 'Blog — tag page lead',
      type: 'string',
      group: 'listing',
      description: '{{name}} is the tag.',
      validation: req,
    }),
    defineField({
      name: 'tagDescription',
      title: 'Blog — tag page search description',
      type: 'string',
      group: 'listing',
      description: '{{name}} is the tag.',
      validation: req,
    }),
    defineField({
      name: 'tagHeading',
      title: 'Blog — hidden heading, tag',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'archiveLead',
      title: 'Blog — archive page lead',
      type: 'string',
      group: 'listing',
      description: '{{name}} is the month.',
      validation: req,
    }),
    defineField({
      name: 'archiveDescription',
      title: 'Blog — archive page search description',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'archiveHeading',
      title: 'Blog — hidden heading, archive',
      type: 'string',
      group: 'listing',
      validation: req,
    }),

    /* --- The careers listing --------------------------------------------- */
    defineField({
      name: 'careersSeatOne',
      title: 'Careers — one seat open',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'careersSeatMany',
      title: 'Careers — several seats open',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'careersFilterAll',
      title: 'Careers — all filter chip',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'careersNewBadge',
      title: 'Careers — new badge',
      type: 'string',
      group: 'listing',
      description: 'On listings posted in the last 21 days.',
      validation: req,
    }),
    defineField({
      name: 'careersOpeningOne',
      title: 'Careers — one opening',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'careersOpeningMany',
      title: 'Careers — several openings',
      type: 'string',
      group: 'listing',
      description: '{{count}} is how many.',
      validation: req,
    }),
    defineField({
      name: 'careersPosted',
      title: 'Careers — posted line',
      type: 'string',
      group: 'listing',
      description: '{{date}} is the posting date.',
      validation: req,
    }),
    defineField({
      name: 'careersCloses',
      title: 'Careers — closes line',
      type: 'string',
      group: 'listing',
      description: '{{date}} is the closing date. Appended to the posted line.',
      validation: req,
    }),
    defineField({
      name: 'careersReadRole',
      title: 'Careers — read the role',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'careersApply',
      title: 'Careers — apply button',
      type: 'string',
      group: 'listing',
      validation: req,
    }),
    defineField({
      name: 'careersStudioLink',
      title: 'Careers — about the studio link',
      type: 'string',
      group: 'listing',
      validation: req,
    }),

    /* --- The /admin redirect ---------------------------------------------
       A one-second staging post between aniwala.com/admin and the Studio.
       Nobody reads it on purpose, but somebody reads it every time the
       Studio is slow to answer. */
    defineField({
      name: 'adminTitle',
      title: 'Admin redirect — browser-tab title',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'adminLead',
      title: 'Admin redirect — message',
      type: 'string',
      group: 'chrome',
      validation: req,
    }),
    defineField({
      name: 'adminLinkLabel',
      title: 'Admin redirect — manual link',
      type: 'string',
      group: 'chrome',
      description: 'The link offered in case the redirect does not fire.',
      validation: req,
    }),

    /* ================================================================= */
    /* Comments                                                          */
    /* ================================================================= */

    defineField({
      name: 'commentsTitle',
      title: 'Comments — heading',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsLoading',
      title: 'Comments — loading',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsEmpty',
      title: 'Comments — none yet',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsLoadError',
      title: 'Comments — could not load',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsFormTitle',
      title: 'Comments — form heading',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsFormNote',
      title: 'Comments — form note',
      type: 'string',
      group: 'comments',
      description:
        'Keep the promise about the email address true: the database is configured so the site itself cannot read that column back.',
      validation: req,
    }),
    defineField({
      name: 'commentsNameLabel',
      title: 'Comments — name label',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsEmailLabel',
      title: 'Comments — email label',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsBodyLabel',
      title: 'Comments — comment label',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsRemember',
      title: 'Comments — remember me',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsSubmit',
      title: 'Comments — submit button',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsSubmitBusy',
      title: 'Comments — submit, while posting',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsNote',
      title: 'Comments — moderation note',
      type: 'string',
      group: 'comments',
      description: 'Nothing appears until a person approves it by hand, so the form says so.',
      validation: req,
    }),
    defineField({
      name: 'commentsErrName',
      title: 'Comments — error, no name',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsErrEmail',
      title: 'Comments — error, bad email',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsErrBody',
      title: 'Comments — error, empty comment',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsErrTooFast',
      title: 'Comments — error, too fast',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsErrPostFailed',
      title: 'Comments — error, post failed',
      type: 'string',
      group: 'comments',
      description: '{{error}} is the reason the server gave.',
      validation: req,
    }),
    defineField({
      name: 'commentsErrPostGeneric',
      title: 'Comments — error, post failed with no reason',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsThanks',
      title: 'Comments — posted',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsPending',
      title: 'Comments — posted, short form',
      type: 'string',
      group: 'comments',
      description:
        'Shown to whoever filled in the hidden bot field. Telling a bot it failed only teaches whoever wrote it to try again.',
      validation: req,
    }),
    defineField({
      name: 'commentsOffLead',
      title: 'Comments — switched off, lead',
      type: 'string',
      group: 'comments',
      validation: req,
    }),
    defineField({
      name: 'commentsOffBody',
      title: 'Comments — switched off, body',
      type: 'text',
      rows: 3,
      group: 'comments',
      description: 'Followed by the studio inbox from Contact details.',
      validation: req,
    }),
    defineField({
      name: 'commentsHoneypotLabel',
      title: 'Comments — hidden field label',
      type: 'string',
      group: 'comments',
      description:
        'The bot trap. Hidden from people and from screen readers; it only has a label because a bot reads the label to decide the field is worth filling in.',
      validation: req,
    }),

    /* ================================================================= */
    /* 404                                                               */
    /*                                                                   */
    /* The one group whose fields may be left blank — see the note at    */
    /* the top of this file. Blank falls back to the built-in text.      */
    /* ================================================================= */

    defineField({
      name: 'notFoundCode',
      title: '404 — code',
      type: 'string',
      group: 'error',
    }),
    defineField({
      name: 'notFoundTitle',
      title: '404 — title',
      type: 'string',
      group: 'error',
    }),
    defineField({
      name: 'notFoundLead',
      title: '404 — lead',
      type: 'text',
      rows: 3,
      group: 'error',
      description:
        'A dead end is a navigation problem, so this page offers routes out rather than only apologising.',
    }),
    defineField({
      name: 'notFoundRoutes',
      title: '404 — ways out',
      type: 'array',
      group: 'error',
      description:
        'The links offered instead. Each path must resolve — the build fails on one that does not.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'route',
          fields: [
            defineField({ name: 'label', title: 'Label', type: 'string', validation: req }),
            defineField({
              name: 'href',
              title: 'Path',
              type: 'string',
              validation: (Rule) =>
                Rule.required().custom((v: string) =>
                  /^(\/|https?:\/\/)/.test(v) ? true : 'Use a path starting with / or a full URL.'
                ),
            }),
            defineField({ name: 'blurb', title: 'Blurb', type: 'string', validation: req }),
          ],
          preview: { select: { title: 'label', subtitle: 'blurb' } },
        }),
      ],
    }),

    /**
     * The careers row, which appears only when something is actually open.
     *
     * Sending somebody who is already lost to an empty listing is a second
     * dead end, which is why this is conditional rather than a permanent row
     * in the list above.
     */
    defineField({
      name: 'notFoundCareersLabel',
      title: '404 — careers row label',
      type: 'string',
      group: 'error',
      description: 'Shown only while at least one role is open.',
    }),
    defineField({
      name: 'notFoundCareersHref',
      title: '404 — careers row path',
      type: 'string',
      group: 'error',
    }),
    defineField({
      name: 'notFoundCareersOne',
      title: '404 — careers row, one role',
      type: 'string',
      group: 'error',
    }),
    defineField({
      name: 'notFoundCareersMany',
      title: '404 — careers row, several roles',
      type: 'string',
      group: 'error',
      description: '{{count}} is how many.',
    }),
    defineField({
      name: 'notFoundFoot',
      title: '404 — footnote',
      type: 'text',
      rows: 2,
      group: 'error',
      description: '{{link}} becomes the link below.',
    }),
    defineField({
      name: 'notFoundFootLinkLabel',
      title: '404 — footnote link text',
      type: 'string',
      group: 'error',
    }),
    defineField({
      name: 'notFoundFootLinkHref',
      title: '404 — footnote link path',
      type: 'string',
      group: 'error',
    }),
    defineField({
      name: 'notFoundSeoTitle',
      title: '404 — browser-tab title',
      type: 'string',
      group: 'error',
    }),
    defineField({
      name: 'notFoundSeoDescription',
      title: '404 — description',
      type: 'string',
      group: 'error',
      description: 'The page is noindex, so this is never a search result. It is here for tidiness.',
    }),

    /* ================================================================= */
    /* Screen readers                                                    */
    /*                                                                   */
    /* Names for controls drawn as icons, and for landmarks a sighted    */
    /* visitor navigates by position. None of these are visible, all of  */
    /* them are required, and a blank one is a defect nobody editing     */
    /* this document will ever see.                                      */
    /* ================================================================= */

    defineField({
      name: 'skipToContent',
      title: 'Skip link',
      type: 'string',
      group: 'a11y',
      description:
        'The first thing in the tab order on every page. It IS visible, once focused — it lets a keyboard user jump the header instead of tabbing through the whole menu on every page.',
      validation: req,
    }),
    defineField({
      name: 'brandHome',
      title: 'Label — logo',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'navMain',
      title: 'Landmark — main menu',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'navMobile',
      title: 'Landmark — mobile menu',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'navFooter',
      title: 'Landmark — footer menu',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'navLegal',
      title: 'Landmark — legal links',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'navBreadcrumb',
      title: 'Landmark — breadcrumbs',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'submenuHint',
      title: 'Label — open a submenu',
      type: 'string',
      group: 'a11y',
      description: '{{label}} is the menu item. "Show Services menu".',
      validation: req,
    }),
    defineField({
      name: 'menuOpen',
      title: 'Label — open the menu',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'menuClose',
      title: 'Label — close the menu',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'themeToLight',
      title: 'Label — switch to light',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'themeToDark',
      title: 'Label — switch to dark',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'searchOpen',
      title: 'Label — open search',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'searchDialog',
      title: 'Label — the search overlay',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'searchClose',
      title: 'Label — close search',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'searchResults',
      title: 'Label — search results',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'announceDismiss',
      title: 'Label — dismiss the notice',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'railOpen',
      title: 'Label — open the blog rail',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'railClose',
      title: 'Label — close the blog rail',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'railLabel',
      title: 'Landmark — the blog rail',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'railSearchLabel',
      title: 'Label — the blog search box',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'filterByCategory',
      title: 'Landmark — blog filters',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'filterByDiscipline',
      title: 'Landmark — portfolio filters',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'filterRoles',
      title: 'Label — role filters',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
    defineField({
      name: 'tagsLabel',
      title: 'Label — a post’s tags',
      type: 'string',
      group: 'a11y',
      validation: req,
    }),
  ],

  preview: { prepare: () => ({ title: 'Interface copy' }) },
});
