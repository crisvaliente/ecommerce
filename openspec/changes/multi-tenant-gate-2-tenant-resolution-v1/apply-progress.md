# Apply Progress — Multi-Tenant Gate 2: Tenant Resolution v1

## Checkpoint

Apply was interrupted twice before a progress artifact was persisted. This checkpoint records only evidence recoverable from the working tree. No commit, push, PR, branch operation, or destructive cleanup was performed.

## Persisted task state

### Completed

- R1 — recovered contract verified on resume.
- R2 — recovered SSR/catalog/image contract verified by the same focused suite.
- R3 — recovered registry and bidirectional two-host DB contract verified after local reset (2/2).
- R4 — bootstrap helper and emitted JSON contract verified: canonical hostname plus `created: true` and already-present `created: false` states, with the exact `{ hostname, created }` shape.
- G1 — additive private registry verified by the passing reset/DB suite.
- G2 — direct-Host resolver reconciled against the persisted 7/7 focused storefront suite and current source scope.
- G3 — SSR/catalog/image isolation reconciled against the persisted 7/7 focused storefront suite and current source scope.
- G4 — collision-safe bootstrap and operational wiring verified, including the emitted JSON contract in both creation states.
- T1 — fail-closed alternate-input triangulation verified with explicit lookup/catalog call counts and 404/503 response assertions.
- T2 — reset-backed two-host DB isolation, service-role scoping, domain collision safety, cross-wired image rejection, foreign-only fail-safe behavior, and Gate 1 regression verified.
- T3 — integrated Next HTTP smoke verified two mapped hosts, fail-closed unknown/malformed hosts, alternate-input resistance, induced 503/no-store behavior, Host preservation, cross-tenant catalog/image exclusion, and full cleanup.

Historical RED output for these already-authored tests was lost with the interrupted apply and was not recreated by reverting valid implementation. This recovery deviation is explicit; current executable evidence is persisted below.

### Implementation already present — preserve and verify, do not rewrite

- R1/R2: host extraction, normalization, resolver, SSR/catalog and image-isolation tests are authored.
- R3: the DB test covers registry constraints/privileges and bidirectional catalog/stock/cross-wired-image fixtures, but remains incomplete against the full T2 contract.
- R4: bootstrap helper tests are authored, but sanitized bootstrap output wiring is not covered.
- G1: the additive `empresa_dominio` migration is present.
- G2: the direct-Host resolver implementation is present.
- G3: storefront SSR/catalog integration and row-to-object image validation are present.
- G4: bootstrap/domain registration, package command, environment sample, and rollout documentation are present.
- T1: alternate-input/fail-closed tests are present but the complete lookup/catalog call-count matrix still needs reconciliation.
- T2: bidirectional DB fixtures are present but missing required bootstrap DB behavior, foreign-only image-null, conflicting-input, and recorded Gate 1 execution evidence.
- R3-005 remediation is present: image filenames `.` and `..` are rejected and corresponding test rows were added. It has not been executed at this checkpoint.

### Pending exact task units

- [x] R1 — focused suite passed with 7/7 tests.
- [x] R2 — the same focused suite passed host authority, explicit scoping, fail-closed orchestration, and row-to-object image cases.
- [x] R3 — recovery-verified DB contract passed 2/2 after a successful local reset; historical RED output remains unavailable and was not fabricated.
- [x] R4 — bootstrap helper plus spawned-script JSON contract passed 5/5, including hostname, created, already-present, and exact object shape.
- [x] G1 — migration/registry GREEN reconciled from the successful reset and 2/2 DB suite.
- [x] G2 — resolver GREEN reconciled from persisted 7/7 storefront evidence and current direct-Host-only source scope.
- [x] G3 — SSR/catalog/image GREEN reconciled from persisted 7/7 storefront evidence and current explicit `empresa_id`/scoped-product/row-to-object source scope.
- [x] G4 — bootstrap behavior/docs and emitted tenant-domain JSON contract are now evidence-complete.
- [x] T1 — focused tests now assert `0/0` lookup/catalog calls for invalid and malformed Host, `1/0` for unknown and lookup-failure outcomes, no alternate-input authority, and 503/no-store behavior.
- [x] T2 — initial and final reset-backed runs passed Gate 2 DB 2/2 plus Gate 1 isolation 1/1 with valid, cross-tenant, and fail-safe cases.
- [x] T3 — precondition RED proved the broken harness, harness-only stdin correction made mappings GREEN, and the complete integrated HTTP matrix passed. Production custom-domain Host preservation remains an explicit release prerequisite.
- [ ] F1 — remove only obsolete/duplicate routing code after prior units are GREEN.
- [ ] F2 — run the complete quality and commerce-integrity gate.

