/**
 * Every schema the Studio knows about.
 *
 * `blockContent` is not a document type — it is the rich-text field used by
 * `post` and `caseStudy`, and it has to be registered here for those to
 * resolve it by name.
 */
import blockContent from './blockContent';
import post from './post';
import caseStudy from './caseStudy';
import role from './role';
import teamMember from './teamMember';
import piece from './piece';
import service from './service';
import workCategory from './workCategory';
import testimonial from './testimonial';
import client from './client';
import milestone from './milestone';
import engagementModel from './engagementModel';
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
