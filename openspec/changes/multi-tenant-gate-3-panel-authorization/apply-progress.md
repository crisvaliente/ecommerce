# Apply Progress — Multi-Tenant Gate 3 Panel Authorization

## PR 1 verdict

**STOPPED.** PR 1 did not close GREEN. PR 2 was not started and requires explicit approval after PR 1 is corrected and independently re-verified.

## Scope attempted

- Branch: `gate3/pr1-read-only-preflight`
- Tracker: `gate3/multi-tenant-panel-authorization`
- Implementation files attempted:
  - `scripts/panel-authorization-preflight.test.mjs` — new, 117 lines
  - `scripts/sql/panel-authorization-preflight.sql` — new, 170 lines
  - `package.json` — one script entry
- No migrations, runtime code, fixture changes, bootstrap changes, production access, commits, pushes, or PR creation occurred.
- All four PR 1 checkboxes remain unchecked because fresh review invalidated the provisional GREEN evidence.

## Provisional TDD evidence — superseded

- RED: `node --test scripts/panel-authorization-preflight.test.mjs` exited 1 with 0 pass / 2 fail because the SQL artifact did not exist.
- Provisional GREEN: the same command exited 0 with 2 pass / 0 fail.
- Provisional TRIANGULATE: the implementation reported clean exit 0, one orphan-UID dirty fixture exit 3, anon-role exit 3, and equal limited fingerprints.
- REFACTOR: focused suite passed 2/2 and `git diff --check` was clean.
- Production URL used: no; transport was local `docker exec supabase_db_ecommerce` only.

These results do **not** establish GREEN because fresh-context reliability review proved that the test and report can false-pass mandatory stop conditions.

## Fresh review findings

| id | severity | status | Finding |
| --- | --- | --- | --- |
| R3-001 | BLOCKER | open | The current local database was reported `overall_status=pass` even though the auth UID FK was absent, the company FK remained `ON DELETE SET NULL`, the auth trigger retained email-adoption behavior, and known public/`membresia` authorization paths were allowlisted. These are mandatory stop conditions, not a clean state. |
| R3-002 | CRITICAL | open | Behavioral dirty coverage exercised only the canonical UID join. It did not prove failures for unsafe/absent FKs, email/UID conflicts, invalid role/company/onboarding, unsafe trigger/bootstrap behavior, `membresia`, or permissive policy/grant drift. |
| R3-003 | CRITICAL | open | Missing relations/query errors can abort before emitting the required JSON report, and the parser does not assert exactly one JSON document. |
| R3-004 | CRITICAL | open | The before/after fingerprint omits material auth/company/catalog/storage/order/payment data and schema authorization surfaces; the SQL `read_only_fingerprint` check is a constant pass. |

## Exact stop reason

PR 1 exposed a mismatch between the intended mandatory-stop contract and the implemented definition of a clean preflight. The artifact currently fingerprints and allowlists parts of the unsafe pre-Gate-3 baseline, so it can authorize rollout when it must stop. Continuing or marking GREEN would weaken the approved fail-closed gate.

## Review budget and rollback

- Attempted PR 1 implementation: 288 authored additions (`117 + 170 + 1`), below 400 lines.
- Current artifacts are retained only for review/correction; they are not approved for production use.
- Rollback boundary: remove the two new preflight files and the `package.json` script entry. No database state requires rollback.

## Required decision before correction

Clarify the clean-state contract for PR 1 tests: either build a disposable target-safe fixture that represents the post-hardening schema while keeping the preflight itself read-only, or redefine preflight staging in the approved Design/spec. No correction and no PR 2 work proceeds without user approval.

## Corrective PR1A attempt

### Verdict

**STOPPED.** The user approved the 10-PR topology and authorized only PR1A, but fresh review found five unresolved reliability findings. PR1A tasks remain unchecked. PR1B was not started.

### Exact implementation artifacts

- `scripts/panel-authorization-preflight.test.mjs` — 79 lines
- `scripts/lib/panel-authorization-preflight-harness.mjs` — 42 lines
- `scripts/sql/panel-authorization-preflight-canonicalizer.sql` — 27 lines
- `scripts/sql/fixtures/panel-authorization-predecessor-v2.sql` — 7 lines
- `scripts/sql/fixtures/panel-authorization-target-v2.sql` — 8 lines
- `scripts/sql/panel-authorization-preflight.sql` — 39 lines
- `package.json` stale stopped-draft addition removed; final package diff is clean

Authored PR1A implementation: **202 additions, 0 deletions**, below the 400-line budget. No migration, runtime/API/UI/bootstrap, production, commit, push, or PR creation occurred.

### Passing but insufficient evidence

- Focused run 1: 4 pass / 0 fail, 181765 ms.
- Focused run 2: 4 pass / 0 fail, 186165 ms.
- PRE manifest-only identity repeated exactly: `82ee7fb0beeb20a3d5ac77b411f011d00f3f8aa0e69777e3778ef20ab1687dc7`.
- POST manifest-only identity repeated exactly: `598f97fe83547cb4c42cd01be1cda9d30b126f42d05686d1e22819a6b4d9c78d`.
- Both harness modes reported local Docker transport, disposed fixtures, `operational_eligible:false`, and no production URL/host.
- Operational SQL remains sealed with no migration digest and exits `4`.

These results prove repeatability only, not correctness or target safety. No auditable exact RED-before-implementation receipt survived the timed-out executor, so strict TDD evidence is insufficient.

### Fresh PR1A findings

| id | severity | status | Finding |
| --- | --- | --- | --- |
| R3-005 | BLOCKER | open | The target-safe fixture replays the unsafe predecessor and adds only a receipt plus a fixture table; it does not materialize Gate3 FKs/checks, UID-only trigger, role-aware policies/grants/storage, or predecessor removals. |
| R3-006 | BLOCKER | open | The manifests contain broad per-kind aggregate rows and self-mappings rather than literal finite per-object predecessor/target rows and exact replacement mappings. |
| R3-007 | CRITICAL | open | Canonicalization lacks recursive rooted closure and omits or weakly represents required ACL, callable routine, storage metadata, migration, trigger, and dependency identities. |
| R3-008 | CRITICAL | open | Tests are source-token/self-consistency checks and do not independently challenge object-level replacements or target-safe behavior. |
| R3-009 | CRITICAL | open | No retained exact RED-before-implementation evidence exists for the current PR1A implementation. |

### Rollback boundary

Remove the six PR1A implementation files listed above. They are untracked and not approved for production use. No database state requires rollback because fixtures were disposable.

## PR1A retry — auditable RED

Before any retry implementation change, only `scripts/panel-authorization-preflight.test.mjs` was replaced with independent behavioral tests. Focused command:

```sh
node --test --test-name-pattern='manifests|canonicalizer|fixtures' scripts/panel-authorization-preflight.test.mjs
```

Exact result: exit `1`; 19 tests, 2 passed, 17 failed (16 assertion failures plus parent `subtestsFailed`). Failures independently exposed:

- `R3-005`: six missing target-safe behavior classes—identity/FKs, UID-only provisioning, role-aware catalog, own-company empresa, storage hardening, and predecessor removal.
- `R3-006`: missing literal per-object manifests, target keys/metadata, exact replacement/removal mappings, preserved Gate1/Gate2 rows, and rejection of aggregate/self-mapped manifests.
- `R3-007`: missing recursive closure and normalized ACL/default-ACL/routine, trigger/view, storage/history/global-callable identities.
- `R3-008`: actual disposable semantic regressions do not yet change/reject target identity.

Test file is 195 lines (net +116 over the stopped draft). Projected PR1A total before implementation: 318 authored lines. No implementation, package, migration, PR1B, PROD, commit, push, or branch change occurred during RED. Local disposable Docker only; production URL used: no.

## PR1A retry — GREEN attempts and stop

The retry modified only authorized implementation files; tests remained unchanged after RED. It added target-fixture Gate3 objects/behavior, 35 finite manifest rows and mappings, recursive normalized canonicalization, semantic mutation checks, and the operational non-zero seal.

