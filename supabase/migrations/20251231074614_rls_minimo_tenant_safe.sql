-- RLS mínimo tenant-safe (replica prod)
-- Tablas: public.usuario, public.producto, public.categoria

-- 1) Habilitar RLS + FORCE
alter table public.usuario  enable row level security;
alter table public.usuario  force row level security;

alter table public.producto enable row level security;
alter table public.producto force row level security;

alter table public.categoria enable row level security;
alter table public.categoria force row level security;

-- 2) Limpiar TODAS las policies existentes (para evitar restos {public} y duplicados)

-- categoria
drop policy if exists "categoria_all_true" on public.categoria;
drop policy if exists "categoria_delete_empresa" on public.categoria;
drop policy if exists "categoria_insert_empresa" on public.categoria;
drop policy if exists "categoria_select_empresa" on public.categoria;
drop policy if exists "categoria_update_empresa" on public.categoria;

-- producto
drop policy if exists "producto_del_owner" on public.producto;
drop policy if exists "producto_delete_empresa" on public.producto;
drop policy if exists "producto_ins_owner" on public.producto;
drop policy if exists "producto_insert_empresa" on public.producto;
drop policy if exists "producto_public_sel" on public.producto;
drop policy if exists "producto_select_empresa" on public.producto;
drop policy if exists "producto_tenant_cud" on public.producto;
drop policy if exists "producto_tenant_select" on public.producto;
drop policy if exists "producto_upd_owner" on public.producto;
drop policy if exists "producto_update_empresa" on public.producto;
drop policy if exists "usuario puede actualizar productos de su empresa" on public.producto;
drop policy if exists "usuario puede crear productos en su empresa" on public.producto;
drop policy if exists "usuario puede eliminar productos de su empresa" on public.producto;
drop policy if exists "usuario puede ver productos de su empresa" on public.producto;

-- usuario
drop policy if exists "usuario_delete_empresa" on public.usuario;
drop policy if exists "usuario_delete_own" on public.usuario;
drop policy if exists "usuario_insert_empresa" on public.usuario;
drop policy if exists "usuario_insert_self" on public.usuario;
drop policy if exists "usuario_select_empresa" on public.usuario;
drop policy if exists "usuario_select_own" on public.usuario;
drop policy if exists "usuario_select_self" on public.usuario;
drop policy if exists "usuario_update_empresa" on public.usuario;
drop policy if exists "usuario_update_own" on public.usuario;
drop policy if exists "usuario_update_self" on public.usuario;

-- 3) Policies: USUARIO (self)
create policy "usuario_select_self"
on public.usuario
for select
to authenticated
using (supabase_uid = auth.uid());

create policy "usuario_insert_self"
on public.usuario
for insert
to authenticated
with check (supabase_uid = auth.uid());

create policy "usuario_update_self"
on public.usuario
for update
to authenticated
using (supabase_uid = auth.uid())
with check (supabase_uid = auth.uid());

-- 4) Policies: PRODUCTO (tenant por empresa_id vía usuario.auth.uid)
create policy "producto_select_empresa"
on public.producto
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.producto.empresa_id
  )
);

create policy "producto_insert_empresa"
on public.producto
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.producto.empresa_id
  )
);

create policy "producto_update_empresa"
on public.producto
for update
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.producto.empresa_id
  )
)
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.producto.empresa_id
  )
);

create policy "producto_delete_empresa"
on public.producto
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.producto.empresa_id
  )
);

-- 5) Policies: CATEGORIA (tenant por empresa_id vía usuario.auth.uid)
create policy "categoria_select_empresa"
on public.categoria
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.categoria.empresa_id
  )
);

create policy "categoria_insert_empresa"
on public.categoria
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.categoria.empresa_id
  )
);

create policy "categoria_update_empresa"
on public.categoria
for update
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.categoria.empresa_id
  )
)
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.categoria.empresa_id
  )
);

create policy "categoria_delete_empresa"
on public.categoria
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = public.categoria.empresa_id
  )
);
