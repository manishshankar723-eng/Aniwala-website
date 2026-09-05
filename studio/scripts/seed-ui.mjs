/**
 * Interface copy, the privacy policy, and the wording of the two forms — as
 * they stood in the templates before they moved to the CMS.
 *
 * TRANSCRIPTIONS, not rewrites. The conversion is only correct if the built
 * page comes out reading exactly as it did before, and that can only be
 * checked against a faithful copy of the original. Every string below was
 * lifted from the `.astro` file that used to hold it.
 *
 * Once seeded, this file has done its job: the Studio is the source of truth
 * from then on, and re-running the migration over it would overwrite whatever
 * has been edited since. See the note on `--only` in migrate.mjs.
 *
 * WHAT CHANGED IN TRANSIT, and it is worth knowing about:
 *
 *   - Sentences with a value in the middle became `{{token}}` templates. The
 *     text is the same; the hole is now named. See `src/lib/copy.ts`.
 *   - The privacy policy's inbox, trading name and postal address came OUT of
 *     its prose. The first two are tokens, the third is rendered from
 *     `contactDetails` — so none of the three can go stale inside a long
 *     document nobody re-reads.
 *   - The application form's "privacy note" link moved from `#applications` to
 *     `#job-applications`, which is the anchor the Portable Text renderer
 *     produces for that heading. Same heading, same place on the page.
 */