### First GREEN attempt

Focused command exited `1`: 12 tests, 10 passed, 2 failed.

1. Twelve literal canonical hashes were not exactly 64 lowercase hexadecimal characters.
2. Canonicalizer SQL used invalid `from pg_attribute a,cross join lateral` syntax.

### Bounded GREEN correction

- Extended the 12 malformed hashes to 64 lowercase hexadecimal characters.
- Corrected `from pg_attribute a,cross join lateral` to `from pg_attribute a cross join lateral`.
- Tests and harness remained unchanged.

Focused rerun exited `1`: 12 tests, 11 passed, 1 failed. Remaining exact failure:

```text
ERROR: syntax error at or near "from"
LINE 21: ... from storage...
```

Execution stopped. TRIANGULATE and REFACTOR were not started. `git diff --check` is clean. All PR1A checkboxes remain unchecked and PR1B was not started.

### Current budget

| File | Lines |
| --- | ---: |
| `scripts/panel-authorization-preflight.test.mjs` | 195 |
| `scripts/lib/panel-authorization-preflight-harness.mjs` | 24 |
| `scripts/sql/panel-authorization-preflight-canonicalizer.sql` | 27 |
| `scripts/sql/fixtures/panel-authorization-predecessor-v2.sql` | 7 |
| `scripts/sql/fixtures/panel-authorization-target-v2.sql` | 19 |
| `scripts/sql/panel-authorization-preflight.sql` | 41 |
| **Total** | **313** |

PR1A verdict: **STOPPED**. No production URL, real migration, PR1B work, package/runtime change, commit, or push occurred.

## PR1A syntax-only retry for R3-010

Only `scripts/sql/panel-authorization-preflight-canonicalizer.sql` was edited. The storage canonicalization expression was missing the empty-set `coalesce` fallback/closing parenthesis:

```diff
- ...string_agg(encode(extensions.digest(convert_to(o.name||coalesce(o.metadata::text,''),'UTF8'),'sha256'),'hex'),''),'UTF8'...
+ ...string_agg(encode(extensions.digest(convert_to(o.name||coalesce(o.metadata::text,''),'UTF8'),'sha256'),'hex'),''),''),'UTF8'...
```

The required complete GREEN suite was executed exactly once:

```sh
node --test --test-name-pattern='manifests|canonicalizer|fixtures' scripts/panel-authorization-preflight.test.mjs
```

Result: exit `1`; 12 tests, 11 passed, 1 failed, duration `44953.576727 ms`. The syntax error is gone, but execution exposed a new blocker:

```text
ERROR: UNION types text and "char" cannot be matched
LINE 23: ...union all select * from view_rows union all select * from dep...
```

Per the stop rule, no TRIANGULATE, REFACTOR, further edit, or additional test run occurred. PR1A remains 313 authored lines with 87 lines of budget margin. PR1B was not started; no PROD, migration, commit, or push occurred.

PR1A verdict remains **STOPPED**.

## PR1A type-only retry for R3-011

Only `scripts/sql/panel-authorization-preflight-canonicalizer.sql:23` was edited:

```diff
- dependency_rows as(select 'dependency' kind,a.key||'->'||b.key k,e.deptype v from pg_depend e
+ dependency_rows as(select 'dependency' kind,a.key||'->'||b.key k,e.deptype::text v from pg_depend e
```

The complete GREEN suite was executed exactly once:

```sh
node --test --test-name-pattern='manifests|canonicalizer|fixtures' scripts/panel-authorization-preflight.test.mjs
```

Result: exit `1`; 12 tests, 11 passed, 1 failed, duration `44808.866425 ms`. R3-011 no longer reproduces, but execution exposed:

```text
ERROR:  "array_agg" is an aggregate function
```

Per the stop rule, no TRIANGULATE, REFACTOR, further edit, additional test, `git diff --check`, or identity command was run. Fresh fixture disposal and operational seal were not separately re-inspected after the failure and remain evidence gaps, not implied passes.

PR1A remains **313 lines** with 87 lines of budget margin. No PR1B, PROD, real migration, commit, push, test/fixture/manifest change, or other file edit occurred.

PR1A verdict remains **STOPPED**.

## PR1A aggregate-aware retry for R3-012

Only `scripts/sql/panel-authorization-preflight-canonicalizer.sql` was modified. Exact cause: global executable `pg_proc` inventory includes `prokind = 'a'` aggregates such as `pg_catalog.array_agg`, but canonicalization applied `pg_get_functiondef` to every routine kind.

The correction branches by `prokind`: functions/procedures/windows retain function-definition canonicalization; aggregates remain inventoried through deterministic `pg_aggregate` transition/final/combine/serialization/moving-state/type/operator/direct-argument/modifier/initial-state metadata using schema-qualified stable names rather than emitted OIDs. Unknown kinds receive an explicit marker; no aggregate is filtered.

The complete GREEN suite was executed exactly once:

```sh
node --test --test-name-pattern='manifests|canonicalizer|fixtures' scripts/panel-authorization-preflight.test.mjs
```

Result: exit `1`; 12 tests, 11 passed, 1 failed, duration `44680.327373 ms`. The `array_agg` error is gone. The remaining fixture subtest failed with child-process status `null`; captured output began with `Output format is unaligned.` and contained thousands of canonical rows without a surfaced PostgreSQL error. Output-buffer overflow is plausible but unproven because the harness does not expose the underlying spawn error.

Per the stop rule, no further edit/test, TRIANGULATE, REFACTOR, identity run, or `git diff --check` occurred. Calculated PR1A size is **351 lines**, leaving 49 lines under budget. No PR1B, PROD, migration, commit, or push occurred.

PR1A verdict remains **STOPPED** because the failure cause and fixture disposal/identity evidence are not verifiable.

## PR1A R3-013 diagnostic retry and fresh review

### Demonstrated `status:null` cause

Before editing, a one-off reproduction of the exact `spawnSync` command captured bounded telemetry:

```json
{
  "status": null,
  "signal": "SIGPIPE",
  "error_code": "ENOBUFS",
  "error_message": "spawnSync docker ENOBUFS",
  "stdout_bytes": 1081372,
  "stderr_bytes": 0,
  "timeout_configured": false,
  "timeout_reached": false
}
```

Cause: Node `spawnSync` output-buffer exhaustion, not timeout or an unknown spawn failure.

### Minimal harness correction

Only `scripts/lib/panel-authorization-preflight-harness.mjs` changed:

- finite 32 MiB `spawnSync` buffer;
- strict 16 MiB canonical-output guard;
- bounded sanitized telemetry for status, signal, error code/message, and stdout/stderr sizes;
- no raw command arguments or thousands of canonical rows in failure output.

### GREEN / TRIANGULATE / REFACTOR

- GREEN exactly once: 12/12 top-level and 19/19 including nested, PASS, 48,085 ms.
- TRIANGULATE focused runs: 19/19 PASS twice, 51,976 ms and 52,844 ms.
- PRE manifest-only twice: byte-identical `b15cf83d82f0b09b6a7187269e3edb810c4ff76063a32f08c3bf2dde5dfcc2a0`.
- POST manifest-only twice: byte-identical `43ff102a69dd69aad5092d0911f00197c46535bb253ed81f71835a50bcce58a7`.
- Both modes: `disposed:true`, local Docker, `operational_eligible:false`; no disposable containers remained.
- Unsafe-current harness invocation was rejected by the harness, but fresh review found the underlying SQL process exited incorrectly; see R3-014.
- REFACTOR: inspection-only; final focused rerun 19/19 PASS, 48,068 ms; `git diff --check` PASS.
- PR1A authored size: 354 lines, 46 below budget.

### Fresh semantic review verdict

PR1A remains **STOPPED** despite passing tests:

