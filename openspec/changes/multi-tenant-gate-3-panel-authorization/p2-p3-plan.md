# P2/P3 Implementation Plan — Proposed; No Apply Authority

**Scope:** Prepare one cohesive P2/P3 Gate 3 boundary: profile integrity, UID-only provisioning, catalog/company/storage isolation, dependent SQL capability closure, bootstrap compatibility, and focused database evidence.

**Status:** Planning only. Gate 1, Gate 2, and Unit 1A are CLOSED; Gate 3 is OPEN; Unit 3 remains FROZEN. The approved and acknowledgement-burned `review-620758b8c6580d46` candidate is committed locally as `fbf12751cd0a6e7e465617b591224f2c0e19f9ad`, with tree `bce358bb242c18f7af41b0a6cae2b0c2d8d57be0` matching the reviewed candidate exactly. Its 1,138 source/test changed lines now form the P1 baseline; no push or database application followed from the commit.

**Prerequisites:** Before any implementation or database action, obtain fresh P2/P3 scope, size, delivery, local-target, fixture-mutation, and apply authority. The prior 1,138-line exception grants none. At writer launch, the parent must derive the exact migration timestamp/path and confirm the approved base plus explicit untracked-file selection.

## Decision boundary

- P2 and P3 create one final migration/test target. Never apply partial SQL subunits or deliver bootstrap behavior against a half-target.
- Use one SQL transaction where PostgreSQL permits. Auth creation and later service-role API calls remain process-nonatomic; the auth trigger itself must reject conflicts transactionally without adoption.
- Preserve `scripts/lib/supabase-bootstrap.mjs` exports and both current entrypoint APIs. No production staff-role parameter, general role API, or new promotion RPC is planned.
- Keep shared Auth fixture behavior in test-only `scripts/lib/local-auth-fixtures.mjs`; three affected DB suites justify it, but it is not production bootstrap.
- Preserve Gate 1 tenant isolation and the `public.producto_stock_resumen` invoker view, not Gate 1's old broader role-admission predicate. P3 narrows catalog access to canonical same-company admin/staff, including SELECT.
- Exclude P4 UI/API parity, payment/stock business rewrites, historical migration cleanup, duplicate-FK/status repair, automatic migration adoption/reset, and Unit 3 rescue.
- Inventory is closed only for the named roots. Fragmented dynamic SQL and external callers remain unproven, so this is not complete Gate 3 runtime attestation.

## Exact proposed file table

| Path | State | Proposed responsibility |
|---|---|---|
| `supabase/migrations/<timestamp>_panel_identity_catalog_isolation.sql` | New placeholder; parent derives exact path before writer | One atomic P2/P3 migration: integrity constraints, hardened auth trigger, RLS/storage policies, grants, and dependency-safe revokes; no promotion RPC. |
| `scripts/lib/supabase-bootstrap.mjs` | Existing | Read-only conflict planning plus guarded service-role conditional UPDATE to configured admin while preserving exports/callers. |
| `scripts/supabase-bootstrap.test.mjs` | New | Production-library cardinality, operation-order, exact promotion/retry, and no-mutation conflict tests. |
| `scripts/lib/local-auth-fixtures.mjs` | New, test-only | Auth-first fixtures, per-resource immediate cleanup registration, trusted test-only staff setup, and ordered cleanup. |
| `scripts/catalog-stock-isolation-db.test.mjs` | Existing | Adopt guarded Auth-first fixtures while preserving real-JWT/RLS assertions. |
| `scripts/order-operations-db.test.mjs` | Existing | Adopt guarded Auth-first fixtures and test existing cleanup compatibility without changing payment logic. |
| `scripts/checkout-idempotency-db.test.mjs` | Existing | Replace fake-UID fallback setup with guarded Auth-first fixtures; retain service/anon scope. |
| `scripts/panel-provisioning-db.test.mjs` | New | P2 trigger, FK, checks, admin promotion, retry/conflict, and cleanup matrix. |
| `scripts/panel-catalog-storage-db.test.mjs` | New | P3 command/identity, ACL, RLS, storage, GraphQL facade, and persisted-state matrix. |

No other implementation path is proposed. `scripts/bootstrap-instance.mjs`, `scripts/bootstrap-smoke-users.mjs`, and `scripts/bootstrap-instance.test.mjs` stay unchanged. `scripts/storefront-tenant-db.test.mjs` stays unchanged and is handled only by the external execution gate described below.

## Resolved security contracts

### P2 identity, trigger, and bootstrap

