# Review Ledger — Multi-Tenant Gate 3 Panel Authorization

## Review target

- Lens: `risk`
- Artifact store: `openspec`
- Target: `design.md` against `proposal.md`, `specs/panel-authorization/spec.md`, and repository policy evidence
- Initial verdict: `BLOCKED`

## Findings

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-001 | risk | `design.md:15-19,238-253,281-289,354-377,468-475,481-499`; `specs/panel-authorization/spec.md:38-75`; `supabase/migrations/20260902120000_multi_tenant_gate_1_catalog_stock_isolation.sql:24-52`; `supabase/migrations/20251231074614_rls_minimo_tenant_safe.sql:73-143` | BLOCKER | verified | The approved matrix denies catalog capability to `cliente`, but the original Design preserved role-blind same-company catalog policies. The corrected Design atomically replaces effective catalog policies/grants with canonical same-company `admin`/`staff` checks, denies same-company `cliente`, removes permissive alternate paths, and requires command-level three-role parity tests. Fresh scoped R1 re-review found no corrective-delta security regression. |

## Corrective design delta

- Historical Gate 1/Gate 2 migrations and OpenSpec artifacts remain unchanged.
- Gate 3 now owns atomic effective catalog policy/grant replacement for retained direct browser surfaces.
- SQL enforces `auth.uid() -> usuario.supabase_uid -> empresa_id + rol` independently of the shared TypeScript capability map.
- Same-company `cliente` catalog access is explicitly denied for every supported command.
- The validated auth UID FK is retained; mandatory regression fixtures may receive setup/cleanup-only changes to create real `auth.users` rows while preserving behavioral assertions.

## Re-review

- Verdict: `APPROVABLE`
- `R1-001`: `verified`
- New BLOCKER/CRITICAL findings: none
- Evidence: canonical authority remains fail-closed; client tenant input remains non-authoritative; the auth-FK fixture path preserves the validated FK and Gate 1 behavioral assertions; no implementation or production mutation is authorized by the Design.

## Post-Tasks audit

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R3-001 | reliability | `.pi/` | BLOCKER | refuted | The audit treated untracked `.pi/` as a session-created unauthorized artifact. Baseline `git status --short` already showed `?? .pi/` before the Design correction or Tasks generation, so it is pre-existing and outside this change. The audit otherwise confirmed that Tasks are dependency ordered, strict-TDD actionable, command/path coherent, regression complete, and paused before Apply. |

Post-Tasks verdict: `READY_FOR_USER_DECISION`.

## PR 1 Apply review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R3-001 | reliability | `scripts/sql/panel-authorization-preflight.sql:109-128` | BLOCKER | open | The local database was reported clean while the auth UID FK was absent, the company FK retained `ON DELETE SET NULL`, the auth trigger retained email adoption, and known public/`membresia` authorization paths were allowlisted. The preflight can false-pass mandatory stop conditions. |
| R3-002 | reliability | `scripts/panel-authorization-preflight.test.mjs:10-22,61-101` | CRITICAL | open | Behavioral dirty coverage exercises only `canonical_uid_join`; it does not prove the remaining mandatory dirty-data/authorization stop conditions. |
| R3-003 | reliability | `scripts/sql/panel-authorization-preflight.sql:5-12,153-170`; `scripts/panel-authorization-preflight.test.mjs:34-37,103-108` | CRITICAL | open | Missing expected relations/query errors may abort before the required JSON report, and the parser does not enforce exactly one JSON document. |
| R3-004 | reliability | `scripts/panel-authorization-preflight.test.mjs:40-49,63-68,88-110`; `scripts/sql/panel-authorization-preflight.sql:129` | CRITICAL | open | The before/after fingerprint omits material data/schema/authorization surfaces, while the SQL `read_only_fingerprint` check is constant `pass`. |

PR 1 verdict: `STOPPED`. The four PR 1 task checkboxes were restored to unchecked. PR 2 was not started.

