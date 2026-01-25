# Evidencia — Contrato Stock Efectivo (B1)

## Timestamp
2026-01-25 02:44 (UTC-3)

## Dataset
empresa_id (EMPRESA_SMOKE): 1862d031-a8c8-4313-974c-daedad7749ae

## Query canonical (texto exacto)
```sql
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


Outputs (reales)
Q1 — usa_variantes = false (stock base)
Esperado: stock_efectivo = stock_base

[
  {
    "producto_id": "d0a3d100-99b3-4ba2-97de-69073c1bddb9",
    "empresa_id": "1862d031-a8c8-4313-974c-daedad7749ae",
    "usa_variantes": false,
    "stock_base": 7,
    "stock_efectivo": 7
  }
]
Q2 — usa_variantes = true + variantes activas
Esperado: stock_efectivo = SUM(stock variantes activas)

[
  {
    "producto_id": "3e13dd89-4742-4bdd-8dba-7854cf73ff48",
    "empresa_id": "1862d031-a8c8-4313-974c-daedad7749ae",
    "usa_variantes": true,
    "stock_base": 0,
    "stock_efectivo": 3
  }
]
Q3 — usa_variantes = true + todas las variantes inactivas
Esperado: stock_efectivo = 0

[
  {
    "producto_id": "3e13dd89-4742-4bdd-8dba-7854cf73ff48",
    "empresa_id": "1862d031-a8c8-4313-974c-daedad7749ae",
    "usa_variantes": true,
    "stock_base": 0,
    "stock_efectivo": 0
  }
]


Conclusión
El stock efectivo queda definido por una única consulta canonical:

Si usa_variantes = false → stock_efectivo = producto.stock

Si usa_variantes = true → stock_efectivo = SUM(stock de variantes activas)

Si no hay variantes activas → stock_efectivo = 0

Q1 / Q2 / Q3 verificados con outputs reales sobre EMPRESA_SMOKE.
Esta query se establece como fuente única de verdad para el cálculo de stock efectivo (B1).




Cuando lo pegues:
1) guardás el archivo  
2) hacés el **commit único**  
3) cerrás sesión  

Dormí tranquilo. Esto quedó **sólido, limpio y bien cerrado**. 🌙