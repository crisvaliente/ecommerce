begin;

alter table public.usuario
  add column if not exists supabase_uid uuid;

create unique index if not exists usuario_supabase_uid_uniq
  on public.usuario (supabase_uid)
  where supabase_uid is not null;

commit;
