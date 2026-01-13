-- B1.5 — imagen_producto: alinear permisos con membership (usuario) en vez de owner_auth
-- Objetivo: evitar conflicto producto (membership) vs imagen_producto (owner)
-- No se modifica can_manage_producto() existente (owner-only), se agrega función nueva.

begin;

-- 1) Función nueva basada en membership de empresa (tabla usuario)
create or replace function public.can_manage_producto_member(p_producto uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.producto pr
    join public.usuario u
      on u.empresa_id = pr.empresa_id
    where pr.id = p_producto
      and u.supabase_uid = auth.uid()
  );
$$;

-- 2) Policies imagen_producto: usar la nueva función (membership)
-- Nota: mantenemos ip_sel_public tal cual (SELECT true) y no lo tocamos.

-- DROP y recreate para evitar edge-cases de ALTER POLICY en distintos entornos
drop policy if exists ip_ins_owner on public.imagen_producto;
drop policy if exists ip_upd_owner on public.imagen_producto;
drop policy if exists ip_del_owner on public.imagen_producto;

create policy ip_ins_owner
on public.imagen_producto
for insert
to authenticated
with check (public.can_manage_producto_member(producto_id));

create policy ip_upd_owner
on public.imagen_producto
for update
to authenticated
using (public.can_manage_producto_member(producto_id))
with check (public.can_manage_producto_member(producto_id));

create policy ip_del_owner
on public.imagen_producto
for delete
to authenticated
using (public.can_manage_producto_member(producto_id));

commit;
