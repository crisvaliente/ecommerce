-- Ruta A3 · A3.0 Base para migración funcional
-- Crea tabla puente producto_categoria + RLS + backfill
-- No se dropea nada (compat segura)

-- 1) Fix crítico: trigger set_updated_at() requiere updated_at
alter table public.producto
add column if not exists updated_at timestamptz not null default now();

-- 2) Índices únicos para FKs compuestas (empresa_id, id)
create unique index if not exists ux_producto_empresa_id_id
  on public.producto (empresa_id, id);

create unique index if not exists ux_categoria_empresa_id_id
  on public.categoria (empresa_id, id);

-- 3) Tabla puente producto_categoria
create table if not exists public.producto_categoria (
  empresa_id   uuid not null,
  producto_id  uuid not null,
  categoria_id uuid not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint producto_categoria_pkey
    primary key (empresa_id, producto_id, categoria_id),

  constraint fk_pc_empresa
    foreign key (empresa_id)
    references public.empresa(id)
    on delete cascade,

  constraint fk_pc_producto
    foreign key (empresa_id, producto_id)
    references public.producto(empresa_id, id)
    on delete cascade,

  constraint fk_pc_categoria
    foreign key (empresa_id, categoria_id)
    references public.categoria(empresa_id, id)
    on delete cascade
);

-- 4) Índices para joins
create index if not exists idx_pc_empresa_producto
  on public.producto_categoria (empresa_id, producto_id);

create index if not exists idx_pc_empresa_categoria
  on public.producto_categoria (empresa_id, categoria_id);

create index if not exists idx_pc_producto
  on public.producto_categoria (producto_id);

-- 5) Trigger updated_at en tabla puente
drop trigger if exists trg_producto_categoria_updated_at on public.producto_categoria;

create trigger trg_producto_categoria_updated_at
before update on public.producto_categoria
for each row execute function set_updated_at();

-- 6) RLS + policies
alter table public.producto_categoria enable row level security;

drop policy if exists producto_categoria_select_empresa on public.producto_categoria;
drop policy if exists producto_categoria_insert_empresa on public.producto_categoria;
drop policy if exists producto_categoria_update_empresa on public.producto_categoria;
drop policy if exists producto_categoria_delete_empresa on public.producto_categoria;

create policy producto_categoria_select_empresa
on public.producto_categoria
for select
to authenticated
using (
  exists (
    select 1 from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_categoria.empresa_id
  )
);

create policy producto_categoria_insert_empresa
on public.producto_categoria
for insert
to authenticated
with check (
  exists (
    select 1 from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_categoria.empresa_id
  )
);

create policy producto_categoria_update_empresa
on public.producto_categoria
for update
to authenticated
using (
  exists (
    select 1 from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_categoria.empresa_id
  )
)
with check (
  exists (
    select 1 from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_categoria.empresa_id
  )
);

create policy producto_categoria_delete_empresa
on public.producto_categoria
for delete
to authenticated
using (
  exists (
    select 1 from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_categoria.empresa_id
  )
);

-- 7) Backfill desde producto.categoria_id (compat segura)
insert into public.producto_categoria (empresa_id, producto_id, categoria_id)
select p.empresa_id, p.id, p.categoria_id
from public.producto p
where p.categoria_id is not null
on conflict do nothing;
