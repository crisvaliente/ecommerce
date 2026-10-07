begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local idle_in_transaction_session_timeout = '5s';

-- The protected body shares one statement deadline.
do $migration$
begin
perform pg_advisory_xact_lock(hashtextextended('gate3-panel-identity-catalog-isolation', 0));
lock table public.usuario, public.empresa, public.producto, public.categoria,
  public.producto_categoria, public.producto_variante, public.imagen_producto in share row exclusive mode;

-- Fail closed before DDL: this migration is only valid on the reviewed predecessor.
do $preflight$
declare
  unsafe_rows bigint;
  signature_count bigint;
begin
  if to_regclass('auth.users') is null
     or to_regclass('public.usuario') is null
     or to_regclass('public.empresa') is null then
    raise exception 'gate3_predecessor_schema_missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.usuario'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (supabase_uid)%'
  ) then raise exception 'gate3_predecessor_uid_unique_missing'; end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
      and tgfoid = 'public.handle_new_auth_user()'::regprocedure and tgenabled = 'O'
  ) then raise exception 'gate3_predecessor_auth_trigger_invalid'; end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.usuario'::regclass and polname = 'usuario_select_self') then
    raise exception 'gate3_predecessor_usuario_select_self_missing';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.usuario'::regclass and tgname = 'usuario_set_uid'
      and tgfoid = 'public.set_supabase_uid_from_jwt()'::regprocedure) then
    raise exception 'gate3_predecessor_uid_write_trigger_invalid';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.membresia'::regclass
      and polname in ('membresia_delete_admins', 'membresia_insert_admins', 'membresia_select_members', 'membresia_update_admins')) <> 4 then
    raise exception 'gate3_predecessor_membership_policy_closure_invalid';
  end if;
  select count(*) into signature_count from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.oid = any(array[
    'public.can_manage_producto(uuid)'::regprocedure, 'public.can_manage_producto_member(uuid)'::regprocedure,
    'public.can_mutate_catalog_empresa(uuid)'::regprocedure, 'public.can_mutate_catalog_producto(uuid)'::regprocedure,
    'public.current_empresa_id()'::regprocedure, 'public.ensure_personal_org()'::regprocedure,
    'public.handle_new_auth_user()'::regprocedure, 'public.is_empresa_owner(uuid)'::regprocedure,
    'public.owns_carrito(uuid)'::regprocedure, 'public.owns_pedido(uuid)'::regprocedure,
    'public.soft_delete_imagen_producto(uuid)'::regprocedure, 'public.uid()'::regprocedure,
    'public.user_is_member_of(uuid)'::regprocedure]) and pg_get_userbyid(p.proowner) = 'postgres';
  if signature_count <> 13 or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('can_manage_producto', 'can_manage_producto_member',
        'can_mutate_catalog_empresa', 'can_mutate_catalog_producto', 'current_empresa_id', 'ensure_personal_org',
        'handle_new_auth_user', 'is_empresa_owner', 'owns_carrito', 'owns_pedido', 'soft_delete_imagen_producto',
        'uid', 'user_is_member_of')) <> 13 then
    raise exception 'gate3_predecessor_routine_signature_or_owner_invalid';
  end if;
  if not exists (select 1 from pg_proc p where p.oid = 'public.can_mutate_catalog_empresa(uuid)'::regprocedure
      and not p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=pg_catalog, public'])
    or not exists (select 1 from pg_proc p where p.oid = 'public.can_mutate_catalog_producto(uuid)'::regprocedure
      and not p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=pg_catalog, public'])
    or not exists (select 1 from pg_proc p where p.oid = 'public.soft_delete_imagen_producto(uuid)'::regprocedure
      and p.prosecdef and p.provolatile = 'v' and p.proconfig @> array['search_path=pg_catalog, public', 'row_security=off']) then
    raise exception 'gate3_predecessor_helper_contract_invalid';
  end if;
  if not has_function_privilege('authenticated', 'public.can_mutate_catalog_empresa(uuid)', 'execute')
    or not has_function_privilege('service_role', 'public.can_mutate_catalog_empresa(uuid)', 'execute')
    or has_function_privilege('anon', 'public.can_mutate_catalog_empresa(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.soft_delete_imagen_producto(uuid)', 'execute')
    or has_function_privilege('anon', 'public.soft_delete_imagen_producto(uuid)', 'execute')
    or not has_function_privilege('service_role', 'public.ensure_personal_org()', 'execute')
    or has_function_privilege('authenticated', 'public.ensure_personal_org()', 'execute')
    or not has_function_privilege('anon', 'public.owns_carrito(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.owns_pedido(uuid)', 'execute') then
    raise exception 'gate3_predecessor_routine_acl_invalid';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.historial_stock'::regclass
      and polname in ('hs_sel_owner', 'hs_ins_owner')
      and coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)) ~ 'can_manage_producto') <> 2
    or not exists (select 1 from pg_policy where polrelid = 'public.imagen_producto'::regclass
      and polname = 'ip_sel_auth_manage_producto' and pg_get_expr(polqual, polrelid) ~ 'can_manage_producto_member') then
    raise exception 'gate3_predecessor_legacy_policy_dependency_invalid';
  end if;
  select count(*) into unsafe_rows
  from public.usuario u
  left join auth.users a on a.id = u.supabase_uid
  left join public.empresa e on e.id = u.empresa_id
  where u.supabase_uid is null or a.id is null or lower(btrim(u.correo)) <> lower(btrim(a.email))
     or u.rol not in ('admin', 'staff', 'cliente')
     or (u.rol in ('admin', 'staff') and (u.empresa_id is null or u.onboarding or e.id is null))
     or (u.rol = 'cliente' and u.empresa_id is null and u.onboarding is not true);
  if unsafe_rows <> 0 then raise exception 'gate3_predecessor_identity_data_invalid:%', unsafe_rows; end if;
  if exists (select 1 from public.usuario group by lower(btrim(correo)) having count(*) > 1) then
    raise exception 'gate3_predecessor_normalized_email_conflict';
  end if;
  if exists (select 1 from public.producto p left join public.categoria c
      on c.id = p.categoria_id and c.empresa_id = p.empresa_id where p.categoria_id is not null and c.id is null) then
    raise exception 'gate3_predecessor_cross_company_category';
  end if;
