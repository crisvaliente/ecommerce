begin;

alter table public.usuario
  alter column supabase_uid set not null;

drop index if exists usuario_supabase_uid_uniq;

alter table public.usuario
  add constraint usuario_supabase_uid_unique unique (supabase_uid);

commit;
