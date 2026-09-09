-- =====================================================================
-- One-time upgrade: let the webhooks fire on UPDATE and DELETE.
--
-- Run this once, whole, in the Supabase dashboard: SQL Editor -> New query
-- -> paste -> Run. Safe to re-run. Nothing in here needs a secret retyped.
--
-- ---------------------------------------------------------------------
-- WHAT IT IS FOR
--
-- The Studio mirror (see functions/_shared/sanity.ts) copies every form
-- submission into Sanity. Copying them on arrival is the easy half; keeping
-- the copy honest afterwards is what needs this file. A booking you confirm,
-- a comment you approve, a lead you tick off in the dashboard — each of those
-- is an UPDATE, and a mirror that still says "new" a week later is worse than
-- no mirror at all, because somebody will act on it.
--
-- ---------------------------------------------------------------------
-- WHY TICKING "UPDATE" IN THE DASHBOARD IS NOT ENOUGH, AND WOULD HURT
--
-- These webhooks are not the dashboard's own `supabase_functions.http_request`
-- triggers. They call a hand-written `notify_new_row()`, and that function was
-- built when INSERT was the only event it would ever see:
--
--     body := jsonb_build_object(
--               'type',   'INSERT',        <- hardcoded
--               'table',  tg_table_name,
--               'record', to_jsonb(new)    <- unassigned on a DELETE
--             )
--
-- Add UPDATE to the trigger without fixing that and every confirmed booking
-- reaches the notify function claiming to be brand new: the studio gets a
-- second notification email and the client gets a second "we have your
-- request" acknowledgement, for a call they already had confirmed. Add DELETE
-- and the trigger raises on `new`, which takes the deletion down with it.
--
-- So the function is made event-aware FIRST, in the same transaction as the
-- trigger change. The two cannot be applied half-and-half.
--
-- ---------------------------------------------------------------------
-- THE URL AND THE SECRET ARE NEVER RETYPED
--
-- They already live inside `notify_new_row()`, and the block below lifts them
-- out of it to write the new version — which is why this file can sit in the
-- repository without carrying a credential, and why nobody has to go and find
-- NOTIFY_SECRET to run it. If either value cannot be read, the block raises
-- and the transaction rolls back with the old function untouched.
-- =====================================================================

do $do$
declare
  src      text;
  m_url    text;
  m_secret text;
begin
  select p.prosrc into src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'notify_new_row' and n.nspname = 'public';

  if src is null then
    raise exception 'notify_new_row() not found - nothing changed';
  end if;

  m_url    := (regexp_match(src, 'url\s*:=\s*''([^'']+)'''))[1];
  m_secret := (regexp_match(src, '''x-notify-secret''\s*,\s*''([^'']+)'''))[1];

  if m_url is null or m_secret is null then
    raise exception 'Could not read the url/secret out of notify_new_row() - nothing changed';
  end if;

  execute format($f$
    create or replace function public.notify_new_row()
    returns trigger
    language plpgsql
    security definer
    set search_path = public, net
    as $body$
    declare
      payload jsonb;
    begin
      /*
       * The payload now says what actually happened, rather than always
       * saying INSERT. `notify` reads this field to decide whether there is
       * an email to send: only an INSERT produces one.
       *
       * NEW is deliberately not referenced on a DELETE. It is unassigned
       * there, and touching it raises inside the trigger — which would mean
       * a row that cannot be deleted.
       */
      if tg_op = 'DELETE' then
        payload := jsonb_build_object(
                     'type',       tg_op,
                     'table',      tg_table_name,
                     'record',     null,
                     'old_record', to_jsonb(old)
                   );
      else
        payload := jsonb_build_object(
                     'type',       tg_op,
                     'table',      tg_table_name,
                     'record',     to_jsonb(new),
                     'old_record', null
                   );
      end if;

      perform net.http_post(
        url     := %L,
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-notify-secret', %L
                   ),
        body    := payload
      );

      if tg_op = 'DELETE' then
        return old;
      end if;
      return new;
    end
    $body$
  $f$, m_url, m_secret);

  raise notice 'notify_new_row() is now event-aware.';
end
$do$;


-- ---------------------------------------------------------------------
-- The triggers themselves.
--
-- The name stays `notify_insert` even though it now fires on three events.
-- It is the name whatever created these webhooks knows them by, and a rename
-- would quietly break that association to buy nothing but a tidier word.
-- ---------------------------------------------------------------------

drop trigger if exists notify_insert on public.enquiries;
create trigger notify_insert
  after insert or update or delete on public.enquiries
  for each row execute function public.notify_new_row();

drop trigger if exists notify_insert on public.comments;
create trigger notify_insert
  after insert or update or delete on public.comments
  for each row execute function public.notify_new_row();

drop trigger if exists notify_insert on public.applications;
create trigger notify_insert
  after insert or update or delete on public.applications
  for each row execute function public.notify_new_row();


-- ---------------------------------------------------------------------
-- Confirm it took. Three rows, all three columns true.
-- ---------------------------------------------------------------------
select
  tgrelid::regclass::text          as table_name,
  (tgtype & 4)::bool               as on_insert,
  (tgtype & 16)::bool              as on_update,
  (tgtype & 8)::bool               as on_delete
from pg_trigger
where not tgisinternal and tgname = 'notify_insert'
order by table_name;


-- ---------------------------------------------------------------------
-- BACKFILL — only after the above reports three rows of true/true/true.
--
-- Touching a row fires the webhook, which mirrors it. No email goes out:
-- only an INSERT sends one, and these are updates. The rate limiter is a
-- `before insert` trigger, so it is not involved either.
--
-- Run it once. On a table of any size, expect one webhook call per row.
-- ---------------------------------------------------------------------

-- update public.enquiries    set handled  = handled;
-- update public.applications set handled  = handled;
-- update public.comments     set approved = approved;
