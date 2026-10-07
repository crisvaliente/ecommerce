# P1 Principal Resolution and Capability Map — Proposed Plan

**Current status:** P1.1 and the agreed atomic P1.2+P1.3 integration scope are implemented and reviewed; the separate canonical `empresa` SELECT prerequisite is also implemented. Native ordinary review approved the full 11-file source/test candidate and burned its authority after exact acknowledgement. This is not delivery, SDD controller closure, whole-P1 or whole-Gate-3 closure, deployment, or broader P2/P3 apply authority. Gate 1/2/Unit 1A remain CLOSED, Gate 3 remains OPEN, and Unit 3 remains FROZEN — NO RESCUE. See the [2026-09-13 checkpoint](#2026-09-13--p1-implementation-and-native-review-checkpoint); it supersedes active P1.2+P1.3 planning pointers while preserving the historical plan below.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–720 source/test additions + deletions (P1 only; low-to-medium confidence) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Candidate P1.1 pure capability map/tests → atomic P1.2+P1.3 principal resolver, four caller adaptations, and tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

The earlier 220–360 P1 estimate omitted focused authorization doubles and necessary callers, so it is superseded and not a budget authority. Arithmetic: P1.1 130–195 + atomic P1.2+P1.3 370–525 = **500–720**. Headroom is not included or quantified before implementation; this does not promise that the integration target fits a 385-line or any other cap. This is an initial candidate-baseline estimate, separate from every native cumulative counter, frozen Unit 3 budget, source base, runtime objective, worktree, or delivery decision. Under `ask-on-risk`, implementation stops for a delivery decision before apply; no chain strategy is selected here.

## Current Read-Only Inventory

| Behavior | Status | Source and test evidence at supplied `526f614…` baseline |
|---|---|---|
| Caller token parsing and authoritative UID derivation through `auth.getUser()` | Covered behavior; no focused principal tests | `src/lib/panelAuthorization.ts:40–143`; `scripts/order-operations-api.test.mjs` only injects authorization outcomes |
| Exactly-one canonical profile resolution | Partial: `.maybeSingle()` selects only `empresa_id, rol`; zero/duplicate/error distinctions, profile shape, and profile ID are not modeled | `src/lib/panelAuthorization.ts:145–154`; no focused test found |
| Recognized admitted role and privileged company presence | Partial: only `admin`/`staff` plus truthy company are checked | `src/lib/panelAuthorization.ts:156–160`; no focused test found |
| Company existence, UUID-like values, onboarding, and cliente identity distinction | Missing in this boundary | `src/lib/panelAuthorization.ts:145–160`; no focused test found |
| Capability matrix | Missing central map; role checks are duplicated | `src/lib/panelAuthorization.ts:4,158`, `src/lib/orderOperationsApi.ts:240`, `src/components/layout/AdminLayout.tsx:13`, `src/components/layout/panel/Sidebar.tsx:12–40` |
| Privileged-client ordering | Partial: the service client is constructed after current admission, but `readPanelEnv()` reads the service key before caller authentication | `src/lib/panelAuthorization.ts:76–109,113–177`; no construction-order test found |
| Existing tenant-scoped consumers | Covered current pattern: product/order queries and order RPC take `authorization.empresaId` | `src/pages/api/panel/productos.ts:86–99`, `src/pages/api/panel/pedidos.ts:58–65`, `src/pages/api/panel/pedidos/[id].ts:120–166`, `src/lib/orderOperationsApi.ts:246–258`; `scripts/order-operations-api.test.mjs:119–228` |

The delivered synthetic canonicalizer evidence at `91b1e80adc4d1005034c0af0657ec4da80750d1b:scripts/panel-authorization-canonical.test.mjs` remains historical Unit 1A evidence only; it neither replaces principal tests nor proves runtime authorization. An uncovered test is a coverage gap, not a confirmed exploit.

### Current resolver detail

| Step | Exact current behavior | P1 planning consequence |
|---|---|---|
| Credential source | `Authorization: Bearer` wins; otherwise parses `sb-access-token` cookie | Retain credential precedence; exercise both trusted sources independently |
| Environment | `readPanelEnv()` requires URL, anon key, and service key before auth | Split caller settings from the delayed service-key factory |
| Authentication | Caller-token client calls `auth.getUser()` | Keep this UID as the sole trusted server identity source |
| Profile query | `usuario.select("empresa_id, rol").eq("supabase_uid", uid).maybeSingle()` | Replace with an exact-cardinality model; do not derive identity from email |
| Admission | Truthy company plus `admin`/`staff`; optional requested company mismatches deny | Validate complete principal/company state, then name a capability |

## P1 Contract to Preserve and Change

Current `authorizePanelAccess(req, requestedEmpresaId?)` returns either `{ ok: false, status, error }` or `{ ok: true, userId, empresaId, role, supabaseAdmin }`. It accepts a bearer header or `sb-access-token` cookie, authenticates with caller-token Supabase, derives the UID from `auth.getUser()`, compares an optional request company, and returns `401`, `403`, or `500` (including current `server_misconfigured`). Preserve the trusted UID derivation and the existing canonical-company filters/RPC arguments at current consumers.

P1 plans the Design contract: `authorizePanelRequest(req, requiredCapability)` returns `{ ok: true, principal }` only after exactly-one profile, exact role, UUID-like field, extant-company validation, and capability admission; authorized callers then invoke `createPanelServiceClient()`. A parsed canonical `cliente` profile can be valid identity state, but `authorizePanelRequest` always returns `403 forbidden` for panel access and never produces a `PanelPrincipal`. Public failures map exactly to `401 unauthorized`, `403 forbidden`, and `500 internal_error` as specified. P1 does not implement legacy-input rejection, downstream partial-response fixes, route/UI changes, provisioning, migrations, RLS, catalog/storage, preflight, or Unit 3.

## Exact Approved Capability Matrix

Use only the existing approved matrix, expressed once in a pure proposed `src/lib/panelCapabilities.ts`: `panel.enter`, `catalog.operate`, `orders.operate`, `orders.cancel`, `payments.access`, and `companyRoles.admin`. `admin` has all six; `staff` has the first three; `cliente` has none. Principal validity and capability admission differ: a legitimate `cliente`, including null-company onboarding identity where valid, can be a canonical profile but cannot be a panel principal; malformed, orphan, unknown-role, or null-company privileged profiles deny. Capability allowance never bypasses order eligibility, payment, stock, or idempotency rules.

A small proposed `src/lib/panelPrincipal.ts` is permitted only if keeping principal parsing out of `panelAuthorization.ts` is clearer; do not create engines or duplicate role lists. The future resolver must not use email, host, cookie tenant, slug, membership, ownership metadata, or request `empresa_id` as authority.

## Proposed Future File Boundary

| File | P1 purpose | Boundary |
|---|---|---|
| `src/lib/panelCapabilities.ts` (absent today) | Pure role/capability map and `hasPanelCapability` | No React, Next, Supabase, environment, or server-only imports |
| `src/lib/panelAuthorization.ts` | Caller-token principal resolution, stable failure mapping, delayed privileged factory | Preserve trusted UID derivation; no service-role key read/client construction on denial |
| `src/lib/panelPrincipal.ts` (absent today, only if needed) | Small validated profile/principal shapes | Do not split one function into generic engines |
| `scripts/panel-authorization.test.mjs` (absent today) | Focused P1 resolver/map and construction-order tests | Mocked unit evidence, not DB/runtime proof |
| `src/pages/api/panel/productos.ts`, `src/pages/api/panel/pedidos.ts`, `src/pages/api/panel/pedidos/[id].ts`, `src/lib/orderOperationsApi.ts` | Required minimal atomic adaptation: all four directly consume current `empresaId`, `userId`, `role`, and/or `supabaseAdmin` | Adapt each to `principal` plus authorized `createPanelServiceClient()` before the target is eligible; P4 owns legacy-input, downstream, and broader API behavior |
| `scripts/order-operations-api.test.mjs` | Reuse only the matching injected consumer compatibility assertions | Do not repackage it as P1 principal coverage |

The actual caller-context ability to validate an `empresa` row is not proven by this source mapping: the current resolver does not query it. P1 must use an injected/caller-token profile-and-company query dependency. If caller-context company validation is unavailable, ambiguous, or denied, record that as a concrete P1/P2 decision blocker and deny; do not read a service key or construct a service client before authorization.

### Candidate work-unit boundaries

| Unit | Start and finish boundary | Verification and rollback |
|---|---|---|
| P1.1 | Start with absent `panelCapabilities.ts`; finish with the approved pure matrix and named matrix tests | Separate candidate: focused map test; revert only the map and its tests |
| P1.2+P1.3 | Start from P1.1; finish only when validated `PanelPrincipal` resolution, delayed factory, and all four direct consumers are adapted together | One atomic integration/delivery target: resolver/double ordering and matching consumer tests; revert resolver, optional principal shape, caller adaptations, and tests together |

P1.2 may be internally reviewed and TDD-sliced, but cannot claim independent deliverability, compilation, finish, or delivery before P1.3's four caller adaptations are included. The atomic target does not take ownership of product legacy-input handling, order-detail partial failures, or UI role rendering; those remain P4. P1.1 and the atomic target each need future authorization, and any re-slice requires the delivery decision.

## Future TDD Sequence

1. **RED:** Add independently named natural behavior failures against the existing working `authorizePanelAccess` export/API, not an importable permissive resolver shell or missing-module guard. P1.1 may use a minimal test-only fixture for its new pure map; it must not replace application authentication. Cover valid admin/staff principal admission, parsed company-bound and legitimate null-company cliente profiles that both deny panel access, missing credentials/auth-invalid versus auth infrastructure, missing/duplicate/malformed/unknown-role/invalid-company-UUID/orphan/null-company privileged profiles, and every capability cell.
2. **GREEN:** Add the smallest pure map and resolver needed to satisfy those behavior cases, then adapt all four consumers in the same atomic target. Model `.limit(2)` profile results explicitly in the test double as `{ data, error }`; do not guess whether a live database represents duplicate rows as an error. Validate trusted server results, preserve the `auth.getUser()` UID source, and make denial return before privileged work.
3. **TRIANGULATE:** Vary token/header-cookie source, valid roles, profile cardinality/shape, company lookup outcomes, and every matrix cell independently. Assert authoritative UID lookup ignores email/client tenant values; missing/rejected credentials remain `401`, invalid principal/capability—including every cliente panel request—remains `403`, and operational auth/profile/company failures remain `500` with the specified public codes.
4. **REFACTOR:** Keep named tests readable; remove no coverage to fit a budget. Confirm the only role matrix is the pure map and that all adapted consumers retain canonical `principal.empresaId` filter/RPC provenance. Refactor only after the complete atomic focused matrix is green.

A root mock caller-token Supabase client for `auth.getUser()` and caller-context profile/company queries may exist before authorization; that is not privileged service-role construction. Mocks prove source mapping and call order only, not RLS, company visibility, database existence, or runtime access. Tests must spy separately on environment service-key access and `createClient` calls so “no privileged work on denial” does not become the impossible claim that no caller-token client exists. If caller-context company validation is unproven or denies access, fail closed, do not reach the service client, and block affected integration evidence; P1 cannot claim full verification or closure.

## Future Verification and Boundaries

Retained future consumer command (not run now): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/order-operations-api.test.mjs`. Proposed focused command (currently absent, not run now): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-authorization.test.mjs`. The commands are identified only; no execution or compatibility result is claimed. P1 unit tests are mocked mapping/order evidence only. Gate 1/2 and whole-Gate-3 regressions belong to future P6, followed by fresh independent review; preflight is not P1.

P1.1 exit criteria are one reviewed map exactly matching the approved table and named map tests. The atomic P1.2+P1.3 target requires resolver tests for every listed principal state/status, denial spies proving no service-key read/client construction or privileged query, and all four adapted consumers retaining server-derived tenant arguments. An unavailable caller-context company check is a blocker, not a bypass, and prevents full P1 verification/closure. The P1.1 rollback boundary contains only its map and associated tests. Rollback of the atomic P1.2+P1.3 target reverts the resolver, optional principal shape, four caller adaptations, and associated integration-target tests together, preserving the P1.1 map and its tests; keep fail-closed consumers and all Gate 1/2 protections intact.

## Non-Goals and Next Step

P1 excludes database schema/migrations, profile provisioning, catalog/storage/RLS, UI/direct-route parity, legacy tenant rejection, downstream failure remediation, preflight, DB/runtime work, Unit 3, and delivery actions. The next step is human review of delivery scope and, if selected, chain strategy, followed by legitimate execution authority before any source write. **Stop after this plan.**

## 2026-09-12 — Human-Directed P1.1 DIRECT Exception Evidence

The user explicitly requested one bounded DIRECT, non-SDD P1.1 unit after a final supported-route check. Installed/latest stable `2.7.0` offered no superseding route, so the specified direct-exception condition was met. This is a new pure capability-map unit, not remediation, rescue, reuse, or continuation of Unit 3 or its ordered-columns work.

- Base: branch `gate3/pr1a-preflight-manifests-fixtures` at `526f614be9cc1efc9269bc62996eaa85b3504be2`.
- Exact implementation files: new `src/lib/panelCapabilities.ts` and new `scripts/panel-capabilities.test.mjs`.
- Scope: the exact three-role, six-capability matrix, a closed typed signature, runtime default-deny behavior, zero-coercion handling, and immutable exported policy collections.
- Exclusions: P1.2 principal resolution, all four consumer adaptations, P1.3, UI/API integration, profile provisioning, migrations, database/runtime/network work, and every Unit 3 source or authority action.
- RED: focused test run reported 18 tests, 9 passed and 9 expected positive grants failed against the temporary false-return implementation.
- GREEN: focused test run reported 18/18 passing after the minimum pure table lookup.
- TRIANGULATE/REFACTOR: exact identities, aliases, malformed primitives, prototype-key strings, hostile objects/proxies with zero coercion, and deep policy immutability produced 23/23 passing; refactor was inspection-only.
- Verification: the final focused command passed 23/23 twice; strict standalone TypeScript compilation passed with no output.
- Source/test size: 49 implementation lines + 116 test lines = 165 new lines. The pre-edit 190–230 forecast included documentation edits; it is not a native cumulative allowance. Native review covered only the two implementation/test files, not the pre-existing untracked planning documents.
- SHA-256: `be0ef4f85e8b163a90ac4586d5b253703b13d2ab842e94fb86b826238848fe24` (`src/lib/panelCapabilities.ts`) and `a51855781c13437f8fac7f192b491695d15928bc47f76d854780537901b4d846` (`scripts/panel-capabilities.test.mjs`).
- Review state (2026-09-13): native ordinary immutable review approved the exact 165-line source/test candidate under lineage `review-271b65146acf2b64`; the acknowledgement returned `authority: burned`. Documentation was outside the frozen review scope. This is not SDD controller closure, whole-P1/Gate-3 closure, or delivery authorization.
- Fresh independent verification (2026-09-13): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-capabilities.test.mjs` exited 0 with 23 passed, 0 failed, 0 skipped. `./node_modules/.bin/tsc --strict --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/lib/panelCapabilities.ts` exited 0. Both source/test hashes above and HEAD remained unchanged. Historical RED/GREEN observations remain the writer's evidence, not a fresh reproduction.
- The auxiliary native assessment returned no usable output (`unassessable`); the separate verifier completed the focused checks and found no source defects. Its documentation readback identified stale pending-review pointers, updated here and in `rebaseline.md`/`tasks.md` without changing historical ledgers.
- P1.1 satisfies its isolated map/test exit criteria only. It is not connected to runtime callers and proves no deployed panel enforcement or tenant isolation. No commit, push, or P1.2+P1.3 implementation was performed.

The broader future principal test path remains `scripts/panel-authorization.test.mjs`; the new `scripts/panel-capabilities.test.mjs` owns only the distinct P1.1 capability-map rollback boundary. P1.2+P1.3 remain proposed as one atomic integration, with the prior rollback plan preserved.

## 2026-09-13 — P1 implementation and native review checkpoint

**Outcome:** P1.1 and the agreed atomic P1.2+P1.3 integration scope are implemented and reviewed, not delivered. P1.1 is 165 source/test lines; the atomic integration is 756; and the separate canonical `empresa` SELECT prerequisite is 217. The full native frozen candidate is 1,138 source/test lines across 11 files and includes P1.1 because those untracked files are absent from `HEAD`. The seven integration files are already implemented and remain unchanged by this passive documentation update.

**Review authority:** Native ordinary review `review-620758b8c6580d46` returned `APPROVED`; the exact acknowledgement returned `authority: burned`. The consolidated review-reliability lens required no correction. Its only nonblocking informational warning, `R3-fixture-cleanup`, points to `scripts/catalog-stock-isolation-db.test.mjs:182–183`: fixture creation can precede cleanup registration. That cleanup gap is separate future work and does not reopen this review. The approved frozen scope covers only the source/test candidate; these checkpoint documentation edits are outside it.

**Verification boundary:**

- The fresh final spot command `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-authorization.test.mjs scripts/order-operations-api.test.mjs scripts/panel-capabilities.test.mjs` passed 79 tests with 0 failures; the final source/test whitespace check passed with 0 findings.
- Independent `./node_modules/.bin/tsc --noEmit --incremental false` and scoped ESLint checks passed earlier but were not rerun for that latest spot. The local `empresa` DB suite previously passed 2/2 and SQL replay previously passed; neither was new in this documentation turn.
- The evidence is mocked/unit/injected-consumer proof, not production or E2E proof. There are no dedicated runtime product-list, order-list, or GET-detail route tests, so this checkpoint makes no whole-P1 coverage claim.
- The new `empresa` migration was applied twice locally, but migration history was not advanced; unrelated `20260903130000_checkout_idempotency_service_role_select.sql` remains pending. No broader P2/P3 migration was applied.
- No commit, push, deployment, SDD controller closure, whole-P1 closure, or whole-Gate-3 closure occurred. No approved frozen Unit 3 bytes were read, and historical ledgers, native checkboxes, and accounting remain untouched.

### Next boundary

| Scope | Proposed, undelivered boundary |
|---|---|
| P2 | UID identity FK, role/company invariants, restrictive company deletion, and UID-only conflict-rejecting bootstrap. |
| P3 | Catalog/storage policy and grant closure with role, A↔B, and persisted-state proof. |

P2 and P3 would contribute to **one proposed, undelivered atomic Gate 3 migration target**; no filename, migration implementation, database action, or apply is authorized. Bootstrap and DB tests need a bounded follow-up inventory. Implementation sizing still requires that closed inventory; the >400-line review risk requires a separate scope/delivery decision. The reviewed 1,138-line source/test candidate remains ambient context only, and future workspace aggregation never authorizes an automatic commit or split. **Next action:** review the proposed [P2/P3 implementation plan](./p2-p3-plan.md); it grants no apply authority.

## Key Learnings

1. Closed TypeScript signatures still need runtime default-deny guards.
2. String-set validation prevents object-key prototype aliases from granting access.
3. Frozen nested policy arrays prevent mutation-created capability grants.
4. Independent expected matrices avoid testing exports against themselves.
5. Pure capability maps do not enforce callers until separately integrated.