/* ------------------------------------------------------------------ */
/* Interface copy                                                      */
/* ------------------------------------------------------------------ */
export const UI_COPY = {
  /* --- Site-wide ---------------------------------------------------- */
  siteName: 'Aniwala Studios',
  defaultDescription:
    'Aniwala is an animation studio producing 2D, 3D, VFX and game art.',

  footerEyebrow: 'Start a project',
  footerNote: "Tell us the deadline first. We'll tell you honestly whether we can hit it.",
  footerAddressLabel: 'Office',
  footerColStudio: 'Studio',
  footerColServices: 'Services',
  footerColFollow: 'Follow',
  footerCopyright: '© {{year}} {{legalName}}. All rights reserved.',
  legalLinks: [{ label: 'Privacy Policy', href: '/privacy/' }],

  searchPlaceholder: 'Type Your Search...',
  searchEmpty: 'No matches. Try “animation”, “VFX” or “contact”.',

  cardReadMore: 'Read',
  cardCaseMore: 'Read the case study',
  barAllCategories: 'All',
  barAllWork: 'All work',
  barClearFilter: 'Clear this filter',

  ctaEyebrow: 'Next step',
  ctaTitle: 'Tell us the deadline first.',
  ctaBody:
    "We'll tell you straight whether we can hit it, and what it would take if we can. No deck, no discovery phase. Just an answer within two working days.",
  ctaSecondaryLabel: 'Email the studio',
  faqEyebrow: 'Questions',
  faqTitle: 'Before you ask',

  adminTitle: 'Redirecting to the Studio…',
  adminLead: 'Taking you to the Aniwala Studio…',
  adminLinkLabel: 'If nothing happens, open it here',

  crumbHome: 'Home',
  crumbBlog: 'Blog',
  crumbPortfolio: 'Portfolio',
  crumbCaseStudies: 'Case studies',
  crumbServices: 'Services',
  crumbCareers: 'Careers',

  /* --- Detail pages -------------------------------------------------- */
  postUpdatedPrefix: 'Updated',
  postBackLabel: 'All posts',
  postRelatedEyebrow: 'Keep reading',
  postRelatedTitle: 'More from the blog',
  postRelatedLink: 'All posts',

  caseEyebrow: 'Case study',
  caseOwnNoteLead: 'Self-directed studio project.',
  caseOwnNoteBody:
    'Nobody commissioned this. We built it to test a claim we make to clients, on our own time — so the working below is complete, including the parts that did not go well.',
  caseFactMadeBy: 'Made by',
  caseFactClient: 'Client',
  caseFactType: 'Type',
  caseFactYear: 'Year',
  caseFactEngagement: 'Engagement',
  caseRailDisciplines: 'Disciplines',
  caseRailDelivered: 'Delivered',
  caseRailTools: 'Built with',
  caseRelatedEyebrow: 'More work',
  caseRelatedTitle: 'Other case studies',
  caseRelatedLink: 'View all',

  roleApplyAct: 'Apply for this role',
  roleAskAct: 'Ask a question first',
  roleAskSubject: 'Question about {{role}}',
  roleWorkTitle: 'The work',
  roleDoingTitle: 'What you would be doing',
  roleNeedTitle: 'What we need from you',
  roleNeedAside:
    'Missing one of these and strong on the rest? Apply anyway and say which one. We have hired on that basis before, and the reel decides it — not the checklist.',
  roleNiceTitle: 'Nice to have',
  roleNiceNote: 'Genuinely optional. None of these decide it.',
  roleSoftwareTitle: 'Software you would be in',
  roleReelEyebrow: 'What to send',
  roleReelFoot:
    'A link is all we need — ArtStation, Vimeo, a personal site, a Drive folder or a PDF. Please check the sharing permission before you send it.',
  roleGlanceTitle: 'At a glance',
  roleFactDiscipline: 'Discipline',
  roleFactType: 'Type',
  roleFactLocation: 'Location',
  roleFactExperience: 'Experience',
  roleFactOpenings: 'Openings',
  roleFactPosted: 'Posted',
  roleFactCloses: 'Applications close',
  roleSeatOne: '1 seat',
  roleSeatMany: '{{count}} seats',
  roleRailNote:
    'Answer within five working days, either way. Tests are paid and never shipped.',
  roleProcessTitle: 'The process',
  roleProcessLink: 'In full',
  roleOthersEyebrow: 'Also open',
  roleOthersTitle: 'Not quite you?',
  roleOthersLink: 'Send an open application',

  serviceEyebrow: 'Services',
  serviceHeroPrimary: 'Start a project',
  serviceHeroSecondary: 'See the pipeline',
  serviceOfferEyebrow: 'What we make',
  serviceOfferTitle: 'Everything {{article}} {{name}} brief can include',
  serviceProcessEyebrow: 'The process',
  serviceProcessTitle: 'How {{article}} {{name}} job runs',
  serviceProcessLead:
    'Every stage names its own approval, so you always know what you are signing off and what it unlocks. Nothing moves to the next stage until the one before it is agreed.',
  serviceToolsEyebrow: 'Software',
  serviceToolsTitle: 'What we work in',
  serviceToolsNote:
    'Not on the list? Ask. Most pipelines are a swap away, and we will say so plainly if yours is not.',
  serviceDeliverEyebrow: 'Hand-off',
  serviceDeliverTitle: 'What you get',
  serviceRelatedEyebrow: 'Pairs with',
  serviceRelatedTitle: 'Rarely just one discipline',
  serviceRelatedLink: 'Every discipline',
  serviceFaqTitle: '{{label}}, answered',
  serviceCtaEyebrow: 'Start a project',
  serviceCtaTitle: 'Have {{article}} {{name}} brief?',
  serviceCtaBody:
    'Send it with the deadline attached. You get a shot or asset count, a crew, a price and a date within two working days — or an honest no.',

  portfolioEyebrow: 'Portfolio',
  portfolioEmptyTitle: 'No {{name}} published yet.',
  portfolioEmptyBodyOne:
    'We take this work on — it is simply not up here yet. Most of what a studio makes never clears for public use, and we would rather show you nothing than show you work that is not ours.',
  portfolioEmptyBodyTwo:
    'Ask and we will send relevant work directly, along with an honest read on whether it is the right fit for your brief.',
  portfolioEmptyCta: 'Ask to see {{name}}',
  portfolioOwnNote:
    'Self-directed studio work — pieces we set ourselves to test a pipeline claim before making it to a client. Commissioned projects appear here as they clear approval.',
  portfolioWorkHeading: '{{title}} work',
  portfolioServicesEyebrow: 'What you would be hiring',
  portfolioServicesTitle: 'The services behind this work',
  portfolioServicesLink: 'Every discipline',
  portfolioCtaEyebrow: 'Start a project',
  portfolioCtaTitle: 'Have {{name}} on your brief?',
  portfolioCtaBody:
    'Send the brief, the asset list or just the problem. You get a shot or asset count, the decisions that will cost money, and a date we believe — within two working days.',

  /* --- Page-builder blocks -------------------------------------------- */
  engagementBestFor: 'Best for',
  blockWorkHeading: 'All work',
  blockPostsHeading: 'All posts',
  blockCaseStudiesHeading: 'All case studies',
  heroScrollLabel: 'Scroll',

  /* --- Listings ------------------------------------------------------ */
  railSearchTitle: 'Search',
  railSearchPlaceholder: 'Search posts…',
  railSearchEmpty: 'No posts match that.',
  railTocTitle: 'On this page',
  railRecentTitle: 'Recent posts',
  railCategoriesTitle: 'Categories',
  railArchiveTitle: 'Archive',
  railTagsTitle: 'Tags',
  railPromoTitle: 'Animation & game art, end to end',
  railPromoText: 'Six disciplines, one pipeline, and a schedule we actually believe.',
  railPromoCta: 'See what we do',
  railPromoHref: '/services/',

  blogEyebrow: 'Blog',
  tagEyebrow: 'Tag',
  archiveEyebrow: 'Archive',
  postCountOne: '{{count}} post',
  postCountMany: '{{count}} posts',
  categoryHeading: 'Posts in {{name}}',
  tagLead: 'Everything on the blog tagged {{name}}.',
  tagDescription: 'Posts tagged {{name}}.',
  tagHeading: 'Posts tagged {{name}}',
  archiveLead: 'Everything published in {{name}}.',
  archiveDescription: 'Posts published in {{name}}.',
  archiveHeading: 'Posts from {{name}}',

  careersSeatOne: 'seat open',
  careersSeatMany: 'seats open',
  careersFilterAll: 'All',
  careersNewBadge: 'New',
  careersOpeningOne: '1 opening',
  careersOpeningMany: '{{count}} openings',
  careersPosted: 'Posted {{date}}',
  careersCloses: 'closes {{date}}',
  careersReadRole: 'Read the role',
  careersApply: 'Apply',
  careersStudioLink: 'More about the studio',

  /* --- Comments ------------------------------------------------------ */
  commentsTitle: 'Comments',
  commentsLoading: 'Loading comments…',
  commentsEmpty: 'No comments yet.',
  commentsLoadError: 'Comments could not be loaded right now.',
  commentsFormTitle: 'Leave a comment',
  commentsFormNote: 'Your email address will not be published. Required fields are marked *',
  commentsNameLabel: 'Full name *',
  commentsEmailLabel: 'Email *',
  commentsBodyLabel: 'Comment *',
  commentsRemember: 'Save my name and email in this browser for next time.',
  commentsSubmit: 'Post comment',
  commentsSubmitBusy: 'Posting…',
  commentsNote: 'Held for review before it appears.',
  commentsErrName: 'Add a name so we know who we are talking to.',
  commentsErrEmail: 'That email address does not look right. It is never published.',
  commentsErrBody: 'Write a comment first.',
  commentsErrTooFast: 'That was quick — give it a second and try again.',
  commentsErrPostFailed: 'Could not post that — {{error}}',
  commentsErrPostGeneric: 'Could not post that. Try again shortly.',
  commentsThanks: 'Thanks — your comment is awaiting review and will appear once approved.',
  commentsPending: 'Thanks — your comment is awaiting review.',
  commentsOffLead: 'Comments are not switched on yet.',
  commentsOffBody:
    'If something here was useful, wrong, or worth arguing about, we would genuinely like to hear it — email the studio and we will reply.',
  commentsHoneypotLabel: 'Website',

  /* --- The 404 ------------------------------------------------------- */
  notFoundCode: '404',
  notFoundTitle: 'Nothing here.',
  notFoundLead:
    'That page moved, or never existed. Nothing is broken on your end — here is everywhere else.',
  notFoundRoutes: [
    { label: 'The work', href: '/portfolio/', blurb: 'Animation, game art and VFX' },
    { label: 'Services', href: '/services/', blurb: 'Six disciplines, one pipeline' },
    { label: 'Case studies', href: '/case-studies/', blurb: 'How three jobs actually went' },
    { label: 'Journal', href: '/blog/', blurb: 'Breakdowns and studio notes' },
    { label: 'Contact', href: '/contact/', blurb: 'Briefs, quotes and bookings' },
  ],
  notFoundCareersLabel: 'Careers',
  notFoundCareersHref: '/careers/',
  notFoundCareersOne: '1 role open',
  notFoundCareersMany: '{{count}} roles open',
  notFoundFoot:
    'Followed a link from somewhere on this site? Tell us where it was and we will fix it — {{link}}.',
  notFoundFootLinkLabel: 'contact the studio',
  notFoundFootLinkHref: '/contact/',
  notFoundSeoTitle: 'Page not found — Aniwala Studios',
  notFoundSeoDescription: "That page doesn't exist.",

  /* --- Screen readers -------------------------------------------------- */
  skipToContent: 'Skip to content',
  brandHome: 'Aniwala Studios — home',
  navMain: 'Main',
  navMobile: 'Mobile',
  navFooter: 'Footer',
  navLegal: 'Legal',
  navBreadcrumb: 'Breadcrumb',
  submenuHint: 'Show {{label}} menu',
  menuOpen: 'Open menu',
  menuClose: 'Close menu',
  themeToLight: 'Switch to light theme',
  themeToDark: 'Switch to dark theme',
  searchOpen: 'Search',
  searchDialog: 'Search',
  searchClose: 'Close search',
  searchResults: 'Search results',
  announceDismiss: 'Dismiss announcement',
  railOpen: 'Open blog menu',
  railClose: 'Close blog menu',
  railLabel: 'Blog sidebar',
  railSearchLabel: 'Search blog posts',
  filterByCategory: 'Filter by category',
  filterByDiscipline: 'Filter by discipline',
  filterRoles: 'Filter roles by discipline',
  tagsLabel: 'Tags',
};

