# Mercado Pago — operational checklist

## 1. Configuración mínima requerida

### API `intento-pago`

Variables necesarias en `src/pages/api/ecommerce/intento-pago.ts`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `APP_BASE_URL`

### Webhook

Variables necesarias en `src/pages/api/webhooks/mercadopago/index.ts`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`

### Flags opcionales de desarrollo

- `MP_WEBHOOK_DEV_MODE=1`
- `MP_WEBHOOK_ALLOW_LOOKUP_FALLBACK=1`
- `MP_WEBHOOK_MAX_SIGNATURE_AGE_SECONDS` (default `300`)
- `MP_WEBHOOK_DEBUG_FULL=true` solo para diagnóstico puntual

## 2. Checklist de wiring funcional

Antes de probar, verificar:

- `APP_BASE_URL` apunta al host público correcto
- la `notification_url` generada termina en `/api/webhooks/mercadopago`
- Mercado Pago tiene configurado el secret correcto para la firma del webhook
- las migraciones de `intento_pago`, hardening del webhook y fases MP están aplicadas
- existe reachability pública real del endpoint webhook

## 3. Checklist de flujo sano

Para considerar sano el circuito mínimo:

- el usuario autenticado puede crear pedido
- `POST /api/ecommerce/intento-pago` responde `201`
- se guarda `preference_id` en `intento_pago`
- el browser recibe `init_point`
- Mercado Pago llama al webhook con evento `payment`
- el webhook valida firma o entra en un modo permitido de desarrollo
- se registra recepción en `webhook_recepcion_mp`
- `intento_pago.external_id` queda persistido
- `procesar_notificacion_intento_pago(...)` devuelve éxito semántico
- si el pago fue `approved`, el `pedido` queda en `pagado` con `intento_pago_consolidado_id`

## 4. Qué mirar en base de datos

### Tabla `intento_pago`

Campos clave:

- `id`
- `pedido_id`
- `estado`
- `canal_pago`
- `external_id`
- `preference_id`
- `notificado_en`
- `ultimo_evento_tipo`
- `ultimo_evento_payload`

Validaciones prácticas:

- `external_id` debe reflejar el `payment.id` de Mercado Pago
- `preference_id` debe existir después de crear la preference
- `ultimo_evento_payload` debe reflejar el snapshot confirmado del payment lookup

### Tabla `pedido`

Validar:

- `estado`
- `intento_pago_consolidado_id`
- vigencia de `expira_en`

La combinación más fuerte de éxito real es:

- `pedido.estado = pagado`
- `pedido.intento_pago_consolidado_id = intento_pago.id`

### Tabla `webhook_recepcion_mp`

Mirar:

- `x_request_id`
- `provider_event_id`
- `payment_id`
- `verification_mode`
- `estado`
- `detalle`
- `trace_id`
- `procesado_en`

## 5. Checklist de validación manual

### Prueba de apertura del checkout

- iniciar sesión con usuario real de prueba
- generar pedido vigente
- ejecutar compra desde colección
- confirmar redirección a Mercado Pago
- confirmar que aparece `preference_id` en DB

### Prueba de webhook

- completar pago en sandbox o entorno controlado
- verificar llegada de `POST /api/webhooks/mercadopago`
- verificar logs: `incoming`, `signature`, `payment_lookup`, `rpc`, `payment processed`
- validar registro en `webhook_recepcion_mp`
- validar transición final de `intento_pago` y `pedido`

### Prueba de idempotencia

- reenviar el mismo evento o repetir entrega
- confirmar absorción por `duplicate_delivery`
- confirmar ausencia de doble consolidación

## 6. Señales de salud operativa

Buenas señales:

- `reason: payment_processed`
- `rpc.codigo_resultado = intento_aprobado_y_consolidado`
- `verification_mode = signature`
- `webhook_recepcion_mp.estado = procesado`

Señales de alerta:

- `invalid_webhook_signature`
- `payment_lookup_failed`
- `payment_not_correlatable`
- `payment_approved_not_consolidated`
- `rpc_semantic_failure`

### Excepción conocida

En producción puede aparecer un `401 invalid_signature` asociado a una notificación legacy `?id=...&topic=payment`. Si al mismo tiempo existe un registro `procesado` en `webhook_recepcion_mp`, `payment processed` en logs y el `pedido` queda `pagado`, tratarlo como **ruido residual no bloqueante**, no como caída del circuito principal.

## 7. Regla operativa clave

Si el retorno del checkout dice success pero el `pedido` sigue `pendiente_pago`, NO vendas humo. El estado canónico sigue siendo el del backend y hay que revisar webhook, correlación y consolidación.
