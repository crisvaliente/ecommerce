# AGENTS.md

## Objetivo
Mantener Raeyz estable, claro y seguro para pre-lanzamiento.

## Prioridades
1. Corregir bugs reales antes de agregar features.
2. Preservar integridad de pedidos, pagos y stock.
3. Evitar duplicación de lógica de negocio.
4. Favorecer cambios pequeños, auditables y reversibles.

## Reglas de revisión
- Verificar idempotencia en flujos de pago y webhook.
- No permitir actualizaciones de stock no atómicas.
- Validar manejo explícito de errores y logs útiles.
- Evitar estados ambiguos en pedidos e intentos de pago.
- Revisar permisos, secretos y uso de variables de entorno.
- Señalar acoplamiento innecesario entre UI y lógica de negocio.
- Priorizar claridad sobre abstracción prematura.

## Estándares
- TypeScript estricto cuando aplique.
- Nombres claros y consistentes.
- Funciones pequeñas con responsabilidad definida.
- Sin código muerto ni comentarios engañosos.
- Tests o al menos pasos de validación cuando el cambio toque pagos, stock o consolidación.