# Mercado Pago — checkout + webhook flow

## Resumen ejecutivo

El flujo real tiene dos mitades:

1. **Apertura del checkout**: el backend crea o reutiliza un `intento_pago`, crea una preference en Mercado Pago y devuelve `init_point`.
2. **Cierre soberano**: el webhook valida autenticidad, consulta el payment real en Mercado Pago, correlaciona por `external_reference`, actualiza `intento_pago` y recién ahí intenta consolidar el `pedido`.

El retorno del navegador (`/checkout/resultado`) es solo una señal de UX. NO define por sí solo que el pedido quedó pagado.

## Flujo paso a paso

### 1) Usuario inicia compra

Desde `src/pages/coleccion/index.tsx`, si el usuario tiene sesión y dirección válida, la UI crea el pedido y luego abre el checkout de Mercado Pago.

### 2) API crea o reutiliza intento interno

`POST /api/ecommerce/intento-pago` (`src/pages/api/ecommerce/intento-pago.ts`):

- exige `POST`
- aplica rate limit (`10` requests por minuto)
- valida origin confiable cuando corresponde
- exige sesión válida de Supabase
- resuelve `usuario.id` interno desde `supabase_uid`
- llama a `public.crear_intento_pago(p_usuario_id, p_pedido_id, 'mercadopago')`

La RPC puede devolver:

- `creado`
- `reutilizado`
- `pedido_no_encontrado`
- `pedido_expirado`
- `pedido_bloqueado`
- `pedido_no_pagable`

### 3) Backend crea la preference en Mercado Pago

Si el intento quedó bien:

- lee `pedido.total` y `pedido.expira_en`
- arma `notification_url = {APP_BASE_URL}/api/webhooks/mercadopago`
- arma `back_urls` hacia `/checkout/resultado?pedido_id=...&status=...`
- crea la preference en `https://api.mercadopago.com/checkout/preferences`

Payload relevante:

- `external_reference = intento_pago.id`
- `notification_url`
- `date_of_expiration = pedido.expira_en`
- `items[0].id = pedido.id`
- `items[0].unit_price = pedido.total`

Si Mercado Pago responde bien:

- se guarda `preference_id` en `intento_pago`
- se devuelve `201` con `intento_pago.id`, `pedido_id`, `preference_id` e `init_point`

Si la creación de la preference falla:

- el intento interno queda en `iniciado`
- la API responde `502 mercadopago_preference_error`
- el diseño actual permite reintentar la apertura del bridge sin compensación automática

### 4) Usuario completa checkout en Mercado Pago

Mercado Pago redirige al usuario a una `back_url` de éxito, pendiente o fallo.

La página `src/pages/checkout/resultado.tsx`:

- muestra el retorno del proveedor
- consulta `/api/ecommerce/pedido/:id`
- informa el **estado real** del pedido (`pagado`, `pendiente_pago`, `bloqueado`, etc.)

Esto evita confundir “retornó success” con “pedido ya consolidado”. Bien ahí, porque CONCEPTO > humo visual.

### 5) Mercado Pago llama al webhook

`POST /api/webhooks/mercadopago` (`src/pages/api/webhooks/mercadopago/index.ts`):

- aplica rate limit (`120` requests por minuto)
- exige configuración mínima del servidor
- toma `paymentId` desde `query[data.id]`, `body.data.id` o `query.id`
- procesa solo eventos `payment`

### 6) Validación de autenticidad

Modo normal:

- valida `x-signature`
- valida `x-request-id`
- usa `MERCADOPAGO_WEBHOOK_SECRET`
- arma el manifest `id:{paymentId};request-id:{xRequestId};ts:{ts};`
- compara HMAC SHA-256
- rechaza timestamps inválidos, viejos o futuros

Modos especiales:

- `MP_WEBHOOK_DEV_MODE=1` + header `x-dev-webhook-bypass: 1` permite bypass local controlado
- `MP_WEBHOOK_ALLOW_LOOKUP_FALLBACK=1` solo fuera de producción permite lookup fallback si falla la firma pero hay `paymentId`

Si no hay firma válida ni fallback permitido, responde `401 invalid_webhook_signature`.

### 7) Registro de recepción y deduplicación

Si la firma es válida:

- inserta una fila en `webhook_recepcion_mp`
- deduplica por `x_request_id`
- deduplica por `provider_event_id` cuando viene informado

Si detecta duplicado, absorbe el evento con `200 duplicate_delivery`.

### 8) Lookup del payment real en Mercado Pago

El webhook NO confía ciegamente en el payload recibido.

- hace `GET https://api.mercadopago.com/v1/payments/{paymentId}`
- usa esa respuesta como snapshot confirmado del pago

Si el lookup falla, responde `502 payment_lookup_failed`.

### 9) Correlación interna soberana

Del payment resuelto toma:

- `externalId = payment.id`
- `externalReference = payment.external_reference`
- `mpStatus = payment.status`

La correlación ocurre así:

- `externalReference` debe existir
- `externalReference` debe coincidir con un `intento_pago.id`

Si no existe `external_reference` o no correlaciona con un intento real, el webhook absorbe el caso sin consolidar.

### 10) Snapshot operativo sobre `intento_pago`

Antes de la transición de negocio, el webhook actualiza en `intento_pago`:

- `external_id`
- `notificado_en`
- `ultimo_evento_tipo`
- `ultimo_evento_payload`

Esto deja trazabilidad útil aunque la consolidación falle más adelante.

### 11) Traducción de estado MP -> estado interno

Mapeo actual:

- `approved` -> `aprobado`
- `rejected` -> `rechazado`
- `cancelled` -> `cancelado`
- cualquier otro estado -> se absorbe como `payment_status_ignored`

### 12) RPC de transición y consolidación

El webhook llama:

`public.procesar_notificacion_intento_pago(p_intento_pago_id, p_estado_objetivo)`

Comportamiento:

- valida existencia del intento
- evita transiciones inválidas
- hace idempotencia si el intento ya estaba en ese estado
- si el nuevo estado es `aprobado`, dispara `public.consolidar_pago_pedido(...)`

`consolidar_pago_pedido(...)` recién considera éxito real cuando:

- el pedido sigue siendo consolidable
- no está expirado
- no fue consolidado por otro intento
- el stock y las invariantes internas permiten cerrar el pedido

### 13) Resultado final

Casos sanos:

- `sin_cambios_idempotente`
- `intento_actualizado`
- `intento_aprobado_y_consolidado`

Caso crítico especial:

- `intento_aprobado_no_consolidado` -> HTTP `409 payment_approved_not_consolidated`

Ese caso es IMPORTANTÍSIMO: Mercado Pago aprobó, pero el dominio interno no pudo consolidar el pedido. Ahí hay que operar, no esconder el problema.

## Diagrama mental simple

```text
coleccion -> pedido -> /api/ecommerce/intento-pago
          -> crear_intento_pago()
          -> preference MP (external_reference = intento_pago.id)
          -> init_point
          -> usuario paga en MP

MP -> /api/webhooks/mercadopago
   -> validar firma / deduplicar
   -> GET /v1/payments/{id}
   -> external_reference -> intento_pago.id
   -> actualizar snapshot intento_pago
   -> procesar_notificacion_intento_pago()
   -> consolidar_pago_pedido()
   -> pedido pagado / absorbido / error operativo
```
