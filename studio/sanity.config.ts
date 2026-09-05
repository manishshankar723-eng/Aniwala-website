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
import { presentationTool } from 'sanity/presentation';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemas';
import { locations } from './resolve';


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

/**
 * Where the Presentation tool points its preview pane.
 *
 * OPTIONAL, and the tool is only registered when it is set. That is
 * deliberate: an unset URL would give an editor a "Preview" tab containing a
 * broken iframe, which is worse than no tab — they would reasonably conclude
 * the site was down rather than that a build step was missing.
 *
 * WHAT TO POINT IT AT. A build of the site made with `npm run build:preview`,
 * hosted somewhere. That build asks Sanity for the `raw` perspective, so it
 * shows UNPUBLISHED work, and it renders the preview bar on every page so
 * nobody mistakes it for the live site. Pointing this at aniwala.com instead
 * would technically work and would show only published content, which is the
 * one thing a preview is not for.
 *
 * It cannot be the local dev server for anybody but a developer — that is the
 * whole reason this exists. See README.
 */
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL;

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
              .title('Services')
              .schemaType('service')
              .child(
                S.documentTypeList('service')
                  .title('Services')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),
            S.listItem()
              .title('Portfolio disciplines')
              .schemaType('workCategory')
              .child(
                S.documentTypeList('workCategory')
                  .title('Portfolio disciplines')
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
            /* How a client hires the studio. One list, so every page that
               mentions "team extension" means the same thing by it. */
            S.listItem()
              .title('Engagement models')
              .schemaType('engagementModel')
              .child(
                S.documentTypeList('engagementModel')
                  .title('Engagement models')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),

            S.divider(),

            /*
             * Built pages — the page builder.
             *
             * A normal document list, because unlike everything else in this
             * sidebar these ARE created and deleted by the editor. That is the
             * point of the type.
             */
            S.listItem()
              .title('Built pages')
              .schemaType('page')
              .child(
                S.documentTypeList('page')
                  .title('Built pages')
                  .defaultOrdering([{ field: 'title', direction: 'asc' }])
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
            /*
             * Images, in one place.
             *
             * Most pictures on this site are NOT their own document — a blog
             * post's cover belongs to the post, a piece's still belongs to the
             * piece. That is right: an image without the thing it illustrates
             * is an orphan, and a separate "media" document type would mean
             * every cover needing two documents and a reference between them.
             *
             * But it left no way to answer "what does the site look like right
             * now", or "which case studies still have no picture" — you had to
             * open thirty documents to find out. So this is a VIEW rather than
             * a place: each row below is the same list you would reach from the
             * sidebar, showing the image as its thumbnail. A row with no
             * thumbnail is a gap, which is the question people actually have.
             *
             * Clicking through opens the document itself, so the image is
             * edited where it belongs, next to the words it sits with.
             *
             * Worth knowing separately: Sanity has a browser for every asset
             * ever uploaded, whether or not anything still uses it. It is
             * behind the "Select" button on any image field.
             */
            S.listItem()
              .title('Images')
              .id('images')
              .child(
                S.list()
                  .title('Images')
                  .items([
                    /* The only images that ARE their own documents: site
                       furniture, filed against a slot a page asks for by name. */
                    S.listItem()
                      .title('Site artwork')
                      .id('images-artwork')
                      .child(
                        S.documentTypeList('artwork')
                          .title('Site artwork')
                          .defaultOrdering([{ field: 'slot', direction: 'asc' }])
                      ),

                    S.divider(),

                    S.listItem()
                      .title('Blog covers')
                      .id('images-posts')
                      .child(
                        S.documentTypeList('post')
                          .title('Blog covers')
                          .defaultOrdering([{ field: 'pubDate', direction: 'desc' }])
                      ),
                    S.listItem()
                      .title('Case study covers')
                      .id('images-case-studies')
                      .child(
                        S.documentTypeList('caseStudy')
                          .title('Case study covers')
                          .defaultOrdering([{ field: 'year', direction: 'desc' }])
                      ),
                    S.listItem()
                      .title('Portfolio pieces')
                      .id('images-pieces')
                      .child(
                        S.documentTypeList('piece')
                          .title('Portfolio pieces')
                          .defaultOrdering([{ field: 'order', direction: 'asc' }])
                      ),
                    S.listItem()
                      .title('Team photos')
                      .id('images-team')
                      .child(
                        S.documentTypeList('teamMember')
                          .title('Team photos')
                          .defaultOrdering([{ field: 'order', direction: 'asc' }])
                      ),
                    S.listItem()
                      .title('Client logos')
                      .id('images-clients')
                      .child(
                        S.documentTypeList('client')
                          .title('Client logos')
                          .defaultOrdering([{ field: 'order', direction: 'asc' }])
                      ),
                  ])
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
            /* The header and footer menus. Kept next to the other settings
               rather than up with the content, because it is opened when the
               shape of the site changes and not otherwise. */
            S.listItem()
              .title('Careers page')
              .id('careersContent')
              .child(
                S.document()
                  .schemaType('careersContent')
                  .documentId('careersContent')
                  .title('Careers page')
              ),
            S.listItem()
              .title('Book a call')
              .id('bookingSettings')
              .child(
                S.document()
                  .schemaType('bookingSettings')
                  .documentId('bookingSettings')
                  .title('Book a call')
              ),
            S.listItem()
              .title('Loading screen')
              .id('loaderSettings')
              .child(
                S.document()
                  .schemaType('loaderSettings')
                  .documentId('loaderSettings')
                  .title('Loading screen')
              ),
            S.listItem()
              .title('Menus')
              .id('navigation')
              .child(
                S.document().schemaType('navigation').documentId('navigation').title('Menus')
              ),
            /*
             * Redirects.
             *
             * A list, not a singleton, and filed with the settings rather than
             * the content: it is opened when a URL changes and not otherwise.
             * The build refuses to ship a rule that would hide a real page —
             * see src/integrations/redirects.mjs.
             */
            S.listItem()
              .title('Redirects')
              .schemaType('redirect')
              .child(
                S.documentTypeList('redirect')
                  .title('Redirects')
                  .defaultOrdering([{ field: 'from', direction: 'asc' }])
              ),
            /* The header logo and the browser icon. Next to the other
               settings rather than up with the content: it is opened when the
               brand changes and not otherwise. */
            S.listItem()
              .title('Logo & icons')
              .id('brand')
              .child(
                S.document().schemaType('brand').documentId('brand').title('Logo & icons')
              ),
            S.listItem()
              .title('Site copy')
              .id('siteCopy')
              .child(
                S.document().schemaType('siteCopy').documentId('siteCopy').title('Site copy')
              ),
            /* Every word the site says that is not attached to a piece of
               content — card labels, empty states, the two blog rails, the
               404 and the names screen readers give to the icon buttons.
               Grouped into tabs, because it is one document of about two
               hundred strings and a flat list of those is unusable. */
            S.listItem()
              .title('Interface copy')
              .id('uiCopy')
              .child(
                S.document().schemaType('uiCopy').documentId('uiCopy').title('Interface copy')
              ),
            /* The policy is prose, so it gets a body rather than fifty
               fields. Its address and inbox are filled in from Contact
               details — see the schema for the tokens. */
            S.listItem()
              .title('Privacy policy')
              .id('privacyPage')
              .child(
                S.document()
                  .schemaType('privacyPage')
                  .documentId('privacyPage')
                  .title('Privacy policy')
              ),
          ]),
    }),

    /**
     * The preview pane.
     *
     * Registered only when a preview URL is configured — see `previewUrl`.
     * `resolve.locations` is what makes it useful rather than decorative: it
     * tells the tool which page a document appears on, so opening a blog post
     * lands on that post instead of the home page and asking the editor to
     * navigate to their own work.
     *
     * There is no `previewMode` block. That enables Sanity's draft-mode
     * handshake, which needs a server route to set a cookie — and this site is
     * static output on Apache, with no server to route to. Drafts are visible
     * because the preview BUILD asks for them, not because the browser did.
     */
    ...(previewUrl
      ? [presentationTool({ previewUrl, resolve: { locations } })]
      : []),

    /* GROQ playground. Useful when the loaders in the website repo need
       debugging; harmless for an editor who never opens it. */
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
});
