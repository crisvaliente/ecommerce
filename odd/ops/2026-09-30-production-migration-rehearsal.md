# Production migration rehearsal (local, 2026-09-30)

## Goal and scope

User accepted ("arranca") rehearsing, on the local disposable Supabase, the migrations pending in production before any production change. The local database was rebuilt (local data lost; test data only). Production was only read (read-only transactions). Nothing was applied to production.

## Steps

1. `supabase db reset --local --version 20260903130000`: 67 migrations, the same ledger as production. Migration files up to that version are identical in `origin/master` and this branch.
2. Schema fingerprint local vs production (policies, triggers, constraints, indexes, columns, grants, RLS, views, storage policies, function bodies normalized for whitespace/comments). Beyond formatting and local-image default privileges, production drift:
   - `producto_categoria` with an `id` primary key and single-column FKs (the `a3` bridge migration used `create table if not exists` and was a no-op there);
   - extra objects: trigger `trg_producto_categoria_misma_empresa` + function, trigger `categoria_set_updated_at`, policy `ip_sel_owner` on `imagen_producto`, 5 indexes, `authenticated` writes on `imagen_producto`, `anon` select on `producto_categoria`, explicit `service_role` grants;
   - `crear_pedido_con_items` without the two `variante_sin_stock` checks.
3. The drift was reproduced locally (`rehearsal/2026-09-30-local-prod-drift*.sql`, generated from production definitions; **local only**). Afterwards the fingerprint matched production except local-image `REFERENCES`/`TRIGGER`/`TRUNCATE` defaults for `anon`/`authenticated`. The Gate 3 preflight passed locally, as in production.
4. `supabase migration up --local` (same ordering as `db push`): `20260913120000` applied; **Gate 3 failed its postflight with `gate3_post_catalog_policy_closure_invalid`** (fail-closed, fully rolled back) because production's `ip_sel_owner` policy is not one of Gate 3's 20 catalog policies. Left in place it would also widen image access through permissive OR.
5. Fix: new migration `20260914120000_drop_legacy_imagen_producto_policy.sql` (`drop policy if exists ip_sel_owner`), ordered before Gate 3. Re-run: the remaining 6 migrations applied in order; ledger 74.
6. Tests against this production-like database: unit 342/342; DB 77/79. The 2 failures are not caused by the migrations:
   - "product category composite FK …": the cross-company reference is still denied, but production's legacy trigger `trg_producto_categoria_misma_empresa` raises `P0001` before the FK's `23503`.
   - "private storage accepts only the exact tenant/product key grammar": assertions pass; the fixture cleanup deletes `storage.objects` with SQL, which the newer Storage (`storage.protect_delete`, also in production) forbids. Any freshly reset local database fails the same way.

## Deploy-order check

- `master`'s storefront reads the catalog server-side with `service_role` (not affected by Gate 3 grants).
- `master`'s panel writes the catalog from the browser as `authenticated`; Gate 3 keeps that for same-company admin/staff.
- `master`'s `AuthContext` tries a browser insert into `usuario` (revoked by Gate 3) and then re-reads; with Gate 3 the Auth trigger creates the profile, so the re-read finds it.
- This branch needs the migrations (panel APIs, `pasar_producto_a_variantes`). Order: migrations first, then deploy the branch.

## Proposed production plan (each step needs explicit authorization)

1. Read-only pre-check: ledger still at `20260903130000`, Gate 3 preflight `preflight_ok`, no pending unexpired orders.
2. `supabase db push` against the project (applies `20260913120000`, `20260914120000`, Gate 3, `20260928190000`, `20260928210000`, `20260929120000`, `20260929130000` in order; Gate 3 is atomic and fail-closed).
3. Read-only post-check: ledger 74, Gate 3 policies present, `ip_sel_owner` gone, new triggers/functions present, `producto_auto_draft_on_update` updated.
4. Deploy this branch's app.
5. Smoke: panel login, product list/delete, categories, checkout + consolidation on a test product.

Rollback: migrations are forward-only; before step 2 take a Supabase backup (dashboard) or confirm point-in-time recovery.

## Follow-ups

- Test fixtures must delete Storage objects through the Storage API.
- Decide whether the legacy trigger `trg_producto_categoria_misma_empresa` stays (redundant with Gate 3's composite FK).
- Separate slice: migration re-aligning `crear_pedido_con_items` with the repo (`variante_sin_stock`).
- Local dev DB now mirrors production drift (e.g. `producto_categoria` structure).
