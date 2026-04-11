-- Seed LOCAL smoke data
-- Esta migración está pensada para db reset / entorno local
-- NO ejecutar en producción

begin;

-- =========================
-- EMPRESA
-- =========================
insert into public.empresa (id, nombre, descripcion, owner_auth, slug, created_by)
values (
  '1862d031-a8c8-4313-974c-daedad7749ae',
  'EMPRESA_SMOKE',
  'Empresa de prueba local para db reset + seed',
  null,
  'empresa-smoke',
  null
)
on conflict (id) do nothing;

-- =========================
-- USUARIOS SMOKE
-- =========================
-- Los usuarios autenticables smoke se bootstrappean por
-- Admin API después del db reset con:
--   pnpm smoke:bootstrap
--
-- Razón:
-- - evita sembrar filas fake en auth.users
-- - deja usuarios realmente logueables
-- - aprovecha el trigger handle_new_auth_user()
-- - evita drift entre auth y public.usuario

-- =========================
-- CATEGORÍAS
-- =========================
insert into public.categoria (id, nombre, descripcion, empresa_id, slug, orden)
values
  (
    '8490355f-8fc4-4956-9d34-d1d4b31d5c72',
    'Hombres',
    null,
    '1862d031-a8c8-4313-974c-daedad7749ae',
    'hombres',
    0
  ),
  (
    'f0f0f0f0-1111-2222-3333-444444444444',
    'Mujeres',
    null,
    '1862d031-a8c8-4313-974c-daedad7749ae',
    'mujeres',
    1
  )
on conflict (id) do nothing;

-- =========================
-- PRODUCTOS
-- =========================
insert into public.producto (
  id, nombre, descripcion, precio, stock, tipo,
  categoria_id, empresa_id, estado
)
values
  (
    'e94646a0-51bf-42e0-aaaa-000000000001',
    'Remera Básica',
    'Algodón',
    990,
    10,
    'ropa',
    '8490355f-8fc4-4956-9d34-d1d4b31d5c72',
    '1862d031-a8c8-4313-974c-daedad7749ae',
    'draft'
  ),
  (
    'e94646a0-51bf-42e0-aaaa-000000000002',
    'Pantalón Cargo',
    'Gabardina',
    1990,
    5,
    'ropa',
    'f0f0f0f0-1111-2222-3333-444444444444',
    '1862d031-a8c8-4313-974c-daedad7749ae',
    'draft'
  )
on conflict (id) do nothing;

-- =========================
-- PUENTE producto_categoria (A3)
-- =========================
insert into public.producto_categoria (empresa_id, producto_id, categoria_id)
values
  (
    '1862d031-a8c8-4313-974c-daedad7749ae',
    'e94646a0-51bf-42e0-aaaa-000000000001',
    '8490355f-8fc4-4956-9d34-d1d4b31d5c72'
  ),
  (
    '1862d031-a8c8-4313-974c-daedad7749ae',
    'e94646a0-51bf-42e0-aaaa-000000000002',
    'f0f0f0f0-1111-2222-3333-444444444444'
  )
on conflict do nothing;


-- La dirección smoke del buyer también se crea en el bootstrap
-- para que quede enlazada a un usuario real de auth.



commit;
