begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Switches a simple product to variant mode in one transaction: the simple
-- stock moves into a single "Único" variant and producto.stock becomes 0, so
-- no stock is counted twice. The panel used to do this in three browser calls
-- (read stock, insert variant, switch mode); a rejected switch left a stray
-- variant and a sale consolidated in between was lost.
--
-- The product row is locked FOR UPDATE, which consolidar_pago_pedido also takes
-- before decrementing simple stock, so the migrated stock is current. A product
-- in a pending order is rejected by trg_producto_reject_variant_mode_switch_in_pending_order
-- (SQLSTATE 55006) and the whole call rolls back.
create or replace function public.pasar_producto_a_variantes(
  p_producto_id uuid,
  p_empresa_id uuid
)
returns table (
  ok boolean,
  codigo_resultado text,
  variante_id uuid,
  stock_migrado integer
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
set row_security = off
as $function$
declare
  v_producto public.producto%rowtype;
  v_stock integer;
  v_variante_id uuid;
begin
  if p_producto_id is null or p_empresa_id is null then
    raise exception using
      errcode = '22004',
      message = 'variant_mode_required_parameter_missing';
  end if;

  select p.*
  into v_producto
  from public.producto p
  where p.id = p_producto_id
    and p.empresa_id = p_empresa_id
  for update;

  if not found then
    return query select false, 'producto_no_encontrado'::text, null::uuid, 0;
    return;
  end if;

  if v_producto.usa_variantes then
    return query select true, 'ya_usa_variantes'::text, null::uuid, 0;
    return;
  end if;

  v_stock := greatest(coalesce(v_producto.stock, 0), 0);

  if v_stock > 0 then
    -- Reuse a single-size variant left by the old browser flow; a simple
    -- product's variants are not sold, so the current simple stock wins.
    update public.producto_variante pv
    set stock = v_stock,
        activo = true
    where pv.id = (
      select v.id
      from public.producto_variante v
      where v.producto_id = p_producto_id
        and v.empresa_id = p_empresa_id
        and lower(v.talle) in ('único', 'unico', 'general')
      order by v.creado_en, v.id
      limit 1
    )
    returning pv.id into v_variante_id;

    if v_variante_id is null then
      insert into public.producto_variante (empresa_id, producto_id, talle, stock, activo)
      values (p_empresa_id, p_producto_id, 'Único', v_stock, true)
      returning id into v_variante_id;
    end if;

    -- The talle index folds case but not accents, so "Único" and "Unico" can
    -- both exist; any other active single-size leftover would count the
    -- migrated stock twice once variant mode is on.
    update public.producto_variante pv
    set activo = false
    where pv.producto_id = p_producto_id
      and pv.empresa_id = p_empresa_id
      and lower(pv.talle) in ('único', 'unico', 'general')
      and pv.id <> v_variante_id
      and pv.activo;
  end if;

  update public.producto
  set usa_variantes = true,
      stock = 0
  where id = p_producto_id;

  return query select true, 'modo_variantes_activado'::text, v_variante_id, v_stock;
end;
$function$;

revoke execute on function public.pasar_producto_a_variantes(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pasar_producto_a_variantes(uuid, uuid) to service_role;

comment on function public.pasar_producto_a_variantes(uuid, uuid) is
  'Atomically moves a simple product''s stock into a single variant and enables variant mode; service role only.';

commit;