- Preserve exact `supabase_uid NOT NULL`, UID uniqueness, `usuario_rol_check`, and `usuario_empresa_o_onboarding`; do not duplicate them. Add `usuario_supabase_uid_auth_fkey` to `auth.users(id) ON DELETE RESTRICT` and `usuario_privileged_company_check` exactly as `rol = 'cliente' OR (empresa_id IS NOT NULL AND onboarding = false)`.
- Add `usuario_empresa_restrict_fkey` to `empresa(id) ON DELETE RESTRICT`, validate it, then replace the historical destructive/SET NULL company FK inside the same transaction.
- Harden `handle_new_auth_user` to use only Auth UID plus normalized-email conflict detection. It inserts exactly one `cliente`, null-company, onboarding profile; same-UID retry accepts only that canonical default; any UID/profile-ID/email conflict aborts without adoption or mutation.
- Before Auth creation, complete every available configuration, target-company, normalized-email, and Auth-cardinality/conflict precheck. For existing Auth, also complete exact UID/profile cardinality, email binding, company, role, and onboarding checks before mutation. If Auth is absent, create it, obtain its UID, require the trigger-created profile, then check exact UID/profile cardinality, email binding, and fresh-default state before conditional promotion.
- Production bootstrap promotes only fresh default → configured **admin**. Its guarded service-role UPDATE predicate includes exact profile ID, `supabase_uid`, `rol = 'cliente'`, `empresa_id IS NULL`, and `onboarding = true`; its target is exact configured admin/company/onboarding false. Require exactly one returned row.
- On zero affected rows, re-read by UID with exact-cardinality semantics. Return idempotent success only for the exact desired admin/company/onboarding-false state; every missing, duplicate, cross-company, role/onboarding mismatch, or normalized UID/email/profile conflict fails with zero promotion mutation. Auth creation and later profile calls are not atomic, so do not claim a separately created Auth user is rolled back; the trigger's own conflict rejection remains transactional and performs no adoption.
- Staff setup exists only in the trusted local test helper to exercise policy identities; it is not a production bootstrap feature. If guarded UPDATE cannot be expressed through the existing service-role client API, stop for renewed scope rather than adding an RPC.
- Register cleanup immediately after each resource creation. Remove business rows/orders, addresses, profile, and company before Auth; clear `empresa.owner_auth`/`created_by` fixture references or delete the company before Auth. Preserve the payment-cycle constraints and test current cleanup behavior; do not claim generic order deletion is proven.

### P3 command and identity matrix

`service_role` may bypass RLS only for reviewed trusted-server operations; it never bypasses FK/check integrity or application business rules.

| Surface | `anon` | `authenticated` admin/staff | bound `cliente` | null-company `cliente` | `service_role` |
|---|---|---|---|---|---|
| Five catalog tables: `producto`, `categoria`, `producto_categoria`, `producto_variante`, `imagen_producto` | No CRUD | Same-company SELECT/INSERT/UPDATE/DELETE; UPDATE checks OLD and NEW | No CRUD, including own-company SELECT | No CRUD | Reviewed trusted CRUD only |
| `producto_stock_resumen` | No SELECT | Same-company SELECT through `security_invoker` source policies | No SELECT | No SELECT | Trusted SELECT |
| `storage.objects` in private `producto-imagenes` | No commands | Same-company SELECT/INSERT/DELETE; no UPDATE | No commands | No commands | Trusted signed-URL/object operations; no integrity bypass |
| `soft_delete_imagen_producto(uuid)` | SQL EXECUTE denied | PostgreSQL grants `authenticated` EXECUTE; function guard allows only own-company admin/staff | Invocation denied inside the function with no mutation | Invocation denied inside the function with no mutation | Trusted execution |
| `empresa` | No commands | Own-company SELECT only | Own-company SELECT only | No row to SELECT | Reviewed bootstrap/provisioning commands only |
| `usuario` | No commands | Self SELECT only; no CUD | Self SELECT only; no CUD | Self SELECT only; no CUD | Reviewed identity/bootstrap operations only |
| `membresia`, `historial_stock` | No commands | No commands | No commands | No commands | Trusted reviewed operations only |

For the five catalog tables, canonical admin/staff authority must match row company; dependent rows must also match referenced product/category company. Remove every overlapping authenticated/PUBLIC policy that could OR around this matrix. Remove legacy category/image SELECT bypasses, browser company mutation, authenticated stock-history access, and all client membership access.

Preserve existing `ux_categoria_empresa_id_id UNIQUE (empresa_id, id)`; add no helper unique constraint. Enforce exact `producto (empresa_id, categoria_id) → categoria (empresa_id, id)` semantics, including missing-category and cross-company denial plus the existing allowed null-category behavior. Stop on dirty rows; do not repair them or clean unrelated historical constraints.

