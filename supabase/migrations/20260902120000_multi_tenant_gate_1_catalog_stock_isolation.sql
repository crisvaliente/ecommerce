begin;

-- Recreated views lose reloptions unless they are explicitly restored. Execute this
-- view with the caller's privileges so source-table RLS remains authoritative.
alter view public.producto_stock_resumen
set (security_invoker = true);

-- The public storefront reads through its trusted server client. Direct PostgREST
-- stock reads are limited to authenticated tenant users and trusted server jobs.
revoke all on table public.producto_stock_resumen
from public, anon, authenticated, service_role;
grant select on table public.producto_stock_resumen to authenticated, service_role;

-- Remove historical SELECT policies that either exposed every tenant or delegated
-- to legacy membership helpers. Keep one explicit operational tenancy authority.
drop policy if exists producto_public_sel on public.producto;
drop policy if exists producto_select_empresa on public.producto;
drop policy if exists producto_tenant_select on public.producto;
drop policy if exists "usuario puede ver productos de su empresa" on public.producto;
drop policy if exists producto_select_tenant_authenticated on public.producto;

create policy producto_select_tenant_authenticated
on public.producto
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto.empresa_id
  )
);

-- The view reads active variants under the same caller, so variant SELECT must use
-- the same canonical usuario.empresa_id boundary without legacy helper functions.
drop policy if exists producto_variante_select_empresa on public.producto_variante;
drop policy if exists producto_variante_select_manage on public.producto_variante;
drop policy if exists producto_variante_select_tenant_authenticated on public.producto_variante;

create policy producto_variante_select_tenant_authenticated
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
  and exists (
    select 1
    from public.producto p
    where p.id = producto_variante.producto_id
      and p.empresa_id = producto_variante.empresa_id
  )
);

-- Do not expose either source table to anonymous PostgREST callers. Authenticated
-- grants are retained for the panel and are constrained by the policies above.
revoke select on table public.producto from public, anon;
revoke select on table public.producto_variante from public, anon;
grant select on table public.producto, public.producto_variante to authenticated, service_role;

commit;