/* ------------------------------------------------------------------ */
/* The privacy policy                                                  */
/* ------------------------------------------------------------------ */

/**
 * The body, as Markdown — converted to Portable Text by `migrate.mjs`, the
 * same route every blog post took.
 *
 * `{{legalName}}` and `{{email}}` are filled in from `contactDetails` when
 * the page renders. They are NOT typed in, because the footer's copyright
 * line names the same entity and every CTA band on the site prints the same
 * inbox — and the copy that goes stale is always the one buried in a long
 * document.
 *
 * The postal address is not here either: it is rendered as structured lines
 * under `contactHeading` from the same document.
 *
 * KEEP THIS TRUE TO THE CODE. The claims below are specific and checkable:
 * no analytics or third-party tracking, exactly two localStorage keys, form
 * submissions in Supabase, three forms, self-hosted fonts. Change any of that
 * in the site and this text is part of the change.
 */
export const PRIVACY_BODY = `
This policy covers **{{legalName}}** and the people behind it. It describes the website only. Anything agreed separately in a contract with a client takes precedence over what is written here.

## The short version

We run no analytics, no advertising, no tracking pixels and no third-party scripts that follow you. Nothing on this site tries to work out who you are. The only personal data we hold is what you typed into a form and sent us on purpose.

## What you send us on purpose

Three forms on this site collect information, and each only runs when you submit it.

### Enquiries and call bookings

The contact and booking forms collect your name, email address, and optionally your company, the kind of work you are asking about, your message, and — for a booking — the slot you picked, its length, your timezone, and which page you sent it from. We use it to reply to you and to schedule the call. Nothing else.

### Job applications

The form on the [careers page](/careers/) collects your name, email address, the city you are in, your experience band, a link to your portfolio or reel, and your message — plus, if you give them, your phone number, a CV link, your availability, and which role or area you are interested in. We use it to assess your application and to reply to you. It is not used for anything else, and it is never shared outside the studio.

**We do not accept file uploads.** The form asks for links rather than attachments, so your CV stays on your own storage where you control who can see it and can revoke our access at any time. If you would rather send a file, email it and it lives in our inbox under the same terms as everything else here.

Applications are held in the same database as enquiries, configured so that the website can write a row and can never read one back. Nobody outside the studio sees an application.

### Blog comments

If you comment on an article, we store the name you gave, your comment, and your email address if you supplied one. Your name and comment are published once approved. **Your email address is never published and is never sent to a browser** — the database is configured so the website itself cannot read that column back. We use it only to reply to you.

No comment appears on the site until a person approves it by hand.

## Where it is stored, and who else touches it

Form submissions are stored in a [Supabase](https://supabase.com/privacy) project that we control. Access is restricted by row-level security policies: an anonymous visitor can submit a form and read approved comments, and can do nothing else — enquiries and job applications cannot be read back by anyone but us.

These are the only third parties involved in running this site:

- **Supabase** — the database that holds enquiries, job applications and comments.
- **Resend** — if enabled, forwards a copy of a new enquiry, application or comment to our inbox so we notice it.
- **Hostinger** — hosts the site. Like any web server it keeps standard access logs, which include IP addresses.

We do not sell your data, and we do not share it with anyone beyond the services listed above.

## Cookies

This site sets **no cookies at all**. It stores exactly two values in your browser's local storage, both of which exist to stop the site being annoying:

- \`aniwala-theme\` — remembers whether you chose the light or dark theme.
- \`aniwala-announce-dismissed\` — remembers that you closed the notice at the top of the page, so it stays closed.

Neither identifies you, neither leaves your device, and clearing your browser data removes both. There is no consent banner because there is nothing to consent to.

## How long we keep things

Enquiries are kept while there is a live conversation and for as long as we may need the commercial record afterwards. Comments stay for as long as the article is published. Ask us to delete either and we will.

Job applications are kept for **twelve months** from the day you send them, so that we can come back to you when a seat opens that fits — which is the whole point of an open application. After that they are deleted. Ask us to delete yours sooner and we will do it on the day you ask, whatever stage the process is at.

## Your rights

You can ask us what we hold about you, ask for it to be corrected, or ask for it to be deleted. Email {{email}} and we will action it and confirm when it is done. You do not need to give a reason.

If you are in the EU or UK, the GDPR gives you these rights formally, along with the right to complain to your data protection authority. In India, the Digital Personal Data Protection Act 2023 gives you equivalent rights.

## Changes

If this policy changes, the date at the top of the page changes with it. We will not quietly start collecting something new and leave this page saying otherwise.
`.trim();

