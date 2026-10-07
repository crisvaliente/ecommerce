# ProductForm error messages for database guards (S0)

## Authorization and scope

First slice of the ProductForm plan from the read-only survey (S0 → S1a → S1b → S2). The user accepted the recommended order and zeroing the simple stock when switching to variants (applies to S1a). This slice only maps errors in the UI; no database, API, PR or merge. Gate 3 OPEN; Unit 3 FROZEN.

Files: `src/lib/productFormErrors.ts` (new), `scripts/product-form-errors.test.mjs` (new), `src/pages/panel/productos/ProductForm.tsx`.

## Contract

- `productFormErrorMessage(error, context)` with contexts `variant_delete`, `variant_save`, `variant_mode_switch`.
- SQLSTATE `55006` (pending-order guard) → specific message for variant delete and mode switch, with a retry hint.
- SQLSTATE `23505` in `variant_save` → "Ya existe una variante con ese talle." (`ux_producto_variante_empresa_producto_talle_ci`).
- Anything else → fixed fallback per context; database text is never shown. `handlePasarAVariantes` no longer surfaces `err.message` (its "Producto no encontrado." now shows the fallback; the function is replaced in S1). Variant inserts now say "No se pudo guardar la variante." instead of "…crear…".

## Progress

- [x] PE-1 — RED: with a stub returning `""`, 8/8 failures (the static wiring check included). A missing module was not counted as RED.
- [x] PE-2 — GREEN: mapper + 4 call sites; 8/8 after fixing unawaited subtests in the test itself. Panel suite + mapper 221/221; `pnpm exec tsc --noEmit --incremental false`, scoped ESLint and `git diff --check` exit 0. Diff 96 lines, 3 files.
- [x] PE-3 — Native review `review-c26a00385355cfab` (medium, only `review-reliability`, 96 lines); relay skipped, the lens as a direct subagent found no blockers. WARNING test not wired into a `package.json` script → repo-wide gap (no CI; most panel and DB tests have no script), recorded as a follow-up. SUGGESTION 23505 during the "Único" insert in `handlePasarAVariantes` → obsolete after S1 replaces that function.

## Follow-ups

- A single test runner script (unit, and DB behind the opt-in) since there is no CI.
