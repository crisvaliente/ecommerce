select
  p.id as producto_id,
  p.empresa_id,
  p.usa_variantes,
  p.stock as stock_base,
  case
    when p.usa_variantes = false then p.stock
    else coalesce(sum(case when pv.activo then pv.stock else 0 end), 0)
  end as stock_efectivo
from producto p
left join producto_variante pv
  on pv.producto_id = p.id
 and pv.empresa_id = p.empresa_id
where p.empresa_id = '1862d031-a8c8-4313-974c-daedad7749ae'
group by p.id, p.empresa_id, p.usa_variantes, p.stock
order by p.id;
