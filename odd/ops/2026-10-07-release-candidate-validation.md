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

## Browser validation (2026-10-07, done by the user)

Google sign-in on the Vercel preview cannot work today: the OAuth return URL comes from `APP_BASE_URL`, which Vercel shares between preview and production (`raeyz.com`), so the login landed on the old production deployment behind Cloudflare Access. The checklist was therefore run on the branch at `d3be722` locally (`pnpm dev`, `http://localhost:3000`) against the local database (production-like schema), with the local Raeyz admin (`owner@local.test`, email and password). Each step was cross-checked in the dev server log and with read-only queries on the local database.

| Step | Result | Evidence |
|---|---|---|
| B1 panel entry | ✅ admin, no profile error | panel APIs `200` |
| B2 category create / edit / delete | ✅ | `POST 201` (company set by the server), `PATCH 200` (slug/orden updated), `DELETE 204` (row gone) |
| B3 product list | ✅ | `GET /api/panel/productos 200` |
| B4 simple product: create with stock 5, name-only save, stock-only save to 7 | ✅ | name-only save left stock 5; stock-only save wrote 7 (no conflict message) |
| B5 "Organizar por talles" | ✅ "Se pasaron 7 unidades a la variante "Único"" | `POST …/modo-variantes 200`; product `usa_variantes = true`, stock 0; variant "Único" stock 7; summary 7 |
| B6 delete product | ✅ "Producto eliminado" | `DELETE 204`; product and variant gone |
| B7 orders list | ✅ (empty locally) | `GET /api/panel/pedidos 200` |
| B8 sign-up and panel denial | ✅ | profile created by the Auth trigger (`cliente`, no company, `onboarding = true`); `/panel` → "Acceso no autorizado · Rol actual: cliente" |
| Extra | ✅ | Pagos visible for admin; home, Nosotros, Contacto render; `/coleccion` 404 locally (no local domain registered) |

The test category, product and account were removed (the account from the local database afterwards). Local state at the end: 1 Auth user, 1 profile, 0 categories and 0 products for the Raeyz company.

Pre-existing bugs found (not regressions; follow-ups):
- Categorías: the slug is auto-filled only while empty, so it keeps the first typed letter (`p` for "Prueba").
- ProductForm: "Stock disponible hoy" is not refreshed after a stock save (shows the old value until reload; the saved value and the compare-and-set baseline are correct).
- Storefront header: the signed-in user's name is white on the beige background.

Launch follow-up: Google sign-in on previews needs a per-environment `APP_BASE_URL` and the preview URL in Supabase Auth redirect URLs.

**Step 1 result: release candidate `d3be722` validated** (automated suites and browser checklist). Not covered: checkout and payment in a browser (no local products/domain and the Mercado Pago webhook is blocked); production compatibility of the currently deployed build.