## PRE/POST contract review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-002 | risk | `specs/panel-authorization/spec.md:373-393`; `design.md:414-445` | BLOCKER | verified | The initial Design disabled `ON_ERROR_STOP` without preserving the transaction after statement errors. The corrected contract now requires non-interactive psql `ON_ERROR_ROLLBACK=on`, immediate `ERROR`/`SQLSTATE` capture, fail-to-`unverifiable` mapping, exactly one JSON emission, explicit rollback, then exit 3/4. Fresh scoped R1 review found no new BLOCKER/CRITICAL regression. |

Corrected PRE/POST Spec and Design verdict: `APPROVABLE`.

## PR1A Apply review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R3-005 | reliability | `scripts/sql/fixtures/panel-authorization-target-v2.sql:8-18` | BLOCKER | open | Target fixture still inherits authenticated `historial_stock` access and omits required UUID/path-shape/non-empty-filename storage checks, so unsafe stock/storage behavior can be represented as target-safe. |
| R3-006 | reliability | `scripts/sql/panel-authorization-preflight.sql:5-39`; `scripts/lib/panel-authorization-preflight-harness.mjs:19-20` | BLOCKER | open | Sealed inventory uses 35 placeholder-hash rows. Direct target comparison found 20 manifest rows versus 7,973 canonical rows, only 17 matching keys, and zero matching hashes; required per-object identities and replacements are absent. |
| R3-007 | reliability | `scripts/sql/panel-authorization-preflight-canonicalizer.sql:6-9,56-65` | CRITICAL | open | Closure omits policy/view dependency objects and checkout/order/payment/webhook roots; schema ACLs are absent; trigger identity retains raw constraint OIDs. Relevant drift can escape or identities can vary across equivalent replays. |
| R3-008 | reliability | `scripts/panel-authorization-preflight.test.mjs:154-181`; `scripts/lib/panel-authorization-preflight-harness.mjs:22-25` | CRITICAL | open | Target behavior is hard-coded after coarse catalog checks; no admin/staff/cliente commands execute. Mutation tests compare against dynamically captured baselines instead of the sealed target manifest, allowing false certification. |
| R3-009 | reliability | `apply-progress.md:94-107` | CRITICAL | verified | Fresh retry retained exact test-first RED evidence before implementation: exit 1, 19 tests, 2 passed and 17 failed, mapped to R3-005 through R3-008. |
| R3-010 | reliability | `scripts/sql/panel-authorization-preflight-canonicalizer.sql:62` | BLOCKER | verified | Complete focused execution canonicalized storage rows; the former storage-expression syntax error did not reproduce. |
| R3-011 | reliability | `scripts/sql/panel-authorization-preflight-canonicalizer.sql:61` | BLOCKER | verified | `pg_depend.deptype::text` executes in the full canonicalizer; the prior UNION type mismatch did not reproduce. |
| R3-012 | reliability | `scripts/sql/panel-authorization-preflight-canonicalizer.sql:11-48,57` | BLOCKER | verified | Aggregate-aware `prokind` handling completed against global callable inventory; the prior `array_agg` error did not reproduce. |
| R3-013 | reliability | `scripts/lib/panel-authorization-preflight-harness.mjs:11-14,21` | BLOCKER | verified | Pre-edit reproduction proved `ENOBUFS` with `status:null`, signal, bounded telemetry, and byte sizes. Harness now uses finite 32 MiB capture plus strict 16 MiB canonical-output guard without row leakage; focused and manifest runs complete. |
| R3-014 | reliability | `scripts/sql/panel-authorization-preflight.sql:40-41`; `scripts/panel-authorization-preflight.test.mjs:185-195` | BLOCKER | open | Operational seal emits `overall_status:"unverifiable"` but exits 0 because local psql ignores `\quit 4` as an extra argument. Tests regex-match source instead of executing the seal, so unsafe/unsealed automation can false-pass. |

