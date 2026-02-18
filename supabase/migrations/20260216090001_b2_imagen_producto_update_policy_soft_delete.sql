-- B2: permitir UPDATE (incluyendo soft delete) a quien puede gestionar el producto

drop policy if exists ip_upd_owner on public.imagen_producto;

create policy ip_upd_owner
on public.imagen_producto
for update
to authenticated
using (
  can_manage_producto_member(producto_id)
)
with check (
  can_manage_producto_member(producto_id)
);