export const PRIVACY = {
  eyebrow: 'Legal',
  title: 'Privacy policy',
  lead: 'What this site collects, where it goes, and how to get it deleted. Written to be read, not to be survived.',
  tint: '210 70% 22%',
  /* The date the policy last changed. The page promises this moves whenever
     the text does — so move it whenever you edit anything above. */
  lastUpdated: '2026-08-30',
  lastUpdatedLabel: 'Last updated',
  contactHeading: 'Contact',
  contactLead: 'Questions about any of this go to {{email}}, or by post to:',
  seoTitle: 'Privacy policy — Aniwala Studios',
  seoDescription:
    'What Aniwala Studios collects when you use this website, where it is stored, who can see it, and how to have it deleted.',
};

/* ------------------------------------------------------------------ */
/* The careers page's FAQ and closing panel                            */
/* ------------------------------------------------------------------ */
export const CAREERS_CLOSING = {
  faqEyebrow: 'Questions',
  faqTitle: 'Before you apply',
  ctaEyebrow: 'Not job hunting?',
  ctaTitle: 'Then brief us instead.',
  ctaBody:
    "If you landed here looking for a studio rather than a seat, the other half of the site is the one you want. Tell us the deadline first — we'll tell you straight whether we can hit it.",
  ctaPrimaryLabel: 'Start a project',
  ctaPrimaryHref: '/contact/',
  ctaSecondaryLabel: 'See the work',
  ctaSecondaryHref: '/portfolio/',
  seoTitle: 'Careers — Aniwala Studios',
  seoDescription:
    'Animation, game art and VFX jobs in Pune. Open roles at Aniwala Studios, plus an open application for the seat that is not listed yet. Every application gets an answer within five working days.',
};