Fresh PR1A verdict: `STOPPED`. Authored size is 354 lines. R3-009 through R3-013 are verified, but R3-005 through R3-008 remain open and R3-014 is a new blocker. PR1B was not started.

## PR1A-1 security review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-007 | risk | `scripts/lib/panel-authorization-preflight-harness.mjs:89-147`; `scripts/panel-authorization-preflight.test.mjs:111-121` | BLOCKER | open | Auth discovery is regex/token-based rather than AST-derived. Valid destructuring (`const { auth } = supabase`) bypassed discovery and passed with 32 rather than 34 callsites; optional chaining, parenthesized access, detached methods, and computed auth access are also outside the bounded scanner. |
| R1-008 | risk | `scripts/lib/panel-authorization-preflight-harness.mjs:16-58,79-85,150-159`; receipt fixtures and tests | BLOCKER | open | Root, GraphQL, closure, and role validators accept caller-supplied summaries rather than discovering repository/database topology. Real extra policies, RPCs, GraphQL objects, ACL/default-ACL edges, or SET ROLE paths remain invisible unless volunteered. |
| R1-009 | risk | `scripts/lib/panel-authorization-preflight-harness.mjs:61-76` | BLOCKER | open | Canonicalization has no required schema per object kind, trusts caller-supplied `stableKey`, accepts incomplete policy identity, and produces order-dependent hashes for equivalent dependency arrays. |
| R1-010 | risk | `scripts/lib/panel-authorization-preflight-harness.mjs:166-183`; runtime attestation fixture | BLOCKER | open | Runtime attestation does not require environment, nonce, source subject, or PostgREST release; arbitrary authentication methods and caller-controlled fixture allowance can pass, allowing incomplete or replayed evidence. |
| R1-011 | risk | `scripts/lib/panel-authorization-preflight-harness.mjs:52-53` | WARNING | info | Closure state mutations are semicolon-packed on single lines at a security-sensitive boundary. |

PR1A-1 verdict: `STOPPED`. Focused TDD and determinism are technically green, but the implementation does not yet discover or canonically bind the authoritative surface. Size: 399 lines. PR1A-2 was not started.

## PR1A-1a security review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-012 | risk | `scripts/lib/panel-authorization-canonical.mjs:28-29,70-76`; `scripts/panel-authorization-canonical.test.mjs:254-268` | BLOCKER | open | Global set classification sorts `argumentNames` and `extraSearchPath`, erasing positional and PostgreSQL search-path semantics. Reordered search paths canonicalize identically; tests omit both falsifiers. |
| R1-013 | risk | `scripts/lib/panel-authorization-canonical.mjs:43-69,97-105`; `scripts/panel-authorization-canonical.test.mjs:202-251` | BLOCKER | open | Array validation discards parent-field context and accepts arbitrary nested records, allowing unknown nested metadata into accepted identities. Tests reject top-level extras and explicit OIDs but not malformed string-array elements. |
| R1-014 | risk | `scripts/lib/panel-authorization-canonical.mjs:78-94`; `scripts/panel-authorization-canonical.test.mjs:179-200` | CRITICAL | open | Stable keys concatenate raw identifiers without unambiguous framing or PostgreSQL quoting; distinct quoted schema/relation pairs can collide. Required Unicode normalization is also absent. |
| R1-015 | risk | `scripts/lib/panel-authorization-canonical.mjs:110-114`; `scripts/panel-authorization-canonical.test.mjs:271-284` | CRITICAL | open | Results expose unbounded raw semantic values, full definitions, per-node canonical inputs, and aggregate canonical input. Complete bytes must be hashed, not returned unbounded; tests lack output-bound and leak falsifiers. |

