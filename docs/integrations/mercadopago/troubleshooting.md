# Mercado Pago — troubleshooting

## 1. `mercadopago_preference_error` al abrir checkout

### Síntoma

`POST /api/ecommerce/intento-pago` devuelve `502`.

### Qué significa

El intento interno pudo haberse creado o reutilizado, pero falló la creación de la preference en Mercado Pago o vino una respuesta inválida.

### Revisar

- `MERCADOPAGO_ACCESS_TOKEN`
- `APP_BASE_URL`
- logs `[intento-pago] mp response`
- existencia de `pedido.total` y `pedido.expira_en`

### Nota

El intento puede quedar en `iniciado`. Reintentar puede ser válido porque el diseño actual permite reabrir el bridge.

---

## 2. `invalid_webhook_signature`

### Síntoma

El webhook devuelve `401`.

### Qué significa

La autenticidad del evento no pudo validarse y tampoco había fallback permitido.

### Revisar

- `MERCADOPAGO_WEBHOOK_SECRET`
- headers `x-signature` y `x-request-id`
- presencia de `query[data.id]`
- skew de reloj (`ts` viejo o futuro)
- si estás en desarrollo, si corresponde usar `MP_WEBHOOK_DEV_MODE` o `MP_WEBHOOK_ALLOW_LOOKUP_FALLBACK`

### Ojo

En producción no deberías depender del fallback. Eso es muleta de laboratorio, no contrato operativo.

---

## 3. `payment_lookup_failed`

### Síntoma

El webhook recibió el evento pero no pudo resolver `GET /v1/payments/{id}`.

### Revisar

- `MERCADOPAGO_ACCESS_TOKEN`
- conectividad saliente
- `paymentId` resuelto por el webhook
- respuesta HTTP real de Mercado Pago en logs

### Impacto

Sin lookup confirmado, el sistema no confía en el payload y no debería consolidar. Y está BIEN que sea así.

---

## 4. `payment_without_external_reference`

### Síntoma

El payment existe, pero no trae `external_reference`.

### Qué significa

No se puede correlacionar soberanamente con `intento_pago.id`.

### Revisar

- payload enviado al crear la preference
- que `external_reference = intento_pago.id` se haya mandado correctamente
- si el payment consultado corresponde realmente a esta app/entorno

---

## 5. `payment_not_correlatable`

### Síntoma

`external_reference` existe, pero no coincide con ningún `intento_pago` real.

### Revisar

- si estás apuntando a la misma base de datos del checkout que originó el pago
- si el `external_reference` pertenece a otro entorno
- si hubo limpieza o inconsistencia de datos

### Idea clave

Acá el problema no es “Mercado Pago anda mal”. El problema es de correlación entre sistemas.

---

## 6. `payment_status_ignored`

### Síntoma

Mercado Pago devolvió un estado que no se mapea a `aprobado`, `rechazado` o `cancelado`.

### Revisar

- `payment.status` real en el lookup
- si el estado es transitorio y requiere esperar otro webhook

### Comportamiento esperado

El sistema absorbe el evento y deja trazabilidad, pero no fuerza una transición de dominio inventada.

---

## 7. `payment_approved_not_consolidated`

### Síntoma

Mercado Pago aprobó el pago, pero el webhook responde `409`.

### Qué significa

La aprobación del proveedor no logró cerrarse como pedido pagado en el dominio interno.

### Revisar

- `rpc.codigo_resultado`
- `consolidacion_codigo`
- `pedido_estado_final`
- `intento_pago_consolidado_id`
- expiración del pedido
- invariantes de stock y consistencia del pedido

### Esto es serio

No es un falso error de frontend. Es una divergencia entre proveedor y dominio. Hay que tratarlo como incidente operativo.

---

## 8. `duplicate_delivery`

### Síntoma

El webhook responde `200`, pero absorbido por duplicado.

### Qué significa

Llegó la misma entrega otra vez y fue frenada por `x_request_id` o `provider_event_id`.

### Resultado esperado

Es saludable. Significa que la deduplicación está funcionando y evita doble procesamiento.

---

## 9. El checkout volvió con `success`, pero el pedido sigue `pendiente_pago`

### Qué significa

El browser recibió una señal del proveedor, pero el backend todavía no consolidó.

### Revisar en orden

1. si llegó el webhook
2. si pasó la validación de firma
3. si hubo lookup exitoso del payment
4. si correlacionó por `external_reference`
5. si la RPC devolvió `intento_aprobado_y_consolidado`

### Regla

La pantalla de retorno no manda. Manda el estado real del `pedido`.

---

## 10. Logs que conviene buscar

En `src/pages/api/webhooks/mercadopago/index.ts`:

- `[mp-webhook] incoming`
- `[mp-webhook] signature`
- `[mp-webhook] receipt_registration`
- `[mp-webhook] payment_lookup`
- `[mp-webhook] correlation`
- `[mp-webhook] snapshot_update`
- `[mp-webhook] rpc`
- `[mp-webhook] payment processed`

En `src/pages/api/ecommerce/intento-pago.ts`:

- `[intento-pago] rpc row`
- `[intento-pago] pedidoRow`
- `[intento-pago] mp response`
- `[intento-pago] mp parsed`
- `[intento-pago] update intento_pago`