- R3-005 remains open: target fixture still permits inherited `historial_stock` access and lacks required storage path-shape checks.
- R3-006 remains open: manifests use placeholders and do not match the 7,973-row canonical inventory.
- R3-007 remains open: closure/roots/schema ACL/trigger identity remain incomplete or unstable.
- R3-008 remains open: behavior checks remain coarse/hard-coded and do not execute real role commands against the sealed target.
- R3-014 is new: operational seal emitted `unverifiable` but local psql ignored `\quit 4` and exited 0; tests only regex-match this path.

R3-009 through R3-013 are verified. No PR1B, PROD, real migration, commit, push, package, or runtime work occurred.

## PR1A-1 — auditable RED

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1`; branch `gate3/pr1a-1-authority-roots`; clean tracker parent `526f614`.

Before implementation, only `scripts/panel-authorization-preflight.test.mjs` was created (157 lines). Focused command executed exactly once:

```sh
node --test --test-name-pattern='authority discovery|directional closure|canonical identity|GraphQL|Auth receipt|role topology|runtime attestation' scripts/panel-authorization-preflight.test.mjs
```

Exact result: exit `1`; 7 tests, 0 passed, 7 failed, duration `52.702106 ms`. First failure: `authority API discoverAuthorityRoots must exist`, actual `undefined`, expected `function`, at test line 71. Remaining failures require the absent closure, canonical identity, GraphQL, Auth receipt, role topology, and runtime-attestation APIs. Unknown-reachability RED coverage was written but did not match the first run's pattern; it must execute during GREEN.

Projected complete PR1A-1 size: 357–397 lines; implementation has a hard remaining budget of 243 lines. No harness/canonicalizer/receipt, planning, package, migration, app/runtime, production, branch, commit, or push change occurred during RED.

## PR1A-1 — implementation and fresh review

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1`; branch `gate3/pr1a-1-authority-roots`.

### Exact files

- `scripts/panel-authorization-preflight.test.mjs` — 157 lines
- `scripts/lib/panel-authorization-preflight-harness.mjs` — 184 lines
- `scripts/fixtures/panel-authorization-static-receipt-v2.json` — 27 lines
- `scripts/fixtures/panel-authorization-postgrest-attestation-v1.json` — 31 lines

Total: **399 additions, 0 deletions**, one line below budget. No SQL, package, migration, app/runtime, PR1A-2, production, commit, or push change.

### TDD evidence

- RED: exit 1, 0/7 pass, first failure `discoverAuthorityRoots must exist`.
- GREEN: 8/8 PASS, 95.123 ms.
- TRIANGULATE focused: 8/8 PASS twice, 97.528 ms and 92.637 ms.
- Drift probes rejected: GraphQL ×4, Auth ×1, role topology ×3, config ×1, runtime attestation ×4.
- Deterministic aggregates: roots `58eaba6e…4332`; closure `a6906699…9271`; receipt `2b7586e5…1895` across replays.
- REFACTOR: inspection-only; final 8/8 PASS, 107.918 ms; `git diff --check` clean.
- Local checked-in fixtures/repository files only; no disposal needed; production URL/host used: no.

### Fresh security review

Technical tests are green, but PR1A-1 is **STOPPED**:

- R1-007: regex/token Auth discovery misses ordinary valid aliases such as `const { auth } = supabase`; a probe passed with only 32/34 callsites.
- R1-008: roots/GraphQL/closure/role checks trust caller-provided summaries instead of discovering actual repository/database topology; real extra policy/RPC/RLS-bypass edges can remain invisible.
- R1-009: canonicalization trusts arbitrary `stableKey`, lacks kind-specific required fields, and remains order-dependent for equivalent dependency arrays.
- R1-010: runtime attestation omits required environment/nonce/source/release and allows arbitrary methods plus caller-controlled fixture acceptance, enabling incomplete/replayed evidence.
- R1-011 (info): semicolon-packed closure mutations reduce readability at a security boundary.

All PR1A-1 task checkboxes remain unchecked. PR1A-2 was not started.

## PR1A-1a — auditable RED

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1a`; branch `gate3/pr1a-1a-canonical-identity`; clean tracker base `526f614`.

Before implementation, only `scripts/panel-authorization-canonical.test.mjs` was created (285 lines). Exact command:

```sh
node --test scripts/panel-authorization-canonical.test.mjs
```

Result: exit `1`; 7 tests, 3 passed, 4 failed, duration `55.881415 ms`. First error: `R1-009 API canonicalizeObservations must exist (ERR_MODULE_NOT_FOUND)`, actual `undefined`, expected `function`, at line 193. Three negative-path tests passed because the absent API rejected; four positive/property tests remain RED.

Projected implementation is 105–110 lines, for a total 390–395 under the 400-line hard limit. No implementation module, PR1A-1b, package, database, production, migration, OpenSpec task checkbox, commit, push, or branch change occurred during RED.

### PR1A-1a technical cycle and fresh review

GREEN created only `scripts/lib/panel-authorization-canonical.mjs` (115 lines). The frozen 285-line test remained unchanged. GREEN passed 7/7; TRIANGULATE passed 7/7 twice with timing-normalized TAP SHA-256 `890cce5e1a80aaeda6ad5b393a333600999cd696ec4b7b6d0e4b54ac98337009`; final REFACTOR rerun passed 7/7 and `git diff --check` was clean. Exact authored size is **400 additions, 0 deletions**.

Fresh R1 security review reran the focused suite (7/7) but marked PR1A-1a **STOPPED**:

- R1-012 BLOCKER: global set-field classification sorts `argumentNames` and `extraSearchPath`, erasing security-relevant positional/search-path semantics; tests lack both falsifiers.
- R1-013 BLOCKER: array validation loses parent-field context and accepts arbitrary nested records, allowing unknown nested metadata to enter accepted identities; tests cover only top-level extras and explicit OID keys.
- R1-014 CRITICAL: raw delimiter concatenation makes distinct quoted PostgreSQL identities collide; Unicode normalization is absent.
- R1-015 CRITICAL: outputs return unbounded raw semantic values, full definitions, and canonical input, exposing potentially sensitive catalog text and memory-amplification risk instead of returning bounded hashes/identifiers.

The technical GREEN does not prove the required property. All PR1A-1a task checkboxes remain unchecked. PR1A-1b and every later unit remain frozen. No database, production, migration, commit, or push occurred.

## PR1A-1a-i — auditable RED

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1ai`; branch `gate3/pr1a-1a-i-kind-schemas`; clean tracker base `526f614`.

Before implementation, only `scripts/panel-authorization-canonical.test.mjs` was created (199 lines). Exact command, executed once:

```sh
node --test scripts/panel-authorization-canonical.test.mjs
```

Result: exit `1`; 8 tests, 3 passed, 5 failed. First failure at line 123: `R1-012/R1-013 API normalizeSemanticObservations must exist`, actual `undefined`, expected `function`. Three negative-path tests passed because the absent API threw; five positive/order contracts remained RED. The implementation module was absent.

Projected implementation is 80–96 lines, for a total 279–295 under the PR1A-1a-i 300-line hard stop. Stable identity, Unicode framing, digest/public aggregate, and bounded-output behavior remain frozen for PR1A-1a-ii/iii. No stopped-workspace access, database, production, migration, commit, push, or branch change occurred during RED.

### PR1A-1a-i GREEN attempt and fresh review

GREEN created only `scripts/lib/panel-authorization-canonical.mjs` (101 lines); the 199-line RED test remained frozen. The exact focused command ran once and failed: exit `1`, 7/8 passed. Changed allowlisted finite `catalog.joinId` remained in normalized output and incorrectly became semantic. The diff reached the exact unit cap: **300 additions, 0 deletions**. Per the hard gate, no correction, TRIANGULATE, REFACTOR, final rerun, or diff check occurred.

Fresh read-only R1 review marked PR1A-1a-i **STOPPED** and found:

