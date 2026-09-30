# Production readiness survey (read-only)

## Authorization and scope

After the ProductForm slices the user accepted a read-only survey of production ("adelante"). Access: `supabase db query --linked --project-ref tdzlbwjcpdwlidniyhdd` (project "Raeyz", Postgres 15.8) through the Management API, run from `/tmp` without linking the repo. Every query was a `SELECT` or a read-only preflight block inside `begin transaction read only; … rollback;` (confirmed `transaction_read_only = on`). Only counts, schema objects and product ids/names were read; no customer personal data. Side effect: the CLI printed "Initialising login role…", i.e. it prepared its own temporary login role on the remote project (no table or data change). Nothing was applied. Date: 2026-09-29.

## Findings

### Code and migrations

- Production matches `origin/master` (`526f614`, 2026-09-03): the remote ledger has 67 rows ending at `20260903130000`. This branch (`gate3/pr1a-preflight-manifests-fixtures`) is 37 commits ahead and unmerged, so none of Gate 3 or this session's fixes is in production.
- Missing in the production ledger: `20260913120000` (empresa canonical select), `20260914165851` (Gate 3), `20260928190000`, `20260928210000`, `20260929120000`, `20260929130000`. Nothing in production is missing from the repo.
- Live schema confirms Gate 3 is not applied (old `*_catalog_staff` / `categoria_select_empresa` policies, no Gate 3 FKs). Extra production objects (`trg_producto_categoria_misma_empresa`, `empresa_sel_own`, `select_empresa_authenticated`, `producto_select_tenant_authenticated`) are legacy objects that the Gate 3 migration drops.
- Identical to the repo: `consolidar_pago_pedido`, `procesar_notificacion_intento_pago`, `transicionar_pedido_operacional`.
- `producto_auto_draft_on_update` equals the pre-fix repo version: **the "every sale unpublishes a simple product" bug is live in production.**
- **Drift:** `crear_pedido_con_items` in production lacks the two `variante_sin_stock` checks. The migration file `20260331120000` was edited after it was applied (commit `bf58b38`, same day), so the repo and production define different checkout functions under the same version.

### Data

| Check | Result |
|---|---|
| Orders | 2 `pagado`, 29 `pendiente_pago`, **0 unexpired** |
| Pending items without product / with a mode mismatch | 0 / 0 |
| Items with a deleted product | 0 |
| Negative product / variant stock | 0 / 0 |
| Simple products left in draft after a consolidated sale | **none** |
| Products | 12 (published: 3 simple, 2 variant; draft: 5 simple, 2 variant) |

No data repair is needed for the bugs fixed in this session.

### Gate 3 preflight

The read-only preflight block of `20260914165851` fails on production with `gate3_predecessor_identity_data_invalid:6`, so the migration would refuse to apply (fail-closed, nothing half-applied). The 6 `usuario` rows (10 profiles, 11 Auth users):

| Reason | Role | Rows |
|---|---|---|
| Profile whose Auth user no longer exists | admin | 1 |
| Profile whose Auth user no longer exists | cliente | 2 |
| Admin still in `onboarding = true` | admin | 3 |

## Dependencies for a deploy of this branch

- The branch's app code needs Gate 3 and, for "Pasar a variantes", `20260929120000`.
- The four migrations from this session touch only `producto`, `producto_variante`, `pedido`, `pedido_item` and their own functions; they do not reference Gate 3 objects. They were only tested on a local database with Gate 3 applied, not on the production predecessor.
- The `pedido_item` insert trigger raises messages that production's checkout function already raises.

## Decisions for the user

1. The 6 identity rows (data change in production; needs ids and a human decision per row).
2. Whether to apply the four bug-fix migrations before Gate 3 (out-of-order ledger, later `db push --include-all`) or together with Gate 3.
3. A new migration to re-align `crear_pedido_con_items` with the repo (the `variante_sin_stock` checks), since editing an applied migration file is not deployable.

## The 6 identity rows (read-only listing, 2026-09-29)

Read with `SELECT` only; no emails or personal names. `pedido`, `direccion_usuario`, `carrito` and `checkout_pedido_idempotencia` reference `usuario` with `ON DELETE CASCADE` (`log_actividad` with `SET NULL`): **deleting a profile deletes its orders**. With this branch's `panelAuthorization`, an admin/staff with `onboarding = true` gets 403 on every panel API.

| # | `usuario.id` | Problem | Role / company | Last Auth sign-in | Linked data | Proposal |
|---|---|---|---|---|---|---|
| 1 | `43692808-6856-4559-a0a2-24d659aa066d` | admin with `onboarding = true` | admin / felpocompany (2 products) | 2026-05-08 | none | `onboarding = false` |
| 2 | `59f27744-3b2a-4a1f-8653-4e431cd143a5` | admin with `onboarding = true` | admin / dssd (3 products) | 2026-04-13 | **7 orders as buyer (2 paid, 5 pending expired)**, 1 address | `onboarding = false`; never delete |
| 3 | `f9f08b39-a4f0-426c-89ea-dc2e864273d8` | admin with `onboarding = true` | admin / EMPRESA_SMOKE (3 products) | 2026-05-08 | none | `onboarding = false`, or decide to remove smoke data from production |
| 4 | `b6292efd-d976-4c74-8e56-7db42515f684` | Auth user no longer exists | admin / EMPRESA_SMOKE | — | none | delete profile |
| 5 | `0fe4567d-93ec-46c7-84a0-60bcb812807f` | Auth user no longer exists | cliente, no company, created 2026-09-03 05:44 | — | none | delete profile |
| 6 | `d4d7e1d5-6b41-4095-a130-42fd7cbb547e` | Auth user no longer exists | cliente, no company, created 2026-09-03 06:16 | — | none | delete profile |