end;
$preflight$;

alter table public.usuario
  add constraint usuario_supabase_uid_auth_fkey
  foreign key (supabase_uid) references auth.users(id) on delete restrict not valid,
  add constraint usuario_privileged_company_check
  check (rol = 'cliente' or (empresa_id is not null and onboarding = false)) not valid;
alter table public.usuario validate constraint usuario_supabase_uid_auth_fkey;
alter table public.usuario validate constraint usuario_privileged_company_check;
alter table public.usuario
  add constraint usuario_empresa_restrict_fkey
  foreign key (empresa_id) references public.empresa(id) on delete restrict not valid;
alter table public.usuario validate constraint usuario_empresa_restrict_fkey;
alter table public.usuario drop constraint if exists usuario_empresa_id_fkey;

alter table public.producto
  add constraint producto_empresa_categoria_fkey
  foreign key (empresa_id, categoria_id) references public.categoria(empresa_id, id) not valid;
alter table public.producto validate constraint producto_empresa_categoria_fkey;

drop trigger if exists usuario_set_uid on public.usuario;
drop function public.set_supabase_uid_from_jwt();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_email text := lower(btrim(new.email));
  v_profile public.usuario%rowtype;
begin
  if new.id is null or v_email is null or v_email = '' then
    raise exception 'auth_user_identity_invalid' using errcode = '23514';
  end if;
  select * into v_profile from public.usuario where supabase_uid = new.id for update;
  if found then
    if lower(btrim(v_profile.correo)) = v_email and v_profile.rol = 'cliente'
       and v_profile.empresa_id is null and v_profile.onboarding then return new; end if;
    raise exception 'auth_user_profile_uid_conflict' using errcode = '23505';
  end if;
  if exists (select 1 from public.usuario where lower(btrim(correo)) = v_email) then
    raise exception 'auth_user_profile_email_conflict' using errcode = '23505';
  end if;
  insert into public.usuario (id, supabase_uid, correo, nombre, rol, empresa_id, onboarding)
  values (new.id, new.id, v_email, coalesce(new.raw_user_meta_data ->> 'name', v_email), 'cliente', null, true);
  return new;
end;
$function$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Restrict browser identity and company access to canonical UID authority.
drop policy if exists empresa_select_canonical_tenant on public.empresa;
drop policy if exists empresa_select_members on public.empresa;
drop policy if exists empresa_update_catalog_staff on public.empresa;
drop policy if exists empresa_delete_catalog_staff on public.empresa;
create policy empresa_select_own_company on public.empresa for select to authenticated
using (exists (select 1 from public.usuario u where u.supabase_uid = auth.uid() and u.empresa_id = empresa.id));
revoke all on public.empresa from public, anon, authenticated;
grant select on public.empresa to authenticated;

