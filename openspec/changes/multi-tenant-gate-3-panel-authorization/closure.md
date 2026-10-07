# Gate 3 closure — Panel Authorization

**Status: CLOSED on 2026-10-07 by explicit user decision, with the documented deviations below.** This record supersedes the open-status pointers in `tasks.md`, `rebaseline.md`, `p1-plan.md` and `apply-progress.md`; those files remain unedited history.

## Decision: P5 preflight superseded

The closure gate in `rebaseline.md` required P5, a bounded preflight with literal PRE/POST manifests, to prove the Gate 3 migration safe to apply to production. On 2026-10-07 the user accepted declaring P5 superseded (reply "bien, adelante" to the closure plan), because the purpose of P5 was met by other evidence before and after the migration was applied:

- `20260914165851_panel_identity_catalog_isolation.sql` carries its own fail-closed checks in one transaction: 13 `gate3_predecessor_*` preflight checks (schema, identity data, routine signatures/owners/ACLs, legacy policy dependencies, email conflicts, cross-company categories) and 8 `gate3_post_*` postflight checks (catalog/identity policy closure, constraints, Auth trigger, relation and routine ACLs, preservation anchors). Any failure aborts the whole migration.
- The preflight block was run read-only against production first (it failed on 6 identity rows, which were fixed with an audited, user-approved script and then passed).
- The migrations were rehearsed on a local database rebuilt to production's ledger with production's schema drift reproduced; the rehearsal found and fixed a real blocker (`20260914120000`, production-only policy `ip_sel_owner`).
- Production was backed up manually, pushed with `supabase db push`, and its full schema fingerprint compared equal to the rehearsal database afterwards.

Evidence: `odd/ops/2026-09-30-production-migration-rehearsal.md`, `odd/tasks/production-readiness-survey.md`, `odd/ops/2026-09-29-prod-identity-cleanup.sql`.

Superseded and not delivered: Unit 1B, Unit 2, the frozen Unit 3 partial candidate, decision-blocked Unit 4, PR1A-1b..1d and PR1A-2..4. Preserved on branches `gate3/unit1b-relation-variants`, `gate3/unit2-scalar-metadata`, `gate3/unit3-ordered-columns`, `gate3/pr1a-1a-i-a-1a-r-a-record-kernel` and `archive/gate3-p5-preflight`, and in a local tarball archive.

## Requirement evidence

Delivered in PR #44 (merge `b476925`, deployed to production 2026-10-07). Migrations applied to production on 2026-09-30 and 2026-10-06 (ledger 75).

| Spec requirement | Disposition | Evidence |
|---|---|---|
| Canonical Panel Principal | Met | `src/lib/panelAuthorization.ts`; `scripts/panel-authorization.test.mjs` |
| Exact Capability Matrix | Met | `src/lib/panelCapabilities.ts`; `scripts/panel-capabilities.test.mjs` |
| Panel UI and Direct-Route Consistency | Met | `PanelRouteGate`, `panelRouteCapabilities`, `AdminLayout`, `Sidebar`, `AuthContext`; `panel-route-gate`, `panel-shell`, `auth-context` tests; browser B1 and B8 |
| Authoritative Panel API Authorization | Met for categories, product list/delete, variant mode and orders; **partial** for `ProductForm` product/variant/image saves, which still write from the browser and are enforced by the Gate 3 RLS policies (same company and role rule in the database) | `src/pages/api/panel/*`; `panel-*-api` tests; browser B2–B7 |
| Explicit Rejection of Legacy Tenant Input | Met | `empresa_id` → `400 legacy_tenant_input` in panel APIs; API tests |
| Own-Company Empresa Visibility | Met | `20260913120000`, Gate 3 `empresa_select_own_company`; `catalog-stock-isolation-db` |
| Bidirectional Tenant Isolation | Met | Gate 3 catalog and storage policies; `panel-catalog-storage-db`; production post-check (20 Gate 3 catalog policies) |
| UID-Only Trusted Provisioning | Met | `handle_new_auth_user`; `panel-provisioning-db`; backfill `20260930120000` (8 tests); browser B8 |
| Role, Company, and Deletion Integrity | Met | validated constraints `usuario_supabase_uid_auth_fkey`, `usuario_empresa_restrict_fkey`, `usuario_privileged_company_check`, `producto_empresa_categoria_fkey` (production post-check) |
| Explicit Two-State Preflight; Exact PRE-MIGRATION Eligibility; Exact POST-MIGRATION Safety; Bounded Read-Only Preflight Evidence; Behavioral Proof of the Two-State Contract | **Superseded** (decision above) | in-migration preflight/postflight, rehearsal, fingerprint |
| Preserve Gate 1, Gate 2, and Commerce Contracts | Met | DB suites `order-operations`, `checkout-idempotency`, `catalog-stock-isolation`, `storefront-tenant` pass; production `consolidar_pago_pedido`, `procesar_notificacion_intento_pago` and `transicionar_pedido_operacional` unchanged |

Also delivered in the Gate 3 branch (beyond the original spec, found while closing P4): pending-order guards for catalog deletes and variant-mode switches, atomic `pasar_producto_a_variantes`, stock no longer unpublishing products, and `ProductForm` stock compare-and-set.

## Test results at closure (release candidate `d3be722`, 2026-10-07)

- Unit/mocked: 342/342. `tsc --noEmit` and `eslint src`: clean.
- DB suites on the production-like local schema: 77/79; profile backfill 8/8 (alone). The two failures are classified, not product defects: a test expects `23503` but production's legacy trigger `trg_producto_categoria_misma_empresa` rejects first with `P0001`; a fixture cleanup deletes `storage.objects` with SQL, which Storage forbids.
- Browser checklist B1–B8 passed (`odd/ops/2026-10-07-release-candidate-validation.md`).

## Deviations from the original closure gate

- **No single integrated independent review** of the full candidate. Every slice had its own native/subagent review with dispositions recorded in `odd/tasks/*.md` and `odd/ops/*.md`.
- P5 superseded (above).
- `ProductForm` product, variant and image writes are not yet behind panel APIs (database-enforced instead).
- Checkout and payment were not exercised in a browser.

## Carried forward (not Gate 3)

Tracked in `docs/operations/lanzamiento-raeyz.md`: production `crear_pedido_con_items` drift (`variante_sin_stock`), `ProductForm` writes to the API, the two test fixes above, Supabase paid plan and backups, Mercado Pago webhook behind Cloudflare Access, `www.raeyz.com`, Vercel preview protection and per-environment `APP_BASE_URL`, smoke and personal-company cleanup, pre-existing UI bugs, one pinned Supabase CLI version.