## Files modified or added

### Product/runtime

- `src/lib/storefrontTenant.ts`
- `src/lib/storefrontCatalog.ts` (new)
- `src/pages/coleccion/index.tsx`
- `scripts/bootstrap-instance.mjs`
- `scripts/lib/tenant-domain.mjs` (new)
- `supabase/migrations/20260903120000_multi_tenant_gate_2_empresa_dominio.sql` (new)

### Tests

- `scripts/storefront-tenant.test.mjs`
- `scripts/storefront-tenant-db.test.mjs` (new)
- `scripts/bootstrap-instance.test.mjs` (new)

### Configuration and operations

- `package.json`
- `README.md`
- `local-env.sample`
- `tsconfig.json`

### SDD artifacts

- `openspec/changes/multi-tenant-gate-2-tenant-resolution-v1/explore.md`
- `openspec/changes/multi-tenant-gate-2-tenant-resolution-v1/proposal.md`
- `openspec/changes/multi-tenant-gate-2-tenant-resolution-v1/specs/tenant-resolution/spec.md`
- `openspec/changes/multi-tenant-gate-2-tenant-resolution-v1/design.md`
- `openspec/changes/multi-tenant-gate-2-tenant-resolution-v1/tasks.md`
- `openspec/changes/multi-tenant-gate-2-tenant-resolution-v1/review-ledger.md`
- `openspec/changes/multi-tenant-gate-2-tenant-resolution-v1/apply-progress.md`

### Excluded harness state

- `.pi/gentle-ai/sdd-preflight.json` is untracked harness state. It was not deleted or treated as Gate 2 product implementation.

## Tests executed and results

### Resume evidence

