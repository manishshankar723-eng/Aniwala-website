/**
 * The Studio mirror — every form submission, copied into Sanity.
 *
 * WHY THIS RUNS HERE AND NOT IN THE BROWSER
 *
 * A Sanity write token is not scoped to a document type. Anything holding one
 * can rewrite or delete every blog post, case study and setting in the
 * dataset. So it cannot go anywhere near the page: the site's anon key is
 * public by design and protected by RLS, and there is no equivalent of RLS on
 * a Sanity token. This function already holds real secrets and is already
 * woken by the database on every write, which makes it the only sensible
 * place for the copy to be made.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * It is a READING ROOM. Supabase remains the source of truth: it has the row
 * policies, the column grants and the rate limiter, and it is what the site
 * and the Edge Functions read and write. The Sanity documents are a view of
 * that, for the person who lives in the Studio and should not need a second
 * dashboard and a second login to see who wrote in.
 *
 * It is NOT a control panel. Marking a mirrored comment approved in the
 * Studio publishes nothing — the blog reads approved comments from Supabase,
 * and nothing here writes back. That is why every field arrives read-only:
 * an editable copy of a record you cannot act on is a trap, and somebody
 * would eventually "approve" a comment in the Studio and wonder why the post
 * never changed. Approve from the email, or from the Supabase dashboard.
 *
 * ONE COPY OF PERSONAL DATA BECOMES TWO. Applications carry names, phone
 * numbers and CV links; enquiries carry client leads. Sanity has no
 * per-document permissions on the standard plans, so everybody invited to the
 * project can read all of it — worth remembering on the day somebody is
 * invited to write a blog post. A deletion request now has to be honoured in
 * both places, and the privacy policy should say so.
 *
 * AND IF THE DATASET IS PUBLIC, "everybody invited" is "everybody". That is
 * not a hypothetical — a Sanity dataset is public on creation. It is the
 * reason for `datasetIsPrivate()` below, which is the last thing standing
 * between this module and a public export of everyone who has ever contacted
 * the studio. Read its comment before touching it.
 *
 * TURNING IT OFF is not setting SANITY_WRITE_TOKEN. Every function that calls
 * this keeps working; the copy simply is not made.
 */

/* The Content Lake API version to mutate against. Pinned, like every other
   Sanity call in this project — an unpinned version is a behaviour change
   arriving on somebody else's schedule. */
const API_VERSION = Deno.env.get('SANITY_API_VERSION') ?? '2026-01-01';

interface SanityEnv {
  projectId: string;
  dataset: string;
  token: string;
}

function sanityEnv(): SanityEnv | null {
  const projectId = Deno.env.get('SANITY_PROJECT_ID');
  const token = Deno.env.get('SANITY_WRITE_TOKEN');
  if (!projectId || !token) return null;
  return { projectId, dataset: Deno.env.get('SANITY_DATASET') ?? 'production', token };
}

/** Whether the mirror is switched on at all. */
export const sanityConfigured = (): boolean => sanityEnv() !== null;

/* ------------------------------------------------------------------ */
/* The dataset has to be PRIVATE before any of this may run            */
/* ------------------------------------------------------------------ */

