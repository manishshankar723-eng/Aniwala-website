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

/* Not secret. The project id appears in every cdn.sanity.io image URL the
   site serves. It is read from the environment so the same config can point
   at a scratch dataset without editing this file. */
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? 'PASTE-YOUR-SANITY-PROJECT-ID';
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
              .title('Case studies')
              .schemaType('caseStudy')
              .child(
                S.documentTypeList('caseStudy')
                  .title('Case studies')
                  .defaultOrdering([{ field: 'year', direction: 'desc' }])
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
