begin;

-- Operational tenancy authority: public.usuario.empresa_id + public.usuario.rol.
-- public.membresia remains legacy and is intentionally not migrated or removed here.

create or replace function public.can_mutate_catalog_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = p_empresa_id
      and u.rol in ('admin', 'staff')
  );
$function$;

create or replace function public.can_mutate_catalog_producto(p_producto_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.producto p
    join public.usuario u
      on u.empresa_id = p.empresa_id
    where p.id = p_producto_id
      and u.supabase_uid = auth.uid()
      and u.rol in ('admin', 'staff')
  );
$function$;

revoke execute on function public.can_mutate_catalog_empresa(uuid) from public, anon;
revoke execute on function public.can_mutate_catalog_producto(uuid) from public, anon;
grant execute on function public.can_mutate_catalog_empresa(uuid) to authenticated, service_role;
grant execute on function public.can_mutate_catalog_producto(uuid) to authenticated, service_role;

-- SECURITY DEFINER RPCs called only by trusted server-side service-role clients.
revoke execute on function public.crear_pedido_con_items(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.crear_intento_pago(uuid, uuid, public.canal_pago_tipo)
  from public, anon, authenticated;
revoke execute on function public.consolidar_pago_pedido(uuid)
  from public, anon, authenticated;
revoke execute on function public.procesar_notificacion_intento_pago(uuid, public.intento_pago_estado)
  from public, anon, authenticated;

grant execute on function public.crear_pedido_con_items(uuid, uuid, uuid, jsonb)
  to service_role;
grant execute on function public.crear_intento_pago(uuid, uuid, public.canal_pago_tipo)
  to service_role;
grant execute on function public.consolidar_pago_pedido(uuid)
  to service_role;
grant execute on function public.procesar_notificacion_intento_pago(uuid, public.intento_pago_estado)
  to service_role;

-- Disable the legacy client-side tenant bootstrap while preserving the function for rollback/history.
revoke execute on function public.ensure_personal_org()
  from public, anon, authenticated;
revoke execute on function public.user_is_member_of(uuid)
  from public, anon, authenticated;

-- Keep membership data as legacy, but remove it as a client-side authorization surface.
revoke all on table public.membresia from anon, authenticated;

-- EMPRESA mutations must not retain membership/owner_auth as alternative authorities.
-- Tenant creation is intentionally left without a client INSERT policy while registration is disabled.
drop policy if exists empresa_del_own on public.empresa;
drop policy if exists empresa_delete_owners on public.empresa;
drop policy if exists empresa_ins_own on public.empresa;
drop policy if exists empresa_insert_owner on public.empresa;
drop policy if exists insert_empresa_authenticated on public.empresa;
drop policy if exists usuario_puede_crear_empresa on public.empresa;
drop policy if exists empresa_upd_own on public.empresa;
drop policy if exists empresa_update_admins on public.empresa;
drop policy if exists empresa_update_catalog_staff on public.empresa;
drop policy if exists empresa_delete_catalog_staff on public.empresa;

create policy empresa_update_catalog_staff
on public.empresa
for update
to authenticated
using (public.can_mutate_catalog_empresa(id))
with check (public.can_mutate_catalog_empresa(id));

create policy empresa_delete_catalog_staff
on public.empresa
for delete
to authenticated
using (public.can_mutate_catalog_empresa(id));

-- This RPC remains client-callable, but performs its own complete authorization because it bypasses RLS.
create or replace function public.soft_delete_imagen_producto(p_imagen_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
set row_security = off
as $function$
declare
  v_uid uuid := auth.uid();
  v_producto_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select ip.producto_id
    into v_producto_id
  from public.imagen_producto ip
  where ip.id = p_imagen_id;

  if not found then
    raise exception 'imagen no existe' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.producto p
    join public.usuario u
      on u.empresa_id = p.empresa_id
    where p.id = v_producto_id
      and u.supabase_uid = v_uid
      and u.rol in ('admin', 'staff')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.imagen_producto
  set deleted_at = now(),
      es_principal = false
  where id = p_imagen_id;
end;
$function$;

revoke execute on function public.soft_delete_imagen_producto(uuid) from public, anon;
grant execute on function public.soft_delete_imagen_producto(uuid) to authenticated, service_role;

-- PRODUCTO: remove every historical permissive CUD policy before creating one policy per command.
drop policy if exists "producto_del_owner" on public.producto;
drop policy if exists "producto_delete_empresa" on public.producto;
drop policy if exists "producto_ins_owner" on public.producto;
drop policy if exists "producto_insert_empresa" on public.producto;
drop policy if exists "producto_tenant_cud" on public.producto;
drop policy if exists "producto_upd_owner" on public.producto;
drop policy if exists "producto_update_empresa" on public.producto;
drop policy if exists "usuario puede actualizar productos de su empresa" on public.producto;
drop policy if exists "usuario puede crear productos en su empresa" on public.producto;
drop policy if exists "usuario puede eliminar productos de su empresa" on public.producto;
drop policy if exists p_upd_estado_manage on public.producto;
drop policy if exists producto_insert_catalog_staff on public.producto;
drop policy if exists producto_update_catalog_staff on public.producto;
drop policy if exists producto_delete_catalog_staff on public.producto;

create policy producto_insert_catalog_staff
on public.producto
for insert
to authenticated
with check (public.can_mutate_catalog_empresa(empresa_id));

create policy producto_update_catalog_staff
on public.producto
for update
to authenticated
using (public.can_mutate_catalog_empresa(empresa_id))
with check (public.can_mutate_catalog_empresa(empresa_id));

create policy producto_delete_catalog_staff
on public.producto
for delete
to authenticated
using (public.can_mutate_catalog_empresa(empresa_id));

-- CATEGORIA.
drop policy if exists "categoria_all_true" on public.categoria;
drop policy if exists "categoria_delete_empresa" on public.categoria;
drop policy if exists "categoria_insert_empresa" on public.categoria;
drop policy if exists "categoria_update_empresa" on public.categoria;
drop policy if exists categoria_insert_catalog_staff on public.categoria;
drop policy if exists categoria_update_catalog_staff on public.categoria;
drop policy if exists categoria_delete_catalog_staff on public.categoria;

create policy categoria_insert_catalog_staff
on public.categoria
for insert
to authenticated
with check (public.can_mutate_catalog_empresa(empresa_id));

create policy categoria_update_catalog_staff
on public.categoria
for update
to authenticated
using (public.can_mutate_catalog_empresa(empresa_id))
with check (public.can_mutate_catalog_empresa(empresa_id));

create policy categoria_delete_catalog_staff
on public.categoria
for delete
to authenticated
using (public.can_mutate_catalog_empresa(empresa_id));

-- PRODUCTO_CATEGORIA is part of catalog mutation and must not remain a role bypass.
drop policy if exists producto_categoria_insert_empresa on public.producto_categoria;
drop policy if exists producto_categoria_update_empresa on public.producto_categoria;
drop policy if exists producto_categoria_delete_empresa on public.producto_categoria;
drop policy if exists producto_categoria_insert_catalog_staff on public.producto_categoria;
drop policy if exists producto_categoria_update_catalog_staff on public.producto_categoria;
drop policy if exists producto_categoria_delete_catalog_staff on public.producto_categoria;

create policy producto_categoria_insert_catalog_staff
on public.producto_categoria
for insert
to authenticated
with check (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
);

create policy producto_categoria_update_catalog_staff
on public.producto_categoria
for update
to authenticated
using (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
)
with check (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
);

create policy producto_categoria_delete_catalog_staff
on public.producto_categoria
for delete
to authenticated
using (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
);

-- PRODUCTO_VARIANTE: preserve SELECT policy; replace all mutation policies.
drop policy if exists producto_variante_insert_empresa on public.producto_variante;
drop policy if exists producto_variante_update_empresa on public.producto_variante;
drop policy if exists producto_variante_delete_empresa on public.producto_variante;
drop policy if exists producto_variante_insert_manage on public.producto_variante;
drop policy if exists producto_variante_update_manage on public.producto_variante;
drop policy if exists producto_variante_delete_manage on public.producto_variante;
drop policy if exists producto_variante_insert_catalog_staff on public.producto_variante;
drop policy if exists producto_variante_update_catalog_staff on public.producto_variante;
drop policy if exists producto_variante_delete_catalog_staff on public.producto_variante;

create policy producto_variante_insert_catalog_staff
on public.producto_variante
for insert
to authenticated
with check (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
);

create policy producto_variante_update_catalog_staff
on public.producto_variante
for update
to authenticated
using (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
)
with check (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
);

create policy producto_variante_delete_catalog_staff
on public.producto_variante
for delete
to authenticated
using (
  public.can_mutate_catalog_empresa(empresa_id)
  and public.can_mutate_catalog_producto(producto_id)
);

-- IMAGEN_PRODUCTO: collapse duplicate permissive policies and validate both OLD and NEW rows.
drop policy if exists ip_ins_owner on public.imagen_producto;
drop policy if exists ip_upd_owner on public.imagen_producto;
drop policy if exists ip_del_owner on public.imagen_producto;
drop policy if exists ip_upd_admin_manage on public.imagen_producto;
drop policy if exists ip_del_admin_manage on public.imagen_producto;
drop policy if exists ip_upd_soft_delete_owner on public.imagen_producto;
drop policy if exists ip_upd_manage_using_only on public.imagen_producto;
drop policy if exists imagen_producto_insert_catalog_staff on public.imagen_producto;
drop policy if exists imagen_producto_update_catalog_staff on public.imagen_producto;
drop policy if exists imagen_producto_delete_catalog_staff on public.imagen_producto;

create policy imagen_producto_insert_catalog_staff
on public.imagen_producto
for insert
to authenticated
with check (public.can_mutate_catalog_producto(producto_id));

create policy imagen_producto_update_catalog_staff
on public.imagen_producto
for update
to authenticated
using (public.can_mutate_catalog_producto(producto_id))
with check (public.can_mutate_catalog_producto(producto_id));

create policy imagen_producto_delete_catalog_staff
on public.imagen_producto
for delete
to authenticated
using (public.can_mutate_catalog_producto(producto_id));

-- STORAGE: preserve public reads; add scoped staff reads required for DELETE after DB soft-delete,
-- then authorize writes by path tenant, product tenant, and admin/staff role.
drop policy if exists pi_insert_member on storage.objects;
drop policy if exists pi_delete_member on storage.objects;
drop policy if exists producto_imagenes_select_catalog_staff on storage.objects;
drop policy if exists producto_imagenes_insert_catalog_staff on storage.objects;
drop policy if exists producto_imagenes_delete_catalog_staff on storage.objects;

create policy producto_imagenes_select_catalog_staff
on storage.objects
for select
to authenticated
using (
  bucket_id = 'producto-imagenes'
  and split_part(name, '/', 1) = 'empresa'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 3) = 'producto'
  and split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 5) <> ''
  and public.can_mutate_catalog_empresa((split_part(name, '/', 2))::uuid)
  and public.can_mutate_catalog_producto((split_part(name, '/', 4))::uuid)
  and exists (
    select 1
    from public.producto p
    where p.id = (split_part(name, '/', 4))::uuid
      and p.empresa_id = (split_part(name, '/', 2))::uuid
  )
);

create policy producto_imagenes_insert_catalog_staff
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'producto-imagenes'
  and split_part(name, '/', 1) = 'empresa'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 3) = 'producto'
  and split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 5) <> ''
  and public.can_mutate_catalog_empresa((split_part(name, '/', 2))::uuid)
  and public.can_mutate_catalog_producto((split_part(name, '/', 4))::uuid)
  and exists (
    select 1
    from public.producto p
    where p.id = (split_part(name, '/', 4))::uuid
      and p.empresa_id = (split_part(name, '/', 2))::uuid
  )
);

create policy producto_imagenes_delete_catalog_staff
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'producto-imagenes'
  and split_part(name, '/', 1) = 'empresa'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 3) = 'producto'
  and split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 5) <> ''
  and public.can_mutate_catalog_empresa((split_part(name, '/', 2))::uuid)
  and public.can_mutate_catalog_producto((split_part(name, '/', 4))::uuid)
  and exists (
    select 1
    from public.producto p
    where p.id = (split_part(name, '/', 4))::uuid
      and p.empresa_id = (split_part(name, '/', 2))::uuid
  )
);

commit;
