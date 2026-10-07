# Canonical tenancy for panel products

**Implemented, verified, reviewed, committed and pushed.** User authorized the products API/consumer/tests slice, then selected local commit, and finally “Push de ambos commits (Recomendado)”. No PR or merge was created.

## Contract and scope

Files: `src/pages/api/panel/productos.ts`, `src/pages/panel/productos/index.tsx`, `scripts/panel-productos-api.test.mjs`. Parent bookkeeping: this document and Engram `odd/products-tenant-contract/tasks`, excluded from delivery.

- Preserve method/rate-limit precedence; any own query `empresa_id` returns `400 legacy_tenant_input` before authorization/service construction.
- Without tenant input, request `catalog.operate` and derive both privileged query filters only from `principal.empresaId`.
- Preserve authorization denials and existing query-error handling; remove `meta.empresa_id` and the browser's tenant URL parameter together.
- Retain bearer auth, item mapping, other metadata, stock calculations and tolerant stock-summary fallback.
- No SQL, DB, migrations, provisioning, other business changes or Unit 3 activity. Gate 3 remains OPEN and Unit 3 FROZEN.

## Completed tasks

- [x] P4P-1 — Delegated read-only mapping; corrected API-only proposal to include its consumer.
- [x] P4P-2 — Strict TDD implementation by `mud7x383-4-k7z3`; actual handler tested via isolated transpilation/interception, not copied logic.
- [x] P4P-3 — Independent verifier `mud834h8-5-w2k9` and native review completed.
- [x] P4P-4 — Evidence checkpoint and remaining P4 limitations reported.
- [x] P4P-5 — Separately authorized local commit `d603f314f0e92def6f1a067267ed7e502739689c`, `fix(auth): derive panel products tenancy from canonical profile`.
- [x] P4P-6 — Separately authorized push with route-gate commit `b908582fcad59739838098a00f4b7fca579b18be` to `origin/gate3/pr1a-preflight-manifests-fixtures`; non-force update `a79ca9d..b908582`, confirmed upstream/HEAD divergence `0 0`.

## Verification and review evidence

Strict TDD from `openspec/config.yaml:4–6`. Writer observed natural RED (old handler required tenant/accepted matching legacy input), then focused PASS 19/19. Writer and independent verifier passed the combined products/authorization/order-operation/capability suites 98/98, TypeScript, scoped ESLint and diff whitespace. Historic RED was not independently replayed.

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-productos-api.test.mjs scripts/panel-authorization.test.mjs scripts/order-operations-api.test.mjs scripts/panel-capabilities.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/pages/api/panel/productos.ts src/pages/panel/productos/index.tsx scripts/panel-productos-api.test.mjs
git diff --check
```

Initial ASSESS was unavailable; independent verification ran conservatively. Native lineage `review-43f4674078710388` approved 3 files/+208/-18 (226 lines), acknowledged and authority burned at revision `sha256:92825305e210b62c6cdb74436a90bb84403ef6881502b20637f4a22e4ece1f76`. Approved/staged/committed tree all exactly `7226d93afd8055e74140422190f89b1489276b6e`; parent `a79ca9d10b77c837f6a0d5827d3e48da2b477c5e`. No corrections or review replay.

Source SHA-256: API `ce1fadce22935e892f6fccb9bae393a0e1a12a32dc91c8cab7eac5123c308789`; consumer `ad8519bc37afd71da765d689ca2710998894e41123a4bb50708b12a2c150dd81`; test `f6f888fcf07818be237c7b8eefc47a93c73c01cf114dbf397e8a18446ec0f444`.

## Limits and next step

Consumer coverage is static, not browser runtime proof. No live auth/RLS or external-consumer compatibility verification; tolerant fallback is a separate P4 gap. Delivery repeated neither tests nor review because approved tree identity was unchanged. Historical artifacts and both ODD checkpoint documents remain untracked/excluded. No PR, merge or manual deployment action; remote CI/deployment behavior was not inspected. Await separately authorized next P4 work or PR planning. Delivery strategy remains `ask-on-risk`, no chain selected; cumulative branch PR size must be assessed separately. Any rollback/revert requires separate authorization.
