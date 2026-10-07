begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- consolidar_pago_pedido raises integridad_inesperada when a pending order lost
-- pedido_item.producto_id or variante_id (both ON DELETE SET NULL), leaving a paid
-- attempt on an order that cannot consolidate. Consolidation only runs for
-- pendiente_pago orders before expira_en, so only those block the delete.
--
-- Concurrency: the pedido_item FKs take KEY SHARE on the referenced row and a
-- DELETE needs FOR UPDATE, so the trigger runs after a concurrent order insert
-- commits and sees its item; an order inserted after the delete fails its FK.

create index if not exists pedido_item_producto_idx on public.pedido_item (producto_id);
create index if not exists pedido_item_variante_idx on public.pedido_item (variante_id);

create or replace function public.reject_delete_in_pending_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_pending_order boolean;
begin
  -- SECURITY DEFINER: pedido_item has RLS without policies, so panel users
  -- deleting through RLS would otherwise see no order items.
  if tg_table_name = 'producto' then
    select exists (
      select 1
      from public.pedido_item pi
      join public.pedido p on p.id = pi.pedido_id
      where pi.producto_id = old.id
        and p.estado = 'pendiente_pago'::public.pedido_estado
        and p.expira_en > now()
    ) into v_in_pending_order;
  else
    select exists (
      select 1
      from public.pedido_item pi
      join public.pedido p on p.id = pi.pedido_id
      where pi.variante_id = old.id
        and p.estado = 'pendiente_pago'::public.pedido_estado
        and p.expira_en > now()
    ) into v_in_pending_order;
  end if;

  if v_in_pending_order then
    raise exception 'producto_en_pedido_activo' using errcode = '55006';
  end if;

  return old;
end;
$$;

revoke all on function public.reject_delete_in_pending_order() from public, anon, authenticated;

drop trigger if exists trg_producto_reject_delete_in_pending_order on public.producto;
create trigger trg_producto_reject_delete_in_pending_order
  before delete on public.producto
  for each row execute function public.reject_delete_in_pending_order();

drop trigger if exists trg_producto_variante_reject_delete_in_pending_order on public.producto_variante;
create trigger trg_producto_variante_reject_delete_in_pending_order
  before delete on public.producto_variante
  for each row execute function public.reject_delete_in_pending_order();

commit;
