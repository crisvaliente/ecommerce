-- B3 Consolidación de Pago
-- Soporte estructural mínimo para registrar el intento que consolidó el pedido

alter table public.pedido
add column intento_pago_consolidado_id uuid;