begin;

-- crear la columna si aún no existe (idempotente)
alter table public.usuario
  add column if not exists supabase_uid uuid;

create unique index if not exists usuario_supabase_uid_uniq
  on public.usuario (supabase_uid)
  where supabase_uid is not null;

-- backfill por email (case-insensitive)
update public.usuario u
set supabase_uid = au.id
from auth.users au
where u.supabase_uid is null
  and u.correo is not null
  and lower(u.correo) = lower(au.email);

commit;