| Command | Exit | Result |
|---|---:|---|
| `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs` | 0 | 7 tests passed, 0 failed; direct Host extraction/normalization, fail-closed resolver, image object-path binding, explicit catalog scoping, alternate-input rejection, and 404/503 orchestration all passed. |
| `pnpm exec supabase db reset --local && node --test scripts/storefront-tenant-db.test.mjs` | 0 | Reset applied all migrations through `20260903120000_multi_tenant_gate_2_empresa_dominio.sql`; 2 tests passed, 0 failed. Registry normalization/uniqueness/cascade/least privilege and bidirectional product/variant/stock/cross-wired-image isolation passed. |
| `pnpm test:instance-config` | 0 | 6 tests passed, 0 failed; instance contract, asset safety, currency/identifier validation, canonical base URL/OAuth derivation, and unsafe base URL rejection passed. |
| `node --test scripts/bootstrap-instance.test.mjs` | 0 | 5 tests passed, 0 failed. In addition to helper behavior, the spawned bootstrap emitted `tenant_domain` as exactly `{ hostname, created }`; first run reported the canonical hostname with `created: true`, second run reported the same hostname with `created: false` (already present). |
| `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs` (T1 initial after test-first spy assertions) | 0 | 7 tests passed, 0 failed. Invalid/malformed cases asserted `0/0`; unknown and failure families asserted `1/0`; alternate tenant inputs remained ineffective; 503/no-store assertions passed. |
| Same focused T1 command, final rerun | 0 | 7 tests passed, 0 failed. No production implementation change was necessary. |
| `pnpm exec supabase db reset --local && node --test scripts/storefront-tenant-db.test.mjs && node --test scripts/catalog-stock-isolation-db.test.mjs` (T2 initial after test-first additions) | 0 | Reset completed through Gate 2 migration; Gate 2 DB 2/2 and Gate 1 isolation 1/1 passed. Covered two mapped hosts, conflicting alternate inputs, same/cross-owner registration, distinct products/variants/stock, canonical and cross-wired image keys, foreign-only null fallback, unknown-host fail closed, registry privileges and cleanup. |
| Same reset-backed T2 command, final rerun | 0 | Gate 2 DB 2/2 and Gate 1 isolation 1/1 passed again. No production implementation change was necessary. |
| `/tmp/gate2-t3-precondition-red.sh` using diagnosed no-`-i` fixture path | 1 (expected RED) | Mapping precondition aborted with `expected=2 actual=0`; verified Next was not started. |
| `/tmp/gate2-t3-smoke-green.sh` after harness-only `docker exec -i` correction | 0 | Preconditions: 2 mappings and 2 persisted cross-wired image rows. HTTP: A=200/A-only, B=200/B-only, unknown=404, malformed=404, conflicting B inputs on Host A=200/A-only, induced lookup failure=503 with `Cache-Control: no-store, must-revalidate`, recovery=200. Cross-tenant data/image keys exposed=0; one bounded lookup-failure log. Cleanup: fixture rows=0, service-role SELECT=true, port 3000 stopped. |
| F1 checkpoint: storefront focused unit | 0 | 7 tests passed, 0 failed. |
| F1 checkpoint: `node --test scripts/storefront-tenant-db.test.mjs` | 0 | 2 tests passed, 0 failed. |
| F1 checkpoint: `pnpm exec tsc --noEmit` | 1 | Failed with 9 diagnostics: four TS2347 untyped generic-query calls, one TS2345 `Set<unknown>` image scope, three TS2339 failure-union accesses in `storefrontCatalog.ts`, and one TS2339 extraction-union access in `storefrontTenant.ts`. |
| F1 identity/structure search | 0 | No old slug resolver or `instanceConfig.store.slug` in the three tenant identity surfaces; exactly one Host normalizer, one server composition definition, and one catalog loader definition; `git diff --check` clean. |
| F1 resumed RED baseline: `pnpm exec tsc --noEmit` | 1 | Reproduced the same 9 diagnostics before modification; log: `/tmp/gate2-f1-tsc-baseline-red.log`. |
| F1 after exact injected-client typing | 2 | The four generic-query diagnostics and inferred `Set<unknown>` diagnostic were removed; only four explicit union-narrowing diagnostics remained. No query or public loader signature changed. |
| F1 after explicit failure discriminants: `pnpm exec tsc --noEmit` | 0 | TypeScript GREEN with no diagnostics; log: `/tmp/gate2-f1-tsc-green.log`. |
| F1 final regression: storefront unit + storefront DB + searches + `git diff --check` | 0 | Storefront 7/7 and DB 2/2 passed; no slug identity matches; normalizer/composition/loader definition counts 1/1/1; diff check clean. No explicit `any` exists in either affected implementation file. T3 not repeated because the type alias erases and the explicit boolean discriminants preserve the closed-union runtime behavior. |
| F2.01 `pnpm exec supabase db reset --local` | 0 | Clean local reset completed through Gate 2 migration and seed. |
| F2.02 `pnpm test:instance-config` | 0 | 6/6 passed. |
| F2.03 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs` | 0 | 7/7 passed. |
| F2.04 `node --test scripts/storefront-tenant-db.test.mjs` | 0 | 2/2 passed. |
| F2.05 `node --test scripts/catalog-stock-isolation-db.test.mjs` | 0 | 1/1 passed. |
| F2.06 `pnpm test:buyer-checkout` | 0 | 7/7 passed. |
| F2.07 `pnpm test:checkout-idempotency` | 0 | 16/16 passed. |
| F2.08 `pnpm test:checkout-idempotency:db` | 0 | 3/3 passed. |
| F2.09 `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/order-operations-api.test.mjs scripts/order-operations-ui.test.mjs` | 0 | 48/48 passed. |
| F2.10 `node --test scripts/order-operations-db.test.mjs` | 0 | 8/8 passed. |
| F2.11 `pnpm lint` | 1 | Stopped on `scripts/bootstrap-instance.test.mjs:6:1`: `@next/next/no-assign-module-variable` rejects `const module`. TypeScript, build, final diff check, and authored-size accounting were not run. |
| F2 recovery: focused bootstrap test after authorized local rename | 0 | 5/5 passed; no assertion or behavior changed. |
| F2.11 retry `pnpm lint` | 0 | ESLint completed with 0 errors and 0 warnings. |
| F2.12 `pnpm exec tsc --noEmit` | 0 | No TypeScript diagnostics. |
| F2.13 `pnpm build` | 0 | Next.js 16.1.1 production build compiled successfully; 26 static pages generated and `/coleccion` retained dynamic SSR. |
| F2.14 final `git diff --check` | 0 | Clean. |
| F2 final authored-size accounting | 0 | All tracked + untracked: 2,194 additions, 258 deletions, 2,452 changed lines. Versionable Gate 2 set excluding harness-only `.pi/gentle-ai/sdd-preflight.json`: 2,186 additions, 258 deletions, 2,444 changed lines. |
| T3 local integrated smoke: temporary two-company/two-domain/products fixture + `pnpm dev` + `curl --resolve` probes | 1 | Blocked on discrepancy: valid Host A and Host B both returned 404; unknown and malformed hosts also returned 404 as expected; conflicting alternate-input request to Host A returned 404. Product markers were absent, so the script stopped before the induced registry-failure 503 probe. Next logs contained only plain 404 request lines and no `[storefront-tenant] lookup_failed` event. Fixture cleanup completed, `service_role` SELECT was restored, and port 3000 was stopped. |

Interrupted-run results remain unclaimed because no prior logs survived.

## TDD cycle evidence

| Unit | RED evidence | GREEN evidence | Current state |
|---|---|---|---|
| R1–R2 | Historical failing outputs were lost with the interrupted process; valid implementation was not reverted to manufacture RED. | Resume focused suite: exit 0, 7/7 passed. | Recovery-verified and complete with explicit RED-evidence caveat. |
| R3 | Historical failing output was lost with the interrupted process; valid implementation was not reverted to manufacture RED. | Local reset plus DB focused suite: exit 0, 2/2 passed. | Recovery-verified and complete with explicit historical-RED-loss caveat. |
| R4 | The missing output-contract test was added before any implementation change; it passed immediately against existing behavior, so no incompatibility RED occurred. Historical earlier RED remains unavailable. | Bootstrap suite: exit 0, 5/5; emitted JSON proved canonical hostname, `created: true`, already-present `created: false`, and exact `{ hostname, created }` shape. | Complete; no bootstrap implementation change required. |
| G1 | Historical RED output unavailable. | Local reset and DB suite: exit 0, 2/2. | GREEN reconciled from executable registry evidence. |
| G2–G3 | Historical RED output unavailable. | Persisted focused storefront suite: exit 0, 7/7; current source was inspected for direct Host-only authority, explicit company predicates, scoped product/image reads, and pre-sign row-to-object validation. | GREEN reconciled without rewriting valid implementation. |
| G4 | Historical RED output unavailable; new output-contract test was test-first and immediately GREEN against valid existing implementation. | Instance-config 6/6, bootstrap 5/5, and DB 2/2; package/docs/environment scope inspected. | GREEN complete. |
| T1 | Missing lookup/catalog spy assertions were added before any implementation change. The strengthened suite passed immediately, so no behavior RED occurred. | Initial and final focused runs both exited 0 with 7/7 tests; invalid/malformed=`0/0`, unknown/failure=`1/0`, alternate inputs ignored, 503/no-store verified. | Complete; existing implementation was preserved. |
| T2 | Missing DB cases were added first: real resolver under conflicting inputs, bootstrap same/cross-owner behavior, foreign-only image null, and unknown-host no-catalog behavior. The strengthened suite passed immediately, so no production behavior RED occurred. | Initial and final reset-backed runs both passed Gate 2 DB 2/2 plus Gate 1 isolation 1/1. | Complete; service-role and tenant→resource boundaries verified without production changes. |
| R3-005 remediation | `.`/`..` cases were added before the validator rejection was changed during resume. | Both T1 focused runs passed 7/7, including image object-path tests. | Verified. |
| T3 | Explicit fixture precondition failed RED before Next under the diagnosed no-stdin harness. | Harness-only `docker exec -i` correction made 2 mappings/2 cross-image rows visible; complete integrated HTTP smoke exited 0 with all expected statuses, catalogs, 503/cache/log, Host, cross-tenant exclusion, and cleanup evidence. | Complete locally; no product code changed. Production custom-domain Host preservation remains a release prerequisite. |
| F1 | Baseline reproduced all 9 strict-TypeScript diagnostics before edits. | Exact injected-client capability typing removed query/collection errors; explicit `ok === false` checks removed the four narrowing errors. TypeScript exit 0; storefront 7/7; DB 2/2; searches and diff check passed. | Complete. Changes are type-only plus behavior-equivalent discriminant syntax; T3 repetition not required. |
| F2 | Clean ordered run passed reset plus all instance/storefront/isolation/checkout/payment/order suites. | Authorized test-only local rename resolved the lint discrepancy; focused bootstrap 5/5, lint, TypeScript, build, and final diff check all exited 0. | Complete; T3's prior production-equivalent smoke remains valid because no material runtime code changed during F2. |

Historical RED evidence that was not persisted must not be fabricated. On resume, preserve valid existing files, use real RED cycles for newly added fixes, and capture all new command evidence immediately.

## T3 Host-boundary diagnosis

- **Client Host:** curl `--noproxy '*' --resolve tenant-a.localhost:3000:127.0.0.1 --trace-ascii ...` emitted `Host: tenant-a.localhost:3000`; the unknown probe emitted `Host: unknown.localhost:3000`.
- **Runtime Host:** temporary bounded instrumentation recorded `headers.host` and the sole `rawHeaders` Host as the same values sent by curl. Next did not substitute them.
- **API used:** `/coleccion` is a Pages Router SSR route. `getServerSideProps` passes `context.req` to `resolveStorefrontServerSideProps`, which calls `resolveStorefrontTenant`; `extractDirectHost` reads Node `request.headers.host` and filtered `request.rawHeaders`. It does not use App Router `headers()`, middleware, query values, or forwarding headers.
- **Normalization:** extraction succeeded; `tenant-a.localhost:3000` normalized to lowercase, port-free `tenant-a.localhost`. Existing normalization also lowercases DNS casing and validates port/hostname syntax.
- **Route entry:** runtime events `resolver_entry`, `extracted`, `normalized`, and `lookup_result` prove `/coleccion` executed tenant resolution for both requests.
- **Proxy/rewrite evidence:** no `middleware.*` or `proxy.*` exists; generated/static inspection found no rewrite path; `next.config.ts` configures response headers only. Next dev preserved direct Host.
- **Lookup convergence:** both known-looking and unknown probes returned `found: false`, `hasError: false`. Direct SQL immediately before the request also showed no `tenant-a.localhost` row.
- **Verified root cause:** the temporary smoke used a heredoc piped into `docker exec ... psql` without Docker's `-i` stdin flag, so fixture SQL was never delivered. A non-mutating control produced `WITHOUT_STDIN_FLAG=''` and `WITH_STDIN_FLAG=42`.
- **Why both returned 404:** both domain rows were absent, so both were correctly classified as `unknown_host` and returned fail-closed `notFound`.
- **Why no `lookup_failed`:** a null mapping with no database error is `unknown_host`; only lookup errors, throws, or malformed rows generate the 503/log branch.
- **Harness correction completed:** an explicit precondition first failed RED with `expected=2 actual=0` and Next not started; only the temporary harness was changed to `docker exec -i`. The GREEN precondition verified 2 exact mappings and 2 persisted cross-wired image rows before launching Next.
- **Integrated GREEN:** Host A/B returned only their own catalogs; unknown/malformed failed closed; conflicting B inputs could not change Host A; induced registry failure returned 503/no-store; cross-tenant data and foreign image keys exposed=0.
- **Restoration:** no temporary instrumentation remains; fixture companies count is zero; `service_role` SELECT is true; port 3000 is stopped.

## Open risks and caveats

- `R3-001` local blocker resolved: after a test-first harness-only stdin correction, the full integrated Host matrix passed. Production direct-Host preservation remains an independent release prerequisite because no deployed hosting target was available.
- `R3-002` CRITICAL recovery note: interrupted apply lost prior command/TDD evidence. R1–G4 now have persisted passing or source-reconciled recovery evidence; historical RED output remains unavailable.
- `R3-003` remediated: T2 now proves bootstrap same-owner/cross-owner behavior, foreign-only image null, conflicting-input resistance, unknown-host fail closed, and combined Gate 1 execution in two passing reset-backed runs.
- `R3-004` remediated: T1 now records the complete `0/0` and `1/0` lookup/catalog call-count matrix.
- `R3-005` verified: both focused T1 runs passed the image object-path suite containing `.`/`..` rejection cases.
- `R3-006` remediated: a spawned-process test now verifies sanitized `tenant_domain` JSON for canonical hostname, created, already-present, and exact object shape; bootstrap suite passes 5/5.
- `R3-007` info: `tsconfig.json` broadens TypeScript import policy and still requires necessity/scope review; untracked `.pi` state must stay outside delivery.
- Row-to-object image isolation remains mandatory: only a canonical key matching the resolved `empresa_id` and scoped `producto_id` may reach the service-role signer.
- F1 strict-TypeScript blocker is closed: exact injected-client capability typing and explicit failure discriminants produce TypeScript exit 0 without explicit `any`, broad casts, query changes, or runtime boundary changes.
- F2 lint blocker is closed: only the test-local imported namespace binding and its lookup references were renamed; focused bootstrap 5/5 and the remaining gate passed.
- The working tree exceeds the 400-line budget under the user-approved size exception.

## Re-entry point

**F2 complete. Stop before commit/versioning. The Gate 2 working tree is quality-gate GREEN; keep `.pi/` outside delivery and validate real deployment direct-Host preservation before release.**

Do not repeat exploration, design, or tasks planning. Do not overwrite valid existing implementation.