/**
 * REFUSE TO MIRROR INTO A PUBLICLY READABLE DATASET.
 *
 * A Sanity dataset can be public or private, and `production` is public on
 * creation. A public dataset answers an unauthenticated GROQ query from
 * anywhere on the internet — no token, no account, one curl.
 *
 * The project id and dataset name are not secret and cannot be made secret:
 * they are in the URL of every CMS image on the site
 * (`cdn.sanity.io/images/<projectId>/<dataset>/...`), so anybody who views
 * source has both halves of the address.
 *
 * Put those two facts together with what this module does — copy every
 * enquiry, booking, JOB APPLICATION (name, phone number, CV link) and comment
 * (including the author's email) into that dataset — and a public dataset
 * turns the mirror into a public export of everyone who has ever contacted
 * the studio.
 *
 * That is not a smaller version of the risk `schema.sql` already manages. It
 * is a way AROUND it. Section 4 of that file revokes every SELECT on
 * `applications` from anon specifically because the table "holds job
 * applicants' names, phone numbers and CV links, so a SELECT policy here
 * would be a personal-data breach, not just a lead leak". The RLS policies,
 * the column grants and the rate limiter all still hold — and none of them
 * reach a second copy sitting in a different vendor's database with no access
 * control on it at all.
 *
 * So the check lives HERE, at the write, rather than in a setup document.
 * README.md can say "set the dataset to private" and be right, and a year
 * from now somebody restoring a project, adding a dataset, or clicking
 * through Sanity's project wizard gets a public one by default and nothing
 * says otherwise. This is the thing that says otherwise.
 *
 * FAIL SAFE, NOT FAIL OPEN. The mirror is made only when the dataset has been
 * POSITIVELY CONFIRMED private. An inconclusive check — Sanity unreachable, a
 * timeout, a token that cannot read project metadata, an unrecognised response
 * — counts as unsafe and the copy is not made. The cost of being wrong in that
 * direction is a Studio list that is briefly out of date, against a permanent
 * disclosure of personal data in the other. Supabase is the source of truth
 * either way (see the header of this file), so nothing is lost.
 *
 * ASK SANITY WHAT THE DATASET IS, DO NOT INFER IT FROM A QUERY.
 *
 * The first version of this asked, unauthenticated, "can a stranger read a
 * document" and inferred public/private from the answer. That was wrong in a
 * way that testing caught: a private dataset answers an anonymous
 * `query=true` with `{"result":true}` and HTTP 200 — because `true` is a
 * constant GROQ expression that reads no documents, so it evaluates the same
 * whether or not the caller may see anything. The probe reported PUBLIC for a
 * dataset that was genuinely private, which fails in the SAFE direction here
 * (it refuses to mirror) but silently defeats the whole feature.
 *
 * The management API states the answer outright. `GET
 * api.sanity.io/.../projects/<id>/datasets` returns each dataset's `aclMode`,
 * which is exactly `"private"` or `"public"` — Sanity's own classification,
 * not something reconstructed from document visibility. It needs a token, and
 * this function already holds one, so it is asked WITH the token. (An
 * unauthenticated caller gets 401 from that endpoint, which is why it cannot
 * be used from the browser, only from here.)
 */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * The management API version for the datasets endpoint. A LITERAL, and
 * separate from `API_VERSION` above: that one versions the CONTENT API
 * (querying and mutating documents); this versions the PROJECTS API (reading
 * project and dataset metadata), which is a different surface with its own
 * dated versions. Pinned for the same reason everything else here is.
 */
const PROJECTS_API_VERSION = 'v2021-06-07';

/**
 * Cached only when the answer is PRIVATE.
 *
 * A "safe" verdict cannot go stale in a direction that hurts: a dataset that
 * was private when the isolate started and is made public later is a decision
 * somebody took deliberately, and the next cold isolate re-checks it. An
 * "unsafe" verdict is deliberately NOT cached, so that flipping the dataset to
 * private takes effect on the very next submission instead of waiting for the
 * isolate to recycle. Re-checking on the blocked path costs one request on a
 * path that is already refusing to do its work.
 */
let confirmedPrivate = false;

