-- 20260218015610_z_drift_from_editor.sql
-- Drift capturado desde SQL editor: versión MINIMA y SEGURA
-- Objetivo: RPC para soft delete de imagen_producto con autorización via can_manage_producto_member().

set check_function_bodies = off;

create or replace function public.soft_delete_imagen_producto(p_imagen_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_producto_id uuid;
begin
  -- 1) tomar producto_id desde la fila
  select producto_id
    into v_producto_id
  from public.imagen_producto
  where id = p_imagen_id;

  if v_producto_id is null then
    raise exception 'imagen no existe' using errcode = 'P0002';
  end if;

  -- 2) autorización: owner/admin/empleado según tu lógica en can_manage_producto_member()
  if not public.can_manage_producto_member(v_producto_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- 3) soft delete + apagar principal por seguridad
  update public.imagen_producto
  set deleted_at = now(),
      es_principal = false
  where id = p_imagen_id;

end;
$$;

grant execute on function public.soft_delete_imagen_producto(uuid) to authenticated;