- R1-016 BLOCKER: `catalog` join metadata is validated but retained in semantic output, confirmed by the failed GREEN test.
- R1-017 BLOCKER: schemas omit multiple Design-required canonical classes/variants and security fields, including materialized views, rewrites, procedures, type/domain/operator/cast, constraints/indexes/FKs/checks, ACL/default-ACL/grants, buckets, role memberships/settings/SET ROLE, attestations, and dependency edges; tests incorrectly expect materialized relations to fail.
- R1-018 BLOCKER: JavaScript sparse arrays bypass `map()` element validation and serialize holes as `null`.
- R1-019 BLOCKER: tests do not independently cover every declared path/variant or required falsifier; ordered/set and malformed nested-path matrices are incomplete and some cases are line-packed.

A local R1-016 edit could be line-neutral, but complete R1-017–R1-019 corrections cannot credibly fit the current 300 cap without replacement or semantic packing. All PR1A-1a-i checkboxes remain unchecked. PR1A-1a-ii and every later unit remain frozen. No stopped-workspace access, database, production, migration, commit, or push occurred.

## PR1A-1a-i-a — RED budget stop

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1aia`; branch `gate3/pr1a-1a-i-a-relation-schemas`; clean tracker base `526f614`.

Only `scripts/panel-authorization-canonical.test.mjs` was created. It is 250 lines. The exact focused command ran once:

```sh
node --test scripts/panel-authorization-canonical.test.mjs
```

Result: exit `1`; 0/73 passed. First failure at line 94: `accepts relation variant table with exact normalized semantics`; API missing (`ERR_MODULE_NOT_FOUND`), actual `undefined`, expected `function`. No implementation module was created.

The RED suite leaves only 80 lines before the 330-line unit hard stop and projects 320–330 total. Fresh pre-GREEN review marked **STOP_BUDGET**:

- R1-020 BLOCKER: a readable nine-variant exact-schema engine plus dense ordered/set arrays, recursive OID rejection, metadata stripping, and normalization cannot credibly fit the remaining 80 lines without forbidden packing.
- R1-021 CRITICAL: helper cases pack multiple missing/type/extra and sparse/malformed falsifiers into broadly named tests.
- R1-022 CRITICAL: malformed/sparse/OID coverage is not independent across every owned variant/path.
- R1-023 CRITICAL: unknown discriminants, some set fields, non-finite metadata variants, and semantic attached-field mutations are missing.
- R1-024 CRITICAL: 0/73 RED is non-discriminating because every case fails first at the shared missing-API guard.

Per the hard gate, GREEN, TRIANGULATE, REFACTOR, and further tests were not started. All PR1A-1a-i-a task checkboxes remain unchecked; i-b and every later unit remain frozen. No real source/catalog/runtime, database, production, migration, commit, or push occurred.

## PR1A-1a-i-a-1 — auditable RED

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1aia1`; branch `gate3/pr1a-1a-i-a-1-relation-engine`; clean tracker base `526f614`.

Bootstrap RED created one export test and ran the focused command once: exit `1`, 0/1, `ERR_MODULE_NOT_FOUND`. Bootstrap GREEN then created only a three-line `normalizeRelation` export shell that unconditionally throws `RELATION_SCHEMA_NOT_IMPLEMENTED` and contains no schema/traversal/accepted-input behavior.

Authoritative behavioral RED added only `accepts an exact table relation` and `relation table rejects an unknown nested column field`, then ran the focused command once. Result: exit `1`, 2/3 passed. The valid-table test failed specifically with `RELATION_SCHEMA_NOT_IMPLEMENTED`; the unknown nested-field rejection passed against the fail-closed shell.

Current authored size: test 65 lines + shell 3 lines = **68 additions, 0 deletions**. No variant beyond table, TRIANGULATE, real source/catalog/runtime, database, production, migration, commit, or push occurred.

### PR1A-1a-i-a-1 GREEN

The frozen 65-line RED test was unchanged. Only `scripts/lib/panel-authorization-canonical.mjs` changed from the three-line shell to a 90-line exact table implementation. The focused command ran once: exit `0`, 3/3 passed, duration `47.763962 ms`.

The API accepts the exact synthetic table record, validates required scalar/nested/array fields, recursively rejects unknown own fields, validates and strips finite synthetic catalog metadata, and preserves table semantic fields. No other relation variant or later family was added. Current unit size: **155 additions, 0 deletions**. TRIANGULATE and REFACTOR had not started.

### PR1A-1a-i-a-1 partial TRIANGULATE budget stop

TRIANGULATE added each missing relation variant sequentially and retained owned failures before minimal GREEN: `partitioned_table`, `foreign_table`, `sequence`, `view`, and `materialized_view`. It also covered the decisive materialized-view definition falsifier, unknown kind/variant, malformed relation/owner/RLS fields, ordered columns, and ACL/dependency/foreignOptions/viewOptions set normalization. Latest focused result: 19/19 passed.

The unit then reached **319 additions, 0 deletions** (test 194, implementation 125) against the 320-line hard stop. Remaining unverified contracts are finite and `NaN`/`+Infinity`/`-Infinity` metadata, explicit metadata stripping, observation-order invariance, semantic OID rejection, start/middle/end sparse-array density, and malformed array elements. The required final two deterministic runs and REFACTOR were not executed.

Per the hard stop, PR1A-1a-i-a-1 is **STOPPED** and does not demonstrate its full property. All task checkboxes remain unchecked; PR1A-1a-i-a-2 and every later unit remain frozen. Scope deviations: none. No real source/catalog/runtime, database, production, migration, commit, or push occurred.

## PR1A-1a-i-a-1 selective clean replay — HISTORICAL-RED INPUT audit

### Status

**STOPPED before implementation.** The historical receipts do not support the required one-to-one 19-row map while preserving the selective replay exclusion boundary. The `HISTORICAL-RED INPUT` task remains unchecked. No clean-workspace file was changed and no test was written or run.

### Clean replay attestation

- Clean base: `526f614be9cc1efc9269bc62996eaa85b3504be2`.
- New worktree: `/home/cristian/Proyectos/ecommerce-pr1a1aia1-replay`.
- Branch: `gate3/pr1a-1a-i-a-1-selective-replay`.
- Git state at audit: clean.
- Authorized future implementation files only: `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs`.
- Prohibited stopped worktrees were not read, inspected, copied, diffed, or used as an oracle.
- This audit used only Tasks, prior apply-progress, review-ledger, Design where needed, and clean-worktree Git state.
- The replay cannot claim a new contract-first RED chronology or byte equality; prior receipts are historical traceability only.

### Attempted 19-row historical map

| # | Replay matrix row | Prior recorded receipt | Audit result |
|---|---|---|---|
| 1 | `table` relation variant | Authoritative RED `accepts an exact table relation`; table GREEN 3/3 | Named, but its GREEN summary also claims excluded catalog validation/stripping. |
| 2 | `partitioned_table` relation variant | Sequential TRIANGULATE failure then minimal GREEN | Category recorded; exact independent test name/result is not retained. |
| 3 | `foreign_table` relation variant | Sequential TRIANGULATE failure then minimal GREEN | Category recorded; exact independent test name/result is not retained. |
| 4 | `sequence` relation variant | Sequential TRIANGULATE failure then minimal GREEN | Category recorded; exact independent test name/result is not retained. |
| 5 | `view` relation variant | Sequential TRIANGULATE failure then minimal GREEN | Category recorded; exact independent test name/result is not retained. |
| 6 | `materialized_view` relation variant | Sequential TRIANGULATE failure then minimal GREEN | Category recorded; exact independent test name/result is not retained. |
| 7 | unknown top-level kind rejection | Collective partial-TRIANGULATE receipt: `unknown kind/variant` | No independent RED/GREEN name or result retained. |
| 8 | unknown relation variant rejection | Collective partial-TRIANGULATE receipt: `unknown kind/variant` | No independent RED/GREEN name or result retained. |
| 9 | relation schema identity validation | Collective receipt: `malformed relation/owner/RLS fields` | Cannot separate one-to-one from relation-name validation. |
| 10 | relation name identity validation | Collective receipt: `malformed relation/owner/RLS fields` | Cannot separate one-to-one from schema validation. |
| 11 | relation owner validation | Collective receipt: `malformed relation/owner/RLS fields` | No independent RED/GREEN name or result retained. |
| 12 | relation RLS validation | Collective receipt: `malformed relation/owner/RLS fields` | Cannot separate one-to-one from forced-RLS validation. |
| 13 | relation forced-RLS validation | Collective receipt: `malformed relation/owner/RLS fields` | Cannot separate one-to-one from RLS validation. |
| 14 | ordered columns | Collective partial-TRIANGULATE receipt: `ordered columns` | Category recorded; exact independent test name/result is not retained. |
| 15 | ACL set semantics | Collective set-normalization receipt | Category recorded; exact independent test name/result is not retained. |
| 16 | dependency set semantics | Collective set-normalization receipt | Category recorded; exact independent test name/result is not retained. |
| 17 | `foreignOptions` set semantics | Collective set-normalization receipt | Category recorded; exact independent test name/result is not retained. |
| 18 | `viewOptions` set semantics | Collective set-normalization receipt | Category recorded; exact independent test name/result is not retained. |
| 19 | `materialized_view.viewDefinition` mutation | `decisive materialized-view definition falsifier` | Category recorded; exact independent test name/result is not retained. |

