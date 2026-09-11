/**
 * backup — hands the whole intake back as one JSON document, for archiving.
 *
 * WHY THIS EXISTS
 *
 * There were no backups of anything. Every enquiry, every job application and
 * every comment this site has ever received existed in exactly one place, and
 * the recovery plan for a dropped table, a bad migration or a lost account was
 * that there wasn't one. The Sanity mirror (`_shared/sanity.ts`) softened that
 * by accident — it is a second copy — but it is a SUMMARY written for reading
 * in the Studio, not a record, and restoring from it would lose columns.
 *
 * ------------------------------------------------------------------
 * WHY A FUNCTION AND NOT `pg_dump` FROM THE WORKFLOW
 *
 * This is the whole design decision, and it is worth the extra file.
 *
 * The obvious way to back up a Supabase project from CI is to put the service
 * role key (or the database password) into GitHub Actions secrets and dump
 * from there. That would work on the first run and would quietly undo the one
 * property this codebase has been most careful about: THE SERVICE ROLE KEY
 * LIVES IN THE EDGE FUNCTION ENVIRONMENT AND NOWHERE ELSE. It bypasses RLS,
 * every column grant in schema.sql and the rate limiter. Copying it into a
 * second system doubles the number of places a total compromise can start,
 * and CI secrets are reachable by anything that can change a workflow file.
 *
 * So the key stays put and the CAPABILITY is what travels: this function holds
 * the key, a separate `BACKUP_SECRET` opens this function, and that secret can
 * do exactly one thing — read the intake. Losing it is bad. It is not the same
 * order of bad as losing the service role key, and that difference is the
 * point.
 *
 * Deploy:  supabase functions deploy backup --no-verify-jwt
 *
 * `--no-verify-jwt` because the caller is a GitHub Actions runner with no
 * Supabase session, exactly as with `notify`. The authorisation is the shared
 * secret checked below, before anything is read.
 *
 *   supabase secrets set BACKUP_SECRET="$(openssl rand -base64 48)" --project-ref <ref>
 *
 * ------------------------------------------------------------------
 * THIS ENDPOINT RETURNS EVERY LEAD YOU HAVE. Treat it accordingly:
 *
 *   - NO CORS HEADERS, deliberately. Nothing in a browser should ever call
 *     this, so there is no origin to allow. A missing Access-Control-Allow-
 *     Origin means a page that tries cannot read the answer.
 *   - POST only, so a link to it in a mail client or a scanner does nothing.
 *   - Every call is logged, success or failure. An export nobody made is the
 *     single loudest signal available that the secret has gone, and a log with
 *     only failures in it would hide exactly the case that matters.
 */
import { safeEqual } from '../_shared/util.ts';

/**
 * What gets archived, and what deliberately does not.
 *
 * `submission_log` is absent: it is rate-limit bookkeeping that is purged
 * after seven days by design, it holds IP addresses (personal data with no
 * business value once the window has passed), and nothing is recoverable from
 * it. Backing it up would mean keeping addresses for 90 days that the
 * database itself throws away after 7 — the opposite of what the purge is for.
 */
const TABLES = ['enquiries', 'applications', 'comments'] as const;

/** PostgREST pages large responses; 1000 is its usual ceiling per request. */
const PAGE = 1000;

/**
 * The daily ceilings from schema.sql section 5, repeated here to be compared
 * against. Change one there and change it here, or the tripwire below reports
 * pressure against a limit that is no longer the limit.
 *
 *   enquiries    trigger('3', '60', '40', '20')  -> 20/day
 *   comments     trigger('5', '60', '60', '30')  -> 30/day
 *   applications trigger('5', '1440', '20')      -> 20 per 24h window
 */
const DAILY_CEILING: Record<string, number> = {
  enquiries: 20,
  comments: 30,
  applications: 20,
};

/**
 * HOW CLOSE THE FORMS ARE TO REFUSING PEOPLE.
 *
 * The rate limiter is silent by design — schema.sql argues, correctly, that an
 * attacker should learn nothing from being blocked. But silence toward the
 * attacker was implemented as silence toward EVERYBODY, so the sequence
 * "script hammers the forms -> ceiling holds -> real enquiries start bouncing"
 * had no observer at all. The defence worked and nobody knew it had fired.
 *
 * WHY THIS IS DERIVED AND NOT LOGGED AT THE MOMENT OF REFUSAL.
 *
 * The natural design is a `security_event` row written by the trigger just
 * before it raises. It cannot work, for the reason schema.sql already gives
 * about its own log: `raise exception` rolls the statement back, and that
 * takes any row written in the same transaction with it. Logging a refusal
 * from inside the thing doing the refusing is self-erasing.
 *
 * What IS durable is `submission_log`, because those rows are written on the
 * SUCCESS path and commit normally. So pressure is measured rather than
 * reported: submissions accepted in the last 24 hours, against the ceiling
 * that would start refusing them. At 100% the forms are turning people away.
 *
 * The blind spot is honest and worth stating: refusals themselves are not
 * counted, so a sustained attack reads as a pegged ceiling rather than as
 * ten thousand blocked attempts. It tells you the forms are closed. It does
 * not tell you how hard somebody is pushing on them.
 */
