/**
 * Is the Sanity dataset readable by strangers, and is anything private in it?
 *
 * WHY THIS IS A BUILD CHECK AND NOT A LINE IN THE README
 *
 * A Sanity dataset is public or private, and a new one is PUBLIC. Public means
 * an unauthenticated GROQ query from anywhere on the internet is answered in
 * full — no token, no account, one curl.
 *
 * The address is not secret and cannot be made secret. Every CMS image on the
 * site is served from `cdn.sanity.io/images/<projectId>/<dataset>/...`, so the
 * project id and the dataset name are in the HTML of ~66 pages. Anybody who
 * views source has everything they need to query it.
 *
 * On its own that is fine: the documents in there are the website's content,
 * which is public the moment it is published. What is NOT fine is the Studio
 * mirror — with `SANITY_WRITE_TOKEN` set on the Edge Functions, the `notify`
 * function copies every enquiry, booking, job application and comment into
 * this same dataset as a `submission` document. Those carry names, email
 * addresses, phone numbers and CV links.
 *
 * `supabase/functions/_shared/sanity.ts` now refuses to write that copy into a
 * public dataset, which is the thing that actually stops the leak. This check
 * is the other half: the guard prevents it silently, per submission, in a log
 * nobody reads, and a guard whose refusal is invisible is one somebody
 * eventually "fixes" by deleting it. This says it out loud on every build.
 *
 * TWO OUTCOMES, AND THEY ARE NOT THE SAME SEVERITY
 *
 *   Public dataset, submission documents present  -> FAIL.
 *     Personal data is being served to anonymous callers right now. This is
 *     not a warning; it is an incident, and the build should stop.
 *
 *   Public dataset, no submission documents       -> WARN.
 *     Nothing is exposed and the write guard means nothing will be. Failing
 *     here would block every deploy over a setting that is not currently
 *     hurting anybody, which is how a check gets disabled. Same reasoning as
 *     the Supabase key warning in .github/workflows/deploy.yml.
 *
 * The fix for both is the same: sanity.io/manage -> API -> Datasets -> set the
 * dataset to Private. Check SANITY_READ_TOKEN is a GitHub Actions secret
 * first, because a private dataset is what makes the build need it.
 *
 * NO CREDENTIALS ARE SENT. The question is what an anonymous caller can read,
 * so the request has to be made the way an anonymous caller would make it.
 * Sending the token would make every dataset look readable and the check would
 * pass forever.
 */
import { readFileSync } from 'node:fs';

/*
 * Put `.env` into `process.env`, the same six lines and for the same reason as
 * `astro.config.mjs` — this runs as a bare node script, so nothing else has
 * loaded it. In CI there is no `.env` and the values arrive in the job
 * environment instead, so this finds nothing and changes nothing. An existing
 * environment variable always wins.
 *
 * Without it the check runs locally against an empty environment, prints
 * "nothing to check", and passes — which is the worst possible behaviour for a
 * check about an open door.
 */
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^["']|["']$/g, '');
    if (value && !process.env[key]) process.env[key] = value;
  }
} catch {
  /* No .env — normal in CI. */
}

const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET || 'production';
const API_VERSION = process.env.SANITY_API_VERSION || '2026-01-01';
const TIMEOUT_MS = 15_000;

const READ_TOKEN = process.env.SANITY_READ_TOKEN;

/** Thrown to end the check early when a verdict has already been printed. */
const DONE = Symbol('done');

/**
 * `fetch` with a timeout that does not outlive the request.
 *
 * AN EXPLICIT CONTROLLER, NOT `AbortSignal.timeout()`, which leaves a live
 * timer on the event loop until it fires; exiting while one is pending once
 * crashed Node on Windows (libuv assertion, exit 127) AFTER the verdict was
 * printed. Cleared in `finally` so nothing is left to trip over.
 *
 * Returns the parsed JSON body, or `null` on any transport/parse failure —
 * the callers decide what an unreadable answer means.
 */
async function getJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The AUTHORITATIVE answer: what does Sanity itself say this dataset is?
 *
 * The management API reports each dataset's `aclMode` — literally "private" or
 * "public" — rather than leaving it to be inferred from whether a query
 * happens to return rows. It needs a token (an anonymous caller gets 401), so
 * this runs only when SANITY_READ_TOKEN is present, which it is in CI and in a
 * local `.env`.
 *
 * Returns 'private' | 'public', or null when it cannot be determined (no
 * token, endpoint error, dataset not listed) — in which case the caller falls
 * back to the anonymous readability probe below.
 */
async function datasetAclMode() {
  if (!READ_TOKEN) return null;
  const url = `https://api.sanity.io/v2021-06-07/projects/${PROJECT_ID}/datasets`;
  const r = await getJson(url, { headers: { Authorization: `Bearer ${READ_TOKEN}` } });
  if (!r || r.status !== 200 || !Array.isArray(r.body)) return null;
  const match = r.body.find((d) => d && d.name === DATASET);
  return match && typeof match.aclMode === 'string' ? match.aclMode : null;
}

