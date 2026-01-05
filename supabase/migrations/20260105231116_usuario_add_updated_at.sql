alter table public.usuario
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_usuario_updated_at on public.usuario;

create trigger set_usuario_updated_at
before update on public.usuario
for each row
execute function public.set_updated_at();