PR1A-1a verdict: `STOPPED`. Technical TDD passed 7/7 through GREEN, TRIANGULATE, and final rerun, but the fresh R1 review found two BLOCKER and two CRITICAL property failures. Size is exactly 400 lines. All PR1A-1a task checkboxes remain unchecked; PR1A-1b was not started.

## PR1A-1a-i security review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-016 | risk | `scripts/lib/panel-authorization-canonical.mjs:81-99`; `scripts/panel-authorization-canonical.test.mjs:184-189` | BLOCKER | open | Validated `catalog.joinId` is retained in normalized semantics. The GREEN attempt confirmed that changing only finite join metadata changes output: 7/8 passed, exit 1. |
| R1-017 | risk | `scripts/lib/panel-authorization-canonical.mjs:15-57`; `scripts/panel-authorization-canonical.test.mjs:142` | BLOCKER | open | The registry omits Design-required materialized views, rewrites, procedures, type/domain/operator/cast, constraints/indexes/FKs/checks, schema/default ACL/grants, buckets, role memberships/settings/SET ROLE, attestations, and dependency edges. The test incorrectly requires `relation:materialized` rejection despite Design including materialized views. |
| R1-018 | risk | `scripts/lib/panel-authorization-canonical.mjs:71-76,93-100` | BLOCKER | open | JavaScript sparse arrays bypass `map()` element validation; holes can survive normalization and serialize as `null`, violating fail-closed malformed-element handling. |
| R1-019 | risk | `scripts/panel-authorization-canonical.test.mjs:88-96,108-181` | BLOCKER | open | The test table omits independent coverage for every kind/path/variant and required ordered/set/malformed-element falsifier. Catalog shape is skipped and multiple cases are packed into shared rows. |

PR1A-1a-i verdict: `STOPPED`. RED was preserved, but GREEN failed 7/8 before TRIANGULATE or REFACTOR. Size is exactly the unit cap: 300 additions. Complete corrections cannot credibly fit without replacement or further repackaging; all PR1A-1a-i task checkboxes remain unchecked and PR1A-1a-ii was not started.

## PR1A-1a-i-a pre-GREEN budget review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-020 | risk | `scripts/panel-authorization-canonical.test.mjs:1-250`; PR1A-1a-i-a Tasks | BLOCKER | open | The 250-line RED suite leaves 80 lines before the 330 hard stop. A readable exact engine for nine variants, nested schemas, dense ordered/set arrays, recursive OID rejection, metadata stripping, and normalization cannot credibly fit without forbidden packing. |
| R1-021 | risk | `scripts/panel-authorization-canonical.test.mjs:107-185` | CRITICAL | open | Shared helpers hide multiple missing/type/extra and start/middle/end sparse/malformed assertions inside broadly named tests, violating independent reviewable-falsifier requirements. |
| R1-022 | risk | `scripts/panel-authorization-canonical.test.mjs:126-186` | CRITICAL | open | Malformed, sparse, nested-key, and OID coverage is sampled rather than independent for every owned relation variant and nested path. |
| R1-023 | risk | `scripts/panel-authorization-canonical.test.mjs:97-116,194-243` | CRITICAL | open | Unknown string discriminants, some declared set fields, `NaN`/negative infinity metadata, and attached-object semantic mutations are not covered. |
| R1-024 | risk | `scripts/panel-authorization-canonical.test.mjs:4-8,51-62` | CRITICAL | open | All 73 tests fail first through the shared missing-API guard, so the RED result is non-discriminating and does not prove each intended defect is caught. |

PR1A-1a-i-a verdict: `STOPPED` before GREEN. RED is 250 additions, 0/73 passing, and implementation is absent. The projected 320–330 total violates the comfortable-margin/no-packing gate. No later unit was started.

## PR1A-1a-i-a-1 partial TRIANGULATE review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-025 | risk | `scripts/panel-authorization-canonical.test.mjs`; `scripts/lib/panel-authorization-canonical.mjs` | BLOCKER | open | The narrowed unit reached 319/320 lines after 19/19 focused tests but before finite/non-finite metadata, metadata stripping, observation-order invariance, semantic OID, sparse-array, and malformed-array contracts. Final deterministic reruns and REFACTOR were not reached. The full property is unproved and cannot be completed within the remaining line without violating the hard stop. |

