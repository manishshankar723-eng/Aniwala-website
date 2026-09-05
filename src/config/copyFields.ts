/**
 * The names of every interface string held in the CMS.
 *
 * WHY A LIST OF NAMES IS A FILE
 *
 * Three documents in Sanity carry interface copy: `uiCopy`, and the wording
 * that sits on `careersContent` and `bookingSettings`. Between them that is
 * around two hundred fields, and two entirely separate things need to know
 * what they are called:
 *
 *   - `content.config.ts`, so the build FAILS when one is missing from the
 *     CMS rather than rendering a blank label on the live site;
 *   - `lib/studio.ts`, so a template gets `copy.footerEyebrow` type-checked
 *     and autocompleted instead of `copy.footerEybrow` compiling fine and
 *     rendering the word `undefined` in the footer.
 *
 * Written out twice, those two lists drift, and the drift is silent in the
 * worst direction: the validator stops guarding the field the templates use.
 * So the names live here once, `as const`, and both sides derive from them.
 *
 * WHAT THIS FILE IS NOT. It holds no text. Every string these names refer to
 * is in Sanity, which is the entire point of the exercise — this is the
 * contract, not the copy.
 *
 * ADDING A FIELD: add it to the Studio schema, add its name here, seed it,
 * and use it. Miss the middle step and the build tells you.
 */

/**
 * Everything on the `uiCopy` singleton that is a plain required string.
 *
 * The 404 group is deliberately absent — those fields are optional and fall
 * back to the text in `lib/studio.ts`, because the 404 is the page somebody
 * reaches when something has already gone wrong and it must not be able to
 * break in turn. `legalLinks` is absent too; it is a list, not a string.
 */
