-- 01_usuario_uid_rls (UP)
begin;

-- 1) Columna + índice provisional (permite NULL mientras migramos)
alter table public.usuario
  add column if not exists supabase_uid uuid;

create unique index if not exists usuario_supabase_uid_uniq
  on public.usuario (supabase_uid)
  where supabase_uid is not null;

-- 2) RLS base
alter table public.usuario enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'usuario' and policyname = 'usuario_select_own'
  ) then
    create policy "usuario_select_own"
    on public.usuario
    for select
    using (supabase_uid = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'usuario' and policyname = 'usuario_update_own'
  ) then
    create policy "usuario_update_own"
    on public.usuario
    for update
    using (supabase_uid = auth.uid())
    with check (supabase_uid = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'usuario' and policyname = 'usuario_insert_self'
  ) then
    create policy "usuario_insert_self"
    on public.usuario
    for insert
    with check (supabase_uid = auth.uid());
  end if;
end$$;

-- 3) Trigger QoL: autocompletar supabase_uid desde el JWT
create or replace function public.set_supabase_uid_from_jwt()
returns trigger as $$
declare sub text;
begin
  sub := current_setting('request.jwt.claim.sub', true);
  if new.supabase_uid is null and sub is not null then
    new.supabase_uid := sub::uuid;
  end if;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists usuario_set_uid on public.usuario;

create trigger usuario_set_uid
before insert on public.usuario
for each row
execute procedure public.set_supabase_uid_from_jwt();

commit;


-- 01_usuario_uid_rls (DOWN)
begin;

drop trigger if exists usuario_set_uid on public.usuario;
drop function if exists public.set_supabase_uid_from_jwt();

drop policy if exists "usuario_insert_self" on public.usuario;
drop policy if exists "usuario_update_own" on public.usuario;
drop policy if exists "usuario_select_own" on public.usuario;

drop index if exists usuario_supabase_uid_uniq;
alter table public.usuario drop column if exists supabase_uid;

-- si querés, podrías deshabilitar RLS aquí, pero lo dejo como está:
-- alter table public.usuario disable row level security;

commit;
