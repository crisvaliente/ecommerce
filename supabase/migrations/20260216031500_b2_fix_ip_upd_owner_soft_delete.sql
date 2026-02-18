-- B2: permitir soft delete (deleted_at) sin romper RLS
-- UPDATE solo sobre filas activas; estado final exige permiso de manage.

DROP POLICY IF EXISTS ip_upd_owner ON public.imagen_producto;

CREATE POLICY ip_upd_owner
ON public.imagen_producto
FOR UPDATE
TO authenticated
USING (
  can_manage_producto_member(producto_id)
  AND deleted_at IS NULL
)
WITH CHECK (
  can_manage_producto_member(producto_id)
);
