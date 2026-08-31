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
import testimonial from './testimonial';
import client from './client';
import milestone from './milestone';
import faq from './faq';
import artwork from './artwork';
import announcement from './announcement';
import contactDetails from './contactDetails';
import siteCopy from './siteCopy';

export const schemaTypes = [
  /* Published content */
  post,
  caseStudy,
  role,
  piece,

  /* The studio itself */
  teamMember,
  testimonial,
  client,
  milestone,

  /* Copy and settings */
  faq,
  artwork,
  announcement,
  contactDetails,
  siteCopy,

  /* Field types, not documents */
  blockContent,
];
