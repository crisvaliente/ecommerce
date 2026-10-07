# Gate 3 Rebaseline Plan — Strategy Accepted; P1 Planning Only

> **Closed (2026-10-07):** Gate 3 is CLOSED by user decision with documented deviations; P5 preflight superseded. See [closure.md](./closure.md). Everything below is history.

> **Current pointer (supersedes active planning status):** P1.1 and the agreed atomic P1.2+P1.3 integration scope are implemented and reviewed, with the separate canonical `empresa` SELECT prerequisite also implemented; see the [2026-09-13 canonical checkpoint](./p1-plan.md#2026-09-13--p1-implementation-and-native-review-checkpoint). They are not delivered, and this is not SDD controller, whole-P1, or whole-Gate-3 closure. Gate 1/2/Unit 1A remain CLOSED, Gate 3 remains OPEN, and Unit 3 remains FROZEN — NO RESCUE. Older planning and SDD-ledger statements below remain historical and untouched.

## Decision, scope, and stop

**Decision:** the user accepted the bounded discovered-inventory evidence strategy; this remains documentation-only and is not implementation authority. **P1 is PLANNING ONLY; STOP NOW—strategy acceptance does not start, implement, or approve P1.** Gate 1 and Gate 2 are CLOSED; Unit 1A is CLOSED/delivered at `91b1e80adc4d1005034c0af0657ec4da80750d1b`. Unit 1B (`54a5c651b31b3e7da9b2ab4bd13d196d8a90dc76`, local/synthetic, six variants, 33-line diff) and Unit 2 (`9dd641130efad448add8c1ef07a534f970804d90`, local/synthetic, scalar metadata, 134-line diff, historical 64/64) are carried evidence only; they do not prove tenant/RLS security. Unit 3 is FROZEN: its 141-line partial and 79-test historical baseline are not the full contract and have no rescue, reuse, or new-base authority.

Gate 3 remains OPEN. The historical 28-unit feature-branch-chain topology and native `10/109` counter are retained as history, not an executable plan or new completion measure. The native controller/checklist remains historical authority; these pointers neither resolve it nor replace runtime authority. No new change ID, renamed Unit 3, commit, push, database action, or production action follows from this document.

## Rebaseline boundary and delivery forecast

| Field | Proposed value |
|---|---|
| Scope | Gap-only closure of the approved Gate 3 security properties; no Gate 1/2 rewrite and no Unit 3 rescue. |
| Evidence strategy change | The user **ACCEPTED** replacement of the retired universal 67-file/catalog-canonicalizer plan with bounded property assertions over a discovered, closed reachable inventory; it narrows no MUST and does not authorize P1 implementation. |
| Completeness rule | A named allowlist alone is insufficient: real bounded source/runtime discovery must find unlisted bypasses; unknown or unverifiable reachability is a closure blocker. |
| Future source/test estimate | Current P1–P5 sum to 2,090–3,400 changed lines; P6 is UNSIZED. Low confidence until bounded discovery completes; these are not promised PR sizes and may require reviewable slices. The superseded 1,810–3,040 estimate is historical only. |
| Review risk | High; delivery strategy remains `ask-on-risk`. |
| Historical topology | `feature-branch-chain` is historical only; no new chain strategy is selected. |

The documentation delta budget is independent of the future source review budget and any cumulative runtime budget. No `size:exception` is inferred.

## Security property and evidence matrix

| Property that must close | Known gap / historical finding group | Required reproducible evidence |
|---|---|---|
| Sole authority is `auth.uid() -> usuario.supabase_uid -> empresa_id + rol`; profile cardinality, role/company state, and company existence are valid | Principal lookup currently lacks zero/duplicate/error distinctions and delays neither service-key read nor client construction | Valid admin/staff/company-bound cliente and legitimate null-company cliente; deny anonymous, missing, duplicate, malformed, unknown-role, orphan, privileged-null-company, and lookup-error states. Assert `401/403/500`, no privileged client before denial, and no protected content/data. |
| Exact approved capability matrix and UI parity | Scattered layout/sidebar/home/payments/cancellation checks; staff-home conflict | Every admin/staff/cliente matrix cell: admission, catalog, ordinary orders, cancellation, payments, and trusted company/role boundary. Direct route equals navigation/control result; loading/failure has no protected flash. |
| Legacy client tenant is always rejected | `productos` still accepts matching request `empresa_id`; API locations vary | For each supported top-level query/body location, matching, foreign, empty, null, and array `empresa_id` return `400 legacy_tenant_input` before service-role work; omitted input uses only canonical company. |
| API work is tenant-derived and fail-closed | Product list/detail and item/payment downstream failures can form partial `200`; panel APIs require ordering proof | Spies/receipts prove principal-derived `.eq("empresa_id", ...)` and RPC arguments; auth/capability precedes service client; secondary lookup/RPC/malformed result returns `500` with no privileged fragment. Preserve post-authorized `404`, existing `405/429/409` semantics. |
| Company, catalog, storage, and restricted operation isolation holds for every role and both directions | `empresa` authenticated `USING true`; role-blind Gate 1 policies; policy/grant OR risks; `pi_read_public`, loose storage path, authenticated stock history, exposed GraphQL | Disposable asymmetric A/B fixtures execute all retained catalog commands, bridges/categories/variants/images, stock view, storage commands and exact five-segment path. Admin/staff own-company allow; a company-bound cliente may only SELECT its own `empresa`, while every cliente has no catalog/storage/restricted-operation/panel capability. A→B and B→A denial prove returned and persisted state. Probe effective grants/policies/RPC/view/GraphQL and unknown bypasses. |
| Provisioning and deletion preserve identity/company integrity | Email adoption in auth trigger/browser ensureProfile/bootstrap; `ON DELETE SET NULL` | UID retry idempotency; new default cliente/null/onboarding; duplicate UID/email/ambiguous-email conflict has no mutation; browser cannot repair profile; privileged role/company assignment is trusted and atomic; company deletion with dependents blocks. |
| PRE/POST is a read-only, two-state operational proof | R3-001–008/014; R1-007–010; canonicalizer identity/order/sparse/nested/replay/leak failures | Actual wrapper against disposable fixtures: one bounded non-secret JSON, exact status/exit, repeatable-read/no mutation, authenticated fresh runtime attestation, closed discovery and before/after covered data/schema proofs. PRE only exact predecessor→`migration_required/0`; POST only exact target→`pass/0`. |

The capability matrix is exactly the existing specification: admin may enter/operate catalog and ordinary orders/cancel/payments/trusted company-role operations; staff may enter/operate catalog and ordinary orders only; cliente has no panel capability. Order eligibility, payment, stock atomicity, and idempotency are not capability bypasses.

### Evidence anchors and status transport

The later bounded discovery starts from these repository-relative targets at the recorded baseline `526f614be9cc1efc9269bc62996eaa85b3504be2`; any historical source assertion must identify its exact commit and use `git show <commit>:<path>`, not a stopped worktree or caller summary.

- Principal/API: `src/lib/panelAuthorization.ts:107–177`, `src/pages/api/panel/productos.ts:48–140`, `src/pages/api/panel/pedidos.ts:62`, `src/pages/api/panel/pedidos/[id].ts:138–176`, and `src/lib/orderOperationsApi.ts:240–255`.
- UI parity: `src/components/layout/AdminLayout.tsx:34–66`, `src/components/layout/panel/Sidebar.tsx:12–48`, `src/pages/panel/index.tsx:26–50`, `src/lib/orderOperationsUi.ts`, and payments layout/page discovery.
- Identity/lifecycle: the inventory-recorded profile-FK and auth-trigger migrations, `src/context/AuthContext.tsx:54–106,133–146`, and `scripts/lib/supabase-bootstrap.mjs:42–104`; future historical-source claims must record each exact migration path and commit.
- Database/exposure: `supabase/migrations/20260801120000_security_tenancy_hardening.sql:5–319`, `supabase/config.toml:8–19`, `storage.objects` policy `pi_read_public`, and `public.empresa`/`historial_stock` effective policies and grants.

PRE accepts only exact `PRE-MIGRATION` predecessor as `migration_required`/exit `0`; POST accepts only exact target as `pass`/exit `0`. A confirmed dirty state, drift, bypass, or preservation failure is `blocked`/exit `3`; missing/malformed mode, unavailable/ambiguous evidence, wrapper transport failure, or unsealed result is `unverifiable`/exit `4`. The wrapper, not raw SQL, transports those exits. In a repeatable-read read-only reporting shell, `ON_ERROR_ROLLBACK=on` (or equivalent savepoints) preserves the transaction, captures `ERROR`/`SQLSTATE`, emits exactly one bounded non-secret JSON, explicitly `ROLLBACK`s, and lets the wrapper map status—never `\quit 4` magic. Covered before/after proof includes all reachable affected data, schema, history, constraints/indexes, RLS/policies, grants/default ACLs, routines/triggers/views and storage authorization; it does not require a feature-wide whole-database fingerprint.

## Historical findings retained in closure

| Finding group | Rebaseline disposition and owning evidence unit |
|---|---|
| R1-001 and R1-002 | Verified Design corrections remain fixed constraints: role-aware catalog policy parity and transaction-preserving one-report preflight handling. They are not relabelled open. |
| R3-001–004 | Still open in the **PR 1 preflight** ledger section: unsafe predecessor acceptance, incomplete dirty coverage, one-report failure handling, and constant/coarse fingerprints belong to P5. The unrelated post-Tasks `.pi/` audit R3-001 was refuted and remains historically distinct. |
| R3-005–008 and R3-014 | Still open P5 blockers: stock/storage target safety, literal manifests, closure/ACL/trigger identity, executed role matrix, and wrapper-owned non-zero exit. R3-009–013 are historical verified evidence only, not closure. |
| R1-007–010 | Still open P5 blockers: AST-capable Auth/source discovery, discovered rather than caller-supplied roots/closure, kind-aware stable canonicalization, and provenance/freshness-bound runtime attestation. |
| R1-012–015 | P5/P6 retain positional ordering, nested-schema rejection, framed identity, and bounded/no-leak output as mandatory property assertions; the stopped canonicalizer implementation is retired, not accepted. |
| R1-016–019, R1-025–027 | P5/P6 retain catalog-metadata stripping, sparse/malformed rejection, independent path falsifiers, and replay ambiguity as unresolved requirements, not evidence. |
| R1-020–024 | P5/P6 retain the budget/readability, independently named falsifier, malformed/sparse/nested coverage, discriminant/metadata, and natural-RED failures; the stopped strategy did not close them. |
| R1-028–036 | Unit 1A closed only its table-kernel concerns; inherited OID, snapshot, proxy, stable-error, and opaque-content evidence remains historical and cannot prove database/runtime authorization. |

Named reachable surfaces remain mandatory: SQL policies/grants/helpers/RPCs/views/triggers, roles and `SET ROLE`, service-role construction, storage, GraphQL facade/exposure, checkout/order/payment/webhook, and all alternate `membresia`, email, ownership, client-tenant, or policy-OR authorities. Retirement of a candidate implementation never retires its underlying property.

### Evidence classification and preserved boundaries

| Evidence | Current classification | Permitted conclusion |
|---|---|---|
| Gate 1 closed [verify report](../multi-tenant-gate-1-isolation-hardening/verify-report.md#tdd-evidence), [tasks](../multi-tenant-gate-1-isolation-hardening/tasks.md), [migration](../../../supabase/migrations/20260902120000_multi_tenant_gate_1_catalog_stock_isolation.sql), and [DB test](../../../scripts/catalog-stock-isolation-db.test.mjs) | Historical closed baseline | Preserve catalog/stock isolation; do not reopen or edit Gate 1. |
| Gate 2 closed [apply progress](../multi-tenant-gate-2-tenant-resolution-v1/apply-progress.md#tests-executed-and-results), [review ledger](../multi-tenant-gate-2-tenant-resolution-v1/review-ledger.md), [migration](../../../supabase/migrations/20260903120000_multi_tenant_gate_2_empresa_dominio.sql), [storefront suite](../../../scripts/storefront-tenant.test.mjs), and [DB suite](../../../scripts/storefront-tenant-db.test.mjs) | Historical closed baseline | Preserve host resolution and signed URLs; do not reopen or edit Gate 2. |
| Unit 1A 39-test receipt at `91b1e80…` | Delivered synthetic evidence in [apply progress](./apply-progress.md), section “Current checkpoint — delivery recorded”, [review ledger](./review-ledger.md), section “Current checkpoint — delivery recorded”, and canonical test at `91b1e80adc4d1005034c0af0657ec4da80750d1b:scripts/panel-authorization-canonical.test.mjs` | Its table-kernel property only. |
| Unit 1B six-variant/33-line result at `54a5c65…` | Local/synthetic reviewed evidence | Variant/opacity history only; no tenant authorization claim. |
| Unit 2 64/64 and 134-line result at `9dd6411…` | Local/synthetic reviewed evidence | Scalar-metadata history only; no runtime/RLS claim. |
| Unit 3 141-line partial and 79-test baseline | Frozen incomplete history | No completion, rescue, reuse, or successor authority. |
| New P1–P6 results | Not yet produced | Nothing is implemented or verified by this rebaseline. |

The following remain untouched and outside this plan revision: source, tests, migrations, worktrees, stopped candidates, blocked ledger, `apply-progress.md`, review ledger, Gate 1/2 documents, native counters, branch topology, and all lifecycle/authority records. A future candidate must record fresh results separately from every historical result above; no historic pass count, synthetic check, commit, or review conclusion may be represented as a new Gate 3 security receipt.

## Proposed gap-only semantic work packages

These are semantic work packages, not independently executable migrations or a selected PR chain. RED precedes GREEN, then TRIANGULATE and REFACTOR; an existing passing behavior receives no code change. Estimates include code and focused tests, are not promises of a ≤400-line PR, and require reviewable slices if oversized. Plain read-only repository mapping is planning evidence and does not require implementation acquisition; any later write, database/runtime action, disposable-environment action, production-equivalent action, or delivery remains separately gated.

| Package | Dependency and carried baseline | RED → GREEN → TRIANGULATE/REFACTOR outcome and codes | Candidate future areas / explicitly not authorized | Evidence and rollback | Estimate |
|---|---|---|---|---|---|
| P1 Principal + capability | Accepted evidence strategy; carry Unit 1A/1B/2 only as synthetic evidence | P1.1 tests the pure capability map; P1.2+P1.3 atomically tests principal/cardinality/company, matrix, delayed service client, and caller adaptation. `401/403/500`; no privileged client before denial. | `src/lib/panelAuthorization.ts`, proposed `src/lib/panelCapabilities.ts`/`panelPrincipal.ts`, four current consumers, focused tests; not DB migration, UI pages, bootstrap. | P1.1 rolls back map/tests alone; P1.2+P1.3 roll back resolver, caller adaptations, and tests together. | 500–720: P1.1 130–195 plus atomic P1.2+P1.3 370–525; high risk |
| P2 DB identity, lifecycle + provisioning | P1 contract; carry Gate 1/2 migrations unchanged | Test UID FK/check/deletion and no-mutation conflicts; contribute identity/lifecycle/provisioning clauses to **one undelivered atomic Gate 3 migration target** plus trusted trigger/bootstrap; vary retry/conflict/company states. | Proposed single Gate 3 migration, `scripts/lib/supabase-bootstrap.mjs`, DB/bootstrap tests; not historical migrations, panel UI/API. | Real disposable `auth.users` identities, before/after rows, failed delete/conflict proof; review the complete target atomically or disable unsafe tooling. | 330–560, low confidence |
| P3 Catalog + storage isolation | P2 target clauses; no partial migration may run | Test every direct command/role/A↔B/path; contribute catalog/storage policy and grant clauses to the **same undelivered atomic Gate 3 migration target**; vary forged IDs, old→new company update, path segments, policy OR and GraphQL exposure. | Gate 3 migration target and DB fixtures/tests; not catalog BFF, checkout/business-state rewrites. | Persisted-state and effective policy/grant receipts; only the complete coherent target is eligible for later verification/apply, never an unsafe intermediate. | 360–620, low confidence |
| P4 Panel API + UI parity | P1 and complete P2/P3 atomic target boundary | Test legacy locations/order/no partial response; enforce principal-derived API filters; then route/loading/sidebar/control parity; vary downstream errors and direct routes. | Panel APIs, order operation helper, `AuthContext`, layout/sidebar/header/panel pages, API/UI tests; not DB policy relaxation or browser profile repair. | HTTP/spies/no-flash evidence; revert UI only while server/DB remain fail-closed. | 380–650, low confidence |
| P5 Bounded preflight | Complete P2/P3 atomic target definitions and P4 static receipts | Test invalid mode/report/exit first; implement closed discovery, literal manifests, wrapper/attestation; cover R3-001–008/014, R1-007–010, and R1-012–024 property failures with natural REDs; mutate each blocker class and prove PRE/POST/read-only fingerprints. | Proposed preflight wrapper/SQL/fixtures/tests/static receipts; not production collector execution, migration application, broad whole-DB fingerprint. | Exact one JSON/status/exit, covered before/after proof, attestation binding; rollback by keeping operational preflight sealed/unavailable. | 520–850, low confidence |
| P6 Closure evidence only | P1–P5 integrated candidate | No feature RED: add missing targeted regression/repro only where property evidence is absent, including UNSIZED atomic-stock/payment/webhook behavior mapping before new tests; run complete matrix and independent review. | Focused regressions, receipts, documentation; not feature implementation or authority operations. | Fresh results/no skips, review dispositions, bounded logs; rollback is withholding release. | UNSIZED until discovery completes |

## Bounded discovery and closure protocol

P5 may not trust caller summaries, regular expressions alone, a static named allowlist, or a database-under-test-derived expectation. It must establish and retain these finite artifacts before any PRE or POST success claim:

1. A repository-tracked JS/TS discovery receipt that handles direct, member, destructured, aliased, optional, and computed Supabase Auth/client calls; unclassified dynamic dispatch fails closed.
2. A source-to-surface receipt for browser, caller-token, service-role, storage, bootstrap, checkout, order, payment, and webhook paths, including tenant argument provenance and user-creation trigger consequences.
3. An independently authenticated, fresh, project/release-bound PostgREST exposure attestation that matches checked-in configuration but never discloses a token, key, URL credential, or full environment.
4. A directional database discovery of effective exposed relations/RPCs, grants/default ACLs, RLS/policies, views/rewrites, triggers, functions, FKs/checks, storage path policies, rooted roles, memberships, and reachable `SET ROLE` targets.
5. Literal reviewed predecessor and target expectations derived outside the state under test, with stable framed identities and ordered-vs-set semantics preserved; raw OIDs, sparse arrays, nested unknown fields, catalog join metadata, unbounded definitions, and leaked semantic values are rejected or hashed as appropriate.
6. A blocker report for every discovered extra, missing, mismatched, dynamic, denied-inspection, stale, or unclassifiable path. No such result is downgraded by a candidate retirement.

The discovery boundary is intentionally finite, not universal: it follows the approved roots and access-changing directional edges only. It excludes unrelated platform/system objects only after they have no exposed, granted, receipted, dependency, or role-topology path into a root. This completeness rationale preserves the specification’s security scope without pretending that an exhaustive catalog dump or the retired 67-file canonicalizer is evidence.

### Required denial and error matrix

| Scenario | Required observable result |
|---|---|
| Missing/invalid auth credential | `401 unauthorized`; no profile/service-role work. |
| Auth infrastructure failure | `500 internal_error`; no privileged response. |
| Missing, duplicate, malformed, unknown-role, orphan, or privileged-null-company profile | `403 forbidden`; no protected child, resource lookup, or service client. |
| Valid cliente, with or without company | Panel admission and all capabilities deny `403`; a company-bound cliente may SELECT only its own `empresa`, and a null-company cliente sees zero companies; neither has catalog/storage/restricted-operation access. |
| Staff panel/catalog/ordinary order | Allowed only for canonical own company and subject to existing business state. |
| Staff payment, cancellation, company/role operation | `403 forbidden` before resource existence or privileged work. |
| Admin cancellation/payment | Capability allows the request, but retained eligibility/state rules still control outcomes. |
| Legacy top-level `empresa_id` in every supported location | `400 legacy_tenant_input` before auth/service work, even when matching. |
| Invalid shape/ID | `400 invalid_request`; valid foreign or absent resource after authorization is the same `404 not_found`. |
| Required downstream query/RPC/result failure | `500 internal_error`, bounded log, and no partial `200` payload. |
| A targets B and B targets A | Deny reads/mutations and prove foreign rows unchanged for API, RLS, storage, order, and restricted paths. |
| Unknown reachable policy/grant/RPC/view/GraphQL/Auth/role path | `blocked`/exit `3` when unsafe is confirmed, otherwise `unverifiable`/exit `4`; neither PRE nor POST may succeed. |
| Invalid/missing PRE/POST mode or report/attestation transport | One bounded JSON, `unverifiable`, exit `4`, and no mutation. |

### Unit completion evidence requirements

| Unit | Must be true before its finish/review boundary |
|---|---|
| P1 | Matrix tests name every capability cell and principal failure; no alternate TypeScript role list or early service-key/client path remains. |
| P2 | Migration assertions precede mutation; UID-only/no-mutation conflict and dependent-company-delete evidence use disposable real auth identities. |
| P3 | Each effective command/policy/grant path, including bridge/category/image/storage and policy OR, has role and A↔B evidence with persisted-state assertions. |
| P4 | API ordering/legacy/error receipts and UI direct-route/no-flash receipts agree with P1 and P3; UI never becomes security authority. |
| P5 | Each mandatory PRE stop class and representative POST regression executes the actual wrapper; fingerprints cover the bounded reachable surface before/after. |
| P6 | An integrated-candidate receipt cross-links every matrix row and finding disposition to fresh evidence, or records a closure blocker. |

No unit may bypass its start boundary by reviving Unit 3, copying stopped candidate bytes, or treating historical synthetic tests as runtime proof. If a narrow unit is already green before a proposed code change, retain its evidence and do not add code merely to satisfy a plan phase.

These semantic work packages require reviewable slices when oversized, but **no PR sequence is selected**. If estimates remain over 400 after one honest cohesion pass, `ask-on-risk` requires a human delivery decision; historical feature-branch-chain topology does not answer it.

## Future verification plan (not run now)

Existing [package commands](../../../package.json) and retained [order-operation test paths](../../../scripts/order-operations-api.test.mjs) to include after implementation are:

```sh
pnpm test:instance-config
pnpm test:storefront-tenant
pnpm test:storefront-tenant:db
pnpm test:catalog-stock-isolation:db
pnpm test:buyer-checkout
pnpm test:checkout-idempotency
pnpm test:checkout-idempotency:db
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/order-operations-api.test.mjs scripts/order-operations-ui.test.mjs
node --test scripts/order-operations-db.test.mjs
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Proposed, currently non-existent focused commands are panel capabilities, API, UI-route, DB, provisioning, and preflight suites; they must not be reported as executable today. The delivered canonicalizer’s 39-test evidence and Unit 2 historical 64/64 are preserved, and any future focused canonicalizer command runs only in an eventual integration candidate containing that delivered code—not from a root where it is absent.

Use disposable isolated local Supabase/Postgres 15 with real asymmetric authenticated fixtures. Any database reset is destructive and requires future explicit approval for that disposable environment; never treat `db reset --local` as safe now or against ambient/production data. Production-equivalent PRE/POST collection needs separate environment/security approval and is read-only; it is never an automatic production action. Atomic-stock, payment, and webhook automation/repro coverage is an UNSIZED P6 closure gap: map actual behavior and any indirect coverage before adding targeted tests or reproducible steps; do not treat the absence of a named tracked test as proof that no indirect coverage exists.

## Plan-only authority boundary

| Action | Plan status |
|---|---|
| Plain read-only repository mapping | Requires neither plan acceptance nor implementation acquisition; it grants no writes, runtime collection, or lifecycle action. |
| Source/test/migration edits | Not authorized by this document. |
| Database reset, fixture mutation, local Supabase action | Requires separate disposable-environment approval. |
| Runtime attestation collection or production-equivalent PRE/POST | Requires separate environment/security approval. |
| Commit, push, branch/worktree, native lifecycle, delivery, archive | Not authorized and not implied. |

Acceptance records must identify the accepted evidence strategy, retained security MUSTs, discovery authority, delivery decision owner, and disposable/production-equivalent environment gates. They must not update a native checklist, mark any historical checkbox complete, or manufacture a receipt/token/counter.

No current result in this revision is a test, build, DB, network, install, source inspection, or runtime verification result. Documentation readback is its sole validation activity.

## Proposed acceptance and closure gates

**ACCEPTED STRATEGY; P1 PLANNING ONLY:** the user accepted replacing the retired universal 67-file/catalog strategy with the bounded discovered-inventory evidence strategy, without amending existing security MUSTs. If future work changes security evidence obligations, the Specification and Design still require explicit alignment before writes. Unknown reachable paths remain blocked, stopped R1/R3 findings are not discarded, and acceptance is not P1 implementation or approval.

Gate 3 may be marked CLOSED only when one identified integrated candidate proves every matrix property; all mandatory regressions pass without skipped cases masquerading as passes; fresh independent review has no unresolved candidate-caused HIGH/BLOCKER; every prior relevant severity has an evidence-backed disposition; bounded logs/error handling are proven; and no implicit commit or push is assumed. **Gate 3 is not closed now.**

Future legitimate gates are explicit user authorization for writes, database/runtime/disposable/production-equivalent actions, and delivery. Plan acceptance does not select a chain strategy, reinstate the historical chain, relax the 400-line review threshold, permit `size:exception`, or start implementation.

**STOP NOW.** This correction records no approval and starts no discovery, implementation, verification, or lifecycle activity.
