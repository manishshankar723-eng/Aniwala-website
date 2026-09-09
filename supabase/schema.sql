-- =====================================================================
-- Aniwala website — Supabase schema
--
-- Run this once, whole, in the Supabase dashboard: SQL Editor -> New query
-- -> paste -> Run. It is safe to re-run; every statement is guarded.
--
-- RUN IT WITH NOTHING ELSE OPEN ON THESE TABLES. The file reshapes four
-- tables, and the locks it needs wait behind anything that is reading them —
-- another SQL Editor tab, a Table Editor view, the schema visualiser. Two
-- sessions taking the same tables in opposite orders is a deadlock, and
-- Postgres resolves it by killing one:
--
--   ERROR: 40P01: deadlock detected
--
-- That is not a fault in this file and nothing is half-applied when it
-- happens: the editor sends the whole script as one batch, so Postgres runs
-- it in a single implicit transaction and rolls all of it back. Close the
-- other tabs and run it again.
--
-- ---------------------------------------------------------------------
-- READ THIS BEFORE CHANGING ANYTHING
--
-- The website is static files. It talks to Supabase directly from the
-- visitor's browser using the ANON key, which is PUBLIC — it ships inside
-- the JavaScript bundle and anyone can read it. That is how Supabase is
-- designed to work, and it is only safe because of the Row Level Security
-- policies below.
--
-- RLS is the entire security model here. There is no server in front of it.
-- If you disable RLS on a table, or add a permissive SELECT policy to
-- `enquiries`, every business lead you have ever received becomes readable
-- by anyone who views source. Treat the policies in this file as load
-- bearing.
--
-- The rules that must stay true:
--   1. enquiries  — anon may INSERT. anon may NEVER SELECT, UPDATE, DELETE.
--   2. comments   — anon may INSERT only with approved = false, and may
--                   SELECT only rows where approved = true.
--   3. applications — anon may INSERT. anon may NEVER SELECT, UPDATE,
--                   DELETE. This one holds job applicants' names, phone
--                   numbers and CV links, so a SELECT policy here would be
--                   a personal-data breach, not just a lead leak.
--   4. Column grants, not just row policies. RLS controls which ROWS are
--      visible; the GRANTs in section 4 control which COLUMNS. Commenter
--      email addresses are readable by neither.
--
-- You read enquiries in the Supabase dashboard (Table Editor), which uses
-- the service key and bypasses RLS. Never put the service key in this repo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ENQUIRIES — booking requests and contact form submissions
-- ---------------------------------------------------------------------
create table if not exists public.enquiries (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  name           text not null check (char_length(name) between 1 and 120),
  email          text not null check (char_length(email) between 3 and 200),
  phone          text check (char_length(phone) <= 40),
  company        text check (char_length(company) <= 160),

  -- Which service the enquiry is about. Free text rather than an enum so
  -- renaming a service in config/services.ts cannot break the form.
  enquiry_type   text check (char_length(enquiry_type) <= 80),
  message        text check (char_length(message) <= 4000),

  -- Booking specifics. Null on a plain contact enquiry.
  duration_mins  int check (duration_mins between 5 and 240),
  slot_label     text check (char_length(slot_label) <= 200),
  slot_utc       timestamptz,
  visitor_tz     text check (char_length(visitor_tz) <= 80),

  -- Who else is coming, comma separated.
  --
  -- ONE TEXT COLUMN AND NOT text[], deliberately. The `submit` Edge Function
  -- refuses any field that is not a scalar, so that a caller-shaped object can
  -- never reach the layer holding the service role key. An array column would
  -- mean carving an exception into that rule for the one field a stranger gets
  -- to fill with addresses. A string keeps the rule whole and costs one split
  -- — see `parseGuests` in functions/_shared/util.ts, which is the only thing
  -- that reads it.
  guest_emails   text check (char_length(guest_emails) <= 500),

  -- Which page it came from, so you can tell a service-page enquiry from a
  -- homepage one without asking.
  source_path    text check (char_length(source_path) <= 300),

  -- ------------------------------------------------------------------
  -- Where the booking has got to.
  --
  -- Only the `schedule` Edge Function writes these, as service_role, after
  -- verifying the HMAC on the link in the notification email. Anon is granted
  -- none of them, and the insert policy below pins the starting state, so a
  -- crafted submission cannot arrive pre-confirmed with a meeting link of
  -- somebody else's choosing in it.
  -- ------------------------------------------------------------------
  status         text not null default 'new'
                   check (status in ('new', 'confirmed', 'declined')),
  confirmed_at   timestamptz,
  meeting_url    text check (char_length(meeting_url) <= 500),

  -- The .ics SEQUENCE, bumped on every re-send.
  --
  -- Load bearing, and invisible until it is missing: a calendar that has
  -- already accepted an invitation IGNORES an update whose SEQUENCE has not
  -- moved. Without this column, correcting a meeting link or resending to an
  -- added guest would appear to work everywhere except the calendars it was
  -- meant to correct.
  invite_seq     int not null default 0,

  -- Set by hand in the dashboard as you work through them.
  handled        boolean not null default false
);

