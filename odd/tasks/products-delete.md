# Product delete through the panel API

## Authorization and scope

User accepted the next P4 slice ("seguimos"): move the product delete in `src/pages/panel/productos/index.tsx` from a direct browser `supabase.from("producto").delete()` to `/api/panel/productos`. Survey found a pre-existing order/payment integrity bug; the user chose an API-level guard now ("API + guard en la API"), with an atomic DB trigger as a later slice. Gate 3 OPEN; Unit 3 FROZEN. No SQL/DB, migration, build, browser run, PR or merge.

Files: `src/pages/api/panel/productos.ts`, `src/pages/panel/productos/index.tsx`, `scripts/panel-productos-api.test.mjs`.

## Finding

Deleting a `producto` sets `pedido_item.producto_id`/`variante_id` to NULL (`on delete set null`) and cascades variants, stock history, images, favorites and category links. If the order is still `pendiente_pago` and later paid, `consolidar_pago_pedido` (20260410120000) raises `integridad_inesperada: … items sin producto_id`, leaving a paid attempt on an order that cannot consolidate. Consolidation only runs for `pendiente_pago` before `expira_en`; `bloqueado` is terminal.

## Contract

- `DELETE ?id=<uuid>` → 204. Product outside the tenant → 404 `producto_no_encontrado`. `Allow: GET, DELETE`; the GET listing is unchanged.
- Own rate limit `api:panel:productos:write` (30/min); query `empresa_id` → 400 `legacy_tenant_input`; missing/invalid id → 400 `invalid_request`; trusted-origin check as in the orders PATCH; `catalog.operate`; tenant only from `principal.empresaId`; service client after authorization.
- Guard: `pedido_item` + `pedido!inner` for this tenant/product with `estado = pendiente_pago` and `expira_en > now` → 409 `producto_en_pedido_activo`; a failed check → 500 and no delete. Known limit: check and delete are separate statements, so an order created between them is not detected. An atomic `BEFORE DELETE` trigger on `producto` would close it (the order insert's FK takes `KEY SHARE` on the product row).
- Postgres `23503` (`carrito_producto` RESTRICT) → 409 `producto_en_uso`; other failures → 500 `internal_error`, logged with only the error code under `panel.productos.delete`.
- UI: no `supabase.from` left in the page; maps codes to messages; `deletingId` always resets in `finally`. The client-side `empresa_id` check and the obsolete TD-001 comment were removed.

## Progress

- [x] PD-1 — RED: 16 natural failures (405, `Allow: GET`, static consumer check).
- [x] PD-2 — GREEN: API test 34/34; panel suite 214/214; `pnpm exec tsc --noEmit --incremental false`, scoped ESLint and `git diff --check` exit 0. Diff 325 lines, 3 files.
- [x] PD-3 — Native review `review-11dc69b7a8b0274e` (medium, only `review-reliability`, 325 lines, budget 163). Relay lens skipped after 8 consecutive refusals; the same lens run directly as a subagent found no blockers. WARNING: UI consumer tests are source regexes, not behavior (existing style; a page harness is a follow-up). SUGGESTION: `safeErrorCode` lacks the character allowlist used in `orderOperationsApi.ts` (same helper in `categorias.ts`; unify in a follow-up).

## Follow-ups

- Atomic DB guard (trigger) for product deletion vs. pending orders — needs SQL/DB authorization.
- Unify `safeErrorCode` with an allowlist across panel APIs.
