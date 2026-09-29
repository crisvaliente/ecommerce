# ProductForm no longer overwrites sales (S2)

## Authorization and scope

Fourth slice of the ProductForm plan (after S0, S1a, the auto-draft fix and S1b). The user chose the small client-side option ("solo si cambió + comparar"): no migration, no API route; product and variant saves stay direct browser writes under RLS (moving them to the API is a later slice). DB test against the local disposable Supabase with `ALLOW_LOCAL_SUPABASE_MUTATIONS=1`. No PR or merge. Gate 3 OPEN; Unit 3 FROZEN.

Files: `src/lib/productStockWrite.ts` (new), `scripts/product-stock-write.test.mjs` (new), `src/pages/panel/productos/ProductForm.tsx`, `scripts/catalog-pending-order-guard-db.test.mjs`.

## Bug

`consolidar_pago_pedido` decrements `producto.stock` (simple products) and `producto_variante.stock` relatively, under `FOR UPDATE`. ProductForm wrote the absolute stock loaded at page open on every product save (even a rename) and on every variant save, so a sale made while the form was open was overwritten (stock inflated → oversell). A blank or invalid stock field was also coerced to 0.

## Contract

- `planStockWrite(readStock, formStock)`: `null` when the stock did not change or the input is invalid; otherwise `{ stock, expectedStock }`.
- Product edit: stock is written only when changed, in the same `UPDATE` with `.eq("stock", expectedStock)` (compare-and-set; the single statement re-checks the condition after waiting for a concurrent row lock). Zero rows → `STOCK_CONFLICT_MESSAGE` and nothing is saved; after a successful stock write the read value is updated. Non-stock edits never touch stock and cannot conflict. Variant-mode products never write `producto.stock`.
- Variant edit: same compare-and-set against the loaded row in the variants list; a variant missing from the list aborts before writing; after a conflict the list is refreshed.
- `parseStockInput`: stock must be a non-negative integer; blank or invalid input is rejected with `INVALID_STOCK_MESSAGE` instead of becoming 0. Exception: a new variant may leave stock blank (0). The publish checklist and product creation use the same rule (a simple product now needs an explicit stock, `0` included).
- Known limits: after a product conflict the form keeps showing the stale stock and the message asks to reload the page (the product loader lives in an effect); still direct browser writes.

## Progress

- [x] SC-1 — RED: stub helpers → 5/5 unit failures (behavior, not a missing module).
- [x] SC-2 — GREEN: helper + ProductForm; unit 15/15 with the mapper tests; `pnpm exec tsc --noEmit --incremental false` exit 0.
- [x] SC-3 — DB characterization (not RED; it passes without the app change): with a real consolidated sale and a panel admin JWT under RLS, for product and variant, the write against the value read before the sale updates 0 rows and keeps the sale, the write against the current value applies, and the old absolute write overwrites the stored stock.
- [x] SC-4 — Native review `review-f191effe8c4c1fb7` (only `review-reliability`, 150 lines; the lens as a direct subagent). CRITICAL blank/invalid variant stock coerced to 0 would now be a deliberate change zeroing real stock → RED (3 failures with a `parseStockInput` stub) then GREEN; WARNING `planStockWrite(10, "")` untested → covered; SUGGESTION variant-mode products never write product stock → asserted. CRITICAL static-only ProductForm checks → accepted (repo style; behavior covered by the pure helpers and the DB test). WARNING no refetch after a product conflict → accepted and documented (no data loss; message asks to reload).
- [x] SC-5 — Final: panel + helpers 245/245; guard DB test 23/23; all 7 DB test files in parallel 79/79 before the review fixes; scoped ESLint, `tsc` and `git diff --check` exit 0. Diff 191 lines.

## Follow-ups

- Move product and variant saves to the panel API (server-side compare-and-set, P4 parity).
- Refresh the product stock after a conflict instead of asking to reload.