PR1A-1a-i-a-1 verdict: `STOPPED`. Bootstrap and authoritative RED, table GREEN, five variant mini-cycles, set/ordered semantics, and the decisive materialized-view falsifier were retained. Full TRIANGULATE and REFACTOR are incomplete. Size: 319 additions. PR1A-1a-i-a-2 was not started.

## SELECTIVE-CLEAN-REPLAY historical-input audit

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-026 | reliability | `apply-progress.md` PR1A-1a-i-a-1 receipts; replay matrix in `tasks.md` | BLOCKER | open | The retained suite includes bootstrap export and unknown nested-column rejection in addition to the proposed 19 rows. Recorded purposes total at least 21 while the final receipt says 19/19; individual names/results are unavailable for one-to-one mapping. |
| R1-027 | reliability | table GREEN and partial TRIANGULATE receipts | BLOCKER | open | Table GREEN claims recursive unknown-field rejection plus catalog metadata validation/stripping, while the later stop classifies metadata validation/stripping as unverified and excludes it from replay. Exact-record reconstruction would either import a pending contract or differ from prior semantics. |

SELECTIVE-CLEAN-REPLAY verdict: `STOPPED BEFORE IMPLEMENTATION`. Historical evidence cannot establish the authorized replay boundary without omission or scope expansion. The clean replay workspace stayed unchanged; no tests or implementation were created. PR1A-1a-i-a-2 remains frozen.

## PR1A-1a-i-a-1a fresh review

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-028 | risk | `scripts/lib/panel-authorization-canonical.mjs:12-40` | CRITICAL | open | `Object.keys` checks only enumerable own string keys: arrays with named properties, inherited/symbol/non-enumerable extras, inherited semantic OIDs, and stateful accessors can bypass the closed envelope or alter discriminants after validation. |
| R1-029 | risk | `scripts/panel-authorization-canonical.test.mjs:42-198` | WARNING | open | Tests cover ordinary objects only and omit array, prototype, symbol, non-enumerable, accessor, and inherited-OID falsifiers, so 16/16 does not establish adversarial closure. |
| R1-030 | risk | `scripts/lib/panel-authorization-canonical.mjs:13-26` | WARNING | open | Validation errors interpolate caller-controlled kind/variant/field values rather than returning stable non-secret codes. |

PR1A-1a-i-a-1a verdict: `STOPPED`. Natural RED, GREEN, six opaque-content falsifiers, deterministic reruns, final 16/16, and whitespace checks succeeded at 239/240. Fresh review found one CRITICAL closed-envelope bypass and no correction margin. Unit 2 was not started.

## PR1A-1a-i-a-1a-r fresh review