export const UI_COPY_FIELDS = [
  /* --- Site-wide ---------------------------------------------------- */
  'siteName',
  'defaultDescription',
  'footerEyebrow',
  'footerNote',
  'footerAddressLabel',
  'footerColStudio',
  'footerColServices',
  'footerColFollow',
  'footerCopyright',
  'searchPlaceholder',
  'searchEmpty',
  'cardReadMore',
  'cardCaseMore',
  'barAllCategories',
  'barAllWork',
  'barClearFilter',
  'ctaEyebrow',
  'ctaTitle',
  'ctaBody',
  'ctaSecondaryLabel',
  'faqEyebrow',
  'faqTitle',
  'crumbHome',
  'crumbBlog',
  'crumbPortfolio',
  'crumbCaseStudies',
  'crumbServices',
  'crumbCareers',

  /* --- Detail pages -------------------------------------------------- */
  'postUpdatedPrefix',
  'postBackLabel',
  'postRelatedEyebrow',
  'postRelatedTitle',
  'postRelatedLink',
  'caseEyebrow',
  'caseOwnNoteLead',
  'caseOwnNoteBody',
  'caseFactMadeBy',
  'caseFactClient',
  'caseFactType',
  'caseFactYear',
  'caseFactEngagement',
  'caseRailDisciplines',
  'caseRailDelivered',
  'caseRailTools',
  'caseRelatedEyebrow',
  'caseRelatedTitle',
  'caseRelatedLink',
  'roleApplyAct',
  'roleAskAct',
  'roleAskSubject',
  'roleWorkTitle',
  'roleDoingTitle',
  'roleNeedTitle',
  'roleNeedAside',
  'roleNiceTitle',
  'roleNiceNote',
  'roleSoftwareTitle',
  'roleReelEyebrow',
  'roleReelFoot',
  'roleGlanceTitle',
  'roleFactDiscipline',
  'roleFactType',
  'roleFactLocation',
  'roleFactExperience',
  'roleFactOpenings',
  'roleFactPosted',
  'roleFactCloses',
  'roleSeatOne',
  'roleSeatMany',
  'roleRailNote',
  'roleProcessTitle',
  'roleProcessLink',
  'roleOthersEyebrow',
  'roleOthersTitle',
  'roleOthersLink',
  'serviceEyebrow',
  'serviceHeroPrimary',
  'serviceHeroSecondary',
  'serviceOfferEyebrow',
  'serviceOfferTitle',
  'serviceProcessEyebrow',
  'serviceProcessTitle',
  'serviceProcessLead',
  'serviceToolsEyebrow',
  'serviceToolsTitle',
  'serviceToolsNote',
  'serviceDeliverEyebrow',
  'serviceDeliverTitle',
  'serviceRelatedEyebrow',
  'serviceRelatedTitle',
  'serviceRelatedLink',
  'serviceFaqTitle',
  'serviceCtaEyebrow',
  'serviceCtaTitle',
  'serviceCtaBody',
  'portfolioEyebrow',
  'portfolioEmptyTitle',
  'portfolioEmptyBodyOne',
  'portfolioEmptyBodyTwo',
  'portfolioEmptyCta',
  'portfolioOwnNote',
  'portfolioWorkHeading',
  'portfolioServicesEyebrow',
  'portfolioServicesTitle',
  'portfolioServicesLink',
  'portfolioCtaEyebrow',
  'portfolioCtaTitle',
  'portfolioCtaBody',

  /* --- Listings ------------------------------------------------------ */
  'railSearchTitle',
  'railSearchPlaceholder',
  'railSearchEmpty',
  'railTocTitle',
  'railRecentTitle',
  'railCategoriesTitle',
  'railArchiveTitle',
  'railTagsTitle',
  'railPromoTitle',
  'railPromoText',
  'railPromoCta',
  'railPromoHref',
  'blogEyebrow',
  'tagEyebrow',
  'archiveEyebrow',
  'postCountOne',
  'postCountMany',
  'categoryHeading',
  'tagLead',
  'tagDescription',
  'tagHeading',
  'archiveLead',
  'archiveDescription',
  'archiveHeading',
  'careersSeatOne',
  'careersSeatMany',
  'careersFilterAll',
  'careersNewBadge',
  'careersOpeningOne',
  'careersOpeningMany',
  'careersPosted',
  'careersCloses',
  'careersReadRole',
  'careersApply',
  'careersStudioLink',

  /* --- Comments ------------------------------------------------------ */
  'commentsTitle',
  'commentsLoading',
  'commentsEmpty',
  'commentsLoadError',
  'commentsFormTitle',
  'commentsFormNote',
  'commentsNameLabel',
  'commentsEmailLabel',
  'commentsBodyLabel',
  'commentsRemember',
  'commentsSubmit',
  'commentsSubmitBusy',
  'commentsNote',
  'commentsErrName',
  'commentsErrEmail',
  'commentsErrBody',
  'commentsErrTooFast',
  'commentsErrPostFailed',
  'commentsErrPostGeneric',
  'commentsThanks',
  'commentsPending',
  'commentsOffLead',
  'commentsOffBody',
  'commentsHoneypotLabel',

  /* --- Screen readers -------------------------------------------------
     Required like everything else here, and for a sharper reason: these
     are the only names a screen reader has for a row of icon buttons, and
     a blank one is not "no label" — it is a control announced as
     "button". Nobody editing the Studio would ever notice. */
  'skipToContent',
  'brandHome',
  'navMain',
  'navMobile',
  'navFooter',
  'navLegal',
  'navBreadcrumb',
  'submenuHint',
  'menuOpen',
  'menuClose',
  'themeToLight',
  'themeToDark',
  'searchOpen',
  'searchDialog',
  'searchClose',
  'searchResults',
  'announceDismiss',
  'railOpen',
  'railClose',
  'railLabel',
  'railSearchLabel',
  'filterByCategory',
  'filterByDiscipline',
  'filterRoles',
  'tagsLabel',
] as const;

export type UiCopyField = (typeof UI_COPY_FIELDS)[number];

/**
 * The application form's wording, held on `careersContent`.
 *
 * It lives with the careers page rather than on its own because the form
 * renders on the listing page AND at the foot of every role page — two copies
 * is how those two pages end up promising an applicant two different reply
 * times. `applyPromises` is absent from this list: it is a repeatable list of
 * objects, not a string.
 */
