/**
 * Sanity Studio — the admin panel for aniwala.com.
 *
 * This is a separate npm package from the website on purpose. The Studio
 * pulls in React, styled-components and the whole Sanity toolkit, and the
 * deploy workflow runs `npm ci` on every push — folding these dependencies
 * into the site's package.json would add minutes to every build of a site
 * that ships no React at all.
 *
 * RUNNING IT
 *   cd studio && npm install && npm run dev     -> http://localhost:3333
 *   npm run deploy                              -> https://aniwala.sanity.studio
 *
 * The deployed Studio is hosted free by Sanity, updates when you run `deploy`,
 * and is where the non-technical editor works. `/admin` on the main site
 * redirects to it, so the address worth remembering is aniwala.com/admin.
 */
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemas';

/* Not secret — the project id appears in every cdn.sanity.io image URL the
   site serves, so it is hardcoded as the default rather than left as a
   placeholder.

   It was a placeholder, and that was a bug: the Sanity CLI does not read the
   repo-root .env, so `sanity deploy` sent the literal string
   'PASTE-YOUR-SANITY-PROJECT-ID' and the API rejected it as "missing required
   grant sanity.project.read" — a permissions error for what was actually a
   typo'd project. The env var still overrides, for pointing at a scratch
   project without editing this file. */
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? '20wlzfea';
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';

export default defineConfig({
  name: 'aniwala',
  title: 'Aniwala Studios',

  projectId,
  dataset,

  plugins: [
    structureTool({
      /**
       * The sidebar. Ordered by how often each thing is touched rather than
       * alphabetically, so the two lists an editor opens every week are not
       * sitting underneath the one they open twice a year.
       */
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            /*
             * Grouped, not one flat list.
             *
             * There are thirteen document types now. Ordered by how often
             * each is touched, with dividers marking the shift from things
             * published weekly, to things about the studio, to settings
             * somebody opens twice a year.
             */
            S.listItem()
              .title('Blog posts')
              .schemaType('post')
              .child(
                S.documentTypeList('post')
                  .title('Blog posts')
                  /* Newest first — the same order the site shows them in.
                     The default is alphabetical, which nobody thinks in. */
                  .defaultOrdering([{ field: 'pubDate', direction: 'desc' }])
              ),
            S.listItem()
              .title('Open roles')
              .schemaType('role')
              .child(
                S.documentTypeList('role')
                  .title('Open roles')
                  .defaultOrdering([{ field: 'posted', direction: 'desc' }])
              ),
            S.listItem()
              .title('Portfolio pieces')
              .schemaType('piece')
              .child(
                S.documentTypeList('piece')
                  .title('Portfolio pieces')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),
            S.listItem()
              .title('Case studies')
              .schemaType('caseStudy')
              .child(
                S.documentTypeList('caseStudy')
                  .title('Case studies')
                  .defaultOrdering([{ field: 'year', direction: 'desc' }])
              ),

            S.divider(),

            S.listItem()
              .title('Team')
              .schemaType('teamMember')
              .child(
                S.documentTypeList('teamMember')
                  .title('Team')
                  /* Grid order, not alphabetical — this list should read the
                     way the about page does. */
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),
            S.listItem()
              .title('Testimonials')
              .schemaType('testimonial')
              .child(
                S.documentTypeList('testimonial')
                  .title('Testimonials')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),
            S.listItem()
              .title('Clients')
              .schemaType('client')
              .child(
                S.documentTypeList('client')
                  .title('Clients')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),
            S.listItem()
              .title('Milestones')
              .schemaType('milestone')
              .child(
                S.documentTypeList('milestone')
                  .title('Milestones')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),

            S.divider(),

            S.listItem()
              .title('FAQs')
              .schemaType('faq')
              .child(
                S.documentTypeList('faq')
                  .title('FAQs')
                  .defaultOrdering([
                    { field: 'scope', direction: 'asc' },
                    { field: 'order', direction: 'asc' },
                  ])
              ),
            S.listItem()
              .title('Images')
              .schemaType('artwork')
              .child(
                S.documentTypeList('artwork')
                  .title('Images')
                  .defaultOrdering([{ field: 'slot', direction: 'asc' }])
              ),

            S.divider(),

            /* Singletons: open the one document straight away rather than a
               list with a single row in it, and pin the id so a second can
               never be created by accident. */
            S.listItem()
              .title('Announcement bar')
              .id('announcement')
              .child(
                S.document()
                  .schemaType('announcement')
                  .documentId('announcement')
                  .title('Announcement bar')
              ),
            S.listItem()
              .title('Contact details')
              .id('contactDetails')
              .child(
                S.document()
                  .schemaType('contactDetails')
                  .documentId('contactDetails')
                  .title('Contact details')
              ),
            S.listItem()
              .title('Site copy')
              .id('siteCopy')
              .child(
                S.document().schemaType('siteCopy').documentId('siteCopy').title('Site copy')
              ),
          ]),
    }),

    /* GROQ playground. Useful when the loaders in the website repo need
       debugging; harmless for an editor who never opens it. */
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
});