-- Safe to re-run against a database created before phone existed. The contact
-- form asks for one; the booking widget does not, and leaves it null.
alter table public.enquiries
  add column if not exists phone text check (char_length(phone) <= 40);

-- Same, for a database created before the booking flow could confirm itself.
-- Existing rows land on 'new', which is exactly right: nothing that predates
-- the Confirm button was ever confirmed through it.
--
-- ONE STATEMENT, FIVE COLUMNS, and that is not a matter of neatness. Every
-- `alter table` takes an ACCESS EXCLUSIVE lock — the strongest there is, and
-- one that waits behind any open read. Five of them in a row is five chances
-- to collide with whatever else is touching this table, and the first run of
-- this file after the booking work went in died exactly that way:
--
--   ERROR: 40P01: deadlock detected
--
-- A dashboard tab left open on the Table Editor is enough to cause it. One
-- statement takes the lock once and lets go once.
alter table public.enquiries
  add column if not exists guest_emails text check (char_length(guest_emails) <= 500),
  add column if not exists status       text not null default 'new',
  add column if not exists confirmed_at timestamptz,
  add column if not exists meeting_url  text check (char_length(meeting_url) <= 500),
  add column if not exists invite_seq   int not null default 0;

-- The CHECK is added separately: `add column if not exists` skips its
-- constraint entirely on a table that already has the column, so a database
-- upgraded in two steps would otherwise be left with an unconstrained status.
do $$
begin
  alter table public.enquiries
    add constraint enquiries_status_check
    check (status in ('new', 'confirmed', 'declined'));
exception when duplicate_object then
  null;
end
$$;

comment on table public.enquiries is
  'Website enquiries and booking requests. Anon may INSERT only — never add a SELECT policy.';

alter table public.enquiries enable row level security;

-- The queue you actually work through: unconfirmed bookings, newest first.
create index if not exists enquiries_status_created_idx
  on public.enquiries (status, created_at desc);

-- Anyone may submit an enquiry.
drop policy if exists "anon can submit enquiries" on public.enquiries;
create policy "anon can submit enquiries"
  on public.enquiries
  for insert
  to anon
  with check (
    -- A submission cannot pre-mark itself handled.
    handled = false
    -- Nor pre-confirm itself. The column grants below already withhold
    -- `status`, so this is the second lock on the same door — and it is the
    -- one that keeps holding if somebody ever widens the grants without
    -- reading this far.
    and status = 'new'
    and confirmed_at is null
  );

-- NO select / update / delete policy for anon. This omission is deliberate
-- and is what keeps your leads private. Do not "fix" it.