drop policy if exists usuario_select_empresa on public.usuario;
drop policy if exists usuario_select_own on public.usuario;
drop policy if exists usuario_select_self on public.usuario;
drop policy if exists usuario_insert_self on public.usuario;
drop policy if exists usuario_update_self on public.usuario;
drop policy if exists usuario_update_own on public.usuario;
drop policy if exists usuario_delete_empresa on public.usuario;
create policy usuario_select_self on public.usuario for select to authenticated using (supabase_uid = auth.uid());
revoke all on public.usuario from public, anon, authenticated;
grant select on public.usuario to authenticated;
revoke all on public.membresia, public.historial_stock from public, anon, authenticated;
drop policy if exists membresia_delete_admins on public.membresia;
drop policy if exists membresia_insert_admins on public.membresia;
drop policy if exists membresia_select_members on public.membresia;
drop policy if exists membresia_update_admins on public.membresia;
drop policy if exists hs_sel_owner on public.historial_stock;
drop policy if exists hs_ins_owner on public.historial_stock;

-- Replace every permissive catalog policy with canonical admin/staff-only policies.
drop policy if exists producto_select_tenant_authenticated on public.producto;
drop policy if exists producto_select_empresa on public.producto;
drop policy if exists producto_tenant_select on public.producto;
drop policy if exists producto_tenant_cud on public.producto;
drop policy if exists producto_insert_catalog_staff on public.producto;
drop policy if exists producto_update_catalog_staff on public.producto;
drop policy if exists producto_delete_catalog_staff on public.producto;
drop policy if exists categoria_select_empresa on public.categoria;
drop policy if exists categoria_insert_catalog_staff on public.categoria;
drop policy if exists categoria_update_catalog_staff on public.categoria;
drop policy if exists categoria_delete_catalog_staff on public.categoria;
drop policy if exists producto_categoria_select_empresa on public.producto_categoria;
drop policy if exists producto_categoria_insert_catalog_staff on public.producto_categoria;
drop policy if exists producto_categoria_update_catalog_staff on public.producto_categoria;
drop policy if exists producto_categoria_delete_catalog_staff on public.producto_categoria;
drop policy if exists producto_variante_select_tenant_authenticated on public.producto_variante;
drop policy if exists producto_variante_select_manage on public.producto_variante;
drop policy if exists producto_variante_insert_catalog_staff on public.producto_variante;
drop policy if exists producto_variante_update_catalog_staff on public.producto_variante;
drop policy if exists producto_variante_delete_catalog_staff on public.producto_variante;
drop policy if exists ip_sel_auth_manage_producto on public.imagen_producto;
drop policy if exists imagen_producto_insert_catalog_staff on public.imagen_producto;
drop policy if exists imagen_producto_update_catalog_staff on public.imagen_producto;
drop policy if exists imagen_producto_delete_catalog_staff on public.imagen_producto;

