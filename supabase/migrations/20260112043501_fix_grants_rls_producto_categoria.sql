begin;

-- A) GRANTS (lo que está faltando en prod)
grant usage on schema public to authenticated;

grant select, insert, update, delete
on table public.producto_categoria
to authenticated;

-- (recomendado) lectura de categorias si el UI las lista
grant select on table public.categoria to authenticated;

-- B) Asegurar RLS (si ya estaba, no pasa nada)
alter table public.producto_categoria enable row level security;

-- C) Policies tenant-safe (asumiendo columnas: empresa_id, producto_id, categoria_id)
-- Si ya existen con estos nombres, las recreamos limpias.
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
    select 1
    from public.usuario u
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
    select 1
    from public.usuario u
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
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_categoria.empresa_id
  )
)
with check (
  exists (
    select 1
    from public.usuario u
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
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_categoria.empresa_id
  )
);

commit;