Preserve `can_mutate_catalog_empresa(uuid)`, `can_mutate_catalog_producto(uuid)`, and `soft_delete_imagen_producto(uuid)`. Before revoking client execution, replace/remove incoming policies: `can_manage_producto` → `hs_sel_owner`/`hs_ins_owner`; `can_manage_producto_member` → `ip_sel_auth_manage_producto`. Validate all 13 supplied signatures/no overloads with bounded dependency and body searches.

Revoke `PUBLIC` where it would defeat role revokes. Preserve explicit authenticated execution for `owns_carrito` (four policies) and `owns_pedido` (eight), while restricting anon/PUBLIC. Keep `user_is_member_of` and `ensure_personal_org` service-only. Revoke clients from `current_empresa_id`, `uid`, and `is_empresa_owner` only after the bounded no-edge check. Retain trigger invocation but no direct client execution for `handle_new_auth_user`.

Drop `pi_read_public`; keep the bucket private and signed-URL-compatible. The stored key has exactly five non-empty segments and four structural `/` delimiters: `empresa/<uuid>/producto/<uuid>/<filename>`. Forbid `/` inside a segment, any `\`, extra/missing segments, traversal or dot segments, query/fragment markers, control characters, malformed UUIDs, and product/company mismatch. Policy tests use the stored key; API tests use decoded API input where that layer decodes it, without adding normalization or double-decoding behavior. No UPDATE policy. Exercise only observed `graphql_public.graphql(text,text,jsonb,jsonb)` and do not invent another facade.

## Work units, dependencies, atomic application, and rollback

| Unit | Dependency and finish condition | Boundary |
|---|---|---|
| A. Fixture preparation | Build guarded Auth-first helper and suite adaptations; initial old-baseline observations are provisional. | Not independently deliverable. Compatibility is proven only after the same tests run against both validated old and combined targets. |
| B. P2 behavior | Natural REDs reach current DB/bootstrap behavior; GREEN satisfies exact trigger, constraints, admin promotion, and conflict contracts. | Shares the migration with C; never apply alone. |
| C. P3 behavior | Natural REDs reach effective command/identity, tenant, grant, dependency, and storage behavior. | Creates the combined target with B; never apply alone. |
| D. Final compatibility/regression | Run A against validated old and combined targets, then complete focused and retained regressions. | No production or delivery authority follows from passing tests. |

Order: provisional A → B/C RED → minimum combined migration/bootstrap GREEN → A old/new proof → triangulation → D. All new or changed DB suites must enforce mutation opt-in **before environment discovery** and validate the exact disposable local target before mutation; an environment prefix alone is not a guard.

Before apply, confirm exact local target, PostgreSQL metadata/state, expected predecessor, 68 SQL source files versus 66 ledger rows, the unrelated pending checkout migration, and the required manually effective `empresa` SELECT prerequisite that is also absent from the ledger. This planning turn supplies no current-database proof. Stop on any mismatch, orphan, ambiguous identity, or unknown dependency; never auto-apply the checkout migration or adopt/reset history.

Migration SQL starts a transaction, locks and validates expected schema/data before DDL, and rolls back on failure. After commit, use only a separately authorized forward restrictive correction; no down migration may reopen access. Process-level Auth cleanup uses registered fixture cleanup, never a database reset.

## TDD test matrix

| Phase | Required future evidence |
|---|---|
| RED | Natural behavior failures for FK/check/delete contracts, UID-only trigger, guarded admin-only promotion, every matrix command/identity cell, A↔B denial, missing/cross-company/null-category semantics, grants, exact storage grammar, and no UPDATE. Missing helper imports do not count as DB RED. |
| GREEN | Minimum bootstrap changes and one combined SQL migration satisfy focused behavior. Fixture preparation alone is neither GREEN for the target nor independently deliverable. |
| TRIANGULATE | Auth-first exact-one profile; admin promotion/retry/conflicts; test-only staff; bound/null-company cliente; immediate partial cleanup; admin/staff/cliente A↔B persisted-state checks; anon/authenticated/service effective ACL+policy behavior; dependency replacement; GraphQL invoker; signed reads; payment-cycle compatibility. |
| REFACTOR | Keep named cases readable and all coverage intact. Count every replacement as one deletion plus one addition; never code-golf or remove tests for budget. |
| Regression | Preserve real-JWT catalog/order checks, service/anon checkout scope, Gate 1/2 behavior, existing storefront behavior, and current order/checkout cleanup constraints. This is not production attestation. |

This passive documentation correction has a strict-TDD exemption because it changes no executable behavior. Future implementation still requires observed RED, GREEN, TRIANGULATE, and REFACTOR evidence.

## Verification commands — NOT RUN

Only after explicit target/mutation/apply approval and in-suite guards pass:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/supabase-bootstrap.test.mjs
ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-provisioning-db.test.mjs
ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-catalog-storage-db.test.mjs
ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/catalog-stock-isolation-db.test.mjs
ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/order-operations-db.test.mjs
ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/checkout-idempotency-db.test.mjs
git diff --check
```

