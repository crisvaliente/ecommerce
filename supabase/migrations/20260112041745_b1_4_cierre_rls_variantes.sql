-- =========================================================
-- B1.4 — Cierre RLS Variantes + Vista resumen stock
-- Objetivo:
-- - Habilitar CRUD tenant-safe sobre producto_variante
-- - Permitir SELECT sobre producto_stock_resumen
-- - Sin tocar frontend
-- =========================================================

begin;

-- =========================
-- 1) GRANTS base
-- =========================
grant usage on schema public to authenticated;

grant select, insert, update, delete
on table public.producto_variante
to authenticated;

grant select
on table public.producto
to authenticated;

grant select
on public.producto_stock_resumen
to authenticated;


-- =========================
-- 2) RLS en producto_variante
-- =========================
alter table public.producto_variante
enable row level security;

-- =========================
-- 3) Policies producto_variante (FIX auth.uid)
-- =========================
drop policy if exists producto_variante_select_empresa
  on public.producto_variante;

drop policy if exists producto_variante_insert_empresa
  on public.producto_variante;

drop policy if exists producto_variante_update_empresa
  on public.producto_variante;

drop policy if exists producto_variante_delete_empresa
  on public.producto_variante;

create policy producto_variante_select_empresa
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
);

create policy producto_variante_insert_empresa
on public.producto_variante
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
);

create policy producto_variante_update_empresa
on public.producto_variante
for update
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
)
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
);

create policy producto_variante_delete_empresa
on public.producto_variante
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto_variante.empresa_id
  )
);

-- =========================
-- 4) Vista stock resumen
-- =========================
alter view public.producto_stock_resumen
set (security_invoker = true);

commit;