-- ---------------------------------------------------------------------
-- 2. COMMENTS — blog post discussion, held for approval
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- Matches the post's folder name, e.g. 'we-quote-in-shots-not-days'.
  post_slug    text not null check (char_length(post_slug) between 1 and 200),

  author_name  text not null check (char_length(author_name) between 1 and 80),
  author_email text check (char_length(author_email) <= 200),
  body         text not null check (char_length(body) between 2 and 4000),

  -- Nothing appears on the site until you flip this in the dashboard. This
  -- is the actual spam control — client-side honeypots are a speed bump.
  approved     boolean not null default false
);

-- Safe to re-run against a database created before author_email existed.
alter table public.comments
  add column if not exists author_email text check (char_length(author_email) <= 200);

comment on table public.comments is
  'Blog comments. Nothing is visible until approved = true is set by hand.';

create index if not exists comments_post_approved_idx
  on public.comments (post_slug, created_at)
  where approved;

alter table public.comments enable row level security;

-- Anyone may post a comment, but only into the moderation queue.
drop policy if exists "anon can submit comments" on public.comments;
create policy "anon can submit comments"
  on public.comments
  for insert
  to anon
  with check (
    -- Without this a crafted request could publish itself instantly.
    approved = false
  );

-- Anyone may read comments you have approved, and only those.
drop policy if exists "anon can read approved comments" on public.comments;
create policy "anon can read approved comments"
  on public.comments
  for select
  to anon
  using (approved = true);


-- ---------------------------------------------------------------------
-- 3. APPLICATIONS — job applications and open (speculative) applications
--
-- Both doors of the careers form land here. `kind` says which one:
--
--   'role' — an application against a listing in src/config/careers.ts.
--            role_slug and role_title are set; discipline and desired_role
--            are null.
--   'open' — nobody was hiring for what they do. discipline and
--            desired_role are set; role_slug and role_title are null.
--
-- Sort by `kind` in the Table Editor and you have two working queues.
--
-- This table is the most sensitive one in the project. An enquiry leaking is
-- a commercial embarrassment; this leaking is somebody's name, phone number,
-- current employer and CV. It gets the same write-only treatment as
-- `enquiries`, and it matters more here.
-- ---------------------------------------------------------------------
create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  -- Which door they came through. Constrained, unlike enquiry_type, because
  -- this one drives how the row is read rather than just labelling it.
  kind           text not null default 'role' check (kind in ('role', 'open')),

  -- Set when kind = 'role'. Free text rather than a foreign key: the roles
  -- live in a TypeScript config, not in the database, and a filled role is
  -- deleted from that file — which must not orphan the applications that
  -- came in against it.
  role_slug      text check (char_length(role_slug) <= 120),
  role_title     text check (char_length(role_title) <= 160),

  -- Set when kind = 'open'.
  discipline     text check (char_length(discipline) <= 80),
  desired_role   text check (char_length(desired_role) <= 160),

  name           text not null check (char_length(name) between 1 and 120),
  email          text not null check (char_length(email) between 3 and 200),
  phone          text check (char_length(phone) <= 40),
  -- City, and country if outside India. Several seats are on-site, so this
  -- is a real filter rather than a formality.
  location       text check (char_length(location) <= 160),
  experience     text check (char_length(experience) <= 60),
  availability   text check (char_length(availability) <= 80),

  -- Links, not files. Accepting uploads would mean a public-insert Storage
  -- bucket behind an anon key that ships in the JavaScript bundle, which is
  -- an open door for anyone who finds it. See src/components/ApplyForm.astro.
  portfolio_url  text check (char_length(portfolio_url) <= 500),
  cv_url         text check (char_length(cv_url) <= 500),

  message        text check (char_length(message) <= 4000),

  -- Which page it was sent from: the listing page or the careers index.
  source_path    text check (char_length(source_path) <= 300),

  -- Set by hand in the dashboard as you work through them.
  handled        boolean not null default false
);

comment on table public.applications is
  'Job and open applications. Contains personal data. Anon may INSERT only — never add a SELECT policy.';

-- The two queues you actually read, newest first.
create index if not exists applications_kind_created_idx
  on public.applications (kind, created_at desc);

