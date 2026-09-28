begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- consolidar_pago_pedido raises integridad_inesperada when an item's variante_id
-- no longer matches producto.usa_variantes, so a pending order also blocks
-- switching the product's variant mode.
--
-- Concurrency: usa_variantes is not a key column, so the UPDATE only takes
-- FOR NO KEY UPDATE, which does not conflict with the KEY SHARE of a concurrent
-- pedido_item insert. The update trigger takes FOR UPDATE on the row to wait for
-- that insert; the insert trigger takes FOR KEY SHARE to wait for an uncommitted
-- switch, because crear_pedido_con_items reads the mode without locks.

-- Shared by the delete and mode-switch guards. Mirrors the states in which
-- consolidar_pago_pedido still runs: pendiente_pago before expira_en.
create or replace function public.is_in_pending_order(p_producto_id uuid, p_variante_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pedido_item pi
    join public.pedido p on p.id = pi.pedido_id
    where (pi.producto_id = p_producto_id or pi.variante_id = p_variante_id)
      and p.estado = 'pendiente_pago'::public.pedido_estado
      and p.expira_en > now()
  );
$$;

revoke all on function public.is_in_pending_order(uuid, uuid) from public, anon, authenticated;

create or replace function public.reject_delete_in_pending_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SECURITY DEFINER: pedido_item has RLS without policies, so panel users
  -- deleting through RLS would otherwise see no order items.
  if (tg_table_name = 'producto' and public.is_in_pending_order(old.id, null))
    or (tg_table_name = 'producto_variante' and public.is_in_pending_order(null, old.id)) then
    raise exception 'producto_en_pedido_activo' using errcode = '55006';
  end if;

  return old;
end;
$$;

create or replace function public.reject_variant_mode_switch_in_pending_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.producto where id = old.id for update;

  if public.is_in_pending_order(old.id, null) then
    raise exception 'producto_en_pedido_activo' using errcode = '55006';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_variant_mode_switch_in_pending_order() from public, anon, authenticated;

drop trigger if exists trg_producto_reject_variant_mode_switch_in_pending_order on public.producto;
create trigger trg_producto_reject_variant_mode_switch_in_pending_order
  before update of usa_variantes on public.producto
  for each row
  when (old.usa_variantes is distinct from new.usa_variantes)
  execute function public.reject_variant_mode_switch_in_pending_order();

-- Uses the error messages crear_pedido_con_items already raises, which the
-- checkout API maps to 400.
create or replace function public.reject_pedido_item_variant_mode_mismatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usa_variantes boolean;
begin
  select p.usa_variantes
  into v_usa_variantes
  from public.producto p
  where p.id = new.producto_id
  for key share;

  if v_usa_variantes is true and new.variante_id is null then
    raise exception using message = 'variante_id_required';
  elsif v_usa_variantes is false and new.variante_id is not null then
    raise exception using message = 'variante_no_pertenece_al_producto';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_pedido_item_variant_mode_mismatch() from public, anon, authenticated;

drop trigger if exists trg_pedido_item_reject_variant_mode_mismatch on public.pedido_item;
create trigger trg_pedido_item_reject_variant_mode_mismatch
  before insert on public.pedido_item
  for each row execute function public.reject_pedido_item_variant_mode_mismatch();

commit;
