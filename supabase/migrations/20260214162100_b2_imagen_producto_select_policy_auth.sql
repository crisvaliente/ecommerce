begin;

-- Quitar lectura pública abierta
drop policy if exists ip_sel_public on public.imagen_producto;

-- SELECT seguro (solo activas + solo con acceso al producto)
create policy ip_sel_auth_manage_producto
on public.imagen_producto
for select
to authenticated
using (
  deleted_at is null
  and can_manage_producto_member(producto_id)
);

commit;