Other observations:
- Rows 1–3 have an `owner` membership in an empty auto-created personal company ("Mi empresa", slug `personal-<id>`, from the legacy `ensure_personal_org`), not in their profile's company. Five such empty companies exist. They do not block Gate 3; cleanup is optional.
- Production contains smoke data (`EMPRESA_SMOKE`, 3 products, 3 profiles).
- Rows 5 and 6 are empty profiles created on 2026-09-03 whose Auth users were later deleted, possibly leftovers of testing against production that day.
- The real store `Raeyz` (31 orders, 4 products) has no flagged profile.

Any fix must run in one transaction with guards that re-check the current state (e.g. delete only if the Auth user is still missing and no order/address/cart/idempotency row references the profile; update only `rol = 'admin' and onboarding = true` rows with the expected company) and verify affected-row counts. Not executed.

## Cleanup decisions and dry run (2026-09-29)

User decisions: keep the dssd admin's orders (demote to client without company); delete the three profiles without an Auth user; delete the test stores felpocompany and dssd plus the felpocompany admin profile; keep EMPRESA_SMOKE (the author recommended removing it) and move its admin out of onboarding.

Script: `odd/ops/2026-09-29-prod-identity-cleanup.sql` (guarded steps with row-count asserts; postcondition: the Gate 3 identity check returns no row; ends in `ROLLBACK`). Production facts behind it: `usuario.empresa_id` is `ON DELETE SET NULL`, no delete triggers on the affected tables, the dssd store's second profile (a client with 1 order) becomes a client without company, 4 image files live in Storage and must be removed through the Storage API.

- Local syntax check: aborts at step 1 as expected (rows absent), rollback.
- Production dry run (`supabase db query --linked --project-ref … -f`, body identical to the reviewed script, ending in `select 'dry_run_ok'; rollback;`): returned `dry_run_ok`, so every step and the postcondition passed. A first attempt passing the SQL as an argument was rejected by the CLI (the leading `--` comment parsed as a flag) and executed nothing.
- After each attempt a read-only check confirmed production unchanged (10 profiles, 12 companies, 12 products, 31 orders; dssd admin still `admin`, smoke admin still in onboarding).

Pending, each with explicit authorization: real run (last line `COMMIT`), Storage files, felpocompany admin's Auth user, then re-run the Gate 3 preflight read-only.

## Real run (2026-09-29)

Authorized by the user ("dale"). Ran `/tmp/real-run.sql`: body byte-identical to the reviewed and dry-run script (SHA-256 of the repo file `16d80cbd…`), last line `COMMIT`. No error returned.

Read-only verification afterwards: profiles 10 → 6, companies 12 → 10, products 12 → 7, orders 31 → 31 (2 paid, unchanged); dssd admin is now `cliente` without company with its 7 orders; smoke admin `onboarding = false`; the dssd client `8db097f3-…` has no company and `onboarding = true`; no image rows left without product. The Gate 3 preflight block, re-run read-only, returns `preflight_ok`.

Still pending: the 4 Storage files (paths in the script header) and the felpocompany admin's Auth user. Applying Gate 3 itself (after `20260913120000`) remains a separate decision.

## Storage files (2026-09-29)

Read-only check before deleting: the 4 files exist in `producto-imagenes` (9 files in the bucket) and no remaining `imagen_producto` row references them. `supabase storage rm --linked --project-ref tdzlbwjcpdwlidniyhdd --experimental ss:///producto-imagenes/<path>` (exact paths, no `-r`) returned `{"deleted":[]}` without error, and a read-only re-check showed all 4 files still present: the CLI deleted nothing. Pending: delete them from the Dashboard (Storage) or through the Storage API with the service role key.

Follow-up (user chose "Storage API"): the service role key was obtained with `supabase projects api-keys --project-ref tdzlbwjcpdwlidniyhdd` into a shell variable only (never printed or stored) and used for one `DELETE /storage/v1/object/producto-imagenes` with the 4 exact paths: HTTP 200, 4 objects deleted. Read-only re-check: none of the 4 present, bucket 9 → 5 files, no active image row without its file.

Two older files with no `imagen_producto` row, not part of the authorized list and left untouched: `2e524336-6e35-41df-aa60-6e4b77ec538c/f854c29b-894f-4672-a58a-d4c0301004e1.jpeg` and `…/917e2334-efdb-44a3-a3c5-def7d9d77c75.jpeg` (2026-01-14, 145 KB each). Their prefix is the id of a deleted dssd product.
