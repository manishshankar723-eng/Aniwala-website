/**
 * Build the site as a PREVIEW: unpublished drafts visible, nothing indexable.
 *
 * A one-line wrapper rather than `SANITY_PREVIEW=1 astro build` in the npm
 * script, because that syntax is a shell-ism: it works in bash and fails on
 * Windows `cmd`, and this repo is developed on Windows. Setting the variable
 * in Node makes the same command work everywhere without adding cross-env.
 *
 * THE LIVE BUILD MUST NOT USE THIS. `npm run build` is the production one and
 * never sets SANITY_PREVIEW, so the Sanity client asks for the `published`
 * perspective and the API itself refuses to send a draft. Preview safety does
 * not rest on this file — it rests on that.
 */
import { spawnSync } from 'node:child_process';

if (!process.env.SANITY_READ_TOKEN) {
  console.warn(
    '\n  ! SANITY_READ_TOKEN is not set, so this preview will show exactly what the\n' +
      '    live site shows. Drafts are private; reading them needs a Viewer token.\n' +
      '    Create one at sanity.io/manage -> API -> Tokens.\n'
  );
}

const result = spawnSync('npx', ['astro', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SANITY_PREVIEW: '1' },
});

process.exit(result.status ?? 1);