### Exact contradictions and exclusion-boundary failure

1. Before TRIANGULATE, the retained suite already had three tests: the bootstrap export test, `accepts an exact table relation`, and `relation table rejects an unknown nested column field`. The last test is a demonstrated category outside the 19-row matrix.
2. The table GREEN summary says the implementation recursively rejected unknown own fields and validated and stripped finite synthetic `catalog` metadata. Recursive unknown nested-field rejection and catalog metadata validation/erasure are outside the selective replay scope.
3. The final partial-TRIANGULATE record simultaneously calls finite/non-finite metadata and explicit metadata stripping “remaining unverified.” This conflicts with the earlier table GREEN behavior claim, so catalog behavior cannot be classified consistently as demonstrated or pending from the admissible records.
4. Counting the retained three tests plus the separately described five additional variants, two unknown discriminants, five identity/owner/RLS criteria, ordered columns, four set criteria, and the materialized-definition falsifier yields 21 independently distinguishable purposes, while the receipt reports 19/19. Therefore at least two purposes were removed or packed; the planning artifacts do not identify which, and exact one-to-one evidence cannot be reconstructed without reading prohibited code.
5. Reconstructing recursive exact-record traversal to honor the historical nested-field RED would intentionally implement excluded unknown-nested-field closure. Omitting that behavior would differ semantically from the recorded table GREEN. Reconstructing the table GREEN's catalog path would likewise implement excluded metadata validation/erasure.
6. Semantic-OID rejection, sparse-array density, and malformed-array-element rejection are explicitly recorded as unverified and excluded. They cannot be imported to repair the map or exact-record traversal.

### Structured status and boundary

- Change: `multi-tenant-gate-3-panel-authorization`.
- Artifact store: `openspec`.
- Authorized unit: `PR1A-1a-i-a-1 SELECTIVE-CLEAN-REPLAY ONLY`.
- Audit outcome: `blocked` by the historical-map and requirement-expansion hard stops.
- Action context: planning-artifact update only; no implementation edit root was entered.
- Workload: single replay unit, low 400-line risk, 320-line unit hard stop; no delivery-decision blocker.
- Remaining implementation tasks: all four selective-replay task lines remain unchecked.
- Required resolution: recut Tasks with an authoritative 19-row historical receipt map that accounts for the export/nested-field tests and resolves whether catalog metadata behavior is demonstrated or excluded, without consulting stopped workspaces.

