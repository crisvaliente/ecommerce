# Sales no longer unpublish simple products

## Authorization and scope

Finding from the S1a slice (`pasar-a-variantes-rpc.md`); the user accepted fixing it before S1b ("dale"). New migration applied only to the local disposable Supabase (`psql` + `supabase migration repair --local`); DB tests with `ALLOW_LOCAL_SUPABASE_MUTATIONS=1`. No production database, data repair, PR or merge. Gate 3 OPEN; Unit 3 FROZEN.

Files: `supabase/migrations/20260929130000_autodraft_ignores_stock.sql`, `scripts/catalog-pending-order-guard-db.test.mjs`.

## Finding

`trg_producto_auto_draft_on_update` returns a published product to draft when any column other than `estado`/`updated_at` changes. `consolidar_pago_pedido` updates `producto.stock` for simple products, so every consolidated sale unpublished the product (local repro: `{"estado":"draft","stock":9}` after a sale). Variant products were not affected (their stock lives in `producto_variante`).

## Contract

- `producto_auto_draft_on_update` also ignores `stock`: sales and stock-only edits keep a published product published.
- Content edits still return it to draft, including a combined stock + content update (the ProductForm case); an explicit `estado` change is still respected; switching to variants still drafts a published product (`usa_variantes` changes).
- The `SECURITY DEFINER` function now has `search_path = ''` (it had none).
- Not included: repairing products already unpublished by past sales (production state unknown).

## Progress

- [x] AD-1 — RED: both new tests failed naturally (`estado: draft` after a sale and after a stock-only update).
- [x] AD-2 — GREEN: migration applied locally; guard DB test 20/20; all 7 DB test files in parallel 76/76. A control run before applying showed exactly the 2 new tests failing and everything else passing.
- [x] AD-3 — Native review `review-7fe5db0b4f077909` (medium, only `review-reliability`, 61 lines); the lens as a direct subagent found no blockers. WARNING combined stock + content update untested → added; SUGGESTION mode switch should still draft → asserted. Final 20/20, scoped ESLint and `git diff --check` exit 0. Diff 67 lines.

## Follow-ups

- Before a production launch, list published-then-drafted simple products (e.g. drafted right after a consolidated sale) and decide whether to republish them.