export const APPLY_COPY_FIELDS = [
  'applyEyebrow',
  'applyTitleRole',
  'applyTitleOpen',
  'applyLeadRole',
  'applyLeadOpen',
  'applyAltNote',
  'applyModeRoleTitle',
  'applyModeRoleCountOne',
  'applyModeRoleCountMany',
  'applyModeOpenTitle',
  'applyModeOpenSub',
  'applyRoleLabel',
  'applyRolePlaceholder',
  'applyRoleHint',
  'applyAreaLabel',
  'applyAreaPlaceholder',
  'applyDesiredLabel',
  'applyDesiredPlaceholder',
  'applyOpenNote',
  'applyLockedLabel',
  'applyNameLabel',
  'applyNamePlaceholder',
  'applyEmailLabel',
  'applyEmailPlaceholder',
  'applyPhoneLabel',
  'applyPhonePlaceholder',
  'applyLocationLabel',
  'applyLocationPlaceholder',
  'applyExperienceLabel',
  'applyAvailabilityLabel',
  'applyChoosePlaceholder',
  'applyPortfolioLabel',
  'applyPortfolioPlaceholder',
  'applyPortfolioHint',
  'applyCvLabel',
  'applyCvPlaceholder',
  'applyMessageLabelRole',
  'applyMessageLabelOpen',
  'applyMessagePlaceholder',
  'applyMessageHint',
  'applySubmitRole',
  'applySubmitOpen',
  'applySubmitBusy',
  'applyConsent',
  'applyA11yModes',
  'applyErrRole',
  'applyErrArea',
  'applyErrDesired',
  'applyErrName',
  'applyErrEmail',
  'applyErrLocation',
  'applyErrExperience',
  'applyErrPortfolio',
  'applyErrPortfolioUrl',
  'applyErrCvUrl',
  'applyErrMessage',
  'applyErrGeneric',
  'applyErrTooFast',
  'applyErrNotConfigured',
  'applyErrSendFailed',
  'applyErrUnreachable',
  'applyDoneTitle',
  'applyDoneWhatRole',
  'applyDoneWhatOpen',
  'applyDoneBody',
  'applyDoneNote',
] as const;

export type ApplyCopyField = (typeof APPLY_COPY_FIELDS)[number];

/**
 * The careers page's FAQ heading and its closing panel, also on
 * `careersContent`.
 *
 * Separate from the list above because they are not part of the form — the
 * closing panel is the one place that page deliberately addresses somebody
 * who is NOT job hunting, which is why both of its actions are set here
 * rather than falling back to the site-wide ones.
 */
export const CAREERS_CLOSING_FIELDS = [
  'faqEyebrow',
  'faqTitle',
  'ctaEyebrow',
  'ctaTitle',
  'ctaBody',
  'ctaPrimaryLabel',
  'ctaPrimaryHref',
  'ctaSecondaryLabel',
  'ctaSecondaryHref',
] as const;

export type CareersClosingField = (typeof CAREERS_CLOSING_FIELDS)[number];

/**
 * The booking widget's wording, held on `bookingSettings`.
 *
 * `weekdayLabels` is absent because it is an array with a length rule of its
 * own — exactly seven, Sunday first, since the calendar grid is laid out
 * Sunday-first and a Monday-first list labels every column one day out.
 */
export const BOOKING_COPY_FIELDS = [
  'sectionEyebrow',
  'sectionTitle',
  'panelTitle',
  'meetingKind',
  'durationUnit',
  'expectTitle',
  'timezoneLabel',
  'slotNextLabel',
  'noSlots',
  'detailsTitle',
  'nameLabel',
  'namePlaceholder',
  'emailLabel',
  'emailPlaceholder',
  'enquiryLabel',
  'messageLabel',
  'messagePlaceholder',
  'submitLabel',
  'submitBusy',
  'errName',
  'errEmail',
  'errNotConfigured',
  'errSendFailed',
  'errUnreachable',
  'doneTitle',
  'doneBody',
  'a11yDurations',
  'a11yPrevMonth',
  'a11yNextMonth',
  'a11yGrid',
  'a11yTimeFormat',
  'a11ySlots',
  'a11yBack',
] as const;

export type BookingCopyField = (typeof BOOKING_COPY_FIELDS)[number];
