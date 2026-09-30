-- Production identity and test-tenant cleanup for the Gate 3 preflight.
-- Survey and decisions: odd/tasks/production-readiness-survey.md
--
-- Decided by the user on 2026-09-29:
--   * keep the dssd admin's orders (2 paid in Raeyz): demote the profile to a
--     client without company instead of deleting it (profiles cascade to orders);
--   * delete the three profiles whose Auth user no longer exists;
--   * delete the test stores felpocompany and dssd, and the felpocompany admin profile;
--   * keep EMPRESA_SMOKE (the author recommended removing it); its admin f9f08b39
--     finishes onboarding so the Gate 3 identity check passes.
--
-- Every step re-checks the state surveyed on 2026-09-29 and aborts the whole
-- transaction if a row count differs. It ends in ROLLBACK (dry run); replace the
-- last line with COMMIT only for the authorized real run.
--
-- Not covered here (separate steps):
--   * Storage files of the deleted products, bucket producto-imagenes (Storage API,
--     not SQL): empresa/959f3d80-7665-48c9-ab00-91016c25157e/producto/2e524336-6e35-41df-aa60-6e4b77ec538c/b0234d24-9125-4359-be23-7b5c3bb973f9.webp,
--     2e524336-6e35-41df-aa60-6e4b77ec538c/272c56ce-c03b-46a1-a77c-aed176b2a1d0.png,
--     0480445f-8cdf-4f4f-85fe-699b0e0cee4e/b7c59b80-a823-4dde-9fbe-d0127d309bc6.jpg,
--     0480445f-8cdf-4f4f-85fe-699b0e0cee4e/c3a8c97c-0d37-461b-b96e-752af473f43c.jpg
--   * the felpocompany admin's Auth user (Dashboard > Authentication), after this runs.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $cleanup$
declare
  c_dssd constant uuid := '959f3d80-7665-48c9-ab00-91016c25157e';
  c_felpo constant uuid := 'cd325adc-10bb-422c-ac0a-dc11acfd32d8';
  c_dssd_admin constant uuid := '59f27744-3b2a-4a1f-8653-4e431cd143a5';
  c_felpo_admin constant uuid := '43692808-6856-4559-a0a2-24d659aa066d';
  c_orphans constant uuid[] := array[
    'b6292efd-d976-4c74-8e56-7db42515f684',
    '0fe4567d-93ec-46c7-84a0-60bcb812807f',
    'd4d7e1d5-6b41-4095-a130-42fd7cbb547e'
  ]::uuid[];
  c_smoke constant uuid := '1862d031-a8c8-4313-974c-daedad7749ae';
  c_smoke_admin constant uuid := 'f9f08b39-a4f0-426c-89ea-dc2e864273d8';
  n bigint;
  remaining uuid[];
begin
  -- 1. dssd admin -> client without company; its 7 orders stay untouched.
  update public.usuario
  set rol = 'cliente', empresa_id = null, onboarding = true
  where id = c_dssd_admin and rol = 'admin' and onboarding and empresa_id = c_dssd;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'cleanup_step1_dssd_admin: expected 1 row, got %', n; end if;

  -- 2. Profiles whose Auth user no longer exists and that nothing references.
  delete from public.usuario u
  where u.id = any (c_orphans)
    and not exists (select 1 from auth.users a where a.id = u.supabase_uid)
    and not exists (select 1 from public.pedido p where p.usuario_id = u.id)
    and not exists (select 1 from public.direccion_usuario d where d.usuario_id = u.id)
    and not exists (select 1 from public.carrito c where c.usuario_id = u.id)
    and not exists (select 1 from public.checkout_pedido_idempotencia i where i.usuario_id = u.id);
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'cleanup_step2_orphans: expected 3 rows, got %', n; end if;

  -- 3. felpocompany admin profile (no orders, addresses or carts).
  delete from public.usuario u
  where u.id = c_felpo_admin and u.rol = 'admin' and u.empresa_id = c_felpo
    and not exists (select 1 from public.pedido p where p.usuario_id = u.id)
    and not exists (select 1 from public.direccion_usuario d where d.usuario_id = u.id)
    and not exists (select 1 from public.carrito c where c.usuario_id = u.id)
    and not exists (select 1 from public.checkout_pedido_idempotencia i where i.usuario_id = u.id);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'cleanup_step3_felpo_admin: expected 1 row, got %', n; end if;

  -- 4. Test stores. Cascades to categories, products, variants, images rows and
  --    links; only if no order, order item, cart item or membership depends on them.
  if exists (select 1 from public.pedido p where p.empresa_id in (c_dssd, c_felpo))
     or exists (select 1 from public.pedido_item pi join public.producto p on p.id = pi.producto_id
                where p.empresa_id in (c_dssd, c_felpo))
     or exists (select 1 from public.carrito_producto cp join public.producto p on p.id = cp.producto_id
                where p.empresa_id in (c_dssd, c_felpo))
     or exists (select 1 from public.membresia m where m.empresa_id in (c_dssd, c_felpo)) then
    raise exception 'cleanup_step4_stores_referenced';
  end if;
  delete from public.empresa where id in (c_dssd, c_felpo);
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'cleanup_step4_stores: expected 2 rows, got %', n; end if;

  -- 5. EMPRESA_SMOKE admin (kept) leaves onboarding; admins in onboarding fail Gate 3.
  update public.usuario
  set onboarding = false
  where id = c_smoke_admin and rol = 'admin' and onboarding and empresa_id = c_smoke;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'cleanup_step5_smoke_admin: expected 1 row, got %', n; end if;

  -- 6. Postcondition: the Gate 3 identity check reports no row.
  select coalesce(array_agg(u.id), '{}') into remaining
  from public.usuario u
  left join auth.users a on a.id = u.supabase_uid
  left join public.empresa e on e.id = u.empresa_id
  where u.supabase_uid is null or a.id is null or lower(btrim(u.correo)) <> lower(btrim(a.email))
     or u.rol not in ('admin', 'staff', 'cliente')
     or (u.rol in ('admin', 'staff') and (u.empresa_id is null or u.onboarding or e.id is null))
     or (u.rol = 'cliente' and u.empresa_id is null and u.onboarding is not true);
  if remaining <> '{}'::uuid[] then
    raise exception 'cleanup_postcondition: unexpected identity rows %', remaining;
  end if;

  raise notice 'cleanup_ok';
end;
$cleanup$;

rollback;