Native review preflight returned `rdd_disabled` and an empty untracked projection, so it could not review the candidate. Two independent direct read-only reviews were used; no candidate mutation followed review.

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-031 | risk | `scripts/lib/panel-authorization-canonical.mjs:16-30`; test inherited-OID case | HIGH | open | `Object.prototype` is allowed, but only own keys are inspected. Polluting `Object.prototype.oid` lets a relation record inherit a semantic OID and still normalize. The test uses a custom prototype, so generic prototype rejection makes it non-discriminating for this bypass. |
| R1-032 | reliability | `scripts/lib/panel-authorization-canonical.mjs:28-47`; accepted-record count test | BLOCKER | open | Descriptor collection and validation are interleaved. An invalid first discovered key throws before descriptors for later discovered keys are read, violating the exact snapshot contract of one descriptor read for every discovered key. The count test covers accepted records only. |
| R1-033 | reliability | `scripts/lib/panel-authorization-canonical.mjs:56-65` | BLOCKER | open | Parsed discriminants are stored in intermediate objects and accessed again for validation and return instead of being retained in final locals once, contrary to the literal no-reread contract. Current descriptor counters cannot observe these intermediate property rereads. |
| R1-034 | reliability | `scripts/panel-authorization-canonical.test.mjs:75-80` | WARNING | open | Opaque-content tests establish erasure but do not use trap/coercion counters, so they do not independently prove content is never inspected before erasure. |
| R1-035 | reliability | `scripts/panel-authorization-canonical.test.mjs:217-230` | WARNING | open | Proxy evidence covers only an envelope `get` trap. It does not independently cover relation-path Proxy values or `ownKeys`/`getPrototypeOf`/descriptor traps. Source inspection appears fail-closed, but the required evidence is incomplete. |
| R1-036 | reliability | `scripts/panel-authorization-canonical.test.mjs:232-244` | WARNING | open | Exact stable error evidence is pinned for unknown kind, variant, and field only. Proxy, invalid-record, invalid-field/accessor, and missing-field failures are not independently pinned as bounded sentinel-free failures. |

PR1A-1a-i-a-1a-r verdict: `STOPPED`. Natural RED was 12/38 pass with 26 owned failures; GREEN was 38/38; TRIANGULATE and final verification were 42/42; normalized TRIANGULATE hash was `3347f3404d73f6d7c1af44292a520c3b109c81bf938a63836969cdf3b645d9a5`; whitespace checks were clean; size was 313/350. Fresh review found an inherited-OID bypass, two exact snapshot/no-reread contract blockers, and three evidence gaps. No correction or Unit 2 work was authorized after review.

## PR1A-1a-i-a-1a-r-A pre-review gate

| id | lens | location | severity | status | evidence |
| --- | --- | --- | --- | --- | --- |
| R1-037 | reliability | Unit 1A TRIANGULATE receipt | INFO | closed | Human review criterion was simplified: TAP byte/hash identity is not required absent semantic nondeterminism. Two resumed runs had the same 39 names/order, 39 pass, zero fail/skip/cancel/todo, identical assertions and fail-closed semantics; only durations differed. |

The initial pre-review stop was superseded by explicit human authorization for read-only semantic reruns and fresh security review. Resumed TRIANGULATE passed 39/39 twice with no semantic nondeterminism. Branch/base/path/line and whitespace checks remained clean at 69 implementation + 225 tests = 294/330.

### Unit 1A closure of R1-031 through R1-036

| finding | Unit 1A disposition |
| --- | --- |
| R1-031 | closed for Unit 1A: own and polluted-`Object.prototype` relation OIDs reject without reading/invoking inherited values. |
| R1-032 | closed: every discovered descriptor is captured once before validation on accepted and early-rejected paths. |
| R1-033 | closed by source review: caller discriminants come from captured descriptors into final locals and are not reread from caller records. |
| R1-034 | table scope closed: hostile table content is never trapped/coerced and is erased; the five deferred variant cases remain assigned to frozen Unit 1B. |
| R1-035 | closed: envelope and relation Proxies reject before `get`, `ownKeys`, `getPrototypeOf`, or descriptor traps. |
| R1-036 | closed: every Unit 1A failure category uses exact bounded input-independent code/message and sentinel-free evidence. |

Native review remained unavailable because `rdd_disabled` produced an empty untracked projection. Two independent fresh direct read-only security reviews found no candidate-caused HIGH/BLOCKER affecting Unit 1A's fail-closed security property or trust boundary. PR1A-1a-i-a-1a-r-A verdict: `APPROVED — DELIVERY PENDING`. No correction, Unit 1B work, commit, push, DB, runtime, or migration occurred.

The verdict above is the historical pre-delivery review record.

## Current checkpoint — delivery recorded, review unchanged

