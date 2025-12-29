-- Ruta A · Helper mínimo para RLS por empresa
-- Paso 1: resolver empresa_id del usuario autenticado
-- NO activa RLS todavía

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id
  from public.usuario
  where supabase_uid = auth.uid()
  limit 1
$$;

revoke all on function public.current_empresa_id() from public;
grant execute on function public.current_empresa_id() to authenticated;


-- Ruta A · Paso 2: activar RLS (sin policies aún)
alter table public.usuario   enable row level security;
alter table public.categoria enable row level security;
alter table public.producto  enable row level security;


-- Ruta A · Paso 3: policies mínimas (solo SELECT)

-- USUARIO: ver solo tu empresa
drop policy if exists "usuario_select_empresa" on public.usuario;
create policy "usuario_select_empresa"
on public.usuario
for select
to authenticated
using (empresa_id = public.current_empresa_id());

-- CATEGORIA: ver solo tu empresa
drop policy if exists "categoria_select_empresa" on public.categoria;
create policy "categoria_select_empresa"
on public.categoria
for select
to authenticated
using (empresa_id = public.current_empresa_id());

-- PRODUCTO: ver solo tu empresa
drop policy if exists "producto_select_empresa" on public.producto;
create policy "producto_select_empresa"
on public.producto
for select
to authenticated
using (empresa_id = public.current_empresa_id());


-- Ruta A · Paso 4: policies mínimas (INSERT)

-- USUARIO: insertar solo dentro de tu empresa
drop policy if exists "usuario_insert_empresa" on public.usuario;
create policy "usuario_insert_empresa"
on public.usuario
for insert
to authenticated
with check (empresa_id = public.current_empresa_id());

-- CATEGORIA: insertar solo dentro de tu empresa
drop policy if exists "categoria_insert_empresa" on public.categoria;
create policy "categoria_insert_empresa"
on public.categoria
for insert
to authenticated
with check (empresa_id = public.current_empresa_id());

-- PRODUCTO: insertar solo dentro de tu empresa
drop policy if exists "producto_insert_empresa" on public.producto;
create policy "producto_insert_empresa"
on public.producto
for insert
to authenticated
with check (empresa_id = public.current_empresa_id());


-- Ruta A · Paso 5: policies mínimas (UPDATE + DELETE)

-- USUARIO
drop policy if exists "usuario_update_empresa" on public.usuario;
create policy "usuario_update_empresa"
on public.usuario
for update
to authenticated
using (empresa_id = public.current_empresa_id())
with check (empresa_id = public.current_empresa_id());

drop policy if exists "usuario_delete_empresa" on public.usuario;
create policy "usuario_delete_empresa"
on public.usuario
for delete
to authenticated
using (empresa_id = public.current_empresa_id());

-- CATEGORIA
drop policy if exists "categoria_update_empresa" on public.categoria;
create policy "categoria_update_empresa"
on public.categoria
for update
to authenticated
using (empresa_id = public.current_empresa_id())
with check (empresa_id = public.current_empresa_id());

drop policy if exists "categoria_delete_empresa" on public.categoria;
create policy "categoria_delete_empresa"
on public.categoria
for delete
to authenticated
using (empresa_id = public.current_empresa_id());

-- PRODUCTO
drop policy if exists "producto_update_empresa" on public.producto;
create policy "producto_update_empresa"
on public.producto
for update
to authenticated
using (empresa_id = public.current_empresa_id())
with check (empresa_id = public.current_empresa_id());

drop policy if exists "producto_delete_empresa" on public.producto;
create policy "producto_delete_empresa"
on public.producto
for delete
to authenticated
using (empresa_id = public.current_empresa_id());