alter table public.applications enable row level security;

-- Anyone may apply.
drop policy if exists "anon can submit applications" on public.applications;
create policy "anon can submit applications"
  on public.applications
  for insert
  to anon
  with check (
    -- A submission cannot pre-mark itself handled.
    handled = false
  );

-- NO select / update / delete policy for anon. Same rule as enquiries, and
-- load bearing for a different reason: this table is personal data. Do not
-- "fix" this omission.


-- ---------------------------------------------------------------------
-- 4. COLUMN GRANTS
--
-- RLS decides which ROWS a request may touch. It says nothing about which
-- COLUMNS. Without the grants below, `select=*` on an approved comment
-- would hand back every commenter's email address.
--
-- So the anon role is stripped back to nothing and given exactly the
-- columns it needs, per operation. Postgres then rejects any request that
-- names a column outside the list, whatever the row policy says.
--
-- `approved` is deliberately NOT insertable. The column default supplies
-- false and the RLS check confirms it, so there is no path by which a
-- crafted request can publish itself — not even a rejected one.
-- ---------------------------------------------------------------------
revoke all on public.enquiries from anon;
grant insert (
  name, email, phone, company, enquiry_type, message,
  duration_mins, slot_label, slot_utc, visitor_tz, guest_emails, source_path
) on public.enquiries to anon;
-- No SELECT grant at all: leads are write-only from the website.
--
-- `status`, `confirmed_at`, `meeting_url` and `invite_seq` are absent from the
-- INSERT list on purpose, for exactly the reason `approved` is absent from the
-- comments one. They are the state the Confirm button writes; a submission
-- that could set them for itself could book a confirmed meeting in your
-- calendar, with its own joining link, without you ever seeing the request.

revoke all on public.comments from anon;
grant insert (post_slug, author_name, author_email, body) on public.comments to anon;
grant select (id, created_at, post_slug, author_name, body) on public.comments to anon;
-- author_email is absent from the SELECT list on purpose. It is stored so
-- you can reply to someone, and it can never be read back by the website.

revoke all on public.applications from anon;
grant insert (
  kind, role_slug, role_title, discipline, desired_role,
  name, email, phone, location, experience, availability,
  portfolio_url, cv_url, message, source_path
) on public.applications to anon;
-- No SELECT grant at all. Applications are write-only from the website, and
-- `handled` is not insertable, so nothing can arrive pre-marked as dealt with.


-- ---------------------------------------------------------------------
-- 5. RATE LIMITING
--
-- WHAT THIS IS FOR, because it is not spam in the ordinary sense.
--
-- The anon key is public and RLS lets it INSERT. Both of those are correct
-- and neither is going to change. What follows from them is that anybody can
-- read the key out of the JavaScript bundle and post rows directly:
--
--   curl -X POST 'https://<project>.supabase.co/rest/v1/enquiries' \
--     -H "apikey: <the key from the bundle>" \
--     -H 'Content-Type: application/json' \
--     -d '{"name":"x","email":"x@x.com"}'
--
-- RLS allows that, as designed. The honeypot and the three-second timer on
-- the forms are client-side and never see the request at all.
--
-- The damage is not the rows. It is that every INSERT fires the `notify`
-- webhook, which sends an email through Resend. A loop like the one above
-- empties a free Resend tier in minutes — and once it is empty, REAL
-- enquiries stop arriving in your inbox with nothing to say they have.
-- Losing a client because a script exhausted a mail quota is a worse outcome
-- than any amount of junk in a table.
--
-- Two ceilings, because they stop different things:
--
--   PER ADDRESS  stops one machine hammering the endpoint.
--   GLOBAL       stops a distributed run from thousands of addresses, which
--                the per-address limit cannot see. This is the one that
--                actually protects the mail quota. Set it well above real
--                traffic: a studio site does not take 40 genuine enquiries
--                in an hour, so if that ceiling is ever reached, something
--                is wrong and silence is the correct outcome.
--
-- NOTE ON COUNTING. A rejected insert raises, which rolls back the whole
-- statement — including the log row for that attempt. So what is counted is
-- SUCCESSFUL submissions, which is what the limit is about. A blocked caller
-- can keep making requests; it just cannot make any more email.
-- ---------------------------------------------------------------------

