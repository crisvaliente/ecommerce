# Gate 4 — Checkout availability guard

Order creation must never accept something the store cannot deliver: unpublished products and quantities above stock are rejected before the buyer pays. One new migration also realigns production, whose `crear_pedido_con_items` lacks the `variante_sin_stock` checks (drift).
Branch `fix/checkout-availability-guard` from `master` `11d74f5`. Local disposable Supabase only; production push, PR and merge are separate user decisions.

## Specs

Gate definition accepted by the user (audit report, section F, row "4. Integridad del checkout"):

> "Que nunca se pueda pagar algo que no se puede entregar"
> "Se rechaza un producto no publicado; se rechaza una cantidad mayor al stock (simple y variante); la deriva de producción queda alineada con una migración nueva, sin editar la `20260331120000`"
> "Pruebas de base con un caso por regla; las suites existentes de idempotencia del checkout y de pedidos siguen en verde"

- **S1 — "Se rechaza un producto no publicado".** An item whose product `estado` is not `published` (today only `draft` can exist, see L4) makes order creation fail with `producto_no_disponible`; `POST /api/ecommerce/pedido` answers `409 { "error": "producto_no_disponible" }`. No `pedido`, `pedido_item` or idempotency row is left behind and stock is unchanged. A product of another company still fails first with `producto_no_pertenece_a_empresa` (no availability leak across companies).
- **S2 — "se rechaza una cantidad mayor al stock (simple y variante)".** The quantity requested for a simple product (`usa_variantes = false`, `producto.stock`) or for a variant (`producto_variante.stock`), summed across all lines of the order, must not exceed its stock; otherwise order creation fails with `stock_insuficiente` and the API answers `409 { "error": "stock_insuficiente" }`. A quantity equal to the stock is accepted. Same no-side-effect guarantees as S1. A variant with stock `0` keeps failing with the existing `variante_sin_stock` (`400`).
- **S3 — "la deriva de producción queda alineada con una migración nueva, sin editar la `20260331120000`".** A new migration redefines `public.crear_pedido_con_items(uuid, uuid, uuid, jsonb)` with the full repository checks plus S1 and S2; `20260331120000` is not edited. Execute stays restricted to `service_role`. The check is advisory (no reservation): `consolidar_pago_pedido` remains the final authority with row locks.
- **S4 — "las suites existentes de idempotencia del checkout y de pedidos siguen en verde".** Existing checkout and order behavior holds: valid orders are created with the server-side price, idempotent replay is unchanged, existing error codes keep their HTTP status.
- **S5 — Buyer message.** The cart shows a clear message for the new codes: `producto_no_disponible` → "Algunos productos ya no están disponibles. Revisá el carrito."; `stock_insuficiente` → "No hay stock suficiente para alguna de las cantidades. Revisá el carrito."
- **S6 — Docs.** `docs/operations/lanzamiento-raeyz.md` and `docs/integrations/mercadopago/checkout-webhook-flow.md` describe the new guard and that production still needs the migration pushed.

## Tasks

| ID | Specs | Route | Commit |
|---|---|---|---|
| T1 ✅ | S1, S2, S3, S4 | inline: migration + `scripts/checkout-availability-db.test.mjs` (RED on the production-like local DB, GREEN after applying) | — |
| T2 ✅ | S1, S2, S4, S5 | inline: API status mapping + `orderError` moved to `src/lib/buyerCheckout.ts`, tests | — |
| T3 ✅ | S6 | inline: docs | — |
| T4 | S1–S6 | independent `gentle-ai-verify` (high risk: migration on checkout) + full suites | — |

## Log

- **L1** (user, 2026-10-29): "dame primero el cuestionario y luego empezamos con gate 4"
- **L2** (evidence): local DB at ledger 75 reproduces production drift: `crear_pedido_con_items` has no `variante_sin_stock` check (`prosrc` count 0). Current repo definition (`20260331120000:96-145`) checks neither `producto.estado` nor `producto.stock`, and variants only `stock <= 0`.
- **L3** (decision): new codes answer `409` (state conflict, not a malformed request); `variante_sin_stock` keeps `400` to preserve the existing contract. Out of scope: the double price read in `crear_pedido_con_items` (launch checklist follow-up).
- **L4** (evidence): `producto` has two active CHECK constraints, `producto_estado_check` (`draft`, `published`) and `producto_estado_valido` (`draft`, `published`, `paused`, `archived`); their intersection allows only `draft` and `published`. S1 rejects every state other than `published`, so it also covers states a future migration may enable. The overlapping constraints are a follow-up, not part of this gate.
- **L5** (T1 evidence): RED before the migration, `ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --test scripts/checkout-availability-db.test.mjs` exit 1, 3/7 pass: the four new rules failed naturally (`expected: 'producto_no_disponible' | 'stock_insuficiente' | 'variante_sin_stock'`, `actual: ~`, the order was created); the preservation tests (foreign product precedence, execute privileges, valid order) passed. No fixture leftovers afterwards. Migration applied locally with `docker exec -i … psql < migration` and `supabase migration repair --status applied 20261029120000 --local` (ledger 76, `search_path=""`). GREEN: availability 7/7, `checkout-idempotency-db` 3/3, `order-operations-db` 8/8, `catalog-pending-order-guard-db` 23/23.
- **L6** (T2 evidence): RED: `checkout-order-api.test.mjs` 1/2 (new codes not 409; existing responses passed on the old code), `buyer-checkout.test.mjs` failed on the missing `checkoutOrderError` export. GREEN: 11/11 across both files. The S4 cases enumerate the previous API responses and cart messages, passing on the old and the new code (differential evidence).
- **L7** (T3): `docs/integrations/mercadopago/checkout-webhook-flow.md` describes the guard and its advisory nature; `docs/operations/lanzamiento-raeyz.md` keeps the drift item open until the migration is pushed to production, and records the overlapping estado constraints.
