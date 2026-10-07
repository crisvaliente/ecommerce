# Database guard: variant-mode switch vs. pending orders

## Authorization and scope

Follow-up of `catalog-delete-db-guard.md`. The user asked for a read-only survey first, then accepted the proposed design ("si"): a new migration applied only to the local disposable Supabase (`psql` + `supabase migration repair --local`) and DB tests with `ALLOW_LOCAL_SUPABASE_MUTATIONS=1`. No production database, checkout function body, PR or merge. Gate 3 OPEN; Unit 3 FROZEN.

Files: `supabase/migrations/20260928210000_variant_mode_pending_order_guard.sql`, `scripts/catalog-pending-order-guard-db.test.mjs` (renamed from `product-delete-guard-db.test.mjs`).

## Survey findings

- `usa_variantes` writers: `ProductForm.tsx:840` (right after creating a product; no orders yet) and `handlePasarAVariantes` (false → true); admins can also update it through PostgREST in both directions. `consolidar_pago_pedido` rejects both mismatches with `integridad_inesperada`.
- `usa_variantes` is not a key column, so its `UPDATE` takes `FOR NO KEY UPDATE`, which does not conflict with the `KEY SHARE` taken by the `pedido_item` FK. `crear_pedido_con_items` (20260331) reads the product twice with plain `SELECT` (no locks in the live function). Both race directions were open.
- Not addressed: `crear_pedido_con_items` reads `precio` once for `pedido.total` and again for the items, so a concurrent price change can make them differ (low); `handlePasarAVariantes` inserts the "Único" variant before switching the mode (non-atomic; a retry reuses the variant).

## Contract

- `public.is_in_pending_order(producto_id, variante_id)`: shared predicate (item of a `pendiente_pago` order with `expira_en > now()`), `SECURITY DEFINER`, `search_path = ''`, not executable by `anon`/`authenticated`. `reject_delete_in_pending_order` now uses it (same behavior).
- `BEFORE UPDATE OF usa_variantes` on `producto` (only when the value changes): takes `FOR UPDATE` on the row to wait for a concurrent order insert, then rejects with `producto_en_pedido_activo` / SQLSTATE `55006` if the product is in a pending order. Other product updates are unaffected.
- `BEFORE INSERT` on `pedido_item`: reads `usa_variantes` with `FOR KEY SHARE` (waits for an uncommitted switch, then sees the committed mode) and raises `variante_id_required` or `variante_no_pertenece_al_producto`, messages the checkout API already maps to 400. A rejected checkout leaves no order.
- Known limit: a checkout can wait for an in-flight mode switch and vice versa; the switch is a single-statement PostgREST update bounded by the role statement timeout.

## Progress

- [x] VM-1 — RED: 3 of 4 new tests failed; the toggle-first race created an order with a stale simple item on a variant-mode product (the consolidation-breaking case).
- [x] VM-2 — GREEN: migration applied locally (ledger repaired for `20260928210000`); guard DB test 12/12.
- [x] VM-3 — Regression: all 7 DB test files in parallel 68/68 (twice); panel suite 213/213; `test:buyer-checkout` 7/7; `test:checkout-idempotency` 16/16. With the two new triggers disabled exactly the 3 guard tests fail; triggers re-enabled (`O`).
- [x] VM-4 — Native review `review-c4f127b74b1b312d` (medium, only `review-reliability`; it counts the rename as 613 lines, real diff ~195). The lens as a direct subagent found no blockers. WARNING missing ACL test for `is_in_pending_order` → added (fails when `EXECUTE` is granted to API roles, passes with the revoke; revoke restored). WARNING runtime lock waits without an explicit timeout → accepted and documented. SUGGESTION variant-level race symmetry → not added (covered by the shared predicate).
- [x] VM-5 — Final: guard DB test 13/13, scoped ESLint and `git diff --check` exit 0.

## Follow-ups

- Production apply of `20260928190000` and `20260928210000` after checking the remote migration ledger.
- `ProductForm`: friendly message for `producto_en_pedido_activo`; make "Pasar a variantes" atomic.
- Price read twice in `crear_pedido_con_items`.