create table if not exists public.submission_log (
  id    bigserial primary key,
  addr  text        not null,
  kind  text        not null,
  at    timestamptz not null default now()
);

create index if not exists submission_log_lookup_idx
  on public.submission_log (kind, addr, at desc);
create index if not exists submission_log_at_idx
  on public.submission_log (at desc);

comment on table public.submission_log is
  'Rate-limit bookkeeping. Written only by the enforce_rate_limit trigger; anon has no access whatsoever.';

-- RLS on with NO policies at all: that is a deny for every role that is not
-- bypassing it. The trigger below reaches the table as its owner instead.
alter table public.submission_log enable row level security;
revoke all on public.submission_log from anon, authenticated;
revoke all on sequence public.submission_log_id_seq from anon, authenticated;

/*
 * The trigger.
 *
 * SECURITY DEFINER is load bearing: it runs as the function's owner, which is
 * how it reads and writes `submission_log` when the caller is `anon` and anon
 * has been stripped of every grant on that table. `search_path` is pinned in
 * the same breath — a SECURITY DEFINER function without a fixed search_path
 * can be redirected to an attacker's objects, which would turn this from a
 * defence into a way in.
 *
 * Arguments: per-address limit, window in minutes, global limit.
 */
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hdrs          json;
  caller_role   text;
  client_addr   text;
  per_addr_max  int := coalesce(nullif(tg_argv[0], ''), '5')::int;
  window_mins   int := coalesce(nullif(tg_argv[1], ''), '60')::int;
  global_max    int := coalesce(nullif(tg_argv[2], ''), '40')::int;
  /* Optional fourth argument. Reading past tg_nargs yields NULL rather than
     erroring, so a trigger created with three arguments simply skips the
     daily ceiling. */
  daily_max     int := nullif(tg_argv[3], '')::int;
  since         timestamptz;
  n             int;