async function datasetIsPrivate(env: SanityEnv): Promise<boolean> {
  if (confirmedPrivate) return true;

  /* WITH the token — this is the management API, which 401s an anonymous
     caller. The token this function already holds can read project metadata. */
  const url = `https://api.sanity.io/${PROJECTS_API_VERSION}/projects/${env.projectId}/datasets`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.token}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(
      `sanity mirror: could not reach the Sanity projects API to check whether ` +
        `dataset "${env.dataset}" is private (${(err as Error).message}). Not ` +
        `mirroring — a copy of personal data is only written to a dataset confirmed ` +
        `private.`
    );
    return false;
  }

  if (!res.ok) {
    console.error(
      `sanity mirror: the Sanity projects API returned ${res.status} when asked ` +
        `whether dataset "${env.dataset}" is private, so it is unknown. Not mirroring. ` +
        `A 401/403 here means SANITY_WRITE_TOKEN cannot read project metadata — that ` +
        `is unusual for an Editor token and worth checking.`
    );
    return false;
  }

  let datasets: Array<{ name?: string; aclMode?: string }>;
  try {
    datasets = await res.json();
  } catch {
    console.error(
      `sanity mirror: could not parse the Sanity projects API response for dataset ` +
        `"${env.dataset}". Not mirroring.`
    );
    return false;
  }

  const match = Array.isArray(datasets)
    ? datasets.find((d) => d.name === env.dataset)
    : undefined;

  if (!match) {
    console.error(
      `sanity mirror: dataset "${env.dataset}" was not found on project ` +
        `${env.projectId}. Not mirroring.`
    );
    return false;
  }

  if (match.aclMode !== 'private') {
    console.error(
      `sanity mirror: REFUSING to copy submissions into dataset "${env.dataset}" ` +
        `on project ${env.projectId} — its aclMode is "${match.aclMode}", not ` +
        `"private", so the copy would publish names, email addresses, phone numbers ` +
        `and CV links to anyone who queries it. Nothing has been written. Fix it at ` +
        `sanity.io/manage -> API -> Datasets -> set "${env.dataset}" to Private. To ` +
        `turn the mirror off instead, unset SANITY_WRITE_TOKEN on the Edge Functions.`
    );
    return false;
  }

  confirmedPrivate = true;
  return true;
}

/* ------------------------------------------------------------------ */
/* Shaping a row into a document                                       */
/* ------------------------------------------------------------------ */

/** The four queues, which are three tables — an enquiry is two things. */
type Kind = 'booking' | 'brief' | 'application' | 'comment';

const str = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v);
  return s ? s : undefined;
};

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * The document id, derived from the Supabase row id.
 *
 * DERIVED, NOT RANDOM, and that is what makes this whole module safe to run
 * twice. Supabase retries a failed webhook three times with backoff, and an
 * UPDATE fires the same hook again — so a generated id would leave four
 * copies of one enquiry in the Studio, three of them stale, with nothing to
 * say which was current.
 *
 * The table is in the id as well as the uuid: uuids do not collide, but an id
 * somebody reads in the Studio should say what it is a copy of.
 */
const docId = (table: string, id: string) => `submission.${table}.${id}`;

/**
 * Turn one database row into the document the Studio shows.
 *
 * Every field is optional on the way out: an application has no slot, a
 * booking has no CV link, and writing explicit nulls for all of them would
 * fill the Studio's form with empty fields that look like something was lost.
 * `undefined` keys drop out of `JSON.stringify` — see the mutation below.
 */
