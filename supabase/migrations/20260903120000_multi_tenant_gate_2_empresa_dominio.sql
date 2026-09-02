begin;

create table public.empresa_dominio (
  hostname text primary key,
  empresa_id uuid not null references public.empresa(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint empresa_dominio_hostname_length
    check (char_length(hostname) between 1 and 253),
  constraint empresa_dominio_hostname_normalized
    check (
      hostname = lower(hostname)
      and hostname ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$'
    )
);

create index empresa_dominio_empresa_id_idx
  on public.empresa_dominio (empresa_id);

alter table public.empresa_dominio enable row level security;
alter table public.empresa_dominio force row level security;

revoke all on table public.empresa_dominio from public, anon, authenticated, service_role;
grant select, insert on table public.empresa_dominio to service_role;

commit;
