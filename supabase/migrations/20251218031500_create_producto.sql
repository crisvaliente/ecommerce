-- Crear tabla producto (base para admin + B1)
create table if not exists public.producto (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nombre text not null,
  descripcion text,
  precio numeric not null,
  stock integer not null,
  tipo text,
  categoria_id uuid,
  estado text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice por empresa
create index if not exists idx_producto_empresa_id
on public.producto (empresa_id);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_producto_updated_at on public.producto;
create trigger trg_producto_updated_at
before update on public.producto
for each row execute procedure public.set_updated_at();

-- Crear tabla categoria (mínimo necesario)
create table if not exists public.categoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nombre text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_categoria_empresa_id
on public.categoria (empresa_id);