/* ------------------------------------------------------------------ */
/* The application form                                                */
/* ------------------------------------------------------------------ */
export const APPLY_COPY = {
  applyEyebrow: 'Apply',
  applyTitleRole: 'Apply for {{role}}',
  applyTitleOpen: 'Send us your work',
  applyLeadRole:
    'One form, and a link to the work. We reply to every application within five working days, including the ones we turn down.',
  applyLeadOpen:
    'Pick a listing, or tell us what you would want to be doing if none of them fit. Both routes reach the same people and get the same answer within five working days.',

  applyPromises: [
    { label: 'Read by', body: 'Someone who does the job, not a keyword filter.' },
    { label: 'Reply', body: 'Within five working days, yes or no.' },
    {
      label: 'Kept',
      body: 'Twelve months, then deleted. See the',
      linkLabel: 'privacy note',
      /* The anchor the Portable Text renderer produces for the policy's
         "Job applications" heading. It was `#applications` when that heading
         was hand-written HTML. */
      linkHref: '/privacy/#job-applications',
    },
    { label: 'Tests', body: 'Paid, under a day, and never shipped.' },
  ],

  applyAltNote:
    'Would rather attach a PDF? Email {{careersEmail}} instead — it reaches the same inbox.',

  applyModeRoleTitle: 'Apply for an open role',
  applyModeRoleCountOne: '1 listed right now',
  applyModeRoleCountMany: '{{count}} listed right now',
  applyModeOpenTitle: 'Nothing listed fits me',
  applyModeOpenSub: 'Register interest for later',

  applyRoleLabel: 'Which role',
  applyRolePlaceholder: 'Choose a role…',
  applyRoleHint: 'For this role: {{note}}',
  applyAreaLabel: 'Which area',
  applyAreaPlaceholder: 'Choose an area…',
  applyDesiredLabel: 'The role you want',
  applyDesiredPlaceholder: 'e.g. Lighting Artist, Rigger, Producer',
  applyOpenNote:
    'We keep these for twelve months and read them first when a seat opens. Be specific about the job you want — "any opening" is the one thing we cannot match against anything.',
  applyLockedLabel: 'Applying for',

  applyNameLabel: 'Your name',
  applyNamePlaceholder: 'First and last',
  applyEmailLabel: 'Email',
  applyEmailPlaceholder: 'you@example.com',
  applyPhoneLabel: 'Phone',
  applyPhonePlaceholder: 'Optional',
  applyLocationLabel: 'Where you are',
  applyLocationPlaceholder: 'City, and country if outside India',
  applyExperienceLabel: 'Experience',
  applyAvailabilityLabel: 'Available from',
  applyChoosePlaceholder: 'Choose…',
  applyAreaOther: 'Something else',

  experienceBands: [
    'Student / final year',
    'Less than 1 year',
    '1–3 years',
    '3–5 years',
    '5–8 years',
    '8+ years',
  ],
  availabilityOptions: [
    'Immediately',
    'Within 2 weeks',
    '1 month notice',
    '2 months notice',
    '3 months notice',
    'Only open to contract work',
  ],
  applyPortfolioLabel: 'Portfolio or reel link',
  applyPortfolioPlaceholder: 'https://artstation.com/… · vimeo.com/… · your site',
  applyPortfolioHint:
    'Check the sharing permission before you send it. A link we cannot open is the most common reason a good application stalls.',
  applyCvLabel: 'CV link',
  applyCvPlaceholder: 'Optional — Drive, Dropbox or a PDF link',
  applyMessageLabelRole: 'Anything we should know',
  applyMessageLabelOpen: 'What you want to be doing here',
  applyMessagePlaceholder:
    'Which piece in your portfolio we should look at first, and why you want this seat in particular. Three sentences is plenty.',
  applyMessageHint:
    'Written by you, not by a model. We can tell, and we would rather read three honest sentences than three polished paragraphs.',

  applySubmitRole: 'Send application',
  applySubmitOpen: 'Send it',
  applySubmitBusy: 'Sending…',
  applyConsent:
    'Sending this stores your name, contact details and links so we can reply. Nothing is shared outside the studio.',
  applyA11yModes: 'What kind of application',

  applyErrRole: 'Pick which role you are applying for.',
  applyErrArea: 'Choose the area you would want to work in.',
  applyErrDesired: 'Name the role you are after — it is what we match against.',
  applyErrName: 'Add your name.',
  applyErrEmail: 'That email address does not look right.',
  applyErrLocation: 'Tell us which city you are in — some of these seats are on-site.',
  applyErrExperience: 'Pick the experience band that fits you best.',
  applyErrPortfolio: 'A link to the work is the one thing we cannot read you without.',
  applyErrPortfolioUrl: 'That portfolio link does not look like a URL we can open.',
  applyErrCvUrl: 'That CV link does not look like a URL we can open.',
  applyErrMessage:
    'Write us a couple of sentences — this is the part a person actually reads.',
  applyErrGeneric: 'Something went wrong with that submission.',
  applyErrTooFast: 'That was quick — give it a moment and press send again.',
  applyErrNotConfigured:
    'Applications are not connected yet — nothing would reach the studio. Email {{careersEmail}} instead.',
  applyErrSendFailed: 'Could not send that — {{error}}. Email {{careersEmail}} instead.',
  applyErrUnreachable: 'Could not reach the server. Email {{careersEmail}} instead.',

  applyDoneTitle: "That's in, {{name}}.",
  applyDoneWhatRole: 'your application for {{role}}',
  applyDoneWhatOpen: 'your open application for {{role}}',
  applyDoneBody:
    'We have {{what}}, and the link to your work. Somebody who does the job will watch it and write back within five working days — including if the answer is no.',
  applyDoneNote:
    'Nothing else to do. If you want to add something, reply to the confirmation or write to {{careersEmail}}.',
};

