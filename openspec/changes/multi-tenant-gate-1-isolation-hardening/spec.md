# Isolation Requirements

1. `public.producto_stock_resumen` MUST use `security_invoker = true`.
2. `anon` MUST NOT have direct SELECT authority over the stock view or its source tables.
3. `authenticated` users MUST see catalog and stock rows only for the `empresa_id` assigned to their `public.usuario` record.
4. Filtering PostgREST by another `empresa_id` MUST return no rows, not disclose that tenant's stock.
5. The storefront MUST ignore visitor-supplied `empresa_id` and resolve only the configured canonical store slug.
6. The canonical storefront and authenticated panel stock consumers MUST remain operational.
7. Checkout and Order Operations contracts MUST remain unchanged.