create policy producto_select_gate3_catalog_roles on public.producto for select to authenticated using (public.can_mutate_catalog_empresa(empresa_id));
create policy producto_insert_gate3_catalog_roles on public.producto for insert to authenticated with check (public.can_mutate_catalog_empresa(empresa_id));
create policy producto_update_gate3_catalog_roles on public.producto for update to authenticated using (public.can_mutate_catalog_empresa(empresa_id)) with check (public.can_mutate_catalog_empresa(empresa_id));
create policy producto_delete_gate3_catalog_roles on public.producto for delete to authenticated using (public.can_mutate_catalog_empresa(empresa_id));
create policy categoria_select_gate3_catalog_roles on public.categoria for select to authenticated using (public.can_mutate_catalog_empresa(empresa_id));
create policy categoria_insert_gate3_catalog_roles on public.categoria for insert to authenticated with check (public.can_mutate_catalog_empresa(empresa_id));
create policy categoria_update_gate3_catalog_roles on public.categoria for update to authenticated using (public.can_mutate_catalog_empresa(empresa_id)) with check (public.can_mutate_catalog_empresa(empresa_id));
create policy categoria_delete_gate3_catalog_roles on public.categoria for delete to authenticated using (public.can_mutate_catalog_empresa(empresa_id));
create policy producto_categoria_select_gate3_catalog_roles on public.producto_categoria for select to authenticated using (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id) and exists (select 1 from public.categoria c where c.id = categoria_id and c.empresa_id = producto_categoria.empresa_id));
create policy producto_categoria_insert_gate3_catalog_roles on public.producto_categoria for insert to authenticated with check (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id) and exists (select 1 from public.categoria c where c.id = categoria_id and c.empresa_id = producto_categoria.empresa_id));
create policy producto_categoria_update_gate3_catalog_roles on public.producto_categoria for update to authenticated using (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id) and exists (select 1 from public.categoria c where c.id = categoria_id and c.empresa_id = producto_categoria.empresa_id)) with check (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id) and exists (select 1 from public.categoria c where c.id = categoria_id and c.empresa_id = producto_categoria.empresa_id));
create policy producto_categoria_delete_gate3_catalog_roles on public.producto_categoria for delete to authenticated using (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id) and exists (select 1 from public.categoria c where c.id = categoria_id and c.empresa_id = producto_categoria.empresa_id));
create policy producto_variante_select_gate3_catalog_roles on public.producto_variante for select to authenticated using (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id));
create policy producto_variante_insert_gate3_catalog_roles on public.producto_variante for insert to authenticated with check (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id));
create policy producto_variante_update_gate3_catalog_roles on public.producto_variante for update to authenticated using (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id)) with check (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id));
create policy producto_variante_delete_gate3_catalog_roles on public.producto_variante for delete to authenticated using (public.can_mutate_catalog_empresa(empresa_id) and public.can_mutate_catalog_producto(producto_id));
create policy imagen_producto_select_gate3_catalog_roles on public.imagen_producto for select to authenticated using (public.can_mutate_catalog_producto(producto_id));
create policy imagen_producto_insert_gate3_catalog_roles on public.imagen_producto for insert to authenticated with check (public.can_mutate_catalog_producto(producto_id));
create policy imagen_producto_update_gate3_catalog_roles on public.imagen_producto for update to authenticated using (public.can_mutate_catalog_producto(producto_id)) with check (public.can_mutate_catalog_producto(producto_id));
create policy imagen_producto_delete_gate3_catalog_roles on public.imagen_producto for delete to authenticated using (public.can_mutate_catalog_producto(producto_id));
revoke all on public.producto, public.categoria, public.producto_categoria, public.producto_variante, public.imagen_producto from public, anon, authenticated;
grant select, insert, update, delete on public.producto, public.categoria, public.producto_categoria, public.producto_variante, public.imagen_producto to authenticated;
alter view public.producto_stock_resumen set (security_invoker = true);
revoke all on public.producto_stock_resumen from public, anon, authenticated;
grant select on public.producto_stock_resumen to authenticated;

-- The bucket remains private; its key is a five-segment tenant/product claim.
update storage.buckets set public = false where id = 'producto-imagenes';
drop policy if exists pi_read_public on storage.objects;
drop policy if exists pi_insert_member on storage.objects;
drop policy if exists pi_delete_member on storage.objects;
drop policy if exists producto_imagenes_select_catalog_staff on storage.objects;
drop policy if exists producto_imagenes_insert_catalog_staff on storage.objects;
drop policy if exists producto_imagenes_delete_catalog_staff on storage.objects;
create policy producto_imagenes_catalog_select on storage.objects for select to authenticated using (
  bucket_id = 'producto-imagenes' and name ~ '^empresa/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/producto/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/\\?#[:cntrl:]]+$'
  and split_part(name, '/', 5) not in ('.', '..')
  and public.can_mutate_catalog_empresa(split_part(name, '/', 2)::uuid)
  and public.can_mutate_catalog_producto(split_part(name, '/', 4)::uuid)
  and exists (select 1 from public.producto p where p.id = split_part(name, '/', 4)::uuid and p.empresa_id = split_part(name, '/', 2)::uuid));
create policy producto_imagenes_catalog_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'producto-imagenes' and name ~ '^empresa/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/producto/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/\\?#[:cntrl:]]+$'
  and split_part(name, '/', 5) not in ('.', '..')
  and public.can_mutate_catalog_empresa(split_part(name, '/', 2)::uuid)
  and public.can_mutate_catalog_producto(split_part(name, '/', 4)::uuid)
  and exists (select 1 from public.producto p where p.id = split_part(name, '/', 4)::uuid and p.empresa_id = split_part(name, '/', 2)::uuid));
create policy producto_imagenes_catalog_delete on storage.objects for delete to authenticated using (
  bucket_id = 'producto-imagenes' and name ~ '^empresa/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/producto/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/\\?#[:cntrl:]]+$'
  and split_part(name, '/', 5) not in ('.', '..')
  and public.can_mutate_catalog_empresa(split_part(name, '/', 2)::uuid)
  and public.can_mutate_catalog_producto(split_part(name, '/', 4)::uuid)
  and exists (select 1 from public.producto p where p.id = split_part(name, '/', 4)::uuid and p.empresa_id = split_part(name, '/', 2)::uuid));

