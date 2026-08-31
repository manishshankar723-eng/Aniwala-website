/**
 * Sanity CLI config — used by `sanity dev`, `sanity build` and `sanity deploy`.
 *
 * `studioHost` is what fixes the deployed address at aniwala.sanity.studio
 * rather than prompting for a hostname on first deploy.
 */
import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? 'PASTE-YOUR-SANITY-PROJECT-ID',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  studioHost: 'aniwala',
});