function toDocument(table: string, row: Record<string, unknown>): Record<string, unknown> | null {
  const id = str(row.id);
  if (!id) return null;

  const base = {
    _id: docId(table, id),
    _type: 'submission',
    supabaseId: id,
    receivedAt: str(row.created_at),
    sourcePath: str(row.source_path),
  };

  if (table === 'enquiries') {
    /* The same column that decides whether an enquiry gets Confirm buttons
       decides which queue it lands in here. One rule, both places. */
    const kind: Kind = row.slot_utc ? 'booking' : 'brief';
    return {
      ...base,
      kind,
      status: str(row.status) ?? 'new',
      handled: row.handled === true,
      name: str(row.name),
      email: str(row.email),
      phone: str(row.phone),
      company: str(row.company),
      topic: str(row.enquiry_type),
      message: str(row.message),
      slotLabel: str(row.slot_label),
      slotUtc: str(row.slot_utc),
      durationMins: num(row.duration_mins),
      visitorTz: str(row.visitor_tz),
      meetingUrl: str(row.meeting_url),
      confirmedAt: str(row.confirmed_at),
      /* An array here rather than the stored comma-separated string: the
         column's shape is a constraint of the `submit` function (scalars
         only, so nothing caller-shaped reaches the service role key), and it
         has no business leaking into how the Studio displays a guest list. */
      guests: str(row.guest_emails)
        ?.split(',')
        .map((g) => g.trim())
        .filter(Boolean),
    };
  }

  if (table === 'applications') {
    const open = row.kind === 'open';
    return {
      ...base,
      kind: 'application' as Kind,
      status: row.handled === true ? 'handled' : 'new',
      handled: row.handled === true,
      name: str(row.name),
      email: str(row.email),
      phone: str(row.phone),
      /* Whichever of the two doors they came through, the heading is the
         same question: which job is this about. */
      topic: open ? str(row.desired_role) ?? 'Open application' : str(row.role_title),
      message: str(row.message),
      applicationKind: open ? 'open' : 'role',
      roleSlug: str(row.role_slug),
      discipline: str(row.discipline),
      location: str(row.location),
      experience: str(row.experience),
      availability: str(row.availability),
      portfolioUrl: str(row.portfolio_url),
      cvUrl: str(row.cv_url),
    };
  }

  if (table === 'comments') {
    return {
      ...base,
      kind: 'comment' as Kind,
      status: row.approved === true ? 'published' : 'pending',
      approved: row.approved === true,
      name: str(row.author_name),
      /* Deliberately mirrored, although the site's own SELECT grant withholds
         it from the public. The Studio is not the public — and an approved
         comment you cannot reply to is half a record. */
      email: str(row.author_email),
      topic: str(row.post_slug),
      postSlug: str(row.post_slug),
      message: str(row.body),
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

async function mutate(env: SanityEnv, mutations: unknown[]): Promise<void> {
  const url = `https://${env.projectId}.api.sanity.io/v${API_VERSION}/data/mutate/${env.dataset}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mutations }),
  });

  if (!res.ok) throw new Error(`Sanity ${res.status}: ${await res.text()}`);
}

/**
 * Copy one row into the Studio, or remove its copy.
 *
 * `createOrReplace` rather than `createIfNotExists` plus a patch, because the
 * document is a mirror and there is nothing on it an editor could have added
 * that would be worth preserving. It makes an INSERT, a retry of that INSERT
 * and every later UPDATE the same operation, which is the property that
 * matters when the caller is a webhook that fires more than once.
 *
 * THROWS. The decision about what a failure means belongs to the caller, and
 * it is genuinely different per event — see `notify`, where a failed mirror on
 * an INSERT must be swallowed (the retry would re-send the email) and a failed
 * mirror on an UPDATE should not be (there is no email, and the retry is free).
 */
export async function mirrorRow(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  row: Record<string, unknown>
): Promise<void> {
  const env = sanityEnv();
  if (!env) return;

  if (event === 'DELETE') {
    const id = str(row.id);
    if (!id) return;
    /* A rejected comment is deleted from the database, and its copy has to go
       with it — a mirror that outlives the thing it mirrors is worse than no
       mirror, because it reads as a comment still waiting for moderation.

       DELIBERATELY NOT BEHIND THE PUBLIC-DATASET CHECK BELOW. A delete only
       ever REMOVES personal data from the dataset, so it is safe on a public
       one and refusing it would be actively harmful: on the day somebody
       discovers the dataset is public, this is the operation that cleans up
       after it, and a guard that blocked it would pin the exposure in place. */
    await mutate(env, [{ delete: { id: docId(table, id) } }]);
    return;
  }

  const doc = toDocument(table, row);
  if (!doc) return;

  /* THE LAST THING BEFORE PERSONAL DATA LEAVES THIS FUNCTION. Everything
     above has built a document full of names, email addresses, phone numbers
     and CV links; this decides whether there is anywhere safe to put it.
     Silent no-op rather than a throw, exactly like an unset SANITY_WRITE_TOKEN
     — the mirror is optional and `notify` treats a thrown mirror differently
     per event, so failing loudly here would turn a configuration problem into
     a retrying webhook. The reason is on the console either way. */
  if (!(await datasetIsPrivate(env))) return;

  await mutate(env, [{ createOrReplace: doc }]);
}
