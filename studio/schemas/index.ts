/**
 * Every schema the Studio knows about.
 *
 * `blockContent` is not a document type — it is the rich-text field used by
 * `post` and `caseStudy`, and it has to be registered here for those to
 * resolve it by name.
 *
 * ------------------------------------------------------------------------
 * WARNING vs ERROR, and why it is not a matter of taste.
 *
 * These schemas are not the only thing validating this content. Every
 * document is validated a second time, by `src/content.config.ts`, when the
 * site builds — and THAT one is fatal. A document that fails it does not
 * render badly; the build exits non-zero, the deploy never runs, and the live
 * site silently keeps serving the previous version.
 *
 * So the two must agree about severity:
 *
 *   ERROR   for anything the build rejects. Sanity then refuses to publish
 *           it, and the editor is told at the field, while they are standing
 *           there and know what they meant.
 *
 *   WARNING only for advice the build tolerates — "this is longer than Google
 *           will show", "this is wider than the grid likes". Real guidance,
 *           no consequence beyond the aesthetic.
 *
 * A warning on a condition the build rejects is the worst of both: it looks
 * like an opinion, publishes cleanly, and surfaces ten minutes later as a
 * failed GitHub Action with a message about a zod schema. That is how a
 * missing alt text on one tile image stopped an entire site from deploying.
 *
 * The practical test when writing a rule: if `content.config.ts` bounds this
 * field, the Studio's rule at that same bound is an error. A tighter,
 * advisory bound can sit beside it as a warning — Sanity takes an array of
 * rules, so a field can carry both:
 *
 *     validation: (Rule) => [
 *       Rule.required().max(300),                    // what the build enforces
 *       Rule.max(160).warning('Google cuts it here') // what we recommend
 *     ]
 *
 * ONE TRAP worth knowing: `.warning()` sets the level for the whole chain it
 * ends, so `Rule.required().max(70).warning(...)` makes `required` a warning
 * too. Several fields here were accidentally optional that way. Splitting the
 * chain into an array is what keeps `required` fatal and the length advisory.
 * ------------------------------------------------------------------------
 */
import blockContent from './blockContent';
import post from './post';
import caseStudy from './caseStudy';
import role from './role';
import teamMember from './teamMember';
import piece from './piece';
import service from './service';
import workCategory from './workCategory';
import postCategory from './postCategory';
import testimonial from './testimonial';
import client from './client';
import milestone from './milestone';
import engagementModel from './engagementModel';
import redirect from './redirect';
import faq from './faq';
import artwork from './artwork';
import announcement from './announcement';
import contactDetails from './contactDetails';
import siteCopy from './siteCopy';
import brand from './brand';
import uiCopy from './uiCopy';
import privacyPage from './privacyPage';
import navigation from './navigation';
import loaderSettings from './loaderSettings';
import bookingSettings from './bookingSettings';
import careersContent from './careersContent';
import page from './page';
import { blockTypes } from './blocks';

export const schemaTypes = [
  /* Published content */
  post,
  caseStudy,
  role,
  piece,
  service,
  workCategory,
  postCategory,

  /* The studio itself */
  teamMember,
  testimonial,
  client,
  milestone,
  engagementModel,

  /* Copy and settings */
  faq,
  artwork,
  announcement,
  contactDetails,
  siteCopy,
  uiCopy,
  brand,
  redirect,
  privacyPage,
  navigation,
  loaderSettings,
  bookingSettings,
  careersContent,
  page,

  /* Field types, not documents */
  blockContent,

  /* Page-builder blocks. Objects, not documents: they exist only inside a
     page's `blocks` array, so they get no place of their own in the sidebar. */
  ...blockTypes,
];
