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

export const schemaTypes = [post, caseStudy, role, blockContent];
