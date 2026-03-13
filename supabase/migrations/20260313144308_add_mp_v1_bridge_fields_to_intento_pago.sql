alter table public.intento_pago
  add column if not exists preference_id text null,
  add column if not exists notificado_en timestamptz null,
  add column if not exists ultimo_evento_tipo text null,
  add column if not exists ultimo_evento_payload jsonb null;

comment on column public.intento_pago.preference_id
  is 'ID de preference/checkout creado en Mercado Pago para el intento_pago';

comment on column public.intento_pago.notificado_en
  is 'Timestamp de la ultima notificacion webhook procesada para este intento_pago';

comment on column public.intento_pago.ultimo_evento_tipo
  is 'Tipo/topic del ultimo evento recibido desde el proveedor de pagos';

comment on column public.intento_pago.ultimo_evento_payload
  is 'Payload minimo del ultimo evento recibido para debugging operativo';