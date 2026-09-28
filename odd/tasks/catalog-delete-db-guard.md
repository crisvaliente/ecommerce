# Database guard: catalog deletes vs. pending orders

## Authorization and scope

Follow-up 1 of `products-delete.md`. The user asked for a read-only survey first, then authorized the slice ("sino mandale"), including a new migration and a local disposable Supabase (apply with `psql`, ledger via `supabase migration repair --local`, DB tests with `ALLOW_LOCAL_SUPABASE_MUTATIONS=1`). No production database, PR or merge. Gate 3 OPEN; Unit 3 FROZEN.

Files: `supabase/migrations/20260928190000_catalog_delete_pending_order_guard.sql`, `scripts/product-delete-guard-db.test.mjs`, `src/pages/api/panel/productos.ts`, `scripts/panel-productos-api.test.mjs`.

## Survey findings

- Three panel actions break consolidation of a `pendiente_pago` order that is paid later: deleting the product, deleting a variant (`ProductForm.tsx` deletes `producto_variante` directly from the browser), and switching `usa_variantes`.
- Impact: `procesar_notificacion_intento_pago` rolls back, the webhook returns 500 `rpc_failed`, the receipt is `error`; the buyer paid, the attempt stays `iniciado`, the order stays `pendiente_pago`.
- `pedido_item` has RLS enabled with no policies, so the guard must be `SECURITY DEFINER`.
- The `pedido_item` FKs take `KEY SHARE` on the referenced row and `DELETE` needs `FOR UPDATE`, so a `BEFORE DELETE` trigger is atomic against a concurrent order insert. An `UPDATE` of `usa_variantes` does not conflict with `KEY SHARE`, and `crear_pedido_con_items` reads the product without locks, so the mode switch needs a checkout RPC change (separate slice).
- Local DB: Gate 3 applied; ledger had 67 rows, missing the two known pending migrations `20260903130000` and `20260913120000` (so `migration up` was not used). No index on `pedido_item(producto_id|variante_id)`.

## Contract

- `BEFORE DELETE` triggers on `producto` and `producto_variante` run `public.reject_delete_in_pending_order()` (`SECURITY DEFINER`, `search_path = ''`, `EXECUTE` revoked from public/anon/authenticated). A row referenced by an item of a `pendiente_pago` order with `expira_en > now()` raises `producto_en_pedido_activo` with SQLSTATE `55006`. Expired, paid, blocked and cancelled orders do not block. Cascades (product → variants, company → products) are guarded too.
- New indexes `pedido_item_producto_idx` and `pedido_item_variante_idx` (also used by the existing `ON DELETE SET NULL`).
- API `DELETE /api/panel/productos` drops its app-level pre-check and maps `55006` → 409 `producto_en_pedido_activo`; the rule now lives only in the database.
- `ProductForm` variant deletes are now blocked too, with its generic error message (UI copy unchanged).

## Progress

- [x] DG-1 — Validation: containers healthy, FKs/RLS confirmed in the live local schema, baseline DB tests 44/44. Bug reproduced with a throwaway probe (removed): product delete → `integridad_inesperada … items sin producto_id`; variant delete → `… variante inválida o inconsistente`.
- [x] DG-2 — RED: 3 guard tests failed (delete succeeded); the 4 allowed-delete cases passed.
- [x] DG-3 — GREEN: migration applied locally with `psql`, recorded with `supabase migration repair --status applied 20260928190000 --local` (ledger 68 rows). DB guard test 7/7 including the held-transaction concurrency case.
- [x] DG-4 — API: RED 7 failures after removing the pre-check expectations; GREEN 33/33.
- [x] DG-5 — One full parallel DB run failed once in `checkout-idempotency-db` ("preference persistence…"); it passed alone 3/3, in pairs 3/3 and in 6 more full parallel runs, no leftover rows. The test deletes no catalog rows and cleans orders before products. Recorded as unexplained, not reproduced.
- [x] DG-6 — Native review `review-412c718747091128` (medium, only `review-reliability`, 331 lines, budget 166). Relay skipped (8 prior refusals); the same lens as a direct subagent found no blockers. WARNING timing-based concurrency test → now waits for a `held` marker from the held transaction; SUGGESTIONs `bloqueado` case and sibling-variant case → added. Manual risk review: no blockers.
- [x] DG-7 — The rewritten guard tests fail against the local DB with the triggers disabled (3 failures) and pass with them enabled; triggers re-enabled (`O`). Final checks: panel suite 213/213, all 7 DB test files in parallel 64/64, `tsc`, scoped ESLint and `git diff --check` exit 0. Diff 348 lines, 4 files.

## Follow-ups

- Production apply is a separate decision; check the remote migration ledger first (known drift).
- `usa_variantes` switch vs. pending orders (needs checkout RPC locking).
- Friendlier `ProductForm` message for `producto_en_pedido_activo`.