/* ------------------------------------------------------------------ */
/* The booking widget's wording                                        */
/* ------------------------------------------------------------------ */
export const BOOKING_COPY = {
  sectionEyebrow: 'Book a call',
  sectionTitle: 'Ready to hop on a call?',
  panelTitle: 'Ready to hop on a call?',
  meetingKind: 'Online meeting',
  durationUnit: 'min',
  expectTitle: 'What to expect during the call:',

  /* Sunday first — the calendar grid is laid out Sunday-first, so a
     Monday-first list would label every column one day out. */
  weekdayLabels: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  timezoneLabel: 'Timezone',
  slotNextLabel: 'Next',
  noSlots: 'No times left on this day. Try the next one.',

  detailsTitle: 'Enter Details',
  nameLabel: 'Your Name',
  namePlaceholder: 'Your Name',
  emailLabel: 'Your Email',
  emailPlaceholder: 'Your Email',
  enquiryLabel: 'What do you need?',
  messageLabel: 'What is this meeting about?',
  messagePlaceholder: 'Deadline, format, reference links…',
  submitLabel: 'Schedule Meeting',
  submitBusy: 'Sending…',

  errName: 'Add your name so we know who we are meeting.',
  errEmail: 'That email address does not look right.',
  errNotConfigured: 'Booking is not connected yet — nothing would reach the studio.',
  errSendFailed: 'Could not send that — {{error}}. Email {{email}} instead.',
  errUnreachable: 'Could not reach the server. Email {{email}} instead.',
  emailSubject: 'New call request — aniwala.com',
  emailFromName: 'Aniwala website',

  doneTitle: 'Request sent.',
  doneBody:
    'Thanks {{name}} — we have your request for {{when}}. We will confirm by email, usually within one working day.',

  a11yDurations: 'Call length',
  a11yPrevMonth: 'Previous month',
  a11yNextMonth: 'Next month',
  a11yGrid: 'Choose a date',
  a11yTimeFormat: 'Time format',
  a11ySlots: 'Available times',
  a11yBack: 'Back to calendar',
};

