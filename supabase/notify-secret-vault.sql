-- =====================================================================
-- One-time upgrade: move NOTIFY_SECRET out of notify_new_row() and into
-- Supabase Vault.
--
-- Run AFTER mirror-events.sql, once, whole: SQL Editor -> New query ->
-- paste -> Run. Safe to re-run. Nothing in here needs the secret retyped.
--
-- ---------------------------------------------------------------------
-- WHY
--
-- The secret that authenticates the database to the `notify` function was a
-- string literal inside the function's own source. Function source is not a
-- secret store: `pg_proc.prosrc` is readable by any role that can connect,
-- and it is printed by the dashboard's function editor to every project
-- member. Anyone holding it can call `notify` directly — mail the studio,
-- write into the Studio mirror — without going through a form.
--
-- In Vault it is encrypted at rest and readable only through
-- `vault.decrypted_secrets`, which the API roles cannot see. The function is
-- SECURITY DEFINER, so it reads it as its owner.
--
-- ---------------------------------------------------------------------
-- HOW
--
-- Same trick as mirror-events.sql: the secret is lifted out of the current
-- function source, so it never appears in this file or in anybody's
-- clipboard. If it is already in Vault (a re-run), the source is not read at
-- all. If neither has it, the block raises and nothing changes.
--
-- After this, mirror-events.sql can no longer find a secret to lift and will
-- refuse to run — correctly, since this file already contains its logic.
--
-- ROTATING it later: `supabase secrets set NOTIFY_SECRET=...` for the
-- function, then `select vault.update_secret(id, '<new>') from vault.secrets
-- where name = 'notify_secret';` for the trigger. No function rewrite needed.
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
    raise exception 'notify_new_row() not found - run mirror-events.sql first. Nothing changed.';
  end if;

  m_url := (regexp_match(src, 'url\s*:=\s*''([^'']+)'''))[1];
  if m_url is null then
    raise exception 'Could not read the url out of notify_new_row() - nothing changed';
  end if;

  if not exists (select 1 from vault.secrets where name = 'notify_secret') then
    m_secret := (regexp_match(src, '''x-notify-secret''\s*,\s*''([^'']+)'''))[1];
    if m_secret is null then
      raise exception 'No secret in notify_new_row() and none in Vault - nothing changed';
    end if;
    perform vault.create_secret(m_secret, 'notify_secret',
      'Sent as x-notify-secret by notify_new_row(); must equal NOTIFY_SECRET on the notify function.');
  end if;

  execute format($f$
    create or replace function public.notify_new_row()
    returns trigger
    language plpgsql
    security definer
    set search_path = public, net, pg_temp
    as $body$
    declare
      payload jsonb;
      secret  text;
    begin
      /* Read per call, so a rotation in Vault takes effect on the next row. */
      select decrypted_secret into secret
        from vault.decrypted_secrets
       where name = 'notify_secret';

      /*
       * The payload says what actually happened. `notify` reads `type` to
       * decide whether there is an email to send: only an INSERT produces
       * one. NEW is not touched on a DELETE — it is unassigned there, and
       * referencing it would make the row impossible to delete.
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

      /*
       * No secret, no call — and the write still succeeds. A form submission
       * must never fail because the notification side is misconfigured; the
       * row is saved and the backup still has it.
       */
      if secret is null then
        raise warning 'notify_new_row: notify_secret missing from Vault, webhook skipped';
      else
        perform net.http_post(
          url     := %L,
          headers := jsonb_build_object(
                       'Content-Type', 'application/json',
                       'x-notify-secret', secret
                     ),
          body    := payload
        );
      end if;

      if tg_op = 'DELETE' then
        return old;
      end if;
      return new;
    end
    $body$
  $f$, m_url);

  raise notice 'notify_new_row() now reads its secret from Vault.';
end
$do$;

-- Confirm it took. Expect: in_vault = true, secret_in_source = false.
select
  exists (select 1 from vault.secrets where name = 'notify_secret') as in_vault,
  (select prosrc ~ 'x-notify-secret''\s*,\s*''' from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'notify_new_row' and n.nspname = 'public')    as secret_in_source;
