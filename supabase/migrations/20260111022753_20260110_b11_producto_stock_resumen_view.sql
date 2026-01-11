BEGIN;

CREATE OR REPLACE VIEW public.producto_stock_resumen AS
SELECT
  p.empresa_id,
  p.id AS producto_id,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.producto_variante pv
      WHERE pv.empresa_id = p.empresa_id
        AND pv.producto_id = p.id
    )
    THEN COALESCE((
      SELECT SUM(pv2.stock)
      FROM public.producto_variante pv2
      WHERE pv2.empresa_id = p.empresa_id
        AND pv2.producto_id = p.id
        AND pv2.activo = true
    ), 0)
    ELSE p.stock
  END AS stock_total,
  EXISTS (
    SELECT 1
    FROM public.producto_variante pv3
    WHERE pv3.empresa_id = p.empresa_id
      AND pv3.producto_id = p.id
  ) AS usa_variantes
FROM public.producto p;

COMMIT;