/* ------------------------------------------------------------------ */
/* The logo and the browser icon                                       */
/* ------------------------------------------------------------------ */

/**
 * Only the words and the colours, deliberately — no images.
 *
 * A seed cannot upload a logo: the built-in inline mark and the committed
 * icon set in `public/` already ARE the defaults, and writing image fields
 * here would mean inventing assets nobody chose. What it does seed is the
 * wordmark and the manifest values that were previously hardcoded in
 * `Header.astro` and `public/site.webmanifest`, so the two fall under the
 * same "edit it in the Studio" rule as everything else.
 *
 * Upload the two logos and the icon in the Studio when there are real ones.
 * Until then every field below drives exactly what the site already showed.
 */
export const BRAND = {
  showWordmark: true,
  wordmark: 'ANIWALA',
  wordmarkSub: 'Studios',
  themeColor: '#0b0c10',
  themeColorLight: '#faf9f5',
  backgroundColor: '#0b0c10',
  appName: 'Aniwala Studios',
  appShortName: 'Aniwala',
  appDescription: 'Animation studio producing 2D, 3D, VFX and game art.',
};

/* ------------------------------------------------------------------ */
/* The services grid's closing tile                                    */
/* ------------------------------------------------------------------ */

/**
 * The tile after the last service, offering work none of the six names.
 *
 * It was written into `ServiceGridBlock.astro`, which meant every services
 * grid on the site had it whether or not it suited the page. It is now three
 * optional fields on the block — so this seeds the ONE block that was
 * actually showing it, and every other grid keeps the behaviour it had.
 *
 * Only grids in the "tiles" layout ever rendered it: the numbered "rows"
 * layout has no tile to append one to.
 */
