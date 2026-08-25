-- =====================================================================
-- Aniwala website — Supabase schema
--
-- Run this once, whole, in the Supabase dashboard: SQL Editor -> New query
-- -> paste -> Run. It is safe to re-run; every statement is guarded.
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
--   3. Column grants, not just row policies. RLS controls which ROWS are
--      visible; the GRANTs in section 3 control which COLUMNS. Commenter
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

  -- Which page it came from, so you can tell a service-page enquiry from a
  -- homepage one without asking.
  source_path    text check (char_length(source_path) <= 300),

  -- Set by hand in the dashboard as you work through them.
  handled        boolean not null default false
);

comment on table public.enquiries is
  'Website enquiries and booking requests. Anon may INSERT only — never add a SELECT policy.';

alter table public.enquiries enable row level security;

-- Anyone may submit an enquiry.
drop policy if exists "anon can submit enquiries" on public.enquiries;
create policy "anon can submit enquiries"
  on public.enquiries
  for insert
  to anon
  with check (
    -- A submission cannot pre-mark itself handled.
    handled = false
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
-- 3. COLUMN GRANTS
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
  name, email, company, enquiry_type, message,
  duration_mins, slot_label, slot_utc, visitor_tz, source_path
) on public.enquiries to anon;
-- No SELECT grant at all: leads are write-only from the website.

revoke all on public.comments from anon;
grant insert (post_slug, author_name, author_email, body) on public.comments to anon;
grant select (id, created_at, post_slug, author_name, body) on public.comments to anon;
-- author_email is absent from the SELECT list on purpose. It is stored so
-- you can reply to someone, and it can never be read back by the website.


-- ---------------------------------------------------------------------
-- 4. Sanity check
--
-- After running this, confirm both tables show "RLS enabled" in
-- Table Editor. If either says otherwise, stop and fix it before going
-- live — an RLS-disabled table with a public anon key is world readable
-- and world writable.
-- ---------------------------------------------------------------------
select
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('enquiries', 'comments');
