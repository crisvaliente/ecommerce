begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Gate 3 (20260914165851) moved profile creation to the Auth trigger and revoked
-- the browser insert that used to create profiles on sign-in. Auth users created
-- before the trigger and never provisioned were left without a profile, so they
-- can neither buy nor sign in to the panel. Create exactly the profile the
-- trigger (handle_new_auth_user) creates for a new user. Fails closed on an
-- email already used by another profile, as the trigger does, and on an email
-- shared by two backfilled users (the trigger's one-at-a-time order would reject
-- the second; the null-company unique index would not).
do $backfill$
declare
  v_conflicts bigint;
  v_missing bigint;
  v_inserted bigint;
begin
  lock table public.usuario in share row exclusive mode;

  select count(*) into v_missing
  from auth.users a
  where not exists (select 1 from public.usuario u where u.supabase_uid = a.id);

  select count(*) into v_conflicts
  from auth.users a
  where not exists (select 1 from public.usuario u where u.supabase_uid = a.id)
    and (
      a.email is null or btrim(a.email) = ''
      or exists (select 1 from public.usuario u where u.id = a.id)
      or exists (select 1 from public.usuario u where lower(btrim(u.correo)) = lower(btrim(a.email)))
      or exists (
        select 1 from auth.users b
        where b.id <> a.id
          and lower(btrim(b.email)) = lower(btrim(a.email))
          and not exists (select 1 from public.usuario u where u.supabase_uid = b.id)
      )
    );
  if v_conflicts <> 0 then
    raise exception 'usuario_backfill_email_conflict:%', v_conflicts;
  end if;

  insert into public.usuario (id, supabase_uid, correo, nombre, rol, empresa_id, onboarding)
  select a.id, a.id, lower(btrim(a.email)),
         coalesce(a.raw_user_meta_data ->> 'name', lower(btrim(a.email))),
         'cliente', null, true
  from auth.users a
  where not exists (select 1 from public.usuario u where u.supabase_uid = a.id);
  get diagnostics v_inserted = row_count;

  if v_inserted <> v_missing
     or exists (select 1 from auth.users a where not exists (select 1 from public.usuario u where u.supabase_uid = a.id)) then
    raise exception 'usuario_backfill_incomplete: expected %, inserted %', v_missing, v_inserted;
  end if;
end;
$backfill$;

commit;