/**
 * The anonymous fallback: run a GROQ count with no credentials.
 *
 * `count(*)` is a real readability test — it reads documents, so a private
 * dataset answers 0 and a public one answers its document total. (The earlier
 * probe, `query=true`, was a constant that returned `true` on a private
 * dataset too, and reported it public — the bug this replaced.)
 *
 * Returns the number, or null when the dataset is not readable without a token
 * (401/403/404) — which is itself the "private" signal. Throws DONE when the
 * API is simply unreachable, since that is evidence of nothing.
 */
async function anonCount(groq) {
  const url =
    `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}` +
    `/data/query/${DATASET}?query=${encodeURIComponent(groq)}`;
  const r = await getJson(url);
  if (!r) {
    console.log('  skip    could not reach Sanity — check not run.');
    throw DONE;
  }
  if (r.status === 401 || r.status === 403 || r.status === 404) return null;
  if (r.body && typeof r.body.result === 'number') return r.body.result;
  console.log(`  skip    Sanity answered ${r.status} — readability unknown, check not run.`);
  throw DONE;
}

/** Public dataset: fail if submissions are exposed, warn if not. */
async function reportPublic() {
  const exposed = await anonCount('count(*[_type == "submission"])');

  if (typeof exposed !== 'number' || exposed === 0) {
    console.log(
      `::warning::Sanity dataset "${DATASET}" is publicly readable. Nothing personal is ` +
        `exposed (0 submission documents), and supabase/functions/_shared/sanity.ts refuses ` +
        `to mirror submissions into a public dataset — so this is latent, not live. Set the ` +
        `dataset to Private at sanity.io/manage -> API -> Datasets to close it properly, ` +
        `after confirming SANITY_READ_TOKEN is a GitHub Actions secret.`
    );
    console.log(`  warn    dataset "${DATASET}" is public, but no submissions are exposed.`);
    return 0;
  }

  console.error(`::error::${exposed} form submission(s) are readable by anyone, with no credentials.`);
  console.error('');
  console.error(`  Sanity project ${PROJECT_ID}, dataset "${DATASET}", is PUBLIC, and the`);
  console.error(`  Studio mirror has copied ${exposed} submission(s) into it. Those documents`);
  console.error('  carry names, email addresses, phone numbers and CV links, and anyone can');
  console.error('  read them:');
  console.error('');
  console.error(`    curl 'https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=*%5B_type%3D%3D%22submission%22%5D'`);
  console.error('');
  console.error('  The project id and dataset name are in every CMS image URL on the site,');
  console.error('  so this is not obscure — it is two clicks from viewing source.');
  console.error('');
  console.error('  TO FIX, in this order:');
  console.error('    1. Confirm SANITY_READ_TOKEN is set as a GitHub Actions secret. A');
  console.error('       private dataset is what makes the build need it, and without it the');
  console.error('       next build fails (safely — deploy is gated on verify).');
  console.error('    2. sanity.io/manage -> API -> Datasets -> set it to Private.');
  console.error('    3. Re-run this check, and confirm CMS images still render.');
  console.error('');
  console.error('  Then treat what was exposed as disclosed: anything published to an');
  console.error('  anonymous endpoint should be assumed to have been read.');
  return 1;
}

async function main() {
  /* Nothing to check. Matches how the rest of the build treats an
     unconfigured Sanity — `astro build` fails on its own if content is
     genuinely required, so this one has no business being the thing that
     stops a fresh clone. */
  if (!PROJECT_ID) {
    console.log('  skip    SANITY_PROJECT_ID is not set — nothing to check.');
    return 0;
  }

  /* PRIMARY: ask Sanity outright. Unambiguous when a token is available. */
  const mode = await datasetAclMode();
  if (mode === 'private') {
    console.log(`  ok      dataset "${DATASET}" is private (Sanity aclMode).`);
    return 0;
  }
  if (mode === 'public') return reportPublic();

  /* FALLBACK: no token, or the metadata call was inconclusive. Ask anonymously
     whether any document is readable. On a private dataset this is 0 (or a
     401/403/404 → null); on a public one it is the document total. */
  const n = await anonCount('count(*)');
  if (n === null || n === 0) {
    console.log(`  ok      dataset "${DATASET}" is not readable without a token.`);
    return 0;
  }
  return reportPublic();
}

/*
 * `process.exitCode`, NEVER `process.exit()`.
 *
 * `process.exit()` tears the event loop down immediately. Called straight
 * after a `fetch`, while undici still holds a keep-alive socket, that crashes
 * Node on Windows:
 *
 *   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING),
 *     file src\win\async.c, line 76
 *
 * with exit code 127 — AFTER the verdict has already been printed. That is
 * the worst possible shape for a bug in a security check: it does its job,
 * says the dataset is fine, and then fails the build anyway, on the SAFE
 * path, for a reason that has nothing to do with what it was checking. It
 * cost a green local run and a red CI run to find, which is the wrong way
 * round for a check meant to make people trust it.
 *
 * Setting the code and letting the process end on its own leaves the sockets
 * to close themselves.
 */
try {
  process.exitCode = await main();
} catch (err) {
  if (err === DONE) process.exitCode = 0;
  else throw err;
}