revoke execute on function public.current_empresa_id() from public, anon, authenticated;
revoke execute on function public.uid() from public, anon, authenticated;
revoke execute on function public.is_empresa_owner(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_personal_org() from public, anon, authenticated;
revoke execute on function public.user_is_member_of(uuid) from public, anon, authenticated;
revoke execute on function public.can_manage_producto(uuid) from public, anon, authenticated;
revoke execute on function public.can_manage_producto_member(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.owns_carrito(uuid) from public, anon;
revoke execute on function public.owns_pedido(uuid) from public, anon;
grant execute on function public.owns_carrito(uuid), public.owns_pedido(uuid) to authenticated;

do $postflight$
declare
  policy_count bigint;
  policy_valid boolean;
begin
  with expected(relid, polname, polcmd) as (values
    ('public.producto'::regclass, 'producto_select_gate3_catalog_roles', 'r'), ('public.producto'::regclass, 'producto_insert_gate3_catalog_roles', 'a'), ('public.producto'::regclass, 'producto_update_gate3_catalog_roles', 'w'), ('public.producto'::regclass, 'producto_delete_gate3_catalog_roles', 'd'),
    ('public.categoria'::regclass, 'categoria_select_gate3_catalog_roles', 'r'), ('public.categoria'::regclass, 'categoria_insert_gate3_catalog_roles', 'a'), ('public.categoria'::regclass, 'categoria_update_gate3_catalog_roles', 'w'), ('public.categoria'::regclass, 'categoria_delete_gate3_catalog_roles', 'd'),
    ('public.producto_categoria'::regclass, 'producto_categoria_select_gate3_catalog_roles', 'r'), ('public.producto_categoria'::regclass, 'producto_categoria_insert_gate3_catalog_roles', 'a'), ('public.producto_categoria'::regclass, 'producto_categoria_update_gate3_catalog_roles', 'w'), ('public.producto_categoria'::regclass, 'producto_categoria_delete_gate3_catalog_roles', 'd'),
    ('public.producto_variante'::regclass, 'producto_variante_select_gate3_catalog_roles', 'r'), ('public.producto_variante'::regclass, 'producto_variante_insert_gate3_catalog_roles', 'a'), ('public.producto_variante'::regclass, 'producto_variante_update_gate3_catalog_roles', 'w'), ('public.producto_variante'::regclass, 'producto_variante_delete_gate3_catalog_roles', 'd'),
    ('public.imagen_producto'::regclass, 'imagen_producto_select_gate3_catalog_roles', 'r'), ('public.imagen_producto'::regclass, 'imagen_producto_insert_gate3_catalog_roles', 'a'), ('public.imagen_producto'::regclass, 'imagen_producto_update_gate3_catalog_roles', 'w'), ('public.imagen_producto'::regclass, 'imagen_producto_delete_gate3_catalog_roles', 'd'))
  select count(*), bool_and(p.oid is not null and p.polcmd = e.polcmd and p.polpermissive
      and p.polroles = array[(select oid from pg_roles where rolname = 'authenticated')]) into policy_count, policy_valid
  from expected e left join pg_policy p on p.polrelid = e.relid and p.polname = e.polname;
  if policy_count <> 20 or policy_valid is distinct from true
    or (select count(*) from pg_policy p where p.polrelid in ('public.producto'::regclass, 'public.categoria'::regclass,
      'public.producto_categoria'::regclass, 'public.producto_variante'::regclass, 'public.imagen_producto'::regclass)) <> 20 then
    raise exception 'gate3_post_catalog_policy_closure_invalid';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.membresia'::regclass
      and polname in ('membresia_delete_admins', 'membresia_insert_admins', 'membresia_select_members', 'membresia_update_admins'))
    or exists (select 1 from pg_trigger where tgrelid = 'public.usuario'::regclass and tgname = 'usuario_set_uid')
    or to_regprocedure('public.set_supabase_uid_from_jwt()') is not null
    or exists (select 1 from pg_policy where polrelid = 'public.usuario'::regclass and polname <> 'usuario_select_self')
    or not exists (select 1 from pg_policy where polrelid = 'public.usuario'::regclass and polname = 'usuario_select_self' and polcmd = 'r') then
    raise exception 'gate3_post_identity_policy_closure_invalid';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.usuario'::regclass and conname = 'usuario_supabase_uid_auth_fkey' and convalidated and pg_get_constraintdef(oid) like '%auth.users(id)%ON DELETE RESTRICT%')
    or not exists (select 1 from pg_constraint where conrelid = 'public.usuario'::regclass and conname = 'usuario_empresa_restrict_fkey' and convalidated and pg_get_constraintdef(oid) like '%empresa(id)%ON DELETE RESTRICT%')
    or not exists (select 1 from pg_constraint where conrelid = 'public.usuario'::regclass and conname = 'usuario_privileged_company_check' and convalidated)
    or not exists (select 1 from pg_constraint where conrelid = 'public.producto'::regclass and conname = 'producto_empresa_categoria_fkey' and convalidated) then
    raise exception 'gate3_post_constraint_closure_invalid';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
      and tgfoid = 'public.handle_new_auth_user()'::regprocedure and tgenabled = 'O')
    or not exists (select 1 from pg_proc p where p.oid = 'public.handle_new_auth_user()'::regprocedure and p.prosecdef
      and p.proconfig @> array['search_path=pg_catalog, public']) then
    raise exception 'gate3_post_trigger_contract_invalid';
  end if;
  if has_table_privilege('anon', 'public.usuario', 'select,insert,update,delete')
    or has_table_privilege('anon', 'public.empresa', 'select,insert,update,delete')
    or has_table_privilege('anon', 'public.producto', 'select,insert,update,delete')
    or not has_table_privilege('authenticated', 'public.usuario', 'select')
    or has_table_privilege('authenticated', 'public.usuario', 'insert,update,delete')
    or not has_table_privilege('authenticated', 'public.empresa', 'select')
    or has_table_privilege('authenticated', 'public.empresa', 'insert,update,delete') then
    raise exception 'gate3_post_relation_acl_invalid';
  end if;
  if exists (select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid in ('public.can_manage_producto(uuid)'::regprocedure, 'public.can_manage_producto_member(uuid)'::regprocedure,
        'public.can_mutate_catalog_empresa(uuid)'::regprocedure, 'public.can_mutate_catalog_producto(uuid)'::regprocedure,
        'public.current_empresa_id()'::regprocedure, 'public.ensure_personal_org()'::regprocedure,
        'public.handle_new_auth_user()'::regprocedure, 'public.is_empresa_owner(uuid)'::regprocedure,
        'public.owns_carrito(uuid)'::regprocedure, 'public.owns_pedido(uuid)'::regprocedure,
        'public.soft_delete_imagen_producto(uuid)'::regprocedure, 'public.uid()'::regprocedure,
        'public.user_is_member_of(uuid)'::regprocedure)
        and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
    raise exception 'gate3_post_public_execute_invalid';
  end if;
  if exists (select 1 from pg_proc p where p.oid = any(array[
      'public.can_manage_producto(uuid)'::regprocedure, 'public.can_manage_producto_member(uuid)'::regprocedure,
      'public.can_mutate_catalog_empresa(uuid)'::regprocedure, 'public.can_mutate_catalog_producto(uuid)'::regprocedure,
      'public.current_empresa_id()'::regprocedure, 'public.ensure_personal_org()'::regprocedure,
      'public.handle_new_auth_user()'::regprocedure, 'public.is_empresa_owner(uuid)'::regprocedure,
      'public.owns_carrito(uuid)'::regprocedure, 'public.owns_pedido(uuid)'::regprocedure,
      'public.soft_delete_imagen_producto(uuid)'::regprocedure, 'public.uid()'::regprocedure,
      'public.user_is_member_of(uuid)'::regprocedure]) and has_function_privilege('anon', p.oid, 'execute'))
    or not has_function_privilege('authenticated', 'public.can_mutate_catalog_empresa(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.can_mutate_catalog_producto(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.soft_delete_imagen_producto(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.owns_carrito(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.owns_pedido(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.ensure_personal_org()', 'execute')
    or has_function_privilege('authenticated', 'public.user_is_member_of(uuid)', 'execute') then
    raise exception 'gate3_post_routine_acl_invalid';
  end if;
  if not exists (select 1 from pg_class c where c.oid = 'public.producto_stock_resumen'::regclass
      and c.reloptions @> array['security_invoker=true'])
    or not exists (select 1 from storage.buckets where id = 'producto-imagenes' and not public) then
    raise exception 'gate3_post_preservation_anchor_invalid';
  end if;
end;
$postflight$;

end;
$migration$;

commit;
