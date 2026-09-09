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
       mirror, because it reads as a comment still waiting for moderation. */
    await mutate(env, [{ delete: { id: docId(table, id) } }]);
    return;
  }

  const doc = toDocument(table, row);
  if (!doc) return;
  await mutate(env, [{ createOrReplace: doc }]);
}