async function intakePressure(
  supabaseUrl: string,
  headers: Record<string, string>
): Promise<Record<string, { accepted24h: number; ceiling: number; pctOfCeiling: number }>> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const out: Record<string, { accepted24h: number; ceiling: number; pctOfCeiling: number }> = {};

  for (const [kind, ceiling] of Object.entries(DAILY_CEILING)) {
    /* `Prefer: count=exact` with a zero-width range asks PostgREST for the
       count in the Content-Range header without transferring any rows. */
    const res = await fetch(
      `${supabaseUrl}/rest/v1/submission_log?select=id&kind=eq.${kind}&at=gt.${since}`,
      { headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } }
    );
    if (!res.ok) throw new Error(`submission_log ${res.status} ${await res.text()}`);

    // "0-0/37" — the total is what matters, and it is after the slash.
    const total = Number(res.headers.get('content-range')?.split('/')[1] ?? '0');
    out[kind] = {
      accepted24h: total,
      ceiling,
      pctOfCeiling: ceiling > 0 ? Math.round((total / ceiling) * 100) : 0,
    };
  }

  return out;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  /* ---------- authenticate BEFORE reading anything ---------- */
  const expected = Deno.env.get('BACKUP_SECRET');
  if (!expected) {
    console.error('backup is missing BACKUP_SECRET');
    return json(500, { error: 'Not configured' });
  }

  // `safeEqual`, not `!==` — the same reasoning as the notify webhook. A
  // string comparison that short-circuits leaks how much of a guess was
  // right, which turns an infeasible search into a feasible one.
  if (!safeEqual(req.headers.get('x-backup-secret') ?? '', expected)) {
    // Logged, and logged with the address, because a failed attempt here is
    // somebody probing an endpoint that returns every lead in the business.
    console.warn(
      'backup: REJECTED an unauthenticated request from',
      req.headers.get('cf-connecting-ip') ?? 'unknown'
    );
    return json(401, { error: 'Unauthorized' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('backup is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return json(500, { error: 'Not configured' });
  }

  /*
   * SUCCESS IS LOGGED TOO, and it is the more important of the two lines.
   *
   * A backup runs on a schedule, so the log should show one of these a day at
   * a predictable hour. Two in a day, or one at 3am, is the shape of somebody
   * else holding the secret — and that is only visible if the ordinary case
   * is recorded as well.
   */
  console.log('backup: authorised export starting');

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const out: Record<string, unknown[]> = {};

  try {
    for (const table of TABLES) {
      const rows: unknown[] = [];

      /*
       * PAGED, because PostgREST caps a response and a silently truncated
       * backup is worse than no backup: it restores cleanly and is missing
       * the newest rows, which are the ones somebody is looking for.
       */
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/${table}?select=*&order=created_at.asc&limit=${PAGE}&offset=${offset}`,
          { headers }
        );
        if (!res.ok) throw new Error(`${table} ${res.status} ${await res.text()}`);

        const page = (await res.json()) as unknown[];
        rows.push(...page);
        if (page.length < PAGE) break;
      }

      out[table] = rows;
    }
  } catch (err) {
    console.error('backup failed:', err);
    // The workflow turns any non-200 into a failed run, which is the alert.
    return json(500, { error: 'Export failed' });
  }

  const counts = Object.fromEntries(Object.entries(out).map(([t, r]) => [t, r.length]));
  console.log('backup: exported', JSON.stringify(counts));

  /*
   * Pressure is best-effort and must NEVER take the backup down with it. The
   * archive is the job; the tripwire is a passenger, and a passenger that can
   * cancel the flight is worse than no passenger. A null here means "not
   * measured", which the workflow reports rather than treating as healthy.
   */
  let pressure: unknown = null;
  try {
    pressure = await intakePressure(supabaseUrl, headers);
    console.log('backup: intake pressure', JSON.stringify(pressure));
  } catch (err) {
    console.error('backup: could not measure intake pressure:', err);
  }

  return json(200, {
    /* Stamped so a restored file can be dated without trusting its filename. */
    exported_at: new Date().toISOString(),
    schema_note: 'Full row export. Restore guidance in .github/workflows/backup.yml.',
    counts,
    /* Not part of the archive — see intakePressure(). Read by the workflow to
       decide whether the forms are near refusing people. */
    intake_pressure: pressure,
    data: out,
  });
});
