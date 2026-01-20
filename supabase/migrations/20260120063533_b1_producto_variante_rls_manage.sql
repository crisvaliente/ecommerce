begin;

-- Reemplazamos policies por empresa por policies con control fino por producto
-- Tenancy: usuario pertenece a la empresa
-- Autorización: puede gestionar el producto (can_manage_producto_member)

-- SELECT
drop policy if exists producto_variante_select_empresa on public.producto_variante;
create policy producto_variante_select_manage
on public.producto_variante
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
  and public.can_manage_producto_member(producto_variante.producto_id)
);

-- INSERT
drop policy if exists producto_variante_insert_empresa on public.producto_variante;
create policy producto_variante_insert_manage
on public.producto_variante
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
  and public.can_manage_producto_member(producto_variante.producto_id)
);

-- UPDATE
drop policy if exists producto_variante_update_empresa on public.producto_variante;
create policy producto_variante_update_manage
on public.producto_variante
for update
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
  and public.can_manage_producto_member(producto_variante.producto_id)
)
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
  and public.can_manage_producto_member(producto_variante.producto_id)
);

-- DELETE
drop policy if exists producto_variante_delete_empresa on public.producto_variante;
create policy producto_variante_delete_manage
on public.producto_variante
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
  and public.can_manage_producto_member(producto_variante.producto_id)
);

commit;
