# Category writes through the panel API

## Authorization and scope

User accepted the recommended next P4 slice ("dale"): move category create/update/delete from direct browser `supabase.from("categoria")` writes to `/api/panel/categorias`, following the listing contract. The candidate reached 596 changed lines (above the 400 review threshold); the user chose a size exception for one slice over splitting API and UI. Gate 3 OPEN; Unit 3 FROZEN. No SQL/DB, migration, build, browser run, PR or merge.

Files: `src/pages/api/panel/categorias.ts`, `src/pages/panel/categorias/index.tsx`, `scripts/panel-categorias-api.test.mjs`, `scripts/panel-categorias-ui.test.mjs`.

## Contract

- `POST` → 201 `{ item }`; requires `nombre`. `PATCH ?id=<uuid>` → 200 `{ item }` and updates only the sent fields (at least one). `DELETE ?id=<uuid>` → 204. A category outside the tenant → 404 `categoria_no_encontrada`.
- Writes: own rate limit `api:panel:categorias:write` (30/min); `empresa_id` in query or body → 400 `legacy_tenant_input`; body keys limited to `nombre`, `slug`, `descripcion`, `orden` (int4) → otherwise 400 `invalid_request`; trusted-origin check as in the orders PATCH; `catalog.operate`; tenant only from `principal.empresaId`; service client built after authorization.
- Postgres `23505` → 409 `categoria_duplicada`; `23503` → 409 `categoria_en_uso`; other failures → 500 `internal_error`, logged with only the error code under `panel.categorias.<action>`.
- UI: no `supabase.from` left in the page; maps error codes to messages, refreshes the listing only on success, disables delete while saving. The client-side `empresaId` check in submit was removed (the API owns tenancy).
- Unchanged DB behavior: deleting a category still cascades `producto_categoria` links and is blocked by `producto.categoria_id` (composite FK) → `categoria_en_uso`.

## Progress

- [x] CW-1 — RED: API write tests failed naturally (26 failures at 405/`Allow`); 5 new UI write tests failed against HEAD while listing tests passed there.
- [x] CW-2 — GREEN: API 34/34, UI 10/10. Two listing tests now flush with `setImmediate` instead of awaiting the effect (the effect does not await `fetchCategorias`, and `getAccessToken` adds a microtask); verified they pass against both HEAD and candidate page, file restored byte-identical.
- [x] CW-3 — Native review `review-5376d3aaa999325d` (medium, only `review-reliability`, 596 lines, budget 200): the relay lens refused again (8th time); no verdict. The same lens run directly as a subagent returned: CRITICAL partial PATCH nulled omitted fields; WARNING delete not disabled while saving; WARNING missing orden/slug bounds tests; WARNING stale listing error after a later success (pre-existing, not addressed); SUGGESTION hard-coded state index in UI tests (harness style, not addressed). The `review-risk` subagent could not run (lens not selected by the lineage); manual risk review found no blockers.
- [x] CW-4 — Fixes: RED 2 partial-contract tests; GREEN partial PATCH / optional POST fields, delete disabled while saving, bounds cases added. Checks: panel suite 199/199, `pnpm exec tsc --noEmit --incremental false`, scoped ESLint and `git diff --check` exit 0. Diff 645 lines, 4 files. The review lineage is stale for this candidate.
