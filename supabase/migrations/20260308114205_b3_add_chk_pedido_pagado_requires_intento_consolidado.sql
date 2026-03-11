-- B3 Consolidación de Pago
-- Un pedido pagado debe referenciar el intento que produjo su consolidación

alter table public.pedido
add constraint pedido_pagado_requiere_intento_consolidado_chk
check (
  estado <> 'pagado'::pedido_estado
  or intento_pago_consolidado_id is not null
);