The untouched `scripts/storefront-tenant-db.test.mjs` command is withheld until it is proven read-only/locally guarded under an external exact-target gate, or renewed scope adds an in-file pre-discovery guard. Prefixing a test that ignores the variable is not protection. No TypeScript runtime edit is planned, so repository TypeScript/lint is conditional on renewed TypeScript scope. Never run DB tests against an ambiguous environment.

## Per-file additions/deletions forecast and combined arithmetic

Conservative ranges reflect the explicit command/identity cases, admin-only bootstrap guard, pre-discovery guards in every changed DB suite, three fixture conversions, 13 signatures, five catalog tables, and storage negatives. Wider test ranges avoid unsupported precision; replacement lines count on both sides.

| Future path | Additions | Deletions | Changed lines |
|---|---:|---:|---:|
| `supabase/migrations/<timestamp>_panel_identity_catalog_isolation.sql` | 300–480 | 0 | 300–480 |
| `scripts/lib/supabase-bootstrap.mjs` | 70–130 | 20–45 | 90–175 |
| `scripts/supabase-bootstrap.test.mjs` | 130–220 | 0 | 130–220 |
| `scripts/lib/local-auth-fixtures.mjs` | 130–210 | 0 | 130–210 |
| `scripts/catalog-stock-isolation-db.test.mjs` | 35–70 | 15–35 | 50–105 |
| `scripts/order-operations-db.test.mjs` | 35–70 | 15–35 | 50–105 |
| `scripts/checkout-idempotency-db.test.mjs` | 35–70 | 15–35 | 50–105 |
| `scripts/panel-provisioning-db.test.mjs` | 190–320 | 0 | 190–320 |
| `scripts/panel-catalog-storage-db.test.mjs` | 380–620 | 0 | 380–620 |
| **Future implementation total** | **1,305–2,190** | **65–150** | **1,370–2,340** |

Arithmetic: `1,305–2,190 + 65–150 = 1,370–2,340`. The local P1 commit `fbf12751cd0a6e7e465617b591224f2c0e19f9ad` is the proposed P2/P3 baseline. Against that commit, the prior 1,138 lines are not part of the new source/test/SQL diff; the previous `2,508–3,478` cumulative estimate is historical, not the current target estimate. Measure the actual future candidate against the approved base and explicit untracked selection. Documentation remains separate and is not implicitly selected.

**Proposed exception — not yet authorized:** cap P2/P3 at 2,340 source/test/SQL additions plus deletions across the nine proposed files. Review the complete candidate as one cohesive target, with staged internal readback and tests but no partial migration application. Check the forecast and running delta before expanding each work unit; stop before exceeding the ceiling or adding a path. Do not remove coverage or compress code to fit. This proposed size exception does not authorize database access, fixture mutation, migration application, commit, push, or production delivery.

## Risk and human approval needed

- Every honest implementation range exceeds 400 lines. One slicing pass finds no independently deliverable helper slice: migration, bootstrap, fixtures, and final old/new proof remain one cohesive target. Human delivery handling is required; no chain strategy or size exception is inferred.
- Human approval is required for the exact migration path, implementation files, local target, applicability reads, fixture mutation, apply, candidate selection, and fresh review. The burned P1 approval covers none of these.
- The untouched storefront DB regression needs proof of a safe external target gate or renewed edit scope before execution. Any extra migration/RPC, TypeScript/UI path, business-rule repair, or hidden file expansion requires renewed scope.
- Unknown data, predecessor/ledger state, dependencies, dynamic callers, or payment-cycle cleanup behavior stops work without automatic repair.

## Key Learnings

1. Bootstrap promotion is an exact guarded admin transition, not a role API.
2. Gate 3 intentionally denies same-company catalog reads to cliente profiles.
3. Fixture compatibility requires observations against both validated database targets.
4. Service-role RLS bypass never disables relational integrity constraints.
5. Cumulative forecasts cannot replace measured candidate selection against an approved base.
