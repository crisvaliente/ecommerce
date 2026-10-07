# Atomic "Pasar a variantes" RPC (S1a)

## Authorization and scope

Second slice of the ProductForm plan (S0 → S1a → S1b → S2). The user accepted zeroing `producto.stock` when switching to variants. New migration applied only to the local disposable Supabase (`psql` + `supabase migration repair --local`, PostgREST schema reload); DB tests with `ALLOW_LOCAL_SUPABASE_MUTATIONS=1`. The panel API route and the UI switch are S1b. No production database, PR or merge. Gate 3 OPEN; Unit 3 FROZEN.

Files: `supabase/migrations/20260929120000_pasar_producto_a_variantes.sql`, `scripts/catalog-pending-order-guard-db.test.mjs`.

## Contract

`public.pasar_producto_a_variantes(p_producto_id, p_empresa_id)` → `(ok, codigo_resultado, variante_id, stock_migrado)`; `SECURITY DEFINER`, `row_security = off`, execute only for `service_role`. In one transaction:

- Locks the product `FOR UPDATE` scoped by company (the same lock `consolidar_pago_pedido` takes before decrementing simple stock, so the migrated stock is current).
- Not found in the company → `producto_no_encontrado`; already in variant mode → `ya_usa_variantes`; neither changes anything.
- `max(stock, 0) > 0` moves into the oldest single-size leftover (`lower(talle)` in único/unico/general; stock overwritten, activated) or a new "Único" variant; any other active single-size leftover is deactivated so the stock is not counted twice (the talle index folds case but not accents). Other variants (e.g. "M") are untouched. Zero or negative stock creates no variant.
- Sets `usa_variantes = true` and `stock = 0`. A product in a pending order is rejected by the existing trigger (`55006 producto_en_pedido_activo`) and the whole call rolls back: no stray variant.
- Known, unchanged: `trg_producto_auto_draft_on_update` sets a published product to draft on this update, as the old browser flow did.

## Finding recorded during this slice (not fixed here)

Every consolidated sale of a **published simple product** sets it to **draft**: `consolidar_pago_pedido` updates `producto.stock`, and `producto_auto_draft_on_update` treats any non-`estado` change as an edit. Reproduced locally with a throwaway probe (removed): after the sale `{"estado":"draft","stock":9}`; variant products stay published. Proposed as the next priority slice.

## Progress

- [x] PV-1 — RED: 5 new tests failed because the function did not exist (absence, not behavior — there was no previous DB behavior to test).
- [x] PV-2 — GREEN: migration applied locally; guard DB test 18/18; all 7 DB test files in parallel 74/74; panel suite 221/221.
- [x] PV-3 — Native review `review-4fd1447619007c05` (medium, only `review-reliability`, 181 lines; the first START returned an expired consent binding and was restarted). Lens as a direct subagent: CRITICAL two single-size leftovers (e.g. "Único" and "Unico") could double-count stock → RED (the second leftover stayed active with 5) then GREEN by deactivating other single-size leftovers; WARNING negative stock untested → covered (-2 → 0 migrated, no variant); SUGGESTION unrelated variants untouched → asserted ("M" unchanged).
- [x] PV-4 — Final: guard DB test 18/18, DB suite 74/74, scoped ESLint and `git diff --check` exit 0. Diff 200 lines, 2 files.
