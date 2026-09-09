/**
 * Sanity CLI config — used by `sanity dev`, `sanity build` and `sanity deploy`.
 *
 * `studioHost` is what fixes the deployed address at aniwala.sanity.studio
 * rather than prompting for a hostname on first deploy.
 */
import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '20wlzfea',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  studioHost: 'aniwala',

  /*
   * Which deployed application this Studio IS.
   *
   * Without it `sanity deploy` prompts for an application id, which is fine
   * for a person at a keyboard and fatal anywhere else — a non-interactive
   * run has nobody to answer, and the obvious "fix" under pressure is to pick
   * whichever option is highlighted. Pinning it means the deploy always
   * updates aniwala.sanity.studio rather than possibly creating a second,
   * near-identical Studio that half the bookmarks then point at.
   *
   * Reported by the CLI on the v6 deploy, 2026-09-09.
   */
  deployment: {
    appId: 'pwez2hv7cdh41cpqli7rfppq',
  },
});
