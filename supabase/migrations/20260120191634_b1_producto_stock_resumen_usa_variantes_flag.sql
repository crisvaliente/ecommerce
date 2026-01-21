begin;

create or replace view public.producto_stock_resumen as
select
  p.empresa_id,
  p.id as producto_id,
  case
    when p.usa_variantes = true then
      coalesce((
        select sum(pv.stock)::bigint
        from public.producto_variante pv
        where pv.empresa_id = p.empresa_id
          and pv.producto_id = p.id
          and pv.activo = true
      ), 0::bigint)
    else
      p.stock::bigint
  end as stock_total,
  p.usa_variantes as usa_variantes
from public.producto p;

commit;
