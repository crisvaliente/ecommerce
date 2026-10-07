# Tasks — Multi-Tenant Gate 3 Panel Authorization

> **Closed (2026-10-07):** Gate 3 is CLOSED by user decision with documented deviations; P5 preflight superseded. See [closure.md](./closure.md). Everything below is history.

> **Current status (supersedes active planning status): P1.1 and the agreed atomic P1.2+P1.3 integration scope are implemented and reviewed, with the separate canonical `empresa` SELECT prerequisite also implemented.** See the [2026-09-13 canonical checkpoint](./p1-plan.md#2026-09-13--p1-implementation-and-native-review-checkpoint). They are not delivered, and this is not SDD controller, whole-P1, or whole-Gate-3 closure. Gate 1/2/Unit 1A remain CLOSED, Gate 3 remains OPEN, and Unit 3 remains FROZEN — NO RESCUE. No historical native checkbox or progress counter is updated.
>
> **Historical precedence:** The accepted strategy changes no security MUST without explicit Specification/Design alignment where evidence obligations change. Historical checklists below remain unedited history and are not executable new work; the native controller still records the historical checklist and this pointer neither resolves nor replaces it.

> **Historical status snapshot: UNIT 3 PARTIAL — BLOCKED ON NATIVE BUDGET AUTHORITY.** The human explicitly approved completing the same Unit 3 contract with a 350-line source/test ceiling, strict TDD, and independent review. Native acquire rejected the larger limit: the unchanged candidate remains bound to 250, and the documented narrower-successor route cannot increase that limit. No new implementation attempt was launched. The exact inherited 141-line partial remains; its historical independent baseline is 79/79, not Unit 3 completion. Work remains in `/home/cristian/Proyectos/ecommerce/.worktrees/gate3-unit3`, branch `gate3/unit3-ordered-columns`, based on Unit 2 `9dd641130efad448add8c1ef07a534f970804d90`. No reset, rescope, artificial candidate drift, commit, push, delivery, Unit 4+, DB/runtime/migration/API/UI/network action, or automatic next phase is authorized. Unit 1A remains delivered at `91b1e80`, Unit 1B committed locally at `54a5c65`, Unit 2 committed locally at `9dd6411`; Gates 1/2 remain `CLOSED`, Gate 3 remains `OPEN`. Earlier checkpoints below are historical and do not override this blocker.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Current P1–P5 sum to 2,090–3,400 source/test changed lines; P6 is UNSIZED. The superseded 1,810–3,040 estimate is historical only. Low confidence until bounded discovery closes the reachable inventory; not promised PR sizes. |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Candidate P1.1 pure capability map/tests → atomic P1.2+P1.3 resolver, four caller adaptations, and tests → P2/P3 one atomic migration target → P4 panel API/UI → P5 preflight → P6 closure evidence; reviewable slices required if oversized, with no PR or chain selected. |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

**Tasks state: `UNIT 1A REVIEW APPROVED — DELIVERY PENDING`; topology approval: `APPROVED`; recommended action: `HUMAN DELIVERY DECISION`; implementation authorization: `NONE`.** Repeated TRIANGULATE runs were semantically identical at 39/39, and two independent fresh security reviews found no candidate-caused HIGH/BLOCKER. Unit 1A is a reviewed candidate but remains uncommitted; commit, push, publication, Unit 1B, correction, migration, production, DB/runtime action, and automatic advance are not authorized. Unit 1B and Unit 2+ remain frozen; Unit 4 remains blocked.

The status paragraph above is the historical pre-delivery snapshot.

## Historical checkpoint — Unit 2 independent review pass

- Unit 1A remains `APPROVED + DELIVERED` at `91b1e80adc4d1005034c0af0657ec4da80750d1b`. Unit 1B remains independently reviewed and committed locally as `54a5c651b31b3e7da9b2ab4bd13d196d8a90dc76` (`feat(security): support remaining relation variants`), without push.
- Unit 2 is `IMPLEMENTED + INDEPENDENT REVIEW PASS + COMMITTED LOCALLY` at `9dd641130efad448add8c1ef07a534f970804d90` (`feat(security): validate relation scalar metadata`), parent `54a5c651b31b3e7da9b2ab4bd13d196d8a90dc76`. The human explicitly authorized this local commit only; the exact reviewed two-file diff matched before and after staging, the target worktree is clean, and no push occurred. Ordinary source-only review found no concrete candidate-caused correctness or security defect; it grants no native review receipt or further delivery permission. Historical review evidence predates this commit; this tracker update remains untracked and outside the source commit.
- Unit 2 preserves five mandatory own enumerable scalars without trimming, normalization, coercion, additional restrictions, or cross-field rules: nonempty primitive strings `schema`, `name`, and `owner`, plus primitive booleans `rlsEnabled` and `rlsForced`. Output contains only `kind`, validated `variant`, and those five exact scalars; opaque `content` is never inspected and is erased.
- Unit 1A/1B guards and stable errors remain unchanged. Invalid scalar uses generic `ERR_INVALID_SCALAR` / `Expected a valid relation scalar.`; missing scalar uses the existing missing-required failure. The exact two-file candidate is 134 source/test changed lines against `54a5c65`, below the >200 hard stop.
- This checkpoint supersedes earlier Unit 2 frozen, active, and pending-review status while preserving historical receipts and approved guards. Implementation authority is `NONE`; no correction, commit, push, delivery, Unit 3+, DB/runtime/migration/API/UI/network action, or automatic next phase is authorized. Gate 1 and Gate 2 remain `CLOSED`, Gate 3 remains `OPEN`, Unit 3+ remains frozen, and Unit 4 remains blocked on its three decisions.

## Non-negotiable implementation rules

- The only executable implementation scope is Unit 2 under the current checkpoint and its exact two-file, 200-line hard boundary. Unit 1A is delivered and frozen; Unit 1B is committed locally and frozen. Unit 3+, PR1A-1a-i-a-2, and PR1A-1a-i-b through PR1A-1a-i-d remain frozen. Read-only repository/Auth/callsite discovery remains assigned only to later PR1A-1b; read-only config and actual database/storage/GraphQL/role-topology discovery remains assigned only to later PR1A-1c; runtime attestation collection and verification remains assigned only to later PR1A-1d. Do not modify `package.json`, any `supabase/migrations/` file, runtime/API/UI/bootstrap code, historical Gate 1/Gate 2 artifacts, other OpenSpec artifacts, or production.
- Start `PR1A-1a-i-a-1a-r-A` clean at tracker `526f614be9cc1efc9269bc62996eaa85b3504be2`. Stopped `PR1A-1a-i-a-1a-r`, stopped `PR1A-1a-i-a-1a`, the stopped 319-line candidate, all other stopped candidates/workspaces/drafts, and their snapshots are non-authoritative prohibited inputs. Never read, inspect, patch, reset, delete, copy, diff against, commit, publish, branch from, or use them as implementation authority, input, base, parent, or equivalence oracle. Old code bytes are unavailable inputs and byte equality must not be claimed.
- Preserve the sole authority chain `auth UID -> usuario.supabase_uid -> empresa_id + rol`; never accept client `empresa_id`, email, host, cookie, slug, `membresia`, current-local observations, or row ownership as authority. In frozen PR1A-1a-i-a-2 and PR1A-1a-i-b through i-d, authority-related values remain only opaque fields in synthetic records; those children do not evaluate or establish authority.
- PRE success is only exact `PRE-MIGRATION` + exact `gate3-predecessor-v2` + clean applicability → `migration_required`/exit `0`. POST success is only exact `POST-MIGRATION` + exact `gate3-target-v2` → `pass`/exit `0`. Every other status is `blocked`/exit `3` or `unverifiable`/exit `4`.
- Use literal finite PRE/POST manifests and canonical SHA-256 values. Prohibit broad allowlists, wildcards, ignored counts, inventory truncation, OID/catalog-order-dependent identities, and learning expectations from the checked database or unsafe current local container.
- Build only disposable predecessor and target-safe fixtures. PR1A must not create or ship `supabase/migrations/20260904120000_multi_tenant_gate_3_panel_authorization.sql`; operational PRE/POST stays non-zero until PR2 supplies and seals its reviewed SHA-256.
- Every fallible inspection must preserve the outer read-only transaction with `\set ON_ERROR_ROLLBACK on`, immediately capture `ERROR`/`SQLSTATE`, and map uncertainty to `unverifiable`. Emit exactly one bounded JSON document, explicitly `ROLLBACK`, then use plain `\quit`; the wrapper alone maps report/transport state to OS exit `0|3|4`. No deliberate SQL error is an exit mechanism.
- Every subdivision unit starts only from its reviewed immediate parent: authorized `PR1A-1a-i-a-1a-r-A` from clean `526f614`; frozen `PR1A-1a-i-a-1a-r-B` only from freshly reviewed Unit 1A after separate authorization; `PR1A-1a-i-a-1b` from freshly reviewed Unit 1B; `PR1A-1a-i-a-1c` from reviewed Unit 2; `PR1A-1a-i-a-1d` from reviewed Unit 3 after its human decisions; and `PR1A-1a-i-a-1e` from reviewed Unit 4. Frozen PR1A-1a-i-a-2 and PR1A-1a-i-b through i-d retain only structural-validation and canonical-output results from focused synthetic tests; these children produce no real evidence receipt. For each separately authorized work unit, retain one evidence receipt with the exact RED assertion/result, GREEN result, TRIANGULATE result, final REFACTOR rerun, authored additions + deletions, and rollback boundary. Each sub-PR targets its immediate reviewed parent and includes its tests with the behavior.

## Corrective PR1 topology — approved six-unit clean subdivision and Unit 1A authority

**Human decision: the 28-unit topology remains `APPROVED`; Unit 1A is `REVIEW APPROVED — DELIVERY PENDING`; implementation authorization is `NONE`.** Semantic reruns were equivalent and fresh security review found no HIGH/BLOCKER. Unit 1B and Unit 2+ remain frozen. Earlier stopped Unit 1 candidates, `SELECTIVE-CLEAN-REPLAY`, and `PR1A-1a-i-a-1r` remain non-authoritative.

The stopped 319-line candidate may be cited only as non-normative current-state evidence that the former unit exceeded its review boundary. It is not reviewed authority, is not a valid parent, and must not be read, copied, or used as an implementation base or oracle.

```text
Gate 3 tracker — approved 28-implementation-PR topology; Unit 1A edge only executable
526f614
⇢ PR1A-1a-i-a-1a-r-A (REVIEW APPROVED; delivery pending; code frozen)
⇢ PR1A-1a-i-a-1a-r-B (FROZEN; Unit 1B; separate authorization required)
⇢ PR1A-1a-i-a-1b (FROZEN; Unit 2)
⇢ PR1A-1a-i-a-1c (FROZEN; Unit 3)
⇢ PR1A-1a-i-a-1d (FROZEN + BLOCKED; Unit 4)
⇢ PR1A-1a-i-a-1e (FROZEN; Unit 5)
⇢ PR1A-1a-i-a-2 (FROZEN) ⇢ PR1A-1a-i-b (FROZEN) ⇢ PR1A-1a-i-c (FROZEN)
⇢ PR1A-1a-i-d (FROZEN) ⇢ PR1A-1a-ii (FROZEN) ⇢ PR1A-1a-iii (FROZEN)
⇢ PR1A-1b (FROZEN) ⇢ PR1A-1c (FROZEN) ⇢ PR1A-1d (FROZEN)
⇢ PR1A-2 ⇢ PR1A-3 ⇢ PR1A-4 ⇢ PR1A-5 ⇢ PR1B ⇢ PR1C (all FROZEN)
⇢ PR2 ⇢ PR3 ⇢ PR4 ⇢ PR5 ⇢ PR6 ⇢ PR7 ⇢ PR8 (all FROZEN)
```

The stopped historical `PR1A-1a-i-a-1` was retired and replaced by five clean units, changing the earlier topology count from 23 to 27. This explicit re-slice replaces the stopped Unit 1 replacement slot with Unit 1A and Unit 1B, increasing the topology from 27 to 28 units. Only Unit 1A is executable. Unit 1B starts only from freshly reviewed Unit 1A after separate authorization; every later unit starts sequentially from its reviewed immediate parent and never from a stopped candidate.

### Approved authority boundary

`PR1A-1a-i-a-1a-r-A` may proceed without another apply decision from a new worktree at clean `526f614be9cc1efc9269bc62996eaa85b3504be2`. Its authority is consumed by the required fresh source review, after which work must stop. No correction after review, commit, push, publication, automatic advance to Unit 1B, migration, network/database discovery, runtime action, or production action is authorized. Unit 1B and Units 2–5 each require separate implementation authorization after their immediate parent is freshly reviewed; Unit 4 additionally requires the three recorded human decisions.

### Frozen later-scope canonical inventory — allocation context only

The registry below remains sizing and responsibility context for the approved subdivision and frozen later units. It is not authority to widen Unit 1A beyond its exact adversarial plain-record kernel, and it was not discovered from any real source:

- **Relations and attached behavior:** exact relation variants `table`, `partitioned_table`, `foreign_table`, `sequence`, `view`, and `materialized_view`; policy; rewrite; and trigger. Field families include qualified identity, relkind/variant, owner, columns/types/nullability/defaults, RLS/forced-RLS, view definition/options, policy command/roles/permissiveness/USING/WITH CHECK, rewrite event/action, trigger enabled/events/constraint binding/function/arguments, ACLs, and dependencies.
- **Callables and semantic signatures:** function, procedure, window function, and aggregate; type, domain, operator, and cast; directed dependency-edge records. Field families include ordered identity argument types/names/modes/defaults, result/language/kind/security/volatility/strictness/config/search path, untruncated definition, owner/ACL, aggregate transition/final/combine/serialization/moving-state/direct-argument/modifier/initial-state metadata, qualified signatures, cast/operator fields, and dependency kind/direction.
- **Integrity, access, and storage:** constraint, index, foreign key, and check variants; schema ACL, default ACL, object ACL, and grant; bucket and storage-path policy. Field families include exact relation/object identity, definition/predicate/expression, uniqueness, validity, deferrability, FK columns/target/match/update/delete actions, check validation, owner/grantor/grantee/privilege/grant option/provenance fields, private-bucket metadata, versioned path-policy identity, scoped count/hash, ordered path segments, and command sets. These fields represent observations only; they do not establish effective access.
- **Opaque operational, role, and attestation records:** ordered migration-history, static/config/Auth/source/callsite receipt, repository/file/version/extension anchor, PostgreSQL role, role-membership, role-setting, role-switch-default, claimed `SET ROLE` edge, and PostgREST attestation shapes. Field families include SHA-256/version/path/operation/source/boundary/consequence, role booleans/settings, membership grantor/options/sentinels, directed-edge claims, environment/project/source subject/release/freshness/nonce/audience/issuer/authentication/evidence hash, and claimed PostgREST values without secrets. Shape acceptance does not establish discovery, reachability, privilege, validity, freshness, or trust.
- **Cross-family normalization:** `identityArgumentTypes`, `argumentNames`, `pathSegments`, migration history, and `extraSearchPath` are ordered; only explicitly mathematical ACL/role/event/command/dependency/config sets are sorted. Every array is dense and element-valid. Synthetic observation order and finite synthetic `catalog` join metadata are non-semantic, and that metadata is discarded after validation. Unknown kind/variant/field/nested record and semantic OIDs fail closed.

### Reliability rejection record

| Alternative | Reliability result | Verdict |
| --- | --- | --- |
| Read, append to, copy, or branch from the stopped 319-line candidate | Uses prohibited non-normative evidence as authority or parent. | **Rejected.** |
| Publish the stopped candidate or resurrect `PR1A-1a-i-a-1r` | Blesses an incomplete, unreviewed lineage. | **Rejected.** |
| `SELECTIVE-CLEAN-REPLAY` | Preserves the failed oversized replay model rather than the approved clean subdivision. | **Abandoned/rejected.** |
| Unit 1A followed by frozen Unit 1B and the four later clean units from reviewed immediate parents | Gives the adversarial plain-record kernel and remaining variant/opacity matrix independent RED/GREEN/review and rollback boundaries, honestly increasing the topology to 28 units. | **Topology approved; `PR1A-1a-i-a-1a-r-A` only authorized.** |
| Commit, push, publish, or auto-advance after Unit 1A | Exceeds the current implementation authorization. | **Not authorized.** |

### Stopped candidates — non-authoritative prohibited inputs

Stopped `PR1A-1a-i-a-1a-r`, stopped `PR1A-1a-i-a-1a`, the stopped 319-line candidate, every other stopped candidate/workspace/draft, and their snapshots have no executable or normative role. Do not read, inspect, copy, diff, patch, reset, delete, commit, publish, branch from, or use them as implementation authority, input, base, parent, equivalence oracle, or source of old code bytes. Their only permitted reference is the fact that they were stopped and replaced.

## Authorized PR1A-1a-i-a-1a-r-A / Unit 1A — Adversarial plain-record kernel

**Authorization:** technical execution complete and fresh security review `APPROVED`; implementation authorization remains `NONE`. Unit 1A code/tests are frozen pending a separate human delivery decision. No correction, commit, push, publication, migration, production access, Unit 1B/later work, or automatic advance is authorized.

**Exact property:** accept only a plain own-data envelope with `kind: "relation"` and a plain own-data relation record with `variant: "table"` plus opaque `content`; emit only `{kind: "relation", variant: "table"}`. The other five formerly accepted variants—`partitioned_table`, `foreign_table`, `sequence`, `view`, and `materialized_view`—and every unknown variant reject fail-closed with the same exact unknown-variant code/message. Envelope and relation records may have only `Object.prototype` or `null` prototypes. Detect and reject a Proxy before any caller trap; reject arrays, `null`, non-records, custom prototypes, symbols, non-enumerable fields, accessors, unknown fields, missing fields, and unknown kinds. Reject semantic own or inherited relation-path `oid`, including temporary `Object.prototype.oid` pollution, without reading or invoking the inherited value. For every inspected record, complete exactly one `Reflect.ownKeys` snapshot and exactly one descriptor read for every discovered key before any validation or rejection; read each descriptor once, consume values only from the complete snapshot, and never reread caller discriminants. Use final validated `kind` and `variant` locals directly, with no intermediate wrapper-property rereads. Treat table `content` as opaque: a hostile Proxy or value with coercion/getter/trap hooks is never inspected and is erased.

**Exact stable failures to pin in RED:** Proxy `ERR_PROXY` / `Proxy values are not allowed.`; invalid record `ERR_INVALID_RECORD` / `Expected a plain record.`; invalid field, accessor, symbol, non-enumerable field, or semantic own/inherited relation-path `oid` `ERR_INVALID_FIELD` / `Expected an enumerable data field.`; unknown string field `ERR_UNKNOWN_FIELD` / `Unknown field.`; missing field `ERR_MISSING_FIELD` / `Missing required field.`; unknown kind `ERR_UNKNOWN_KIND` / `Unknown kind.`; unknown variant—including all five deferred known variants—`ERR_UNKNOWN_VARIANT` / `Unknown relation variant.` Every error is finite, bounded, sentinel-free, non-secret, and must not echo a key, value, symbol description, variant, or caller-controlled text.

**Exact files:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs` only; no third file.

**Inputs:** this approved property and synthetic in-memory values only. All stopped candidates, workspaces, drafts, snapshots, and old code bytes—including stopped `PR1A-1a-i-a-1a-r`—are prohibited inputs and may not be read or used.

**Estimate:** implementation 60–75 and tests 180–225 authored additions + deletions; total forecast 240–300; **hard stop: >330**. Stop rather than pack tests, compress the property, widen scope, or seek an exception.

**Explicit exclusions:** Unit 1B's five additional accepted variants and full six-case opacity matrix; Unit 2 scalar fields; Unit 3 columns; Unit 4 sets/catalog/observation order; Unit 5 payload semantics; PR1A-1a-i-a-2 and later work; DB/runtime/discovery/migration/API/UI. Unit 1B and every later unit remain frozen; Unit 4 remains decision-blocked.

- [x] **RED / BOOTSTRAP:** In the exact two files, create only an importable permissive shell with no shared guard or implemented validation. First prove valid `table` and its opaque hostile `content` pass. Then add independently named natural-RED cases for own and inherited relation-path `oid`, including temporary `Object.prototype.oid` pollution with an inherited getter/value that is never read or invoked (**R1-031**); complete descriptor snapshot of every discovered key before unknown/invalid rejection, exactly one `Reflect.ownKeys` per inspected record, and exactly one descriptor read per key (**R1-032**); hostile Proxy/coercive/getter/trap-bearing table `content` that is never inspected and is erased (**R1-034**); Proxy envelope/relation rejection before any caller trap (**R1-035**); and every pinned stable bounded sentinel-free error category (**R1-036**). Cover envelope and relation arrays, `null`, non-records, custom prototypes, symbols, non-enumerable fields, accessors, unknown fields, missing fields, unknown kind, all five deferred variants, and unknown variants. Pin every exact code/message listed above with secret and control-character sentinels. Invalid RED cases must fail because the shell accepts them or invokes a prohibited hook, never because import/export is missing or a shared guard pre-rejects them. Run only `node --test scripts/panel-authorization-canonical.test.mjs`; retain exact natural-RED assertion/results and keep tests within 180–225 authored lines. <!-- sdd-owner: implementation -->
- [x] **GREEN:** In `scripts/lib/panel-authorization-canonical.mjs`, implement only the Unit 1A kernel in 60–75 authored lines. Detect Proxy before any caller trap; fully snapshot each non-Proxy record with one own-key pass and one descriptor read for every discovered key before validation; validate only snapshot descriptors/values; permit only Object/null prototypes and own enumerable data fields; reject inherited/own semantic relation `oid` without reading inherited values; cache final discriminants in locals; accept only `relation`/`table`; erase `content`; and return only `{kind: "relation", variant: "table"}`. Emit only the pinned bounded failures, with all five deferred variants sharing unknown-variant behavior. Do not add Unit 1B or any reusable cross-family engine. Rerun the focused command and retain the exact GREEN result. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Independently vary Object/null prototypes, key order, rejection position, descriptor shape, own/inherited OID, all five deferred and unknown variants, and secret/control sentinels. Prove R1-031, R1-032, R1-034, R1-035, and R1-036 with trap/call-count fixtures; prove every discovered descriptor is read once even when an earlier key guarantees rejection; prove values come from the snapshot and caller discriminants are never reread. Run the focused test repeatedly in the same environment and require the same test identities, pass/fail counts, assertions, outputs, and security semantics; timing and TAP serialization hashes need not match. Stop on non-determinism, any third-file change, any excluded behavior, or line growth that risks the hard stop. <!-- sdd-owner: implementation -->
- [x] **REFACTOR / FRESH-REVIEW STOP:** Refactor only for readability without packing named tests or expanding scope. Close **R1-033** only through readable implementation structure plus fresh source review; do not add brittle source-text tests. Rerun the focused suite; run `git diff --check` for tracked changes and the exact applicable `git diff --no-index --check /dev/null <authorized-path>` check for each untracked authorized file; verify exact paths and exact line/whitespace results; count authored additions + deletions against `526f614`, including untracked files; and stop immediately above 330. Hand the clean-base attestation, exact two-file diff, R1-031/R1-032/R1-034/R1-035/R1-036 evidence, R1-033 source-review result, RED/GREEN results, deterministic reruns, trap/descriptor/discriminant counts, whitespace results, implementation/test/total line counts, exclusions, and rollback boundary to fresh review. Fresh review consumes authority: STOP without correction, commit, push, publication, or Unit 1B work. <!-- sdd-owner: implementation -->

**Exact verification:** only `relation`/`table` accepts and emits only the two discriminants; five deferred and all unknown variants share the pinned unknown-variant failure; every named record/descriptor/field/OID adversary rejects with its pinned bounded sentinel-free failure; Proxy is rejected before caller traps; snapshots are complete and single-read; values are consumed from snapshots; discriminants are not reread; hostile table content is untouched and erased; focused reruns are deterministic; exact path/line/whitespace checks pass; implementation is 60–75 lines, tests are 180–225 lines, and total authored change is 240–300 with a hard stop above 330.

**Rollback/no-PROD boundary:** discard only uncommitted `PR1A-1a-i-a-1a-r-A` changes in the two canonical files and remove only its new clean worktree if directed. Leave tracker `526f614` and every stopped candidate/workspace untouched. No test beyond the focused synthetic command, DB/runtime/discovery/migration/API/UI action, network, production, commit, push, or publication is permitted.

## Authorized PR1A-1a-i-a-1a-r-B / Unit 1B — Remaining relation variants and hostile opacity matrix

**Authorization:** completed implementation and ordinary independent-review cycle; code frozen, uncommitted, and undelivered. Implementation authority is `NONE`; no further correction, native review claim, delivery, Unit 2 advance, commit, or push is authorized.

**Exact property:** starting from the freshly reviewed Unit 1A kernel, add acceptance only for `partitioned_table`, `foreign_table`, `sequence`, `view`, and `materialized_view`, while preserving `table`. Exercise exactly six hostile opacity/erasure cases, one per accepted variant. Preserve Unit 1A's plain-record, Proxy-before-trap, complete-snapshot, semantic-OID, discriminant-local, stable-error, and fail-closed unknown-variant contracts unchanged.

**Depends on:** completed GREEN and fresh source review of `PR1A-1a-i-a-1a-r-A`, followed by separate explicit implementation authorization.  
**Starts from:** freshly reviewed Unit 1A, never stopped `PR1A-1a-i-a-1a-r` or any other stopped candidate.  
**Exact files/inputs:** the same two canonical module/test files; synthetic in-memory inputs only.  
**Estimate:** approximately 50 authored additions + deletions across the exact two files; **hard stop: >100** against delivered Unit 1A commit `91b1e80`.

- [x] **RED:** Add independently named natural-RED acceptance for the five remaining variants and exactly six hostile opacity/erasure cases, one for each accepted variant; unknown variants must retain the exact Unit 1A failure. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Add only the five variant literals to reviewed dispatch while leaving every Unit 1A adversarial guard and output shape unchanged. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE / REFACTOR / FRESH REVIEW:** Prior execution varied each variant and hostile content independently, passed 44/44 twice plus final 44/44 verification, and completed exact path/line/whitespace checks. A separate ordinary read-only `gentle-ai-verify` review inspected the unchanged exact diff and base source/tests and returned `PASS` without rerunning tests; this is not native approval, delivery authority, or Unit 2 authority. <!-- sdd-owner: implementation -->

**Exact verification:** all six variants accept; exactly six hostile content cases are never inspected and are erased; unknown variants remain fail-closed with the pinned error; every Unit 1A adversarial regression remains green.

**Rollback/no-PROD boundary:** revert only uncommitted Unit 1B changes in the same two files, preserving freshly reviewed Unit 1A. No Unit 2+, DB/runtime/discovery/migration/API/UI, network, production, commit, push, or publication action.

## Authorized PR1A-1a-i-a-1b / Unit 2 — Independent scalar metadata validation

**Authorization:** Unit 2 is `IMPLEMENTED + INDEPENDENT REVIEW PASS`, code-frozen, uncommitted, and undelivered. Implementation authority is `NONE`; this ordinary source-only review grants no native approval, correction, commit, push, delivery, or Unit 3+ authority.

**Exact property:** independently validate `schema`, `name`, `owner`, `rlsEnabled`, and `rlsForced` for every accepted relation envelope without adding column, set, catalog, or variant-payload semantics. All five are mandatory own enumerable data fields. Strings must be primitive and nonempty but are otherwise retained exactly; booleans must be primitive. `content` stays opaque and is erased. Output is a new plain record with only `kind`, validated `variant`, and the five validated scalars. Invalid scalar uses only `ERR_INVALID_SCALAR` / `Expected a valid relation scalar.`

**Forecast:** honest pre-edit forecast 130–180 authored additions + deletions; **hard stop: >200**.  
**Depends on / starts from:** independently reviewed, locally committed Unit 1B `54a5c651b31b3e7da9b2ab4bd13d196d8a90dc76`, never Unit 1A directly or a stopped candidate.  
**Exact files/inputs:** the same two canonical module/test files; synthetic in-memory inputs only.

- [x] **RED:** Added independently named natural failures for valid enriched retention, then each scalar's missing and invalid forms, without column/set/catalog/payload assertions. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Incrementally admitted/retained the five descriptors, then added only the five scalar validators required by the RED cases. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE / REFACTOR:** Varied exact strings and all boolean combinations independently, preserved every prior guard and exactly six content-opacity cases, reran the focused suite deterministically, completed exact path/line/whitespace checks, counted 134 changed lines against Unit 1B, and stopped for independent review. REFACTOR was inspection-only. <!-- sdd-owner: implementation -->

## Authorized PR1A-1a-i-a-1c / Unit 3 — Ordered columns and dense/element-valid array integrity

**Authorization:** the human explicitly approved raising the Unit 3 source/test ceiling from 250 to 350 for the same complete contract, strict TDD, and independent review from committed Unit 2 `9dd641130efad448add8c1ef07a534f970804d90`. No commit/push or automatic advance. This human approval does not override native authority: acquire rejected 350 on the unchanged 250-line objective, so implementation remains blocked.

**Exact property:** every accepted relation has a mandatory own enumerable data `columns` field beside `variant`, opaque `content`, and the five Unit 2 scalars. It is an actual dense Array-prototype/null-prototype array, including empty, whose own keys/descriptors are captured completely before validation; every index is an own enumerable data property, with no inherited filling, accessor, custom prototype, Proxy trap, hostile sparse-length scan/allocation, iterator, or caller reread. Output contains a new ordered copied `columns` array and new copied elements; input and `content` remain untouched, and `content` is erased.

Each column is an Object/null-prototype plain own-enumerable-data record with exactly `name`, `type`, `nullable`, and `defaultExpression`. `name` and `type` are primitive nonempty strings retained exactly; `nullable` is a primitive boolean; `defaultExpression` is a primitive string, including empty, or `null`, retained without SQL or semantic policy. Duplicate names reject by exact validated-string equality only; case/space differences remain distinct. No extras, normalization, sorting, deduplication, identifier parsing, length caps, variant/type/default/nullability policy, sets, catalog behavior, or variant payload semantics are authorized. Existing record/OID/descriptor/error guards remain; fixed generic column-array, column-value, and duplicate failures may be added.

**Forecast:** retained 141 + incremental implementation 42–58 + tests 105–130 = 288–329 authored additions/deletions against Unit 2; human-approved ceiling 350 with correction headroom. Documentation is separate. The native objective remains capped at 250 and does not authorize this plan. The earlier 200–240 forecast was insufficient.  
**Depends on / starts from:** reviewed and locally committed Unit 2 `9dd641130efad448add8c1ef07a534f970804d90`, never a stopped candidate.  
**Exact files/inputs:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs`; synthetic in-memory inputs only. Original `tasks.md` and cumulative `apply-progress.md` record metadata separately.

- [ ] **RED:** Add incremental natural failures for enriched retention, missing columns, dense safe array structure, exact column records/scalars, duplicate names, copying, and independent order/hole/element variations. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Add only snapshot-driven ordered-column canonicalization and the dense/element-valid/copy/duplicate guards proven by those RED stages. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE / REFACTOR; REVIEW PENDING:** Exercise order, empty arrays, hole positions, inherited indices, zero-trap Proxies/hooks, exact primitive retention/duplicate identity, copy/no-mutation, and descriptor consumption; repeat the focused suite twice, check exact paths/whitespace/count/hash, and stop for independent review. <!-- sdd-owner: implementation -->

**Historical Unit 3 apply stop, before the later 350-line approval and native refusal:** the inherited partial candidate remains exactly 141 source/test changed lines. One honest completion pass reached 266 lines while retaining readable element-validation, copy, duplicate, Proxy, null-prototype, exact-distinction, and snapshot-consumption tests, exceeding the 250 hard stop. Those execution edits were fully reverted to the inherited partial hashes; all three Unit 3 rows remain unchecked. No `size:exception` is authorized. Parent resolution is required to recut Unit 3 into a dense-array structural slice followed by an element/copy/duplicate slice, or to provide another explicit delivery decision.

## Blocked PR1A-1a-i-a-1d / Unit 4 — Set-valued metadata and catalog boundary

**Authorization:** topology approved; implementation frozen, unauthorized, and explicitly `BLOCKED`. No implementation authorization can be inferred from this topology or any predecessor approval.

**Exact property:** set-valued metadata normalization and the finite synthetic catalog validation/discard boundary.

**Estimate:** 170–240 authored additions + deletions; **hard stop: >300**.  
**Depends on:** completed GREEN and fresh review of `PR1A-1a-i-a-1c`, resolution of all three human decisions below, a Tasks recut recording those decisions, and separate explicit implementation authorization.  
**Starts from:** the reviewed Unit 3 parent, never the stopped candidate.  
**Exact files/inputs:** the same two canonical module/test files; synthetic in-memory inputs only.

**Human decisions required before any RED or implementation:**

1. Exact set deduplication behavior.
2. Exact locale-independent canonical ordering rule.
3. Exact scope of observation-order invariance.

No RED/GREEN/TRIANGULATE/REFACTOR task is executable while any decision remains unresolved.

## Frozen PR1A-1a-i-a-1e / Unit 5 — Foreign/view/materialized variant-specific payload semantics

**Authorization:** topology approved; implementation frozen and unauthorized.

**Exact property:** validate and retain the assigned foreign-table, view, and materialized-view variant-specific payload semantics after the envelope, scalar, column, set, and catalog boundaries are reviewed.

**Estimate:** 100–160 authored additions + deletions; **hard stop: >220**.  
**Depends on:** completed GREEN and fresh review of `PR1A-1a-i-a-1d` after its decision block is resolved, followed by separate explicit implementation authorization.  
**Starts from:** the reviewed Unit 4 parent, never the stopped candidate.  
**Exact files/inputs:** the same two canonical module/test files; synthetic in-memory inputs only.

- [ ] **RED (frozen):** After separate authorization, add independently named acceptance, rejection, and semantic-mutation tests for each assigned foreign/view/materialized payload path. <!-- sdd-owner: implementation -->
- [ ] **GREEN (frozen):** Add only the three assigned variant-payload semantics without attached behavior or later schema families. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE / REFACTOR (frozen):** Mutate each assigned payload field independently, rerun deterministically, check the diff, count against reviewed Unit 4, and stop above 220 for fresh review. <!-- sdd-owner: implementation -->

## Rejected PR1A-1a-i-a-1r — audit evidence only

**Verdict:** `REJECTED`; not approved; not implementable; no executable tasks, chain target, or rollback unit. `SELECTIVE-CLEAN-REPLAY` remains abandoned/rejected and must not be recreated.

## Proposed PR1A-1a-i-a-2 / Work unit 1A-1a-i-a-2 — Policy, rewrite, and trigger schemas

**Authorization:** topology retained; implementation frozen and unauthorized. Unit 1A authorization does not extend to this unit.  
**Exact property:** Using the reviewed exact-schema engine, synthetic in-memory `policy`, `rewrite`, and `trigger` records accept exactly their Design-required relation identity, name, command/event, roles/permissiveness/USING/WITH CHECK, rewrite action, trigger enabled/events/constraint binding/function/ordered arguments, ACL/dependency sets, and finite catalog metadata. Unknown kind/field/nested field, semantic OIDs, malformed values, and sparse arrays fail closed; only declared roles/ACL/events/dependencies normalize as sets; trigger arguments stay ordered; finite catalog metadata is removed and non-semantic.  
**Decisive independent falsifier:** changing only `policy.withCheck` while `policy.using` remains fixed MUST change the normalized representation; this catches collapsed or ignored policy predicates independently of acceptance.  
**Minimum evidence assignment:** one independently named acceptance case for each owned variant (`policy`, `rewrite`, `trigger`); one named case each for policy `relation/roles/acl/dependencies/catalog`, rewrite `relation/dependencies/catalog`, and trigger `relation/events/arguments/dependencies/catalog` paths plus their scalar semantic fields. The reviewed engine-contract suite is reused unchanged; each newly owned array/path gets one representative malformed-or-semantic case, not a repeated start/middle/end × type × variant cross-product.  
**Estimate:** 160–200 authored additions + deletions; **unit hard stop: >270** (70 lines above forecast high; 130 below 400).  
**Why no semantic packing:** attached policy/rewrite/trigger behavior is one coherent family layered on the reviewed engine; tests stay separately named and do not absorb callable or later families.  
**Owns:** attached-behavior completion of R1-016/R1-018 and its portion of R1-017/R1-019; broader closure remains open through PR1A-1a-i-d.  
**Depends on:** completed GREEN and fresh review of `PR1A-1a-i-a-1e` (and therefore Unit 1A, Unit 1B, and Units 2–5), plus separate execution authorization. The stopped candidate and rejected `PR1A-1a-i-a-1r` cannot satisfy this dependency.  
**Chain target:** `PR1A-1a-i-a-1e` branch after that immediate parent is reviewed; no edge is executable while this unit remains frozen.  
**Exact files:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs` only.  
**Inputs/evidence:** synthetic in-memory observations and focused structural/canonical output only; no repository/config/catalog/runtime read and no real evidence receipt.  
**Explicitly outside:** relation-engine changes except a defect exposed by this owned family; callable; integrity/access/storage; opaque operational/role/attestation records; stable identity/digest/bounded output; discovery/closure/reachability/effective privilege/capability/trust; migrations, production, commits, pushes, and all stopped-workspace actions.

- [ ] **RED (frozen historical scope):** After separate execution authorization on reviewed immediate parent `PR1A-1a-i-a-1e`, add only one direct, independently named test, `policy retains WITH CHECK independently from USING`, with a valid policy fixture and no import guard. Run `node --test scripts/panel-authorization-canonical.test.mjs` once; retain the exact unsupported-`policy` or missing-policy-schema failure, which is unique to this child. This checkbox grants no current authority. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Add only the readable `policy` declaration needed to pass that RED through the reviewed engine; preserve `using` and `withCheck` as distinct semantic fields and do not add rewrite/trigger yet. Rerun the exact RED command and retain the GREEN result. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add the rewrite, trigger, assigned-path, discriminant, order/set, finite-metadata, sparse/malformed, unknown-field, and semantic-OID cases one independently named case at a time, taking each failure through minimal GREEN before proceeding. Include the independent `withCheck` falsifier and one semantic mutation for every other assigned scalar/path, but do not repeat the reusable engine cross-product. Run the focused command twice and require byte-identical timing-normalized results. Runtime harness: `N/A`—pure synthetic in-memory validation with no repository, config, database, or process boundary. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Share only reviewed engine primitives, keep policy/rewrite/trigger declarations and falsifiers readable, and do not pack table rows or assertions. Rerun the focused test, `git diff --check`, and immediate-parent `git diff --numstat`; stop at >270 authored lines and return to Tasks. <!-- sdd-owner: implementation -->

**Exact verification:** all three attached variants and every assigned path appear exactly once in the named evidence map; the inherited engine suite remains green; the independent `withCheck` mutation differs; malformed/sparse/non-finite/OID/unknown cases reject; deterministic focused tests exit `0`; diff is clean; authored count is ≤270.  
**Rollback/no-PROD boundary:** revert only PR1A-1a-i-a-2 changes in the two canonicalization files; reviewed immediate parent `PR1A-1a-i-a-1e` remains intact. No database, production, migration, fixture, manifest, source callsite, commit, push, or stopped-workspace action.

## Proposed PR1A-1a-i-b / Work unit 1A-1a-i-b — Callable and semantic-signature schemas

**Authorization:** pending human approval; implementation authorization NONE.  
**Exact property:** Synthetic in-memory function, procedure, window-function, aggregate, type, domain, operator, cast, and directed dependency records accept exactly the Design-required signature, behavior, owner/config/ACL, definition, and dependency fields. Positional arguments, defaults, modes, and `extraSearchPath` retain order; only declared ACL/dependency/config sets normalize permutation; aggregate metadata is complete and no raw OID becomes semantic.  
**Estimate:** 225–270 authored additions + deletions; **unit hard stop: >320** (50 lines above forecast high; 80 below 400).  
**Why no semantic packing:** callable/signature representation and directed dependency-edge representation form one reviewable schema-family boundary; relation, integrity/access/storage, opaque operational/role/attestation records, identity, and output do not enter this child.  
**Owns:** the callable/signature/dependency portion of R1-017/R1-019 and R1-012/R1-013 for these paths.  
**Depends on:** completed GREEN and fresh review of PR1A-1a-i-a-2 (and therefore `PR1A-1a-i-a-1a-r-A` → `PR1A-1a-i-a-1a-r-B` → `PR1A-1a-i-a-1b` → `PR1A-1a-i-a-1c` → `PR1A-1a-i-a-1d` → `PR1A-1a-i-a-1e`) plus separate authorization.  
**Chain target:** PR1A-1a-i-a-2 branch; diagram marks `PR1A-1a-i-a-1e → PR1A-1a-i-a-2 → PR1A-1a-i-b 📍 → PR1A-1a-i-c → PR1A-1a-i-d`.  
**Exact files:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs` only.  
**Inputs:** synthetic in-memory observations only.  
**Evidence:** structural validation and deterministic canonical output from focused tests only; no real evidence receipt.  
**Out of scope:** effective discovery; repository/config/callsite/catalog reads; real database/storage/GraphQL topology collection; graph closure or reachability; effective privileges or effective `SET ROLE`; capabilities; and runtime attestation collection or trust/issuer/audience/freshness/nonce/replay/cryptographic/operational verification. Future role, membership, `SET ROLE` edge, receipt, and attestation shapes are allowed only as opaque synthetic records whose truth is not established.

- [ ] **RED:** Add one independently named failing subtest for each callable/signature variant and every nested array/record path, including procedure/window acceptance, complete aggregate metadata, dependency-edge direction/kind representation, argument/default/mode/search-path ordering, set permutations, sparse arrays, unknown nested fields, and semantic OIDs. Run `node --test scripts/panel-authorization-canonical.test.mjs` once and retain the first exact structural failure.
- [ ] **GREEN:** Extend the existing declarative registry only with these classes and variants. Encode ordered versus set normalization per path and exact variant-specific required/optional fields; reject incomplete aggregate/signature records and unknown routine kinds. Do not implement integrity/access/storage, opaque operational/role/attestation shapes, framed identity, digest, or public output. Rerun the exact RED command to GREEN and retain the result.
- [ ] **TRIANGULATE:** Swap each positional signature/search-path field and require normalized inequality; permute each declared ACL/dependency set and require normalized equality; vary security mode, volatility, config, definition tail, aggregate transition/final/combine/serialization/moving-state fields, cast context, operator signature, and dependency-edge direction one at a time and require normalized inequality. Inject start/middle/end holes and malformed elements at every array path. Run the focused command twice and require byte-identical timing-normalized results. Runtime harness: `N/A`—pure validation of in-memory inputs with no repository, config, database, or process boundary.
- [ ] **REFACTOR:** Share readable signature fragments without a global field-name classifier or compressed variant rows. Rerun `node --test scripts/panel-authorization-canonical.test.mjs`, `git diff --check`, and immediate-parent `git diff --numstat`. Stop at >320 lines and return to Tasks.

**Exact verification:** every listed variant/path has an independent passing test; ordered/set normalization is exact; holes/OIDs/unknowns fail; late definition changes alter normalized representation; deterministic tests exit `0`; diff is clean; authored count ≤320.  
**Rollback/no-PROD boundary:** revert only PR1A-1a-i-b changes in the two canonicalization files; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b through PR1A-1a-i-a-1e, and PR1A-1a-i-a-2 remain intact. No database, production, migration, fixture, manifest, commit, push, or stopped-workspace action.

## Proposed PR1A-1a-i-c / Work unit 1A-1a-i-c — Integrity, access, and storage schemas

**Authorization:** pending human approval; implementation authorization NONE.  
**Exact property:** Synthetic in-memory constraint/index/FK/check, schema/default/object ACL/grant, bucket, and storage-path records accept exactly their Design-required fields. Validation/deferrability, FK columns/target/match/update/delete actions, predicates/expressions, owner/grant provenance/options, bucket privacy, scoped count/hash, and path-policy fields all affect normalized representation; ACL/privilege/command sets are order-independent while FK column pairs and storage path segments remain ordered.  
**Estimate:** 215–260 authored additions + deletions; **unit hard stop: >310** (50 lines above forecast high; 90 below 400).  
**Why no semantic packing:** these classes form one structural integrity/access/storage representation family. This child does not answer graph reachability or effective database/storage privileges; opaque receipts, roles, attestations, identity, and output remain excluded.  
**Owns:** the integrity/access/storage portion of R1-017/R1-019 and R1-012/R1-013 for these paths.  
**Depends on:** completed GREEN and fresh review of PR1A-1a-i-b plus separate authorization.  
**Chain target:** PR1A-1a-i-b branch; diagram marks `PR1A-1a-i-b → PR1A-1a-i-c 📍 → PR1A-1a-i-d → PR1A-1a-ii`.  
**Exact files:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs` only.  
**Inputs:** synthetic in-memory observations only.  
**Evidence:** structural validation and deterministic canonical output from focused tests only; no real evidence receipt.  
**Out of scope:** effective discovery; repository/config/callsite/catalog reads; real database/storage/GraphQL topology collection; graph closure or reachability; effective privileges or effective `SET ROLE`; capabilities; and runtime attestation collection or trust/issuer/audience/freshness/nonce/replay/cryptographic/operational verification. Future role, membership, `SET ROLE` edge, receipt, and attestation shapes are allowed only as opaque synthetic records whose truth is not established.

- [ ] **RED:** Add one named failing subtest per constraint/index/FK/check and schema/default-ACL/ACL/grant/bucket/storage variant and nested path. Cover exact FK actions, validity/deferrability, index predicate/expression, grantor/grantee/options/provenance fields, private-bucket fields, scoped count/hash without object names, ordered path segments, set commands, sparse arrays, unknown nested fields, and semantic OIDs. Run `node --test scripts/panel-authorization-canonical.test.mjs` once and retain the first exact structural failure.
- [ ] **GREEN:** Add only these exact schemas and field rules to the reviewed engine. Require dense arrays and complete paired FK/path structures; normalize ACL/grant/command sets deterministically; retain ordered FK/path fields; reject unbounded storage object details and unknown access metadata. Do not add receipts/roles/attestation or identity/output behavior. Rerun the exact RED command to GREEN and retain the result.
- [ ] **TRIANGULATE:** Mutate each FK action, validation/deferrability bit, predicate/check expression, owner/grant provenance field, bucket privacy/count/hash field, and path segment independently and require normalized inequality. Permute only mathematical sets and require normalized equality. Inject malformed values and start/middle/end holes at every array path and require rejection. Run the focused command twice and require byte-identical timing-normalized results. Runtime harness: `N/A`—pure validation of in-memory inputs with no repository, config, database, or process boundary.
- [ ] **REFACTOR:** Reuse explicit integrity/access fragments without merging distinct variants or packing falsifiers. Rerun the focused test, `git diff --check`, and immediate-parent `git diff --numstat`. Stop at >310 lines and return to Tasks.

**Exact verification:** all variants/fields have named tests; distinct FK and storage-path representations cannot collapse; set permutations match; ordered changes differ; malformed/sparse/OID cases reject; focused deterministic tests exit `0`; diff is clean; authored count ≤310.  
**Rollback/no-PROD boundary:** revert only PR1A-1a-i-c changes in the two canonicalization files; i-a/i-b remain intact. No database, production, migration, fixture, manifest, commit, push, or stopped-workspace action.

## Proposed PR1A-1a-i-d / Work unit 1A-1a-i-d — Opaque operational, role, and attestation schemas with exhaustive completeness

**Authorization:** pending human approval; implementation authorization NONE.  
**Exact property:** Synthetic in-memory migration/history, static/config/Auth/source/callsite receipt, repository/file/version/extension anchor, PostgreSQL role/membership/setting/role-switch-default/claimed `SET ROLE` edge, and PostgREST attestation records accept exactly the Design fields and no secret-bearing alternatives. Roles, memberships, role settings, `SET ROLE` edges, receipts, and attestations are opaque shapes only: normalization does not discover them or establish their truth, reachability, effective privileges, validity, freshness, or trust. Across the complete declarative registry, every declared kind/variant/nested path has independent acceptance, missing/type/extra/OID/sparse-array coverage, and exact ordered/set normalization; no Design-required shape is absent.  
**Estimate:** 230–275 authored additions + deletions; **unit hard stop: >325** (50 lines above forecast high; 75 below 400).  
**Why no semantic packing:** this child owns the remaining opaque operational/role/attestation schema family and the independent structural-completeness proof; it does not absorb framed identity or bounded output, and every proof case remains separately named.  
**Owns:** final schema/normalization closure of R1-012, R1-013, R1-016, R1-017, R1-018, R1-019, and the schema/order portion of R1-009. R1-009 identity/output remains open through PR1A-1a-ii/iii.  
**Depends on:** completed GREEN and fresh review of PR1A-1a-i-c plus separate authorization.  
**Chain target:** PR1A-1a-i-c branch; diagram marks `PR1A-1a-i-c → PR1A-1a-i-d 📍 → PR1A-1a-ii → PR1A-1a-iii`.  
**Exact files:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs` only.  
**Inputs:** synthetic in-memory observations only.  
**Evidence:** structural validation and deterministic canonical output from focused tests only; no real evidence receipt.  
**Out of scope:** effective discovery; repository/config/callsite/catalog reads; real database/storage/GraphQL topology collection; graph closure or reachability; effective privileges or effective `SET ROLE`; capabilities; and runtime attestation collection or trust/issuer/audience/freshness/nonce/replay/cryptographic/operational verification. Role, membership, `SET ROLE` edge, receipt, and attestation shapes are allowed only as opaque synthetic records whose truth is not established.

- [ ] **RED:** Add one named failing subtest per opaque operational/role/attestation variant and path, then a registry-completeness matrix enumerating every Design class/variant and every array path exactly once. Cover ordered history and receipt-identity fields, role booleans/setting fields, PostgreSQL-major option sentinel, membership/claimed-`SET ROLE` edge direction, attestation environment/project/source/release/freshness/nonce/audience/issuer/authentication/claimed-value/evidence-hash fields, prohibited secret fields, all sparse-array positions, and the full ordered/set list. Assert only structural acceptance/rejection and canonical retention. Run `node --test scripts/panel-authorization-canonical.test.mjs` once and retain the first exact structural failure.
- [ ] **GREEN:** Add only opaque operational/role/attestation schemas and make the complete registry satisfy the explicit completeness matrix. Preserve ordered history and directed-edge representation; normalize only declared setting/role sets; reject unknown authentication/evidence fields, secret/token/password/URL credential fields, semantic OIDs, sparse arrays, and omitted Design variants. Do not compute role closure, effective `SET ROLE`, effective privileges, capabilities, attestation validity, trust, freshness, or framed identity/digest/bounded public output reserved for later units. Rerun the exact RED command to GREEN and retain the result.
- [ ] **TRIANGULATE:** Independently mutate every role boolean/setting/membership option/grantor/sentinel/claimed-`SET ROLE` direction and every attestation metadata field, including fields named trust/freshness/config; swap history, source, and search-path order; permute declared sets; add secret-like/unknown fields; create start/middle/end holes at every array path. Run the focused command twice; require byte-identical timing-normalized results for input/synthetic-metadata reorder and require each declared field mutation to differ or reject as specified. These mutations prove semantic retention only, never validity or trust. Runtime harness: `N/A`—pure validation of in-memory inputs with no repository, config, database, runtime-attestation, or process boundary.
- [ ] **REFACTOR:** Keep the completeness inventory test-readable and one assertion/falsifier purpose per named subtest; helper loops may generate named subtests but may not collapse test coverage into packed rows. Rerun `node --test scripts/panel-authorization-canonical.test.mjs`, `git diff --check`, and immediate-parent `git diff --numstat`. Stop at >325 lines and return to Tasks.

**Exact verification:** the completeness matrix has no missing/duplicate class, variant, or array path; each independent test passes; all malformed/sparse/secret/OID cases fail; ordered/set/synthetic-metadata/input normalization matches the Design; repeated structural/canonical output is deterministic; no test claims discovery, effective access, attestation validity, or trust; diff is clean; authored count ≤325.  
**Rollback/no-PROD boundary:** revert only PR1A-1a-i-d changes in the two canonicalization files; i-a/i-b/i-c remain intact. No database, production, migration, fixture, manifest, source callsite, commit, push, or stopped-workspace action.

## Proposed PR1A-1a-ii / Work unit 1A-1a-ii — Framed Unicode canonical identity

**Authorization:** proposed only; pending human approval and explicitly unauthorized.  
**Exact property:** Each accepted observation derives its identity from a kind-tagged, length-framed tuple of NFC-normalized semantic identifier components with deterministic PostgreSQL identifier quoting; distinct tuples cannot collide through `.`, `:`, `->`, commas, quotes, or qualification boundaries, canonically equivalent Unicode composes identically, and all untruncated UTF-8 semantic bytes affect the node digest without trusting caller keys, OIDs, or catalog order.  
**Estimate:** 140–200 authored additions + deletions.  
**Owns:** R1-014 and the stable-key/complete-byte identity portion of R1-009. R1-009 remains open until PR1A-1a-iii.  
**Depends on:** completed, GREEN, freshly reviewed PR1A-1a-i-d (and therefore i-a → i-b → i-c) plus separate execution approval.  
**Chain target:** PR1A-1a-i-d branch; proposed PR body diagram marks `PR1A-1a-i-c → PR1A-1a-i-d → PR1A-1a-ii 📍 → PR1A-1a-iii → PR1A-1b`.  
**Starts at:** reviewed exact semantic schemas/order rules without a stable identity layer.  
**Ends with:** collision-safe per-observation identity preimages and digests; collection/result exposure and output bounds remain out of scope.  
**Exact files:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs` only.

- [ ] **RED:** Add failing collision pairs such as schema/name tuples `("a.b","c")` versus `("a","b.c")`, identifiers containing current delimiters/arrows/commas/quotes, quoted/case-sensitive PostgreSQL names, and NFC versus NFD spellings. Add spoofed-key, duplicate normalized identity, raw/nested OID, input/catalog reorder, and definition-tail differences after byte 5,000. Run `node --test scripts/panel-authorization-canonical.test.mjs` and retain the first exact R1-014 failure.
- [ ] **GREEN:** Normalize semantic text to NFC according to the schema, quote PostgreSQL identifiers deterministically, encode identity components with explicit kind/type tags and byte lengths, derive keys only from that framing, reject duplicate normalized identities, and hash all canonical UTF-8 bytes. Never concatenate raw components with ambiguous delimiters or accept a caller `stableKey`. Rerun the RED command to green.
- [ ] **TRIANGULATE:** Generate separator-placement and qualification-boundary falsifiers and require distinct keys/digests; require composed/decomposed equivalents to match; vary OIDs/catalog order without changing identity; mutate only a late multibyte definition tail and require a changed digest. Run the focused command twice with byte-identical bounded test output. Runtime harness: `N/A` for this pure identity layer.
- [ ] **REFACTOR:** Centralize tuple framing/quoting only after every collision and Unicode falsifier stays green. Rerun the focused test, `git diff --check`, and immediate-parent `git diff --numstat`. Hard stop at more than 200 authored lines; no semantic packing or `size:exception`.

**Exact verification:** every known/generated collision pair differs; NFC/NFD equivalents match; late bytes change the digest; spoofed keys/OIDs fail; deterministic reruns match; diff check is clean; authored count is ≤200.  
**Rollback/no-PROD boundary:** revert only PR1A-1a-ii changes in the two canonicalization files; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b through PR1A-1a-i-a-1e, PR1A-1a-i-a-2, and PR1A-1a-i-b through i-d remain intact. No database, production, migration, fixture, manifest, or stopped-workspace action.

## Proposed PR1A-1a-iii / Work unit 1A-1a-iii — Bounded evidence and output

**Authorization:** proposed only; pending human approval and explicitly unauthorized.  
**Exact property:** The public canonicalization result is bounded and non-secret: its successful serialized output is at most 64 KiB and returns only count, aggregate SHA-256, and bounded per-node stable identity/digest evidence. It never returns semantic objects, definitions, per-node canonical inputs, or aggregate canonical input. Complete untruncated bytes are hashed before disposal, and any evidence collection that would exceed the 64 KiB budget is rejected rather than truncated.  
**Estimate:** 120–180 authored additions + deletions.  
**Owns:** R1-015 and final collection/output closure of R1-009.  
**Depends on:** completed, GREEN, freshly reviewed PR1A-1a-ii and separate execution approval.  
**Chain target:** PR1A-1a-ii branch; proposed PR body diagram marks `PR1A-1a-i-d → PR1A-1a-ii → PR1A-1a-iii 📍 → frozen PR1A-1b`.  
**Starts at:** reviewed semantic validation and collision-safe node identity/digest primitives with no public collection result.  
**Ends with:** the complete standalone canonicalization library required by PR1A-1b, with bounded deterministic evidence and R1-009/R1-012–R1-019 ready for fresh review.  
**Exact files:** `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs` only.

- [ ] **RED:** Add failing assertions that a >1 MiB definition and unique leak sentinels never occur in `JSON.stringify(result)`, while changing the final multibyte tail changes node/aggregate digests. Require no `semantic`, `definition`, or `canonicalInput` result fields; reject duplicate identities and observation/key collections whose evidence would exceed 64 KiB; and prohibit successful oversize or truncated serialization. Run `node --test scripts/panel-authorization-canonical.test.mjs` and retain the first exact R1-015 failure.
- [ ] **GREEN:** Implement `canonicalizeObservations` over the reviewed primitives with the Design's exact 64 KiB result budget; hash complete canonical bytes without retaining duplicate canonical strings; discard raw semantic/definition bytes after hashing; return only bounded stable-key evidence, per-node SHA-256, count, and aggregate SHA-256; reject any result-budget violation with a stable fail-closed code instead of truncating. Rerun the RED command to green.
- [ ] **TRIANGULATE:** Falsify with just-under/at/one-byte-over 64 KiB evidence fixtures, long multibyte keys, >1 MiB early-versus-late definition changes, leak markers, duplicate normalized identities, and reordered equivalent observations. Require deterministic equal output for equivalent order, distinct hashes for all semantic tail changes, explicit rejection above the budget, and successful serialized output ≤64 KiB. Runtime harness: `N/A` because no database/process boundary exists.
- [ ] **REFACTOR:** Remove duplicate serialization/buffering while preserving full-byte hashing and stable limit errors. Rerun `node --test scripts/panel-authorization-canonical.test.mjs`, `git diff --check`, and immediate-parent `git diff --numstat`. Hard stop at more than 180 authored lines; no semantic packing or `size:exception`.

**Exact verification:** focused tests exit `0`; no raw semantic/definition/canonical input leaks; late bytes affect digests; all limit falsifiers reject without truncation; output is deterministic and ≤64 KiB; diff check is clean; authored count is ≤180.  
**Rollback/no-PROD boundary:** revert only PR1A-1a-iii changes in the two canonicalization files; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b through PR1A-1a-i-a-1e, PR1A-1a-i-a-2, PR1A-1a-i-b through i-d, and ii remain intact. No database connection, production access, migration, fixture, manifest, source callsite, or stopped-workspace action.

## Proposed PR1A-1b / Work unit 1A-1b — AST Auth/client/source discovery and exact receipt

**Authorization:** proposed only; pending human approval and explicitly unauthorized.  
**Estimate:** 315–390 authored additions + deletions.  
**Owns:** R1-007.  
**Depends on:** completed and reviewed PR1A-1a-iii, which transitively requires PR1A-1a-i-a-1a-r-A → PR1A-1a-i-a-1a-r-B → PR1A-1a-i-a-1b → PR1A-1a-i-a-1c → PR1A-1a-i-a-1d → PR1A-1a-i-a-1e → PR1A-1a-i-a-2 → PR1A-1a-i-b → PR1A-1a-i-c → PR1A-1a-i-d → PR1A-1a-ii, plus separate authorization.  
**Chain target:** PR1A-1a-iii branch; proposed PR body diagram marks `PR1A-1a-i-d → PR1A-1a-ii → PR1A-1a-iii → PR1A-1b 📍 → PR1A-1c → PR1A-1d`.  
**Starts at:** reviewed kind-specific semantic validation, collision-safe Unicode identity, and bounded canonical evidence, with no trusted static source receipt.  
**Ends with:** scope-aware AST discovery and a repeatable exact receipt for 34 unique current Auth callsites plus all reviewed Supabase client/source boundaries, with unknown reachability failing closed.  
**Files:** new `scripts/lib/panel-authorization-auth-discovery.mjs`, new `scripts/panel-authorization-auth-discovery.test.mjs`, and new `scripts/fixtures/panel-authorization-static-receipt-v2.json`. Read-only discovery target: every repository-tracked `js`, `jsx`, `mjs`, `cjs`, `ts`, `tsx`, `mts`, and `cts` source outside dependency/build/generated directories.

- [ ] **RED:** Add the exact destructuring 32/34 bypass as a failing regression, then alias, optional-chain, parenthesized, detached-method, static-computed, shadowed-binding, import, re-export, dynamic dispatch, new-operation, client-construction, and source-classification cases. Run `node --test scripts/panel-authorization-auth-discovery.test.mjs` and retain the first exact R1-007 failure.
- [ ] **GREEN:** Implement scope-aware AST discovery for Supabase client construction/import/re-export and Auth calls; emit exactly 34 unique current callsite identities through the reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, i-b–i-d, ii, and iii canonicalization boundary; classify every source and client boundary; and fail closed on unclassified dynamic dispatch, a new operation, unresolved client/source drift, deletion/rename, or receipt mismatch. Generate only the reviewed static receipt; do not infer expectations from runtime/database observations. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Exercise every listed syntax form, run discovery twice and require an identical receipt byte-for-byte, mutate one source/classification at a time and require rejection, and prove any browser import/construction of service-role credentials is rejected. Runtime harness: `N/A` because this is static repository analysis; the exact source-tree scan is the execution boundary.
- [ ] **REFACTOR:** Consolidate traversal and scope bookkeeping without reducing syntax coverage or collapsing repeated calls. Rerun `node --test scripts/panel-authorization-auth-discovery.test.mjs`, `node scripts/lib/panel-authorization-auth-discovery.mjs --check-receipt scripts/fixtures/panel-authorization-static-receipt-v2.json`, `git diff --check`, and immediate-parent `git diff --numstat`. **Hard stop before commit/PR creation at more than 400 authored additions + deletions; do not use `size:exception`.**

**Exact verification:** both commands exit `0`; discovery reports exactly 34 unique current callsites; two receipt runs are byte-identical; every syntax/drift falsifier and browser service-role case fails closed; authored line count is ≤400.  
**Rollback boundary:** remove only the PR1A-1b discovery module/test and `scripts/fixtures/panel-authorization-static-receipt-v2.json`; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, i-b–i-d, ii, and iii remain intact.  
**No PROD/real migration:** repository source scanning only; no database, production, migration, package, source-callsite, or runtime modification.

## Proposed PR1A-1c / Work unit 1A-1c — Actual config/database/storage/GraphQL/role topology

**Authorization:** proposed only; pending human approval and explicitly unauthorized.  
**Estimate:** 325–395 authored additions + deletions.  
**Owns:** R1-008 topology and R3-007 root, closure, and OID defects.  
**Depends on:** completed and reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, PR1A-1a-i-b–i-d, PR1A-1a-ii/iii, and PR1A-1b plus separate authorization.  
**Chain target:** PR1A-1b branch; proposed PR body diagram marks `PR1A-1a-iii → PR1A-1b → PR1A-1c 📍 → PR1A-1d`.  
**Starts at:** reviewed canonical identities and exact static discovery receipt, with no accepted database topology observation.  
**Ends with:** a thin read-only collector that queries actual repository config and actual database/storage/GraphQL/role catalogs, feeds observations through the reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, i-b–i-d, ii, and iii boundary, computes directional closure, and rejects extras or unverifiable reachability.  
**Files:** `scripts/sql/panel-authorization-preflight-canonicalizer.sql`, new `scripts/lib/panel-authorization-topology.mjs`, new `scripts/panel-authorization-topology.test.mjs`, and thin changes to `scripts/lib/panel-authorization-preflight-harness.mjs`. Read-only inputs: `supabase/config.toml`; `pg_catalog` relation/policy/rewrite/routine/trigger/constraint/dependency/ACL/default-ACL catalogs; rooted-role memberships/settings and `SET ROLE` reachability; `graphql_public` exposure; and scoped `storage.buckets`/`storage.objects` authorization metadata.

- [ ] **RED:** Add failures against actual disposable catalogs for unvolunteered policy, RPC, GraphQL object/overload, ACL/default ACL, trigger, view/rewrite, storage path, or `SET ROLE` drift; omitted roots; wrong-direction closure; sibling/system expansion; raw-OID identity; catalog-order dependence; and truncated definitions. Run `node --test scripts/panel-authorization-topology.test.mjs` and retain the first exact R1-008/R3-007 failure.
- [ ] **GREEN:** Query actual normalized `supabase/config.toml` and actual catalogs read-only; collect the exact database/storage/GraphQL/four-role topology; feed every observation through the reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, i-b–i-d, ii, and iii canonicalization boundary; walk only the Design's outgoing behavior and incoming access-changing edges; block confirmed extras; and classify denied, unknown, or ambiguous inspection/reachability as `unverifiable`. Never volunteer expectations from observed current state. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Replay two independently created predecessor fixtures and run `node scripts/lib/panel-authorization-preflight-harness.mjs --fixture predecessor --scenario topology-discovery`; require identical semantic aggregates despite independent OIDs/catalog order. Mutate each unvolunteered class independently and require bounded rejection. Prove no sibling or unrelated system catalog expands into closure and record disposal plus `production URL/host used=no`.
- [ ] **REFACTOR:** Deduplicate collector plumbing without mixing discovery with expected manifests or widening closure. Rerun `node --test scripts/panel-authorization-topology.test.mjs`, both independent harness replays, `git diff --check`, and immediate-parent `git diff --numstat`. **Hard stop before commit/PR creation at more than 400 authored additions + deletions; do not use `size:exception`.**

**Exact verification:** focused test exits `0`; both independent predecessors produce byte-identical semantic topology; each policy/RPC/GraphQL/ACL/trigger/view/storage/role mutation fails closed; no sibling/system expansion occurs; authored line count is ≤400.  
**Rollback boundary:** revert only the PR1A-1c SQL canonicalizer, topology module/test, and thin harness changes; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, i-b–i-d, ii/iii, and 1b remain intact; destroy disposable databases.  
**No PROD/real migration:** disposable local databases and read-only catalogs only; no production access, DDL/DML, migration creation, or migration execution.

## Proposed PR1A-1d / Work unit 1A-1d — Authenticated runtime attestation and final integration

**Authorization:** proposed only; pending human approval and explicitly unauthorized.  
**Estimate:** 270–360 authored additions + deletions.  
**Owns:** R1-010 and completion of R1-008 integration.  
**Depends on:** completed and reviewed PR1A-1a-i-a-1a-r-A → PR1A-1a-i-a-1a-r-B → PR1A-1a-i-a-1b → PR1A-1a-i-a-1c → PR1A-1a-i-a-1d → PR1A-1a-i-a-1e → PR1A-1a-i-a-2 → PR1A-1a-i-b → PR1A-1a-i-c → PR1A-1a-i-d → PR1A-1a-ii → PR1A-1a-iii → PR1A-1b → PR1A-1c plus separate authorization.  
**Chain target:** PR1A-1c branch; proposed PR body diagram marks `PR1A-1a-iii → PR1A-1b → PR1A-1c → PR1A-1d 📍 → frozen PR1A-2`.  
**Starts at:** reviewed canonicalization, static source receipt, and actual topology discovery without accepted runtime evidence.  
**Ends with:** authenticated runtime-attestation validation bound to independent trust and integrated fail-closed receipt/topology checks, while the operational preflight remains sealed.  
**Files:** new `scripts/lib/panel-authorization-attestation.mjs`, new `scripts/panel-authorization-attestation.test.mjs`, thin changes to `scripts/lib/panel-authorization-preflight-harness.mjs`, new `scripts/panel-authorization-attestation-integration.test.mjs`, new `scripts/fixtures/panel-authorization-postgrest-attestation-v1.json`, and receipt-binding declarations only in `scripts/sql/panel-authorization-preflight.sql`.

- [ ] **RED:** Add failures for missing environment, nonce, source identity, or immutable PostgREST release; arbitrary authentication method; caller/self-asserted trust; replay; stale/future evidence; wrong project/audience/issuer; malformed evidence hash/signature; operational acceptance of the fixture path; and unknown AST or database reachability during integration. Run `node --test scripts/panel-authorization-attestation.test.mjs scripts/panel-authorization-attestation-integration.test.mjs` and retain the first exact R1-010 failure.
- [ ] **GREEN:** Bind environment, project, source subject/kind, release, audience, issuer, canonical evidence hash, issue/expiry time, and single-run nonce to an independently configured trust identity. Gate the fixture path independently to an explicit disposable-local test marker; operational mode rejects fixture source/signature omissions. Integrate PR1A-1b receipts and PR1A-1c topology so unknown AST/database reachability fails closed, and limit SQL changes to receipt-binding declarations.
- [ ] **TRIANGULATE:** Run replay, forgery, stale/future-time, config, source, project, audience, issuer, and release falsifiers; run the valid local fixture only through `node scripts/lib/panel-authorization-preflight-harness.mjs --fixture predecessor --mode PRE-MIGRATION --fixture-attestation scripts/fixtures/panel-authorization-postgrest-attestation-v1.json`; require operational fixture use to fail. Rerun R1-003, R1-004, R1-005, and R1-006 integration regressions and record exact bounded outputs plus `production URL/host used=no`.
- [ ] **REFACTOR:** Remove duplicate envelope/binding validation without allowing caller-controlled trust or weakening unknown-reachability handling. Rerun both focused tests, the valid-fixture and operational-rejection harness scenarios, `git diff --check`, and immediate-parent `git diff --numstat`. **Hard stop before commit/PR creation at more than 400 authored additions + deletions; do not use `size:exception`.**

**Exact verification:** both test files exit `0`; every replay/forgery/stale/config/source/project/audience/issuer/release mutation fails closed; explicit local fixture succeeds only on the disposable test path; operational fixture acceptance fails; R1-003–R1-006 regressions remain green; authored line count is ≤400.  
**Rollback boundary:** revert only the PR1A-1d attestation module/tests, thin harness integration, local attestation fixture, and SQL receipt-binding declarations; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, PR1A-1a-i-b–i-d, PR1A-1a-ii/iii, and PR1A-1b/1c remain intact; delete only local nonce/test artifacts.  
**No PROD/real migration:** no production/control-plane collection or access, no production attestation, no migration creation/execution, and no change to the operational seal.

## PR1A-2 / Work unit 1A-2 — Exact predecessor and target-safe fixtures

**Authorization:** frozen and unauthorized until separately approved.  
**Estimate:** 170–260 authored additions + deletions.  
**Depends on:** completed and reviewed PR1A-1d, plus separate explicit authorization; this unit remains frozen.  
**Chain target:** PR1A-1d branch; PR body diagram marks `PR1A-1d → PR1A-2 📍 → PR1A-3 → PR1A-4 → PR1A-5`.  
**Starts at:** reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, and PR1A-1a-i-b–i-d plus PR1A-1a-ii/iii through PR1A-1d canonical identity, static discovery, actual topology, and attestation contracts, with no trusted target fixture.  
**Ends with:** independently authored disposable predecessor and materially target-safe fixture states; this owns R3-005 groundwork but does not close R3-005 until PR1A-5 executes real behavior.  
**Files:** `scripts/sql/fixtures/panel-authorization-predecessor-v2.sql`, `scripts/sql/fixtures/panel-authorization-target-v2.sql`, `scripts/lib/panel-authorization-preflight-harness.mjs`, and `scripts/panel-authorization-preflight.test.mjs`.

- [ ] **RED:** Add fixture-semantic tests for exact 67-file predecessor replay and target presence/removal of Gate 3 FKs/checks, UID-only trigger state, own-company `empresa`, role-aware catalog grants/policies, revoked `historial_stock`, exact storage path grammar, and predecessor policy/helper removal. Require target setup to fail if it merely replays predecessor state, stores a hard-coded receipt, or derives expected target state from migration output. Run `node --test --test-name-pattern='predecessor fixture|target-safe fixture|R3-005 groundwork' scripts/panel-authorization-preflight.test.mjs` and retain the first exact failure.
- [ ] **GREEN:** Make the predecessor fixture deterministically replay the pinned tree and make `panel-authorization-target-v2.sql` independently materialize all target-safe identity, provisioning, company, catalog, stock-history, storage, and predecessor-removal structures required by the Design. Keep fixture-only DDL outside `supabase/migrations/`; do not copy or invoke a real Gate 3 migration.
- [ ] **TRIANGULATE:** Build and destroy fresh predecessor and target-safe databases twice; run manifest-independent structural probes and compare only the expected PRE→POST semantic differences. Prove asymmetric A/B principals and objects can be seeded without production credentials and record `production URL/host used=no`.
- [ ] **REFACTOR:** Deduplicate fixture setup only where predecessor and target semantics remain independently authored. Rerun the focused command, disposable rebuilds, `git diff --check`, and immediate-parent `git diff --numstat`. **Stop if the unit exceeds 400 authored lines; do not spill fixture behavior into PR1A-3 or use `size:exception`.**

**Verification:** exact predecessor replay; independent target-safe structural probes; two clean disposable rebuild/disposal cycles; clean diff; ≤400 authored lines.  
**Rollback boundary:** revert only the two fixture files and their PR1A-2 harness/tests; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, and PR1A-1a-i-b–i-d plus PR1A-1a-ii/iii through PR1A-1d remain intact. Destroy all disposable databases.  
**No PROD/real migration:** no production connection, production mutation, branch migration, or real Gate 3 migration file.

## PR1A-3 / Work unit 1A-3 — Literal affected PRE/POST manifests

**Authorization:** frozen and unauthorized until separately approved.  
**Estimate:** 210–310 authored additions + deletions.  
**Depends on:** reviewed PR1A-2.  
**Chain target:** PR1A-2 branch; PR body diagram marks `PR1A-1d → PR1A-2 → PR1A-3 📍 → PR1A-4 → PR1A-5`.  
**Starts at:** stable canonical identities plus independently verified predecessor/target-safe fixtures.  
**Ends with:** finite literal affected-set PRE and POST rows and exact replacement/removal mappings; this owns the affected portion of R3-006.  
**Files:** `scripts/sql/panel-authorization-preflight.sql` manifest section, `scripts/sql/panel-authorization-preflight-canonicalizer.sql`, `scripts/lib/panel-authorization-preflight-harness.mjs`, and `scripts/panel-authorization-preflight.test.mjs`.

- [ ] **RED:** Add tests requiring every affected row's version, mode, stable key, kind, count, state, owner, ACL/dependency/definition hashes, PRE classification, POST key, and POST state/hash. Reject placeholders, wildcard/name-only rows, broad per-kind aggregates, runtime-learned hashes, unmapped removals/additions, invalid self-maps, duplicate keys, missing affected closure, extra target rows, and any PRE/POST source-hash drift. Run `node --test --test-name-pattern='literal affected manifest|PRE POST mapping|R3-006 affected' scripts/panel-authorization-preflight.test.mjs` and retain the first exact failure.
- [ ] **GREEN:** Encode the Design's literal affected families for profile integrity, provisioning, GraphQL, Auth reachability, `usuario`, `empresa`, `membresia`, catalog, stock/history, storage, helpers, grants/RLS, role topology, and runtime exposure. Pin hashes only from reviewed canonical source strings validated against both disposable fixtures; require unchanged closure rows in both modes and one exact target or `ABSENT` for every replaceable PRE row.
- [ ] **TRIANGULATE:** Generate manifest-only observations from two fresh predecessor and two fresh target-safe databases; require byte-identical per-mode counts/aggregates and the exact reviewed PRE→POST mapping. Mutate one row in each affected object class and require bounded rejection without updating expected literals.
- [ ] **REFACTOR:** Consolidate row construction without creating wildcard acceptance or dynamic expectations. Rerun the focused suite, manifest-only harness scenarios, `git diff --check`, and immediate-parent `git diff --numstat`. **Stop at >400 authored lines and request a new split decision; no `size:exception`.**

**Verification:** literal row/schema validation; repeatable PRE and POST aggregates; representative per-class mutation rejection; clean diff; ≤400 authored lines.  
**Rollback boundary:** revert only PR1A-3 manifest rows and directly related canonicalizer/harness/tests; retain reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, and PR1A-1a-i-b–i-d plus PR1A-1a-ii/iii through PR1A-1d and PR1A-2 fixtures.  
**No PROD/real migration:** manifest work uses disposable fixtures only and cannot create, run, or infer from the real Gate 3 migration.

## PR1A-4 / Work unit 1A-4 — Bounded Gate 1, Gate 2, and commerce preservation anchors

**Authorization:** frozen and unauthorized until separately approved.  
**Estimate:** 110–170 authored additions + deletions.  
**Depends on:** reviewed PR1A-3.  
**Chain target:** PR1A-3 branch; PR body diagram marks `PR1A-1d → PR1A-2 → PR1A-3 → PR1A-4 📍 → PR1A-5`.  
**Starts at:** complete literal affected PRE/POST manifests without bounded unchanged-surface coverage.  
**Ends with:** the ten named preservation anchors, bounded diagnosis, and identical PRE/POST preservation aggregates except the explicit history append; this completes R3-006 and R3-007.  
**Files:** `scripts/sql/panel-authorization-preflight.sql` anchor section, `scripts/sql/panel-authorization-preflight-canonicalizer.sql`, `scripts/lib/panel-authorization-preflight-harness.mjs`, and `scripts/panel-authorization-preflight.test.mjs`.

- [ ] **RED:** Add one focused failure for each named anchor: `history-and-files-v2`, `exposed-app-roots-v2`, `gate2-domain-v2`, `commerce-orders-v2`, `commerce-checkout-stock-v2`, `commerce-payment-v2`, `commerce-webhook-v2`, `static-code-receipts-v2`, `role-topology-v1`, and `postgrest-runtime-v1`. Reject unbounded inventories, affected-row double ownership, omitted reviewed keys, ignored count drift, more than ten diagnostic keys, and any unauthorized Gate 1/Gate 2/commerce change. Run `node --test --test-name-pattern='preservation anchor|Gate 1|Gate 2|commerce|R3-006|R3-007' scripts/panel-authorization-preflight.test.mjs` and retain the first exact failure.
- [ ] **GREEN:** Encode each anchor's explicit root-key list, directional closure, literal count, ordered per-key hashes, and aggregate. Keep affected catalog rows outside preservation anchors, bind the per-run runtime attestation without learning its hash as a manifest row, and allow only the reviewed Gate 3 history append between PRE and POST.
- [ ] **TRIANGULATE:** On fresh predecessor and target-safe fixtures, require equal preservation count/aggregate pairs except history's explicit append. Independently mutate one Gate 1, Gate 2, order, checkout/stock, payment, webhook, static receipt, role, and runtime-attestation identity; require bounded non-secret diagnosis and no database change.
- [ ] **REFACTOR:** Remove duplicate anchor plumbing without merging distinct contracts or widening discovery. Rerun focused tests, anchor harness scenarios, `git diff --check`, and immediate-parent `git diff --numstat`. **Stop if authored change exceeds 400 lines; no `size:exception`.**

**Verification:** all ten anchors match in clean PRE/POST fixtures; each preservation family detects drift; diagnosis remains bounded; clean diff; ≤400 authored lines.  
**Rollback boundary:** revert only PR1A-4 anchor definitions and related tests/harness/canonicalization; literal affected manifests and earlier fixtures/receipts remain reviewable.  
**No PROD/real migration:** local read-only fixture inspection only; do not touch production, historical migrations, or the real Gate 3 migration.

## PR1A-5 / Work unit 1A-5 — Real role behavior, semantic mutations, and operational exit

**Authorization:** frozen and unauthorized until separately approved.  
**Estimate:** 210–310 authored additions + deletions.  
**Depends on:** reviewed PR1A-4.  
**Chain target:** PR1A-4 branch; PR body diagram marks `PR1A-1d → PR1A-2 → PR1A-3 → PR1A-4 → PR1A-5 📍`.  
**Starts at:** exact roots, fixtures, affected manifests, and preservation anchors without complete executed semantic proof.  
**Ends with:** real admin/staff/cliente and A↔B behavior, sealed-target-relative semantic mutations, and wrapper-owned OS exit behavior; R3-008 and R3-014 are resolved and R3-005 is closed.  
**Files:** `scripts/sql/fixtures/panel-authorization-target-v2.sql`, `scripts/sql/panel-authorization-preflight.sql`, `scripts/lib/panel-authorization-preflight-harness.mjs`, and `scripts/panel-authorization-preflight.test.mjs`.

- [ ] **RED:** Add child-process tests that execute, rather than source-match, admin/staff/cliente commands for every retained catalog relation command, stock-view read, storage `SELECT/INSERT/DELETE`, denied storage `UPDATE`, own-company `empresa`, UID-only provisioning, and bidirectional A/B isolation. Add sealed-target-relative mutations for affected objects and anchors, plus an unsealed operational run proving current psql `\quit 4` behavior cannot yield OS exit `0`. Run `node --test --test-name-pattern='role behavior|semantic mutation|A to B|B to A|operational exit|R3-005|R3-008|R3-014' scripts/panel-authorization-preflight.test.mjs` and retain the first exact behavioral/exit failure.
- [ ] **GREEN:** Execute the complete target behavior matrix against real disposable roles and data; compare mutations to literal sealed expectations rather than a captured baseline. Make the wrapper parse exactly one bounded JSON value and own OS exits: `0` only for valid PRE `migration_required` or POST `pass`, `3` for `blocked`, and `4` for `unverifiable`, malformed/multiple output, transport failure, or unsealed operational evidence. Keep SQL read-only with explicit rollback.
- [ ] **TRIANGULATE:** Run clean predecessor PRE and target-safe POST fixture scenarios, all role/A↔B cases, representative affected/anchor mutations, denied inspection, and the unsealed operational path as actual child processes. Record exact statuses/exits, before/after bounded fingerprints, one JSON document, fixture disposal, and `production URL/host used=no`.
- [ ] **REFACTOR:** Remove hard-coded success paths and duplicate mutation setup only after the complete semantic suite stays green. Rerun `node --test scripts/panel-authorization-preflight.test.mjs`, both harness modes, `git diff --check`, and immediate-parent `git diff --numstat`. **Stop at >400 authored lines; request another topology decision rather than using `size:exception`.**

**Verification:** real three-role command matrix; independent A→B and B→A denial; semantic mutation rejection; exact wrapper-owned exit matrix; unchanged before/after fingerprints; clean diff; ≤400 authored lines.  
**Rollback boundary:** revert only PR1A-5 behavior/mutation/exit changes; reviewed `PR1A-1a-i-a-1a-r-A`, `PR1A-1a-i-a-1a-r-B`, PR1A-1a-i-a-1b–1e/i-a-2, and PR1A-1a-i-b–i-d plus PR1A-1a-ii/iii through PR1A-1d and PR1A-2–PR1A-4 remain intact. Destroy disposable fixtures and leave operational execution sealed.  
**No PROD/real migration:** no production URL, preflight, migration, schema mutation, or rollout; no real Gate 3 migration file may be added or executed.

## Proposed PR1B / Work unit 1B — Exact two-mode SQL and transaction-preserving report engine

**Authorization:** frozen and explicitly unauthorized; scope retained for later approval.  
**Depends on:** reviewed PR1A-5 and separate explicit authorization.  
**Starts at:** reviewed immutable fixture manifests with operational success sealed.  
**Ends with:** exact PRE/POST evaluation and one-document exit behavior against disposable fixtures; production migration remains absent and operational success remains sealed.  
**Files:** `scripts/sql/panel-authorization-preflight.sql`, `scripts/panel-authorization-preflight.test.mjs`, and `scripts/lib/panel-authorization-preflight-harness.mjs`.

- [ ] **RED:** Add behavioral tests for omitted/empty/wrong-case/unknown `gate3_mode`; missing or malformed `repository_commit`, `gate3_migration_path`, `gate3_migration_sha256`, receipt hashes, and A/B UUIDs; exact status/exit pairs; zero/multiple/malformed/oversize JSON rejection; and failures after transaction start (missing relation, denied catalog/data inspection, unsupported server/canonicalizer, SQL error). Assert PRE never emits `pass`, POST never emits `migration_required`, and unavailable real migration evidence prevents operational exit `0`. Run `node --test --test-name-pattern='mode|metadata|report engine|error isolation' scripts/panel-authorization-preflight.test.mjs` and retain the exact failing assertion.
- [ ] **GREEN:** Rebuild `scripts/sql/panel-authorization-preflight.sql` around `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` and `\set ON_ERROR_ROLLBACK on` before fallible inspection. Guard every psql variable with `:{?name}` before quoting; preinitialize check results; execute OID-safe discovery; immediately capture `ERROR`/`SQLSTATE`; and classify verified mismatch as `blocked`/3 and unavailable or ambiguous evidence as `unverifiable`/4. Evaluate exact history, manifests, closure, metadata, clean data/applicability, and static receipts. Make `scripts/lib/panel-authorization-preflight-harness.mjs` verify the supplied commit, migration path/digest, and receipt hashes against the checked-out tree before invoking psql. Construct one compact report (`gate3-preflight-v2`, ≤64 KiB), emit it through one `\echo`, explicitly `ROLLBACK`, then use plain `\quit`; preserve PR1A-5's wrapper-owned OS exit mapping. The harness must reject stdout with anything other than exactly one JSON value. Never use `ON_ERROR_STOP=1 --single-transaction`, deliberate divide-by-zero, DDL/DML/remediation, or side-effecting application functions.
- [ ] **TRIANGULATE:** Run `node scripts/lib/panel-authorization-preflight-harness.mjs --fixture predecessor --mode PRE-MIGRATION` and require only `migration_required`/0 with explicitly test-only migration evidence. Run the target-safe equivalent with `--mode POST-MIGRATION` and require only `pass`/0. Repeat both without the test-only seal and require `unverifiable`/4. Exercise one missing relation and one denied-inspection case and record one JSON, captured check/SQLSTATE, explicit rollback, non-zero exit, and surviving read-only transaction for each. Record `production URL/host used=no`.
- [ ] **REFACTOR:** Consolidate report assembly without merging distinct stop checks or relaxing exact status precedence. Rerun the focused command, both local harness commands, `git diff --check`, and the immediate-parent authored-line count; stop for another delivery decision if PR1B exceeds 400 lines.

**Rollback boundary:** revert only PR1B changes to the preflight SQL, harness, and focused tests. PR1A manifests/fixtures remain independently reviewable; all databases are disposable.

## Proposed PR1C / Work unit 1C — Complete stop matrix, comprehensive fingerprints, and retry evidence

**Authorization:** frozen and explicitly unauthorized; scope retained for later approval.  
**Depends on:** reviewed PR1B and separate explicit authorization.  
**Starts at:** exact two-mode report behavior on clean disposable fixtures.  
**Ends with:** complete behavioral proof for R3-001–R3-004 and verified R1-002, ready for fresh PR1 review but not for PR2.  
**Files:** `scripts/panel-authorization-preflight.test.mjs`, `scripts/lib/panel-authorization-preflight-harness.mjs`, and corrective-only changes to `scripts/sql/panel-authorization-preflight.sql` if a behavioral case exposes an engine defect.

- [ ] **RED:** Add one independently named disposable mutation for every PRE stop class: mode/metadata; history/count/hash; missing/extra/mismatched predecessor and closure rows; UID null/duplicate/orphan/wrong binding and profile cardinality; normalized-email ambiguity/UID conflict; unknown role, invalid company/onboarding, orphan company; not-null/uniqueness/future FK/check applicability; asymmetric A/B principal readiness; trigger/function body/owner/config/ACL; relation/RLS/policy/grant/default ACL; helper/browser RPC/view/dependency/storage/bucket; unexpected permissive or `membresia` path; Gate 1, Gate 2, checkout/stock/order/payment/webhook preservation; static receipt; lock, permission, query, and evidence uncertainty. Add POST mutations for missing FK/check, old trigger, retained PRE policy, extra permissive policy/RPC, role-blind catalog/own-company regression, view-option drift, storage/public grant, preserved-surface drift, dirty data, and denied inspection. First run selected names with `node --test --test-name-pattern='PRE stop matrix|POST regression matrix|fingerprints' scripts/panel-authorization-preflight.test.mjs` and record the first absent stop-case failure.
- [ ] **GREEN:** Complete matrix setup/cleanup and any smallest report-engine corrections. For every case assert the exact mode/status/exit/version/bindings, exactly one valid ≤64 KiB non-secret JSON value, bounded samples (≤10), no raw definitions/emails/auth metadata/URLs/keys/payloads/storage names, and no remediation. Require exact predecessor alone to return `migration_required`/0 and exact target alone to return `pass`/0; every absence, dirty state, regression, drift, ambiguity, or evidence failure must be non-zero.
- [ ] **TRIANGULATE:** Before and after every run, compare category hashes covering relevant `public`/`auth`/`storage` row identities, counts, distributions, references, and hashed object metadata; exact migration history and statement digests; namespaces/extensions/canonicalizer version; relations/columns/sequences/types; constraints/indexes; RLS/policies; relation/column/schema/sequence/default ACLs; routines/procedures with definition/owner/config/ACL/dependencies; triggers/bindings; views with definition/options/owner/ACL/dependencies; and bucket/storage authorization. Run `node --test scripts/panel-authorization-preflight.test.mjs`; then rerun predecessor PRE and target-safe POST through the harness. Record all exact results, equal before/after category hashes, report SHA-256 values, fixture disposal, and `production URL/host used=no`.
- [ ] **REFACTOR:** Remove redundant fixture plumbing only after the complete matrix stays green. Rerun the full test, both harness scenarios, `git diff --check`, and immediate-parent authored-line count. Attach a finding map: R3-001 → exact manifests/two states; R3-002 → complete matrix; R3-003 and R1-002 → savepoint isolation/one JSON/rollback/exit; R3-004 → comprehensive external fingerprints. If PR1C exceeds 400 lines, stop and request another delivery decision.

**Rollback boundary:** revert only PR1C matrix/fingerprint additions and any directly induced engine fix; PR1A/PR1B remain intact. Destroy disposable fixtures. No migration, shared database, production access, or PR2 work is included.

## Corrective PR1 retry gate

- Human approval records `PR1A-1a-i-a-1a-r-A` as Unit 1A and the only implementation-authorized unit. The stopped Unit 1 replacement slot is now two sequential units, Unit 1A and Unit 1B, increasing the approved implementation topology honestly from 27 to 28 units.
- Unit 1A starts in a new worktree from clean tracker `526f614be9cc1efc9269bc62996eaa85b3504be2`, uses only synthetic in-memory inputs, and may touch exactly `scripts/lib/panel-authorization-canonical.mjs` and `scripts/panel-authorization-canonical.test.mjs`.
- Stopped `PR1A-1a-i-a-1a-r`, stopped Unit 1, the stopped 319-line candidate, all other stopped candidates/workspaces/drafts/snapshots, and old code bytes are non-authoritative prohibited inputs. Do not read, inspect, copy, diff, patch, reset, delete, branch from, or use them as authority, input, base, parent, or oracle.
- Unit 1A RED uses only an importable permissive shell. Valid `relation`/`table` and hostile opaque table content pass; invalid cases fail naturally because they are accepted or invoke a forbidden hook, never because of missing import/export or a shared guard. Tests explicitly pin R1-031, R1-032, R1-035, and R1-036 plus all seven exact stable error categories.
- Unit 1A GREEN accepts only `kind: "relation"`, relation `variant: "table"`, and opaque `content`, then emits only `{kind: "relation", variant: "table"}`. The other five former variants and all unknown variants share the exact unknown-variant failure.
- The adversarial kernel permits only Object/null-prototype own-data envelope and relation records; detects Proxy before any caller trap; rejects invalid records/fields, accessors, symbols, non-enumerable or unknown/missing fields, and semantic own/inherited relation-path OIDs, including temporary `Object.prototype.oid` pollution without inherited value access.
- Snapshot proof requires exactly one `Reflect.ownKeys` per inspected record and one descriptor read for every discovered key before validation/rejection, with descriptors read once, values consumed from the complete snapshot, caller discriminants never reread, and final validated locals used directly. R1-033 closes only through implementation structure plus fresh source review; brittle source-text tests are prohibited.
- Unit 1A tests must remain 180–225 lines, implementation 60–75 lines, and forecast total 240–300 lines. Stop immediately above 330 rather than packing tests, compressing the property, expanding scope, or requesting an exception.
- Unit 1B owns the remaining five accepted variants and exactly six hostile opacity/erasure cases. It stays frozen and starts only from freshly reviewed Unit 1A after separate explicit authorization.
- Unit 2 scalar fields, Unit 3 columns, Unit 4 sets/catalog/observation-order decisions, Unit 5 payload semantics, i-a-2+, DB/runtime/discovery/migration/API/UI, and every third-file change are excluded. Unit 2+ remain frozen; Unit 4 remains decision-blocked.
- After deterministic reruns, exact path/line/whitespace checks, trap/descriptor/discriminant proofs, readability refactor, and fresh source review, STOP. Fresh review consumes Unit 1A authority. No correction after review, commit, push, publication, migration, production access, or automatic advance to Unit 1B is authorized.
- Sequential dependencies are fixed: Unit 1A starts from clean `526f614`; Unit 1B starts only from freshly reviewed Unit 1A after separate authorization; Unit 2 starts only from freshly reviewed Unit 1B; Unit 3 from reviewed Unit 2; Unit 4 from reviewed Unit 3 only after its three human decisions and separate authorization; Unit 5 from reviewed Unit 4; frozen PR1A-1a-i-a-2 then starts from reviewed Unit 5.
- Unit 4 remains explicitly blocked until a human resolves set deduplication, locale-independent canonical ordering, and the exact observation-order invariance scope. No implementation authorization may be inferred.
- Final state: topology `APPROVED` at 28 implementation units; Unit 1A `REVIEW APPROVED — DELIVERY PENDING` with code/tests frozen; implementation authorization `NONE`; Unit 1B and Units 2, 3, and 5 `FROZEN`; Unit 4 `FROZEN + BLOCKED`; PR1A-1a-i-a-2 and every later unit `FROZEN`; earlier stopped candidates `NON-AUTHORITATIVE/PROHIBITED`.
- Unit 1A and eventual PR1A completion do not claim production eligibility: production access and migration remain prohibited, and without the reviewed real migration SHA operational PRE and POST remain `unverifiable`/non-zero.

## PR 2 / Work unit 2 — Canonical identity, company integrity, and fixture compatibility

**Authorization:** frozen and explicitly unauthorized; PR2–PR8 scopes below are retained, not approved for implementation.  
**Depends on:** approved PR1C and a separate explicit approval to start PR2.  
**Starts at:** tested read-only preflight.  
**Ends with:** the initial section of the sole Gate 3 migration enforcing profile/company invariants, trusted trigger behavior, and own-company `empresa` access on a fresh local database.  
**Files:** the sole new `supabase/migrations/*_multi_tenant_gate_3_panel_authorization.sql`, `scripts/panel-authorization-db.test.mjs`, setup/cleanup only in `scripts/catalog-stock-isolation-db.test.mjs` and `scripts/order-operations-db.test.mjs`, plus a focused package script.

- [ ] **RED:** Add DB tests first for exact schema/dirty-data assertions, UID uniqueness/not-null preservation, `usuario.supabase_uid -> auth.users(id) ON DELETE RESTRICT`, privileged role/company/onboarding checks, `usuario.empresa_id -> empresa(id) ON DELETE RESTRICT`, blocked company deletion, UID-only trigger defaults/idempotency/conflicts, own-company `empresa` reads for all three roles and null-company cliente, and denial of authenticated company mutations. Run `pnpm exec supabase db reset && node --test scripts/panel-authorization-db.test.mjs`; record the first missing Gate 3 invariant/policy failure.
- [ ] **GREEN:** Begin the one transactional migration with advisory/table locks, short `lock_timeout`, all prerequisite and dirty-data assertions before DDL, additive `NOT VALID` then validated constraints, safe replacement of the old company FK, hardened UID-only trigger ownership/search path/execute grants, and non-recursive own-company `empresa` SELECT with authenticated mutations revoked. Update only fixture setup/cleanup in the two existing regression files: create real local auth identities, reuse the trigger-created UID profile, assign fixture state without email adoption, and clean dependent rows → `usuario` → auth user → `empresa` idempotently. Do not alter their behavioral assertions. Reset locally and rerun the focused DB test to green.
- [ ] **TRIANGULATE:** Run `node --test scripts/catalog-stock-isolation-db.test.mjs`, `node --test scripts/order-operations-db.test.mjs`, `node --test scripts/storefront-tenant-db.test.mjs`, and `pnpm test:instance-config`. Record profile preservation after rejected deletes/conflicts and exact unchanged Gate 1/order behavioral assertion results.
- [ ] **REFACTOR:** Consolidate fixture helpers only if behavior stays byte-for-byte equivalent, rerun all commands above and `git diff --check`, and verify no historical migration/OpenSpec file changed.

**Rollback boundary:** revert this migration section, the new DB assertions, the package entry, and setup/cleanup-only fixture edits; run a fresh local reset. Never weaken an already shared/production database with an ad hoc down migration.

## PR 3 / Work unit 3 — Role-aware core catalog SQL boundary

**Depends on:** PR 2.  
**Starts at:** validated canonical identity/company contracts.  
**Ends with:** authoritative policies and grants for `producto`, `categoria`, and `producto_categoria`.  
**Files:** the same sole Gate 3 migration and `scripts/panel-authorization-db.test.mjs`.

- [ ] **RED:** Extend the DB suite first with asymmetric companies A/B and canonical `admin`, `staff`, and company-bound `cliente` users. For each of `producto`, `categoria`, and `producto_categoria`, test SELECT/INSERT/UPDATE/DELETE: admin/staff may operate only in their own company; cliente is denied **every retained direct command even in its own company**; A→B and B→A reads/mutations fail; bridge parents must share the canonical company; and UPDATE checks both old and new rows. Add fingerprint assertions that stale role-blind/permissive policies or alternate grants fail the suite. Run `pnpm exec supabase db reset && node --test scripts/panel-authorization-db.test.mjs` and retain the expected role-aware matrix failure.
- [ ] **GREEN:** Extend the migration with restricted `STABLE SECURITY INVOKER` canonical catalog predicates and atomic policy/grant replacement for the three core tables. Every rule must resolve `auth.uid() -> usuario.supabase_uid -> empresa_id + rol IN ('admin','staff')`; remove every overlapping authenticated/public/anon path that could OR around it; preserve service-role contracts; and use no `membresia`, row-only, email, host, or security-definer alternate authority. Reset locally and rerun the focused DB suite to green.
- [ ] **TRIANGULATE:** Run `node --test scripts/catalog-stock-isolation-db.test.mjs` and explicit named A→B/B→A subtests from `scripts/panel-authorization-db.test.mjs`; inspect final policy/grant fingerprints and persisted rows after denied writes. Record that all original Gate 1 behavioral assertions remain unchanged and green.
- [ ] **REFACTOR:** Deduplicate only SQL predicates/fixture builders without creating another authority path; rerun focused and Gate 1 commands plus `git diff --check`.

**Rollback boundary:** remove only this migration subsection and its core-table parity cases, then reset the local database; PR 2 identity/company behavior remains independently testable.

## PR 4 / Work unit 4 — Dependent catalog, storage, view, and stock SQL boundary

**Depends on:** PR 3.  
**Starts at:** role-aware core catalog policies.  
**Ends with:** the complete corrected SQL catalog boundary and final migration fingerprint assertions.  
**Files:** the same sole Gate 3 migration and `scripts/panel-authorization-db.test.mjs`.

- [ ] **RED:** Extend tests first for `producto_variante`, `imagen_producto`, `producto_stock_resumen`, `storage.objects` in `producto-imagenes`, `soft_delete_imagen_producto(uuid)`, and `historial_stock`. Exercise all retained commands for admin/staff in-company, deny every retained direct command to cliente, deny both cross-tenant directions and forged parent/company/path moves, deny storage UPDATE and public/anon enumeration, require `security_invoker` stock-view behavior, and prove no authenticated stock-history surface or alternate permissive policy/grant remains. Run a fresh reset plus `node --test scripts/panel-authorization-db.test.mjs` and retain the expected failure.
- [ ] **GREEN:** Complete the migration atomically: parent-aware variant/image predicates; validated storage path/product/company checks; authenticated SELECT/INSERT/DELETE only for canonical admin/staff; removal of `pi_read_public`; hardened soft-delete function authorization/privileges; authenticated `historial_stock` policy/grant removal; stock-view `security_invoker` and no-mutation assertions; least-privilege grants; and final fingerprints proving no policy can OR around the role-aware boundary. Preserve Gate 2 signed-URL service behavior and all commerce RPC/function grants. Reset locally and rerun the focused DB suite to green.
- [ ] **TRIANGULATE:** Run `node --test scripts/catalog-stock-isolation-db.test.mjs`, `node --test scripts/storefront-tenant-db.test.mjs`, `pnpm test:storefront-tenant`, and named three-role command-matrix subtests. Record admin/staff own-company success, same-company cliente denial for every retained direct catalog command, A↔B persisted-state isolation, public storage denial, and successful trusted signed-URL behavior.
- [ ] **REFACTOR:** Simplify policy helpers without broadening execute grants or introducing a second authority; rerun all focused commands, inspect policy/grant fingerprints, and run `git diff --check`.

**Rollback boundary:** remove only this dependent-surface migration subsection/tests and reset locally. After any authorized hardened deployment, rollback requires a separately reviewed forward migration; never restore public storage, role-blind catalog access, or direct stock-history access.

## PR 5 / Work unit 5 — Shared capabilities and canonical server authorization

**Depends on:** PR 4.  
**Starts at:** complete local database authority.  
**Ends with:** a pure shared capability model and server authorization that returns a validated principal before privilege exists.  
**Files:** new `src/lib/panelCapabilities.ts`, optional new `src/lib/panelPrincipal.ts`, `src/lib/panelAuthorization.ts`, new `scripts/panel-capabilities.test.mjs`, new `scripts/panel-authorization-api.test.mjs`, and focused package scripts.

- [ ] **RED:** Add table tests first for every role/capability cell; UUID/boolean/role parsing; anonymous, missing, duplicate (`limit(2)`), malformed, unknown-role, null privileged company, orphan company, cliente with/without company, auth transport failure, and lookup failure. Add source checks rejecting another TypeScript role allowlist and proving the service-role key/client is untouched before successful capability authorization. Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-capabilities.test.mjs scripts/panel-authorization-api.test.mjs` and record the expected missing-contract/order failure.
- [ ] **GREEN:** Implement the pure `PANEL_ROLES`, `PANEL_CAPABILITIES`, `CAPABILITIES_BY_ROLE`, `hasPanelCapability`, canonical profile parser, and admitted non-null-company `PanelPrincipal`. Refactor to `authorizePanelRequest(req, requiredCapability)` using anon credentials/caller token, exact UID lookup, validated own-company existence, safe status codes/logs, and a separate `createPanelServiceClient()` called only by an allowed endpoint branch. Remove request tenant comparison and service-client return from authorization. Rerun focused tests to green.
- [ ] **TRIANGULATE:** Run focused fail-closed tests with spies that record auth/profile/company/service-client call order. Runtime route harness is `N/A` for this library-only unit; PR 6 supplies endpoint and A/B runtime evidence. Also run `pnpm exec tsc --noEmit`.
- [ ] **REFACTOR:** Keep parsing/authorization functions small, remove duplicate role logic, rerun both focused suites, TypeScript, and `git diff --check`.

**Rollback boundary:** revert only the shared modules/authorization refactor and tests before dependent APIs merge. If later layers exist, disable/revert panel APIs coherently; never restore request-selected tenancy or early service-role construction.

## PR 6 / Work unit 6 — Panel API contract and tenant-scoped operations

**Depends on:** PR 5.  
**Starts at:** canonical principal authorization with delayed privilege.  
**Ends with:** products and order endpoints enforcing named capabilities, stable errors, and canonical tenant arguments without partial responses.  
**Files:** `src/pages/api/panel/productos.ts`, `src/pages/api/panel/pedidos.ts`, `src/pages/api/panel/pedidos/[id].ts`, `src/lib/orderOperationsApi.ts`, a small request-contract helper under `src/lib/`, `scripts/panel-authorization-api.test.mjs`, and `scripts/order-operations-api.test.mjs`.

- [ ] **RED:** Extend API tests first for exact ordering: method/rate limit → top-level legacy `empresa_id` detection → complete shape/UUID validation → auth → trusted origin for cookie mutations → canonical profile → capability → service client → tenant-scoped query/RPC → complete response. Cover query/body legacy values that match, differ, are empty, null, or arrays (`400 legacy_tenant_input` before auth); `empresaId`/unknown keys (`400 invalid_request`); `401/403/404/500`; staff ordinary orders but no cancellation; cliente denial before lookup; foreign and absent resources sharing non-revealing `404`; canonical `.eq("empresa_id", principal.empresaId)`/`p_empresa_id`; secondary product-stock and order-item/payment failures producing `500` with no partial payload; and A→B/B→A argument/result isolation. Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-authorization-api.test.mjs scripts/order-operations-api.test.mjs` and retain the expected contract failure.
- [ ] **GREEN:** Add own-property top-level legacy detection for endpoint-declared query/body locations. Update all three endpoints and order-operation handler to request named capabilities, construct the service client only after allow, scope every query/RPC from `principal.empresaId`, validate complete downstream data, emit only stable `{ error }` payloads, preserve `405/429` and order-domain `409`, and remove products' tolerant response plus `meta.empresa_id`. Do not add a catalog BFF or forward browser tenant values. Rerun focused tests to green.
- [ ] **TRIANGULATE:** Run the focused suites and their named A→B/B→A cases against the local API harness; retain spy receipts for exact filters/RPC arguments, zero privileged calls on denial, equal foreign/absent `404`, and no partial payload. Run `node --test scripts/order-operations-db.test.mjs`, `pnpm lint`, and `pnpm exec tsc --noEmit`.
- [ ] **REFACTOR:** Centralize request/error helpers without hiding endpoint capability declarations, rerun all commands above and `git diff --check`.

**Rollback boundary:** revert or disable the affected panel endpoints and server helpers as one unit while retaining database restrictions. Never restore accepted client `empresa_id`, tolerant privileged payloads, or role checks after resource lookup.

## PR 7 / Work unit 7 — UID-only bootstrap provisioning

**Depends on:** PR 2 trigger/invariants and PR 4 final local migration.  
**Starts at:** trigger-created default profiles and restrictive FKs/checks.  
**Ends with:** conflict-complete, guarded, idempotent trusted bootstrap behavior.  
**Files:** `scripts/lib/supabase-bootstrap.mjs`, new `scripts/supabase-bootstrap.test.mjs`, focused compatibility assertions in `scripts/bootstrap-instance.test.mjs`, and its package script entry.

- [ ] **RED:** Add fake-client tests first for zero/one/multiple normalized auth-email matches; UID query cardinality; email used only for conflict detection; same-UID exact-state idempotency; missing trigger profile; duplicate UID/profile-ID/email and UID/email conflicts; cross-company/unexpected-role/onboarding states; fresh cliente promotion; concurrent guarded-update mismatch; and no auth/profile mutation on every conflict path. Run `node --test scripts/supabase-bootstrap.test.mjs scripts/bootstrap-instance.test.mjs` and record the expected email-adoption/early-mutation failure.
- [ ] **GREEN:** Separate read-only planning from writes; enumerate all email matches; query UID with bounded arrays; require the trigger-created `cliente`/null/onboarding profile for new users; remove email adoption/direct privileged inserts; permit only exact idempotency or one guarded fresh-cliente → configured-admin/company/onboarding-false update returning exactly one row; and defer metadata/profile writes until checks pass. Keep buyer defaults and tenant-domain setup separate. Rerun focused tests to green.
- [ ] **TRIANGULATE:** On disposable local Supabase, run `pnpm bootstrap:instance` twice and record identical canonical ownership on the second run; execute a conflict fixture and record failure with unchanged rows; then run `pnpm smoke:bootstrap`, `pnpm test:instance-config`, and `node --test scripts/storefront-tenant-db.test.mjs`.
- [ ] **REFACTOR:** Deduplicate read plans without reintroducing `.maybeSingle()` ambiguity or email selection, rerun all focused/local commands and `git diff --check`.

**Rollback boundary:** stop bootstrap tooling and revert only to a proven UID-only safe state. If the predecessor adopts by email, disable the tool instead of restoring it; database trigger/constraints remain.

## PR 8 / Work unit 8 — Fail-closed UI, route, and operation parity

**Depends on:** PR 6 authoritative APIs and PR 4 database enforcement.  
**Starts at:** server/database capability enforcement.  
**Ends with:** browser state, navigation, direct routes, and controls consistently projecting the shared map, followed by the complete local release gate.  
**Files:** `src/context/AuthContext.tsx`, `src/components/layout/AdminLayout.tsx`, `src/components/layout/panel/Sidebar.tsx`, `src/components/common/Header.tsx`, all routes under `src/pages/panel/`, `src/lib/orderOperationsUi.ts`, new `scripts/panel-routes-ui.test.mjs`, `scripts/order-operations-ui.test.mjs`, and focused package scripts.

- [ ] **RED:** Add UI/route tests first for tagged loading/anonymous/resolved/denied states; zero protected-content/fetch flash; missing/duplicate/malformed/lookup-failed profiles; cliente denial; staff panel home/catalog/orders allow; staff direct payments/cancellation denial; admin payments/cancellation allow subject to order eligibility; sidebar/header/direct-route parity; and source checks prohibiting `ensureProfile`, duplicate role allowlists, or panel API `empresa_id`. Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-routes-ui.test.mjs scripts/order-operations-ui.test.mjs` and retain the expected guard/parity failure.
- [ ] **GREEN:** Refactor `AuthContext` to the tagged fail-closed resolution and remove browser profile insertion/repair. Make `AdminLayout(requiredCapability = "panel.enter")` the content guard; map catalog, order, and payment pages to named capabilities; remove the panel-home admin-only redirect; drive sidebar/header and cancellation visibility through `hasPanelCapability`; retain order-state eligibility separately; and remove the products API query/meta tenant identifier. Retained direct catalog writes may carry schema-required company claims only because final RLS validates them; they are never authorization authority. Rerun focused tests to green.
- [ ] **TRIANGULATE:** Run focused UI/API suites, then `pnpm dev` against disposable local Supabase and record direct-route/network scenarios for admin, staff, company-bound cliente, null-company cliente, and failed profile lookup: no protected flash/fetch; staff denied payments/cancel; admin allowed; cliente denied panel. Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`.
- [ ] **REFACTOR:** Remove obsolete role branches and misleading tenant comments without moving business logic into UI, then rerun focused suites, lint, TypeScript, build, and `git diff --check`.

**Rollback boundary:** revert UI/context/routes while retaining server and database authority. If UI compatibility is uncertain, keep panel content unavailable rather than bypassing guards.

## Final local release gate — verification only

This gate adds no new behavior and is not a substitute for any work unit's RED/GREEN receipt. Before the tracker is eligible for delivery review:

- [ ] Run and retain exact results for:

```sh
pnpm test:instance-config
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs
node --test scripts/storefront-tenant-db.test.mjs
node --test scripts/catalog-stock-isolation-db.test.mjs
pnpm test:buyer-checkout
pnpm test:checkout-idempotency
node --test scripts/checkout-idempotency-db.test.mjs
node --test scripts/order-operations-api.test.mjs
node --test scripts/order-operations-ui.test.mjs
node --test scripts/order-operations-db.test.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-capabilities.test.mjs scripts/panel-authorization-api.test.mjs scripts/panel-routes-ui.test.mjs
node --test scripts/panel-authorization-preflight.test.mjs scripts/panel-authorization-db.test.mjs scripts/supabase-bootstrap.test.mjs
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

- [ ] Discover any additional atomic-stock, payment, or webhook suite present at apply time under `scripts/*test.mjs`; run each relevant suite and attach its exact result.
- [ ] Verify A→B and B→A independently for APIs and every retained direct catalog command; confirm admin/staff own-company allow, cliente denial for every catalog command, canonical service-role filters/RPC arguments, and unchanged persisted foreign rows.
- [ ] Run `git diff --exit-code main...HEAD -- supabase/migrations/20260902120000_multi_tenant_gate_1_catalog_stock_isolation.sql supabase/migrations/20260903120000_multi_tenant_gate_2_empresa_dominio.sql openspec/changes/multi-tenant-gate-1-isolation-hardening openspec/changes/multi-tenant-gate-2-tenant-resolution-v1` to prove historical Gate 1/Gate 2 artifacts are unchanged. Review the two permitted regression files to prove only auth-user fixture setup/cleanup changed and all historical behavioral assertions remain.
- [ ] For every child PR, attach Chain Context with start/end/dependency/follow-up/out-of-scope fields, changed-line count (`additions + deletions`), independent verification, rollback boundary, and a dependency diagram marking that PR with `📍`. Stop and split again if a child exceeds 400 authored lines; do not use `size:exception` without a separate maintainer decision.

## Separate authorization gates — not apply tasks

**Production read-only preflight:** Do not execute automatically. After the complete repository candidate and local release receipt are approved, request separate authorization to run the reviewed read-only SQL against production-equivalent/production data and retain its hash-bound, non-secret report. Any non-zero, ambiguous, or unverifiable result stops rollout with no mutation and no automatic remediation.

**Production rollout:** Do not execute automatically. A clean production preflight does not authorize mutation. Request another explicit authorization before applying the migration or deploying server/UI changes. Roll out database → immediate DB/catalog parity validation → server/API → UI → direct-route/capability/A↔B smoke; preserve fail-closed rollback and never restore client-selected tenancy, global company enumeration, email adoption, destructive FKs, public catalog/storage bypasses, or privileged null-company states.