## PR1A-1a-i-a-1a — natural RED

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1aia1a`; branch `gate3/pr1a-1a-i-a-1a-relation-envelope`; clean tracker base `526f614`.

A six-line import shell returns only `{ kind, variant }` and intentionally performs no validation. Ten independently named tests were added and the focused command ran exactly once: exit `1`, 6/10 passed, duration `67.571897 ms`. All six exact relation variants passed. Four owned rejection tests failed naturally with `Missing expected exception.`: unknown kind, unknown variant, unknown top-level field, and semantic OID on the relation path.

Current size: test 107 lines + shell 6 lines = **113 additions, 0 deletions**, leaving 127 lines under the 240 hard stop. No GREEN, later unit, stopped-workspace read, real source/catalog/runtime, database, production, migration, commit, or push occurred.

### PR1A-1a-i-a-1a GREEN

The 107-line RED test remained frozen. Only the shell changed, from 6 to 41 lines. The focused command ran exactly once: exit `0`, 10/10 passed. The implementation closes the top-level relation envelope, dispatches exactly six variants, rejects unknown kind/variant/top-level fields and semantic relation-path OIDs, and returns only `{ kind, variant }` so variant contents remain erased.

Current unit size: **148 additions, 0 deletions**. No scalar/column/set/catalog/payload or later-unit behavior was added; no real source/catalog/runtime, database, production, migration, commit, or push occurred.

### PR1A-1a-i-a-1a TRIANGULATE

Six independently named opaque-content falsifiers were added, one for each accepted variant. Implementation remained frozen. The full suite ran twice: 16/16 passed both times. After normalizing timing lines, TAP was byte-identical with SHA-256 `a932e0418bf2d86e4c59e4703d8c7ce6e3baf7f1e71226d5e471665402d1824d`.

Current size: test 198 lines + implementation 41 lines = **239 additions, 0 deletions** against hard stop 240. No scope deviation or later-unit behavior was introduced.

### PR1A-1a-i-a-1a REFACTOR and fresh review

REFACTOR was inspection-only because the unit had one line of budget remaining. Final focused test: 16/16 passed. Explicit no-index whitespace validation covered both untracked files and was clean; exactly the two authorized files differ. Final size remains **239 additions, 0 deletions**.

Native review preflight was attempted but skipped with `review-mode-disabled`; no lineage or mutation was created. A separate fresh read-only R1 review then marked Unit 1 **STOPPED**:

- R1-028 CRITICAL: the closed envelope is bypassable because `Object.keys` ignores inherited, symbol, and non-enumerable properties; arrays with named properties can pass; getters can change discriminants after validation; inherited semantic OIDs can pass.
- R1-029 WARNING: tests use ordinary objects only and lack independent array/prototype/symbol/non-enumerable/accessor/inherited-OID falsifiers.
- R1-030 WARNING: errors interpolate caller-controlled kind/variant/field values instead of stable non-secret codes.

Technical tests are green but do not prove the closed-envelope property. PR1A-1a-i-a-1a remains **STOPPED** at 239/240 with no correction margin. Unit 2 and every later unit remain frozen. No DB, runtime, migration, commit, or push occurred.

## PR1A-1a-i-a-1a-r — adversarial natural RED

Implementation workspace: `/home/cristian/Proyectos/ecommerce-pr1a1aia1ar`; branch `gate3/pr1a-1a-i-a-1a-r-adversarial-envelope`; clean tracker base `526f614`.

A six-line permissive import shell and 250-line independently named test suite were created. The focused command ran exactly once: exit `1`, 12/38 passed and 26 failed. Six variant-acceptance and six opacity/erasure cases passed. Every invalid shape failed naturally because the shell accepted it; the accessor test recorded one getter call, the Proxy test recorded two caller trap calls, and sentinel tests observed no stable error. No failure depended on a missing import or shared guard.

Current RED size is **256 additions, 0 deletions**, with implementation behavior absent and 94 lines remaining under the 350 hard stop. No Unit 2+, stopped-candidate read, scalar/column/set/catalog/payload behavior, DB, runtime, migration, commit, or push occurred.

### GREEN

The frozen 250-line RED suite ran exactly once after a 69-line implementation and passed **38/38** with exit `0`. The implementation rejects Proxy values before reflective inspection, accepts only Object/null-prototype plain records, inspects own keys and descriptors, consumes descriptor values without invoking accessors or coercive hooks, validates six variants, erases opaque content, and emits finite stable errors. Total authored size: **319 additions, 0 deletions**, leaving 31 lines under hard stop. TRIANGULATE and fresh review remain pending; later units remain frozen.

### TRIANGULATE

Without changing the 69-line implementation, the test suite was readability-refactored to 244 lines and gained four independent proofs: null-prototype envelope acceptance, null-prototype relation acceptance, relation-path accessor rejection with zero getter calls, and exact inspection counts. The count fixture observed one `Reflect.ownKeys` call for each record and one descriptor read for each of `kind`, `relation`, `variant`, and `content`, with no discriminant reread. Two focused runs passed **42/42**; timing-normalized TAP SHA-256 was identical: `3347f3404d73f6d7c1af44292a520c3b109c81bf938a63836969cdf3b645d9a5`. Current total is **313 additions, 0 deletions**, leaving 37 lines under hard stop. REFACTOR/final validation and fresh review remain pending.

### REFACTOR / final verification

Inspection found no readability refactor necessary. One final focused run passed **42/42** with zero failures/skips/cancellations. `git diff --check` was clean. Explicit `git diff --no-index --check /dev/null` checks for both untracked files emitted no diagnostics (expected exit `1` for content differences). Branch and merge-base remain `gate3/pr1a-1a-i-a-1a-r-adversarial-envelope` / `526f614be9cc1efc9269bc62996eaa85b3504be2`; exactly the two authorized untracked paths exist; size remains **69 implementation + 244 tests = 313**, 37 below hard stop. The verifier disclosed one harmless cwd metadata/status precheck in the planning worktree before switching to the candidate; no content read or mutation occurred there. Fresh review is pending.

### Fresh-review STOP

Native preflight returned `rdd_disabled` with an empty untracked projection, so two independent direct read-only reviews inspected the exact candidate. They found R1-031 through R1-036: inherited `Object.prototype.oid` is not rejected; invalid records do not complete the promised descriptor snapshot; validated intermediate discriminants are accessed again; and opacity, Proxy, and all-error-channel evidence is incomplete. Verdict: **STOPPED**. No post-review correction is authorized. Unit 2 and every later unit remain frozen; Unit 4 remains decision-blocked. No DB, runtime, migration, commit, push, or publication occurred.

## PR1A-1a-i-a-1a-r-A — natural RED

Workspace `/home/cristian/Proyectos/ecommerce-pr1a1aia1arA`, branch `gate3/pr1a-1a-i-a-1a-r-a-record-kernel`, clean base `526f614`. A three-line permissive shell and 216-line independently named suite ran once: exit `1`, **2/37 passed and 35 failed naturally**. Plain `relation/table` acceptance and hostile-content opacity passed. Every rejection/snapshot/error case failed because invalid input was accepted or expected inspection was absent, never because import/export was missing. Hostile content traps/coercions stayed zero; Proxy and inherited-OID hooks also stayed zero but rejection was absent; own-key/descriptor counters were zero. Total RED artifact size: **219 additions, 0 deletions**, with 111 lines below hard stop. No GREEN, Unit 1B/later scope, stopped-candidate read, DB, runtime, migration, commit, or push occurred.

### GREEN

The frozen 216-line suite ran exactly once after a 69-line implementation and passed **37/37**. Proxy rejection precedes reflection; complete descriptor snapshots precede validation; own/inherited semantic OID rejects without reading inherited values; final caller discriminants are retained in locals; only `relation/table` accepts; hostile content is untouched and erased; every pinned error is stable and sentinel-free. Total size: **285 additions, 0 deletions**, 45 below hard stop. TRIANGULATE and fresh review remain pending.

### TRIANGULATE STOP

With implementation frozen, two independent tests were added for Object/null-prototype acceptance and consumption of descriptor-snapshot discriminants after caller mutation. The suite reached 225 test lines and total size **294/330**. Both authorized focused runs passed **39/39**, but their timing-normalized TAP SHA-256 values differed: run 1 `cf0209e2f59d85c03d5c90a6bc27f961d6f8987bb06d00ebf998407b964f9196`; run 2 `e22721c3f777ae21036f7d2e553eddf414071ee2fd183713a60bb00a46b6b13e`. The exact deterministic-rerun contract therefore failed. No third run, normalization correction, REFACTOR, fresh review, or implementation correction was authorized. Unit 1A is **STOPPED before fresh review**; Unit 1B and all later units remain frozen.

### Simplified semantic rerun and fresh security review

The human explicitly superseded TAP byte/hash identity with semantic repeatability. With code/tests frozen, two normal focused reruns each produced the same 39 named tests in the same order, **39 pass, 0 fail, 0 skipped/cancelled/todo**, identical acceptance/rejection assertions, and no unexpected diagnostics. Only duration differed (`70.03889ms` versus `83.464244ms`), so no semantic nondeterminism exists and R1-037 is closed as non-blocking. Exact branch/base, two untracked paths, 69/225/294 counts, tracked whitespace, and explicit untracked whitespace checks remained valid.

Native review was unavailable (`rdd_disabled`, empty untracked projection). Two independent direct read-only security reviews inspected only Unit 1A and found no candidate-caused HIGH/BLOCKER affecting fail-closed behavior or its trust boundary. R1-031, R1-032, R1-033, R1-035, and R1-036 close for Unit 1A; R1-034 closes for table while five-variant opacity remains frozen in Unit 1B. Verdict: **UNIT 1A APPROVED — DELIVERY PENDING**. Implementation authority remains none; no commit, push, Unit 1B, DB, runtime, or migration occurred.

The entries above are historical execution and review receipts. The checkpoint below records the later delivery without rewriting that evidence.

## Current checkpoint — delivered Unit 1A reconciliation

- Unit 1A is `APPROVED + DELIVERED` in commit `91b1e80adc4d1005034c0af0657ec4da80750d1b`. Local branch `gate3/pr1a-1a-i-a-1a-r-a-record-kernel` and its matching origin tracking ref contain the commit; prior human-authorized commit/push is recorded, and no remote refresh was performed during this audit.
- The delivered commit adds only `scripts/lib/panel-authorization-canonical.mjs` (69 lines) and `scripts/panel-authorization-canonical.test.mjs` (225 lines), totaling 294 lines. Worktree `/home/cristian/Proyectos/ecommerce-pr1a1aia1arA` is clean; its HEAD and both files match the commit.
- Fresh delivery verification ran `node --test scripts/panel-authorization-canonical.test.mjs` twice on Node v22.23.2; each run reported 39 tests, 39 pass, 0 fail, with combined exit 0. Source inspection found no concrete Unit 1A defect, and whitespace validation passed.
- This fresh verification does not mint formal review authority. The existing Unit 1A security approval remains the historical approval; implementation authority is `NONE`, and the completed review need not be repeated because tracker text was stale.
- Current tracker checkout `gate3/pr1a-preflight-manifests-fixtures` remains at `526f614be9cc1efc9269bc62996eaa85b3504be2` and lacks the delivered canonical files. The entire Gate 3 change directory remains untracked alongside tooling and stopped preflight artifacts. This reconciliation does not stage or deliver these documents, clean artifacts, or change the checkout; stopped candidate scripts are neither approved work nor Unit 1B inputs.

## Unit 1B — implementation complete, fresh review pending

### Scope and structured status

- Human authorization selected only Unit 1B on branch `gate3/unit1b-relation-variants`, execution root `/home/cristian/Proyectos/ecommerce/.worktrees/gate3-unit1b`, base/HEAD `91b1e80adc4d1005034c0af0657ec4da80750d1b`.
- Consumed native status: schema `gentle-ai.sdd-status` v2, artifact store `openspec`, apply state `ready`, next recommendation `apply`, no blocked reasons.
- Action context was safe: repo-local workspace `/home/cristian/Proyectos/ecommerce` with that root allowed; the exact nested worktree and original planning documents are within the authorized root.
- Review path is the human-selected `feature-branch-chain` Unit 1B slice. Source/test forecast was approximately 50 lines with a hard stop above 100; actual change is 33 additions + deletions.
- Exact source scope remained two files. Scalar metadata, Unit 2+, third source/test files, package/dependency/environment work, DB/runtime/discovery/migration/API/UI/network, commit, push, and delivery were not performed.

### Persisted task state

- Marked Unit 1B RED and GREEN rows `- [x]` in `tasks.md` after completion.
- TRIANGULATE and inspection-only REFACTOR implementation evidence is complete, but the combined fresh-review row remains unchecked because no fresh review or approval was performed.
- Exact remaining Unit 1B row:
  - [ ] **TRIANGULATE / REFACTOR complete; FRESH REVIEW pending:** Vary each variant and hostile content independently, rerun deterministically, perform exact path/line/whitespace checks against freshly reviewed Unit 1A, and stop for fresh review without Unit 2, commit, push, or publication. Implementation evidence is complete; this combined row remains unchecked until fresh review is performed. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Unit 1B relation variants and opacity | `scripts/panel-authorization-canonical.test.mjs` | Unit | 39/39 pass, exit 0 | 44 tests: 34 pass / 10 natural fail, exit 1; all ten failures were `ERR_UNKNOWN_VARIANT` from unchanged Unit 1A | 44/44 pass, exit 0 | Two repeated runs each 44/44 pass, exit 0, with identical names/order/semantics | Inspection-only; final 44/44 pass, exit 0 |

- RED replaced five deferred negative cases with acceptance and added five hostile-opacity cases. The ten named cases failed naturally because Unit 1A rejected the deferred variants; table, unknown-variant, and all other regressions remained passing.
- GREEN added only the six-literal relation variant set, validated membership, and returned the validated snapshot local. Required content remains opaque and erased.
- TRIANGULATE exercised each of the five added variants with independent hostile Proxy/coercion/getter/trap fixtures; the existing table case makes exactly six opacity cases. Secret and control sentinels remained covered, and the unknown variant retained `ERR_UNKNOWN_VARIANT` / `Unknown relation variant.`
- REFACTOR was not justified; the readable minimal implementation was left unchanged and verified once more.

### Files, checks, and evidence

- `scripts/lib/panel-authorization-canonical.mjs`: 5 additions, 2 deletions.
- `scripts/panel-authorization-canonical.test.mjs`: 21 additions, 5 deletions.
- Bounded source/test candidate: 26 additions, 7 deletions, 33 total changed lines against `91b1e80`, below the 100-line hard stop.
- `git diff --check`: exit 0.
- Exact changed source paths: only the two authorized canonical files; both are tracked modifications, with no untracked/scratch file in the source worktree.
- Candidate evidence revision from the exact final binary diff bytes: `sha256:2966d95b2a62caf4fea213077221ac25002a6d2606f4ecf657cb8dd5719d246a`.
- All focused test processes exited; no matching process remained running. Tests use synthetic in-memory values only and created no external side effects requiring cleanup.
- Planning-document delta is separate from the 33-line source/test candidate: `tasks.md` records the current Unit 1B authorization/checkpoint and persisted checkbox state; this section was appended cumulatively to `apply-progress.md` without replacing historical receipts.

### Result and deviations

Unit 1B implementation is complete and awaiting fresh parent review. This is not formal review, approval, delivery, or authority to advance to Unit 2. Deviations from the authorized design/scope: none.

## Unit 1B — ordinary independent review closure

- This closure supersedes all earlier Unit 1B frozen, authorized, and pending-review statements as current status while preserving their historical receipts: Unit 1B is `IMPLEMENTED + INDEPENDENT REVIEW PASS`, code-frozen and `UNCOMMITTED/UNDELIVERED`.
- A separate read-only `gentle-ai-verify` reviewer inspected the unchanged exact diff plus base source/tests and returned `PASS`, with no concrete correctness or security regression; Unit 1A guards and the unknown-variant sentinel regression were preserved.
- The reviewer did not rerun tests. Test evidence remains the previously executed baseline 39/39, RED 34 pass/10 expected `ERR_UNKNOWN_VARIANT` failures, GREEN 44/44, TRIANGULATE 44/44 twice, and final REFACTOR verification 44/44 recorded above.
- Independent read-only checks confirmed HEAD `91b1e80`, only the two authorized target paths modified, 33 authored source/test diff lines, and clean `git diff --check`; source bytes were not modified after apply.
- Native review mode was `off` by default, with global and clone-local settings unset and unchanged. No native review lineage, receipt, approval token, or attempt counter was created.
- This ordinary review evidence grants no correction, commit, push, delivery, Unit 2+, or full Gate 3 verification authority. Implementation authority is `NONE`; Gate 3 remains `OPEN`.

## Unit 2 — implementation complete, independent review pending

### Scope and status

- Human authorization selected only scalar metadata Unit 2 in `/home/cristian/Proyectos/ecommerce/.worktrees/gate3-unit2`, branch `gate3/unit2-scalar-metadata`, clean base/HEAD `54a5c651b31b3e7da9b2ab4bd13d196d8a90dc76`.
- Consumed native `gentle-ai.sdd-status` v2: `openspec`, `applyState: ready`, `nextRecommended: apply`, no blocked reasons. Repo-local action context allowed the nested source worktree and original planning documents.
- Review workload decision was resolved by the human-selected `feature-branch-chain` Unit 2 slice. Honest pre-edit source/test forecast was 130–180 changed lines; actual was 134, below the >200 hard stop.
- Scope stayed within the two canonical source/test files plus original `tasks.md` and this cumulative progress artifact. Unit 3+, DB/runtime/migration/API/UI/network, dependencies/config, scratch files, branch changes, staging, commit, push, and review were excluded.
- One initial baseline command omitted the target `cd` and exited on file-not-found before running tests or mutating anything. The corrected target-root baseline passed 44/44.

### TDD Cycle Evidence

| Slice | Test file | Layer | RED | GREEN / TRIANGULATE |
| --- | --- | --- | --- | --- |
| Enriched envelope and retention | `scripts/panel-authorization-canonical.test.mjs` | Unit | 44 tests: 28 pass / 16 natural fail; enriched cases reached unchanged `ERR_UNKNOWN_FIELD` | Minimal structural admission/retention: 44/44 pass |
| Five missing scalars | same | Unit | 49 tests: 44 pass / 5 natural fail because each missing scalar was accepted without an error | Added required-field membership only: 49/49 pass |
| Five invalid scalars and hostile values | same | Unit | 56 tests: 49 pass / 7 natural fail because invalid values were accepted; five field-specific tests plus coercive-object and Proxy tests | Added one finite generic scalar failure and strict primitive checks: 56/56 pass |
| Independent triangulation | same | Unit | Exact strings, four boolean combinations, output/input/snapshot assertions passed 62/62. A later non-enumerable-scalar fixture accidentally preserved enumerability and produced 63 pass / 1 fixture failure; correcting only the descriptor setup closed it. | Final repeated focused runs passed 64/64 twice with identical names/order/semantics; REFACTOR was inspection-only |

- Tests now retain whitespace-only, Unicode, case, controls, and an 8192-character string exactly; cover all four RLS boolean combinations; reject boxed/object/null/undefined/0/1/string forms; and prove hostile scalar coercion/Proxy hooks remain untouched.
- The six existing variant-specific hostile-content cases remain exactly six. Content is not inspected and is absent from the new output.
- Static snapshot expectations now name all seven relation descriptor keys. Added scalar snapshot mutation proves validation/output consume captured descriptor values without caller-property rereads.
- Output tests require a new Object-prototype record with exact keys `kind`, `variant`, `schema`, `name`, `owner`, `rlsEnabled`, and `rlsForced`, while input remains unmutated.

### Files and final evidence

- `scripts/lib/panel-authorization-canonical.mjs`: +17/-2 (19 changed lines).
- `scripts/panel-authorization-canonical.test.mjs`: +99/-16 (115 changed lines).
- Total source/test change: 116 additions, 18 deletions, 134 authored changed lines against Unit 1B.
- Focused safety net: 44/44 pass. Final semantic repeats: 64/64 pass twice. `git diff --check` passed.
- Exact changed source paths are only the two authorized canonical files; both are tracked modifications. Final evidence revision is `sha256:3c2810864cd11dfe48feddb6b07c6afd7ee7e4f279b9aebf99958cebf58fc1df` from the exact requested binary diff bytes.
- All Unit 2 implementation rows are visibly marked `- [x]` in `tasks.md`. Unit 2 is `IMPLEMENTED — INDEPENDENT REVIEW PENDING`; no approval or delivery is claimed.
- All focused Node processes exited. Synthetic in-memory tests created no files, services, network traffic, or external side effects requiring cleanup.

### Deviations and remaining work

- Design/scope deviations: none. The descriptor-fixture correction affected test setup only and did not change production behavior.
- Remaining Unit 2 work is independent review under parent control. Unit 3 and every later unit remain frozen; Unit 4 remains decision-blocked.

## Unit 2 — ordinary independent source-review closure

- This closure supersedes earlier Unit 2 frozen, active, and pending-review status while preserving all historical receipts and approved guards: Unit 2 is `IMPLEMENTED + INDEPENDENT REVIEW PASS`, code-frozen, uncommitted, and undelivered.
- A separate read-only `gentle-ai-verify` reviewer read the full current source and test files, compared the exact candidate with base, and returned `PASS` with no concrete candidate-caused correctness or security defect.
- Independent checks confirmed base/HEAD `54a5c651b31b3e7da9b2ab4bd13d196d8a90dc76`, only the two authorized modified paths, +17/-2 and +99/-16 for 134 changed lines, clean whitespace, and candidate `sha256:3c2810864cd11dfe48feddb6b07c6afd7ee7e4f279b9aebf99958cebf58fc1df`.
- No tests were rerun for this ordinary source-only review. Runtime authority remains the detailed strict-TDD evidence above, including the enumerability-fixture correction before the two final 64/64 passes.
- The native implementation attempt settled complete without persisted tokens or counters. Native RDD remained off by default with global and clone-local settings unset and unchanged; no native lineage, receipt, approval, or delivery permission exists.
- Source was unchanged after review. Implementation authority is `NONE`; the untracked original planning documents remain outside the source candidate, and no correction, commit, push, DB/API/UI, Unit 3+, delivery, or automatic next-phase work is authorized. Gate 1 and Gate 2 remain `CLOSED`, Gate 3 remains `OPEN`, Unit 3+ remains frozen, and Unit 4 remains blocked on its three decisions.

## Unit 3 — review-budget stop during partial completion

### Scope and status consumed

- Consumed authoritative `gentle-ai.sdd-status` v2 for `multi-tenant-gate-3-panel-authorization`: `openspec`, `applyState: ready`, `nextRecommended: apply`, no blocked reasons, repo-local workspace `/home/cristian/Proyectos/ecommerce`, and allowed root `/home/cristian/Proyectos/ecommerce`.
- Human-selected delivery path was `feature-branch-chain`, current slice Unit 3 only, with a strict 250 source/test changed-line hard stop and no `size:exception`.
- Exact execution workspace was `/home/cristian/Proyectos/ecommerce/.worktrees/gate3-unit3`, branch `gate3/unit3-ordered-columns`, base/HEAD `9dd641130efad448add8c1ef07a534f970804d90`.
- Writer model reported by the harness was `gpt-5.6-sol`; effort metadata was unavailable. Skills resolved from the three injected paths.

### Forecast, baseline, and TDD chronology

- The one required pre-edit remaining-work forecast was 80–100 additional changed lines, projecting 221–241 total from the inherited 141-line partial candidate. The corrected focused safety-net run passed 79/79.
- An earlier command accidentally ran from the planning root, failed with `Could not find 'scripts/panel-authorization-canonical.test.mjs'`, and made no change. It is not baseline or source evidence; every subsequent source/test command used the exact Unit 3 cwd.
- The inherited partial implementation already admitted mandatory `columns` and enforced the array-structure boundary. It had no retained element validation, duplicate-name rejection, or copied-column-record behavior, so no historical RED is claimed for that code.
- New natural RED added the missing element/copy/duplicate expectations: exit 1, 94 tests, 79 pass / 15 fail. The first failure was `copies ordered columns and retains exact column primitives`, at the expected `notStrictEqual` copied-record assertion; the remaining failures rejected no malformed column or exact duplicate.
- Minimal GREEN added exact column-record/scalar validation, copied records in order, and exact-string duplicate rejection. Its first run was 93/94 because the new non-enumerable fixture had accidentally preserved enumerability. Correcting only that descriptor setup produced 94/94 pass.
- TRIANGULATE then added null-prototype arrays/column records, empty columns, case/space-distinct names, column Proxy zero-trap coverage, and complete array/element descriptor-snapshot and caller-mutation consumption checks. Before execution, the exact source/test count was 266, above the hard stop; no TRIANGULATE run, repeated final suites, REFACTOR, or independent review was performed.

### Budget outcome and restored boundary

- The single honest completion pass established a smallest observed readable candidate of 266 changed lines: source `+78/-6` and tests `+163/-19`. This exceeded the 250 boundary by 16 lines, so no exception, packing, or further shrink iteration was attempted.
- All execution source/test edits were reverted exactly. The inherited partial candidate is restored to source `+39/-3`, tests `+86/-13`, **141 additions + deletions** total against `9dd6411`.
- Restored exact diff SHA-256: `f3a5aedbd65ab44d14a4a85f88a934de58b6bd94963380548c790a6c647771a0`.
- Restored file SHA-256 values: module `07ca000965da773a59edd04c7ad29b7079d1a820c67789a2d23a9f236975d2eb`; test `3b94f42d16a72b2955ff86b50a5075933e2a99efce87d36c3344db180b5bb67b`.
- `tasks.md` now records this budget stop. No Unit 3 checkbox was marked complete, and no commit, push, branch manipulation, review, Unit 4+, install, network, DB/API/UI, runtime, migration, or production action occurred.

### TDD Cycle Evidence

| Unit | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| Unit 3 ordered column completion | Unit | 79/79 pass from exact cwd | Natural 79 pass / 15 fail; missing copy, record/scalar guards, and duplicate rejection | 93/94 due fixture setup; fixture-only correction then 94/94 pass | Tests written but not run because candidate reached 266/250; all execution edits reverted | Not started |

### Remaining tasks and required decision

Exact persisted unchecked Unit 3 rows remain:

- [ ] **RED:** Add incremental natural failures for enriched retention, missing columns, dense safe array structure, exact column records/scalars, duplicate names, copying, and independent order/hole/element variations. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Add only snapshot-driven ordered-column canonicalization and the dense/element-valid/copy/duplicate guards proven by those RED stages. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE / REFACTOR; REVIEW PENDING:** Exercise order, empty arrays, hole positions, inherited indices, zero-trap Proxies/hooks, exact primitive retention/duplicate identity, copy/no-mutation, and descriptor consumption; repeat the focused suite twice, check exact paths/whitespace/count/hash, and stop for independent review. <!-- sdd-owner: implementation -->

Required parent interaction: recut Unit 3 as two semantic feature-branch-chain slices—first the already-partial dense-array structure boundary (141 lines), then column element validation/copy/exact-duplicate semantics (observed approximately 125 lines against that parent)—before resuming implementation. No `size:exception` is recommended or authorized under the current instruction.

## Current pointer — 2026-09-13 P1 review checkpoint

P1.1 and the agreed atomic P1.2+P1.3 integration scope are now implemented and reviewed, with the separate canonical `empresa` SELECT prerequisite also implemented; the [canonical checkpoint](./p1-plan.md#2026-09-13--p1-implementation-and-native-review-checkpoint) supersedes active P1-planning pointers without rewriting the historical receipts above. They are not delivered, and no SDD controller, whole-P1, whole-Gate-3, deployment, or broader P2/P3 closure is claimed. This passive documentation update is outside the approved 1,138-line frozen source/test candidate. Gate 1/2/Unit 1A remain CLOSED, Gate 3 remains OPEN, and Unit 3 remains FROZEN — NO RESCUE.

