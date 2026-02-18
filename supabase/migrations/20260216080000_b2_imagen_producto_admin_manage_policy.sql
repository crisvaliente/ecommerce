-- 20260216080000_b2_imagen_producto_admin_manage_policy.sql

begin;

-- Asegurar RLS (por si acaso)
alter table public.imagen_producto enable row level security;

-- Policy nueva: permitir UPDATE/DELETE si el usuario autenticado
-- es admin de la misma empresa del producto asociado.
-- (No depende de claims: mira tablas en DB)

drop policy if exists ip_upd_admin_manage on public.imagen_producto;
create policy ip_upd_admin_manage
on public.imagen_producto
for update
to authenticated
using (
  exists (
    select 1
    from public.producto p
    join public.usuario u
      on u.empresa_id = p.empresa_id
     and u.supabase_uid = auth.uid()
     and u.rol = 'admin'
    where p.id = imagen_producto.producto_id
  )
)
with check (
  exists (
    select 1
    from public.producto p
    join public.usuario u
      on u.empresa_id = p.empresa_id
     and u.supabase_uid = auth.uid()
     and u.rol = 'admin'
    where p.id = imagen_producto.producto_id
  )
);

drop policy if exists ip_del_admin_manage on public.imagen_producto;
create policy ip_del_admin_manage
on public.imagen_producto
for delete
to authenticated
using (
  exists (
    select 1
    from public.producto p
    join public.usuario u
      on u.empresa_id = p.empresa_id
     and u.supabase_uid = auth.uid()
     and u.rol = 'admin'
    where p.id = imagen_producto.producto_id
  )
);

commit;