- Unit 1A is `APPROVED + DELIVERED` at `91b1e80adc4d1005034c0af0657ec4da80750d1b` on the recorded local branch and matching origin tracking ref. Local commit/ref and clean delivered-worktree evidence were freshly confirmed without a remote refresh; `apply-progress.md` contains the exact two-file, 294-line delivery and 39/39 verification receipt.
- Fresh verification found no concrete defect in Unit 1A scope, but it is not a new native review and grants no review or implementation authority. The existing security approval and its unchanged fail-closed property remain authoritative; stale documentation alone does not require repeating the completed review.
- Gate 1 and Gate 2 remain `CLOSED`, Gate 3 remains `OPEN`, implementation authority remains `NONE`, Unit 1B and Unit 2+ remain frozen, and Unit 4 remains blocked on set deduplication, locale-independent canonical ordering, and observation-order invariance.

## Unit 1B ordinary independent review closure

- This closure supersedes the preceding Unit 1B frozen/pending status as current state while preserving history. Target: the unchanged 33-line source/test diff on `gate3/unit1b-relation-variants` from HEAD/base `91b1e80`, limited to the two authorized canonical files.
- A separate read-only `gentle-ai-verify` reviewer inspected the exact current diff and base source/tests and returned `PASS`: no concrete correctness or security regression, with Unit 1A guards and unknown-variant sentinel behavior preserved.
- This was source-only ordinary independent review; it did not rerun tests. The execution evidence remains the prior 39/39 baseline, natural RED 34 pass/10 expected failures, GREEN 44/44, TRIANGULATE 44/44 twice, and final 44/44 verification in `apply-progress.md`.
- Independent checks confirmed only the two target paths modified, 33 changed lines, and clean `git diff --check`. Source bytes were not modified after apply.
- Native review mode remained `off` by default; global and clone-local settings remained unset. No native lineage, receipt, token, approval, or attempt counter was created.
- Verdict: `INDEPENDENT REVIEW PASS — UNCOMMITTED/UNDELIVERED`. This does not close Gate 3 or authorize correction, delivery, Unit 2+, commit, or push; implementation authority remains `NONE`, Gate 3 remains `OPEN`, and Unit 4 remains blocked.

## Unit 2 ordinary independent source-review closure

- This closure supersedes all earlier Unit 2 frozen, active, and pending-review status as current state without rewriting historical receipts or approved guards. Target: unchanged candidate `sha256:3c2810864cd11dfe48feddb6b07c6afd7ee7e4f279b9aebf99958cebf58fc1df` on `gate3/unit2-scalar-metadata`, base/HEAD `54a5c651b31b3e7da9b2ab4bd13d196d8a90dc76`.
- A separate read-only `gentle-ai-verify` reviewer read the full current source/test files, compared base and diff, and returned `PASS`: no concrete candidate-caused correctness or security defect. Independent checks confirmed only the two target paths, +17/-2 and +99/-16 (134 changed lines), and clean whitespace.
- This was ordinary source-only review, not a native receipt or approval, and tests were not rerun. Prior runtime evidence in `apply-progress.md` remains authoritative, including the recorded enumerability-fixture correction and final 64/64 passes twice.
- The native implementation attempt settled complete without persisted tokens or counters. Native RDD remained off by default, global and clone-local settings stayed unset and unchanged, and no native lineage, receipt, or delivery permission was created.
- Verdict: `IMPLEMENTED + INDEPENDENT REVIEW PASS — CODE FROZEN — UNCOMMITTED/UNDELIVERED`. Source remained unchanged after review; implementation authority is `NONE`. Unit 1A stays delivered at `91b1e80`, Unit 1B stays locally committed at `54a5c65` without push, Gate 1/2 stay `CLOSED`, Gate 3 stays `OPEN`, Unit 3+ stays frozen, and Unit 4's three decisions stay blocked; no correction, commit, push, delivery, DB/API/UI, next-unit, or automatic lifecycle work is authorized.
