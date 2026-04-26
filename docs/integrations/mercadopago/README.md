# Mercado Pago

Esta carpeta documenta el comportamiento real de la integración de checkout en `ecommerce`.

## Objetivo

Dejar claro cómo viaja un pedido desde la tienda hasta la consolidación final del pago, qué piezas participan y cómo operar la integración sin adivinar.

## Mapa rápido

- `checkout-webhook-flow.md` — flujo end-to-end desde la creación del intento hasta la consolidación
- `operational-checklist.md` — checklist técnico y operativo para sandbox, producción y validación manual
- `troubleshooting.md` — fallas típicas, síntomas y caminos de diagnóstico

## Piezas principales del sistema

- `src/pages/api/ecommerce/intento-pago.ts` — crea o reutiliza `intento_pago`, arma la preference y devuelve `init_point`
- `src/pages/api/webhooks/mercadopago/index.ts` — valida firma, deduplica, consulta el payment en MP y procesa la notificación
- `src/pages/checkout/resultado.tsx` — muestra el retorno del proveedor, pero confirma el estado real consultando el pedido interno
- `supabase/migrations/20260411173000_mp_phase4a_reuse_active_intento_pago.sql` — RPC `crear_intento_pago`
- `supabase/migrations/20260410120000_mp_phase1_fix_consolidation_semantics.sql` — RPC `procesar_notificacion_intento_pago` y `consolidar_pago_pedido`
- `supabase/migrations/20260416190000_mp_webhook_receipt_hardening.sql` — tabla de recepción de webhooks para anti-replay, deduplicación y auditoría

## Decisiones importantes

- La correlación soberana no depende del retorno del browser sino del webhook.
- `external_reference` en Mercado Pago se carga con `intento_pago.id`.
- La verdad final del pago vive en el estado del `pedido` y en `pedido.intento_pago_consolidado_id`, no en el `status` de la URL de retorno.
- El sistema absorbe eventos no útiles o no correlacionables sin romper, pero falla fuerte cuando no puede validar firma, registrar recepción o ejecutar la transición interna.
