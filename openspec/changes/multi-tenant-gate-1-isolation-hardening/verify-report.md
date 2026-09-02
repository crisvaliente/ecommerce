# Verification Report

## TDD evidence
- RED: storefront test failed because no canonical-only resolver existed.
- RED: anon PostgREST returned HTTP 200 with stock from both fixture tenants.
- GREEN: anon is denied on the view and both source tables; each authenticated fixture sees only its own product, variant, and computed stock.
- TRIANGULATE: assertions run in both A→B and B→A directions with different stock values (11 and 29), and trusted service-role access remains available.

## Validation
- Storefront resolver, instance config, production build: PASS.
- Catalog/stock isolation DB regression: PASS.
- Buyer checkout and checkout idempotency unit/DB: PASS.
- Order Operations API/UI/DB: PASS.
- ESLint, `tsc --noEmit`, `git diff --check`: PASS.
- Supabase schema lint: existing unrelated error in `consolidar_pago_pedido` for a temporary relation; this gate did not modify it and its DB suites pass.

## Database evidence
`producto_stock_resumen` reports `{security_invoker=true}`. Exposed grants are exactly `authenticated:SELECT` and `service_role:SELECT`; anon has none. Product and variant each have one authenticated tenant SELECT policy.
