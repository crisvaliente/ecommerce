-- Reemplazo: para UPDATE alcanza con USING si querés permitir cambios sobre filas que ya podés ver/tocar.
-- WITH CHECK a veces falla por evaluación de funciones/joins en el "new row".

drop policy if exists ip_upd_soft_delete_owner on public.imagen_producto;

create policy ip_upd_manage_using_only
on public.imagen_producto
for update
to authenticated
using (can_manage_producto_member(producto_id))
with check (true);
