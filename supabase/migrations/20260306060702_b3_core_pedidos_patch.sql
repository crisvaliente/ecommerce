-- B3 Core Patch
-- Objetivo:
-- 1) eliminar FK duplicada en pedido.direccion_envio_id
-- 2) endurecer pedido.estado como NOT NULL
-- 3) agregar defaults + trigger de timestamps en pedido

begin;

-- =========================================================
-- 1) LIMPIEZA: FK duplicada en pedido.direccion_envio_id
-- =========================================================

alter table public.pedido
  drop constraint if exists pedido_direccion_envio_id_fkey;

-- =========================================================
-- 2) PEDIDO: defaults en timestamps
-- =========================================================

alter table public.pedido
  alter column creado_en set default now(),
  alter column actualizado_en set default now();

-- =========================================================
-- 3) FUNCIÓN: mantener actualizado_en en UPDATE
-- =========================================================

create or replace function public.set_pedido_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- =========================================================
-- 4) TRIGGER: updated_at automático
-- =========================================================

drop trigger if exists trg_pedido_set_actualizado_en on public.pedido;

create trigger trg_pedido_set_actualizado_en
before update on public.pedido
for each row
execute function public.set_pedido_actualizado_en();

-- =========================================================
-- 5) BACKFILL defensivo + endurecer estado
-- =========================================================

update public.pedido
set estado = 'pendiente_pago'::public.pedido_estado
where estado is null;

alter table public.pedido
  alter column estado set not null;

commit;