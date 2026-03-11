-- B3 Consolidación de Pago
-- FK mínima para registrar qué intento consolidó el pedido

alter table public.pedido
add constraint fk_pedido_intento_pago_consolidado
foreign key (intento_pago_consolidado_id)
references public.intento_pago(id)
on delete restrict;