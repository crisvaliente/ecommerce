# "Pasar a variantes" through the panel API (S1b)

## Authorization and scope

Third slice of the ProductForm plan, after S1a (`pasar-a-variantes-rpc.md`) and the auto-draft fix. The user accepted S1b ("si"). The candidate reached 467 lines, so it was split without a size exception into two reviewed commits: A (endpoint, 336 lines) and B (UI + mapper, 138 lines). Mocked API/UI tests only; no database change, browser run, PR or merge. Gate 3 OPEN; Unit 3 FROZEN.

Commits:
- A — `feat(panel): add atomic variant-mode endpoint for products`: `src/pages/api/panel/productos/[id]/modo-variantes.ts`, `scripts/panel-productos-variant-mode-api.test.mjs`.
- B — `fix(panel): switch products to variants through the atomic endpoint`: `src/pages/panel/productos/ProductForm.tsx`, `src/lib/productFormErrors.ts`, `scripts/product-form-errors.test.mjs`.

## Contract

- `POST /api/panel/productos/[id]/modo-variantes`: same guards as the product DELETE (shared write rate limit `api:panel:productos:write`, query `empresa_id` → 400, uuid id → 400, trusted origin for cookie sessions, `catalog.operate`, tenant from `principal.empresaId`, service client after authorization). Calls `pasar_producto_a_variantes`; `55006` → 409 `producto_en_pedido_activo`; `ok=false` → 404 `producto_no_encontrado`; other failures → 500. On success returns `{ codigo_resultado, stock_migrado, estado }` (the switch can return a published product to draft).
- `handlePasarAVariantes` no longer reads or writes `producto`/`producto_variante` from the browser. The confirm no longer shows a possibly stale stock number; the success message reports the migrated units. Any 2xx refreshes the mode from the database even if the body cannot be parsed; a 401 asks to sign in again; other failures go through `productFormErrorMessage`, which now also maps the API's `producto_en_pedido_activo`.
- Not changed: `maybeSetUsaVariantesAfterCreate` still sets the mode with a second update right after creating a product (no orders can exist yet; low risk).

## Progress

- [x] SB-1 — RED: route stub returning 501 (16 API failures), mapper API-error case and ProductForm static checks failing (19 total across both files).
- [x] SB-2 — GREEN: API 16/16, mapper + ProductForm checks 10/10, panel suite 239/239, `pnpm exec tsc --noEmit --incremental false` exit 0.
- [x] SB-3 — Split at 467 lines: UI files copied aside with SHA-256 checksums (a `git stash` attempt failed on intent-to-add entries and stashed nothing), restored from HEAD, unit A reviewed and committed locally, then the UI files restored and verified against the checksums.
- [x] SB-4 — Review A `review-925c36656bf99a1c` (only `review-reliability`, direct subagent): no blockers; WARNING rate-limit options unasserted → asserted; WARNING transpile-only harness → accepted (repo pattern, `tsc` runs separately); SUGGESTION more malformed shapes → not added (code guards them).
- [x] SB-5 — Review B `review-c2ef85fd4c498ee1` (direct subagent): no blockers; WARNING a 200 with an unparsable body was shown as a failure and left the UI stale → any 2xx now refreshes from the database; WARNING static-only UI tests → accepted (existing style; atomicity covered by 18 DB and 16 API tests); SUGGESTION 401 message → added.

## Follow-ups

- S2: ProductForm overwrites stock with the value loaded at page open (lost update against sales).
- A behavior harness for ProductForm (or extracting its request/response logic into testable functions).