export const SERVICE_GRID_CTA = {
  ctaTitle: 'Something else?',
  ctaBody: "Tell us what you need and we'll scope it honestly.",
  ctaHref: '/contact/',
};

/* ------------------------------------------------------------------ */
/* How a client hires the studio                                       */
/* ------------------------------------------------------------------ */

/**
 * Transcribed from `config/services.ts`, where these were a hand-edited
 * array. Each is a commercial promise about how the studio takes work on —
 * the sentence worth keeping in every one is the one about what happens when
 * things go wrong, because that is the part nobody else writes down.
 */
export const ENGAGEMENT_MODELS = [
  {
    title: 'Fixed-scope project',
    body: 'An agreed shot or asset count, a fixed price and a fixed date. We absorb the overruns that are our fault; changes to the brief are quoted as changes rather than absorbed silently.',
    bestFor: 'A defined deliverable — a trailer, a cinematic, an asset batch.',
    order: 10,
  },
  {
    title: 'Team extension',
    body: 'Named artists reserved for you by the month, working in your pipeline, your tracker and your reviews. You direct the work; we handle employment, kit and cover.',
    bestFor: 'An in-house team that needs capacity, not a vendor.',
    order: 20,
  },
  {
    title: 'Co-development',
    body: 'We take a whole vertical — all the environments, the full cinematic, the entire effects package — and run it to a milestone plan with our own leads.',
    bestFor: 'A slice of production you would rather hand over entirely.',
    order: 30,
  },
];

/* ------------------------------------------------------------------ */
/* The pages search cannot find on its own                             */
/* ------------------------------------------------------------------ */

/**
 * Transcribed from the `searchIndex` array in `config/nav.ts`.
 *
 * Only pages whose text lives in a template. Posts, services, case studies,
 * roles and disciplines are folded into the index from their own documents at
 * build time, so none of them is listed here and none of them can fall out of
 * step with the site.
 */
export const SEARCH_PAGES = [
  { title: 'Home', href: '/', section: 'Pages', keywords: 'aniwala studios animation showreel' },
  {
    title: 'Portfolio',
    href: '/portfolio/',
    section: 'Pages',
    keywords: 'work projects case studies reel',
  },
  { title: 'About Us', href: '/about/', section: 'Pages', keywords: 'studio team story pipeline' },
  { title: 'Blog', href: '/blog/', section: 'Pages', keywords: 'journal news breakdowns articles' },
  {
    title: 'Contact',
    href: '/contact/',
    section: 'Pages',
    keywords: 'book appointment enquiry email hire quote',
  },
  {
    title: 'Case Studies',
    href: '/case-studies/',
    section: 'Pages',
    keywords: 'work projects breakdown process results portfolio examples',
  },
  {
    title: 'Services',
    href: '/services/',
    section: 'Pages',
    keywords: 'disciplines pipeline engagement outsourcing capabilities what we do',
  },
  {
    /* Only the landing page. The individual openings are derived from the
       role documents, so a filled seat leaves search the day it leaves the
       careers page. */
    title: 'Careers',
    href: '/careers/',
    section: 'Pages',
    keywords:
      'jobs hiring vacancies openings apply application internship intern recruitment work with us animator artist vfx editor pune',
  },
];

/* ------------------------------------------------------------------ */
/* The trading name, which moved off config/contact.ts                 */
/* ------------------------------------------------------------------ */
export const LEGAL_NAME = 'aniwala.com';