begin
  since := now() - make_interval(mins => window_mins);

  -- PostgREST publishes the request headers here. A direct SQL insert (the
  -- dashboard, a migration, the service key) has no such setting, and the
  -- `true` makes that a NULL rather than an error.
  begin
    hdrs := current_setting('request.headers', true)::json;
  exception when others then
    hdrs := null;
  end;

  /*
   * WHOSE address is this?
   *
   * Two shapes of caller reach these tables:
   *
   *   1. The browser, posting straight to PostgREST with the anon key. The
   *      edge sets cf-connecting-ip / x-forwarded-for and the visitor cannot
   *      forge them.
   *
   *   2. The `submit` Edge Function, which verifies a Turnstile token and
   *      then inserts as service_role. Its OWN address is on those headers —
   *      the same one for every visitor on earth — so reading them here would
   *      put the whole internet in one bucket. It forwards the real visitor
   *      address on x-client-ip instead.
   *
   * x-client-ip is trusted ONLY for service_role. The anon key is public, so
   * an anon caller allowed to set its own address could send a different one
   * on every request and never reach a limit — which would quietly undo this
   * entire section.
   *
   * `current_user` is NOT usable for that test: this function is SECURITY
   * DEFINER, so inside it current_user is the owner, not the caller. The
   * role PostgREST authenticated as is in the verified JWT claims.
   */
  begin
    caller_role := current_setting('request.jwt.claims', true)::json ->> 'role';
  exception when others then
    caller_role := null;
  end;

  if caller_role = 'service_role' then
    client_addr := nullif(btrim(coalesce(hdrs ->> 'x-client-ip', '')), '');
  else
    client_addr := nullif(btrim(coalesce(
      hdrs ->> 'cf-connecting-ip',
      split_part(hdrs ->> 'x-forwarded-for', ',', 1),
      hdrs ->> 'x-real-ip',
      ''
    )), '');
  end if;

  -- No identifiable caller means this is not a web request: the dashboard,
  -- psql, or the service role doing something deliberate. Never limit those,
  -- or you will one day be unable to fix your own data.
  if client_addr is null then
    return new;
  end if;

  -- Ceiling one: this address.
  select count(*) into n
    from public.submission_log l
   where l.kind = tg_table_name
     and l.addr = client_addr
     and l.at > since;

  if n >= per_addr_max then
    raise exception
      'Too many submissions from this address. Please wait a little and try again.'
      using errcode = 'PT429';
  end if;

  -- Ceiling two: everybody. This is the one protecting the mail quota.
  select count(*) into n
    from public.submission_log l
   where l.kind = tg_table_name
     and l.at > since;

  if n >= global_max then
    raise exception
      'We are receiving an unusual number of submissions right now. Please try again shortly.'
      using errcode = 'PT429';
  end if;

  /*
   * Ceiling three: everybody, per DAY. This is the one that actually bounds
   * the mail bill, and its absence was a hole in the two above.
   *
   * An HOURLY ceiling limits the rate and not the total. At 40 an hour,
   * enquiries alone can produce 960 notification emails in a day and roughly
   * 29,000 in a month — so a script running flat out still walks through a
   * free Resend tier (about 3,000 a month, and about 100 a day) in a little
   * over a day, which is precisely the outcome sections 5 exists to prevent.
   * Rate limiting without a total is a slower leak, not a plugged one.
   *
   * The daily numbers on the triggers below add up to well under the daily
   * allowance, and every one of them is several times real traffic. A studio
   * site does not receive thirty genuine enquiries in a day; if it ever does,
   * raise this deliberately rather than discovering it was already raised.
   */
  if daily_max is not null then
    select count(*) into n
      from public.submission_log l
     where l.kind = tg_table_name
       and l.at > now() - interval '24 hours';

    if n >= daily_max then
      raise exception
        'We have taken a lot of submissions today. Please email us directly instead.'
        using errcode = 'PT429';
    end if;
  end if;

  insert into public.submission_log (addr, kind) values (client_addr, tg_table_name);
  return new;
end;
$$;

/*
 * Limits per table: (per address, window in minutes, per window, PER DAY).
 *
 * Ceilings on abuse, not targets — every number is several times what real
 * use looks like. The daily column is the one sized against the mail plan:
 *
 *   enquiries      20/day  x2  \
 *   comments       30/day       >  90 a day worst case, all three combined,
 *   applications   20/day      /   inside a free Resend tier (~100/day).
 *
 * ENQUIRIES COUNT TWICE, and that is why their ceiling came down from 30.
 * A booking now produces two emails, not one: the notification to the studio
 * and the acknowledgement to the person who booked, so they know a real
 * request landed rather than staring at a page that says so. At the old 30 a
 * day, enquiries alone could reach 60 emails and the three tables together
 * 110 — over the free daily allowance, at which point REAL enquiries stop
 * being delivered with nothing to say they have. Twenty is still several
 * times any day this site has ever had.
 *
 * The invite that goes out when you press Confirm is not in this arithmetic.
 * It is sent by a person clicking a button in their own inbox, not by anything
 * a stranger can trigger, and there is one of them per booking you agreed to.
 *
 * Applications keep a 24-hour window rather than an hour: somebody may
 * genuinely apply for two or three roles in one sitting, so the per-address
 * allowance is generous and long. Its window IS a day, which makes the third
 * argument its daily ceiling already — hence no fourth.
 */
drop trigger if exists enquiries_rate_limit on public.enquiries;
create trigger enquiries_rate_limit
  before insert on public.enquiries
  for each row execute function public.enforce_rate_limit('3', '60', '40', '20');

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_rate_limit('5', '60', '60', '30');

drop trigger if exists applications_rate_limit on public.applications;
create trigger applications_rate_limit
  before insert on public.applications
  for each row execute function public.enforce_rate_limit('5', '1440', '20');

