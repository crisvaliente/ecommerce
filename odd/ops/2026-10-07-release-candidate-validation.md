# Release candidate validation: `d3be722` (2026-10-07)

## Scope and authorization

Step 1 of the closure plan accepted by the user ("adelante"): validate the branch `gate3/pr1a-preflight-manifests-fixtures` at `d3be722` before a PR to `master`. Local environment only; production was not touched. The PR and the merge (which deploys `raeyz.com`, still behind Cloudflare Access) are separate steps with their own authorization.

## Local environment fix

The local Storage container was crash-looping (`duplicate key … migrations_name_key`). Cause: the repository pins the Supabase CLI at `2.67.2` (`package.json`), which runs `storage-api:v1.33.0` (49 storage migrations), but the local database had been reset on 2026-09-30 with the global CLI `2.114.0`, whose Storage (`v1.69.0`) had already migrated the storage schema to 61. Fix: `supabase stop` (volumes kept) and `supabase start` with the global CLI `2.114.0` (Storage `v1.69.0`, PostgREST `v16.1`, GoTrue `v2.195.0`). Database contents unchanged (ledger 75, companies 5, Auth users 1, storage migrations 62 before and after).

Debt: pin one Supabase CLI version for the repository and local tooling (`pnpm exec supabase` vs the global binary).

## Automated results

| Suite | Result |
|---|---|
| 19 unit/mocked files (`node --experimental-strip-types --test`, without `-db` and preflight) | **342/342** (`bootstrap-instance` passes again with Storage healthy) |
| `pnpm exec tsc --noEmit --incremental false` | exit 0 (2026-10-07, code unchanged since) |
| `pnpm exec eslint src` | exit 0 (2026-10-07) |
| 7 DB files in parallel (`ALLOW_LOCAL_SUPABASE_MUTATIONS=1`) | **77/79** |
| `scripts/profile-backfill-db.test.mjs` alone | **8/8** |
| `scripts/panel-authorization-preflight.test.mjs` (untracked) | not run (P5 superseded, see the closure plan) |

The two DB failures are the known, classified ones, not regressions:
- "product category composite FK…": expects `23503`, gets `P0001` from production's legacy trigger `trg_producto_categoria_misma_empresa` (reproduced locally). The cross-company reference is still rejected.
- "private storage accepts only…": the test fixture cleanup deletes `storage.objects` with SQL, which Storage forbids (`storage.protect_delete`). The access assertions pass.

The local database mirrors production's schema drift (`odd/ops/rehearsal/`), so these runs are against a production-like schema.

## Preview

`d3be722` preview: `https://ecommerce-5vlw-o2fdtz6k0-crisvalientes-projects.vercel.app` (GitHub deployment `success`). Unauthenticated probes: `/auth/login` 200, `/auth/register` 200, `/panel` 200 (client-side gate), `/api/panel/productos` 401, `/api/panel/categorias` 401. The storefront (`/coleccion`) returns 404 on previews by design (only `raeyz.com` is registered in `empresa_dominio`). **The preview uses the production database.**

## Browser checklist (pending, done by the user)

Sign in with the user's Raeyz admin account. Use only test data created for this check and delete it at the end.

- [ ] B1 — `/auth/login` with the Raeyz admin, then `/panel` loads (no "No pudimos cargar tu perfil").
- [ ] B2 — Categorías: create a test category, edit it, delete it.
- [ ] B3 — Productos: the list loads.
- [ ] B4 — Create a simple test product with stock 5. Edit only its name and save; edit only its stock to 7 and save (no stock-conflict message).
- [ ] B5 — "Organizar por talles" on that product: message says 7 units moved to "Único"; the variant shows stock 7.
- [ ] B6 — Delete the test product from the list.
- [ ] B7 — Pedidos: the list and one order detail open.
- [ ] B8 — Sign out; register a new test account at `/auth/register`; it signs in without a profile error (it must not enter `/panel`).

After the checklist: read-only database verification of each effect (category gone, product gone, new profile created by the Auth trigger as `cliente`, no other row changed), then delete the B8 test account.
