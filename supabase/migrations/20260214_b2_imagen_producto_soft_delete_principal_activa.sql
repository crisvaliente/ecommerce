begin;

-- 1) Agregar soft delete
alter table public.imagen_producto
  add column if not exists deleted_at timestamptz null;

-- 2) Reemplazar índice de principal única
drop index if exists public.ux_ip_one_principal_per_producto;

create unique index ux_ip_one_principal_per_producto
  on public.imagen_producto (producto_id)
  where (es_principal = true and deleted_at is null);

commit;