/*
 * Housekeeping. The log only ever needs the current window, and nothing reads
 * a row older than a day. Left alone the table is still tiny — a row is a few
 * dozen bytes — but it grows forever, so trim it.
 *
 * Run this once if the pg_cron extension is available (Database -> Extensions
 * in the dashboard). If it is not, this whole block is skipped and you can
 * delete old rows by hand occasionally; nothing breaks either way.
 */
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-submission-log',
      '17 4 * * *',
      $cron$delete from public.submission_log where at < now() - interval '7 days'$cron$
    );
    raise notice 'Scheduled the daily submission_log purge.';
  else
    raise notice 'pg_cron is not installed — submission_log will not be purged automatically.';
  end if;
exception when others then
  -- Housekeeping is a convenience and must never take the schema run down with
  -- it. An older pg_cron with a different signature, or a permissions quirk,
  -- lands here: the rate limiter above is already installed and working, and
  -- the only consequence is a table that grows slowly and can be emptied by
  -- hand with the DELETE above.
  raise notice 'Could not schedule the submission_log purge (%). Rate limiting is unaffected.', sqlerrm;
end
$$;


-- ---------------------------------------------------------------------
-- 6. Sanity check
--
-- After running this, confirm all three tables show "RLS enabled" in
-- Table Editor. If any says otherwise, stop and fix it before going
-- live — an RLS-disabled table with a public anon key is world readable
-- and world writable.
-- ---------------------------------------------------------------------
select
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('enquiries', 'comments', 'applications', 'submission_log');

-- And that the rate limiter is actually attached. Three rows expected; none
-- means section 5 did not run and the forms are unthrottled again.
select
  event_object_table as table_name,
  trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name like '%_rate_limit'
order by event_object_table;


-- ---------------------------------------------------------------------
-- 7. THE TURNSTILE CUTOVER  —  COMMENTED OUT ON PURPOSE. DO NOT RUN YET.
--
-- Once every form posts through the `submit` Edge Function, the anon role
-- has no remaining reason to write to these tables, and taking the grants
-- away is what finally closes the direct-to-PostgREST door:
--
--   curl -X POST '.../rest/v1/enquiries' -H "apikey: <key from the bundle>"
--
-- After this, that returns 401 no matter what it sends. `submit` is
-- unaffected — it writes as service_role, which bypasses grants and RLS.
--
-- ORDER MATTERS, AND GETTING IT WRONG TAKES THE FORMS DOWN.
--
-- The live site keeps posting under the anon key until a build made WITH
-- TURNSTILE_SITE_KEY is actually deployed to Hostinger. Run this before that
-- build is live and every form on aniwala.com starts failing immediately,
-- with a permission error the visitor cannot do anything about.
--
-- So the sequence is, in this order and not another:
--
--   1. Get a Turnstile site key and secret key from Cloudflare.
--   2. supabase secrets set TURNSTILE_SECRET_KEY=0x... --project-ref <ref>
--   3. supabase functions deploy submit --no-verify-jwt
--   4. Put TURNSTILE_SITE_KEY in .env AND in the GitHub Actions secrets.
--   5. Deploy the site. CONFIRM a real submission works on aniwala.com.
--   6. Only then, uncomment and run the three statements below.
--
-- To roll back, re-run section 4 of this file: it restores exactly these
-- grants. Keep that in mind rather than reconstructing them by hand.
-- ---------------------------------------------------------------------

-- revoke insert on public.enquiries    from anon;
-- revoke insert on public.comments     from anon;
-- revoke insert on public.applications from anon;

-- The comment SELECT grant must SURVIVE this: reading approved comments is
-- how the blog thread renders, and it has nothing to do with submitting one.
-- Section 4 grants it as `grant select (id, created_at, post_slug,
-- author_name, body)`. Do not revoke that, and do not use a bare
-- `revoke all` here, which would take it with everything else.
