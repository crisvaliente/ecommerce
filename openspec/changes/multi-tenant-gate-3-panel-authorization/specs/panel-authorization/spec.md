# Panel Authorization Specification

> **Current checkpoint (supersedes the active P1-planning pointer):** P1.1 and the agreed atomic P1.2+P1.3 integration scope are implemented and reviewed, with the separate canonical `empresa` SELECT prerequisite also implemented; see [the canonical evidence](../../p1-plan.md#2026-09-13--p1-implementation-and-native-review-checkpoint). They are not delivered, and no SDD controller, whole-P1, whole-Gate-3, deployment, or P2/P3 closure is claimed. No requirement in this specification is narrowed; explicit Specification/Design alignment remains required for evidence-obligation changes. Gate 3 remains OPEN and Unit 3 is FROZEN/NO RESCUE.

## Purpose

Define one fail-closed authorization contract for panel identity, capabilities, tenant isolation, profile lifecycle, and rollout safety while preserving Gate 1, Gate 2, and commerce integrity.

## Requirements

### Requirement: Canonical Panel Principal

The system MUST resolve a `PanelPrincipal` exclusively from the authenticated auth UID and exactly one canonical `public.usuario` row matched by `usuario.supabase_uid`. The principal's tenant and role MUST come only from that row's `empresa_id` and `rol`. Client input, email, host, cookie, slug, `membresia`, and ownership metadata MUST NOT override or supplement this authority.

The only recognized roles MUST be `admin`, `staff`, and `cliente`. Unauthenticated, missing-profile, duplicate or ambiguous-profile, lookup-failed, unknown-role, orphan-company, and `admin` or `staff` null-company states MUST fail closed. A `cliente` MAY have a null company only as a legitimate incomplete profile, but MUST NOT become a panel principal admitted to protected panel content.

#### Scenario: Resolve a valid company-bound principal

- GIVEN an authenticated UID maps to exactly one `usuario` with a recognized role and an extant company
- WHEN principal resolution completes
- THEN the resolved UID, role, and company MUST equal that canonical row
- AND no alternate identity or tenant source MUST affect the result

#### Scenario: Deny an unresolved or invalid principal

- GIVEN authentication or profile resolution is missing, ambiguous, malformed, invalid, orphaned, or failed
- WHEN protected panel content or an operation is requested
- THEN access MUST be denied
- AND protected data or content MUST NOT be returned or rendered, including transiently

**Test evidence:** Unit or integration table tests MUST cover every valid role and every listed fail-closed state, including a legitimate null-company `cliente` and invalid null-company privileged roles.

### Requirement: Exact Capability Matrix

The system MUST enforce this capability matrix without introducing additional roles or implicit privileges:

| Capability | `admin` | `staff` | `cliente` |
| --- | --- | --- | --- |
| Enter panel and panel home | MUST allow | MUST allow | MUST deny |
| Read and operate catalog and categories | MUST allow | MUST allow | MUST deny |
| Read orders and perform ordinary order workflows | MUST allow | MUST allow | MUST deny |
| Cancel an eligible order | MUST allow | MUST deny | MUST deny |
| Access payment configuration surfaces | MUST allow | MUST deny | MUST deny |
| Use authorized company or role administration operations | MUST allow where a trusted operation exists within scope | MUST deny | MUST deny |

Eligibility and business-state rules MUST still apply to every allowed operation. A capability grant MUST NOT bypass order, payment, or stock invariants.

#### Scenario: Staff performs ordinary panel work

- GIVEN a valid `staff` principal
- WHEN the user enters panel home, operates catalog, or performs an otherwise-valid ordinary order workflow
- THEN the action MUST be allowed for that principal's company

#### Scenario: Staff attempts an admin-only capability

- GIVEN a valid `staff` principal
- WHEN the user requests payment access, order cancellation, or company or role administration
- THEN the action MUST be denied at every applicable route and server boundary

#### Scenario: Cliente attempts panel access

- GIVEN a valid `cliente` profile with or without a company
- WHEN the user requests any panel capability
- THEN panel admission and the requested capability MUST be denied

**Test evidence:** Capability-table unit tests and route/API integration tests MUST prove every matrix cell. Existing business-rule tests MUST prove that an `admin` capability does not override operation eligibility.

### Requirement: Panel UI and Direct-Route Consistency

The panel UI MUST use the capability contract to control panel admission, navigation visibility, direct-route access, page content, and operation controls. A route or control hidden from navigation MUST also deny direct navigation. Protected children MUST NOT render before authentication, principal resolution, or capability evaluation reaches an allowed state.

UI enforcement MUST be treated only as a UX defense. Server authorization and database policies MUST remain authoritative, and a forged or stale client state MUST NOT grant access.

#### Scenario: Hidden route is requested directly

- GIVEN a principal lacks the capability for a panel route
- WHEN the URL is entered directly rather than selected from navigation
- THEN protected route content MUST NOT render
- AND any server operation behind the route MUST remain denied

#### Scenario: Principal resolution is pending or fails

- GIVEN protected panel navigation begins before a valid principal is available
- WHEN the UI is loading or resolution fails
- THEN protected children and privileged data MUST NOT appear, even transiently

**Test evidence:** Component and route-level tests MUST compare sidebar/control visibility with direct-route outcomes and MUST assert absence of protected-content flashes during loading and failure states.

### Requirement: Authoritative Panel API Authorization

Every panel API MUST authenticate the caller, resolve the canonical principal, and verify the required capability before initiating privileged work. Service-role access MAY begin only after those checks succeed. Every service-role tenant filter and tenant-bearing RPC argument MUST derive exclusively from the canonical principal's company.

Authorization, lookup, validation, or downstream failures MUST fail closed. An API MUST NOT emit a partial privileged payload when any required authorization or tenant-scoped operation fails.

#### Scenario: Authorized service-role operation

- GIVEN a valid principal has the required capability
- WHEN a panel API performs a service-role query or RPC
- THEN every tenant-bearing filter and argument MUST use only the principal's canonical company
- AND the response MUST contain only authorized data

#### Scenario: Authorization fails before privileged access

- GIVEN the caller is unauthenticated, has an invalid principal, or lacks the required capability
- WHEN a panel API is requested
- THEN privileged service-role work MUST NOT begin
- AND no complete or partial privileged payload MUST be returned

#### Scenario: A privileged downstream operation fails

- GIVEN authorization succeeds but a required tenant-scoped query or RPC fails
- WHEN the API forms its response
- THEN the request MUST fail closed
- AND successfully fetched privileged fragments MUST NOT be returned as a partial response

**Test evidence:** API integration tests with service-role query/RPC spies or equivalent explicit evidence MUST prove check ordering, canonical tenant arguments, capability denial, and absence of partial privileged responses.

### Requirement: Explicit Rejection of Legacy Tenant Input

A legacy panel API that receives `empresa_id` in any request location supported by that API MUST return HTTP `400`. The field MUST NOT be ignored, compared for authorization, or passed to a privileged filter or RPC argument, even when it matches the canonical company. Requests without the legacy field MUST derive tenancy solely from the canonical principal.

#### Scenario: Matching legacy tenant is supplied

- GIVEN a caller supplies `empresa_id` equal to the caller's canonical company
- WHEN a legacy panel API receives the field in a supported request location
- THEN the API MUST return HTTP `400`
- AND the supplied value MUST NOT reach privileged work

#### Scenario: Foreign legacy tenant is supplied

- GIVEN a caller supplies another company's `empresa_id`
- WHEN a legacy panel API receives the field in a supported request location
- THEN the API MUST return HTTP `400`
- AND no tenant data or privileged partial response MUST be disclosed

#### Scenario: Tenant input is omitted

- GIVEN an authorized request does not include `empresa_id`
- WHEN the API performs tenant-scoped work
- THEN it MUST use only the canonical principal company

**Test evidence:** API contract tests MUST exercise every supported request location for `empresa_id`, matching and foreign values, and assert HTTP `400` plus zero propagation into service-role filters or RPC arguments.

### Requirement: Own-Company Empresa Visibility

Authenticated access to `public.empresa` MUST expose at most the row whose ID equals the caller's canonical `usuario.empresa_id`. A company-bound `admin`, `staff`, or `cliente` MAY read that row; a legitimate null-company `cliente` MUST read no `empresa` row. Authenticated users MUST NOT enumerate other companies.

Untrusted clients MUST NOT create, update, or delete companies through this read contract. Trusted service-role provisioning and Gate 2 resolution MAY retain their separately authorized access and MUST NOT make browser access authoritative.

#### Scenario: Company-bound user reads empresa

- GIVEN an authenticated user has exactly one canonical profile assigned to company A
- WHEN the user reads `empresa` through the authenticated database boundary
- THEN at most company A MUST be visible
- AND company B MUST NOT be visible or enumerable

#### Scenario: Incomplete cliente reads empresa

- GIVEN an authenticated `cliente` has a legitimate null company assignment
- WHEN the user reads `empresa`
- THEN zero company rows MUST be visible

#### Scenario: Untrusted company mutation is attempted

- GIVEN an authenticated browser client
- WHEN it attempts to create, update, or delete `empresa` through untrusted access
- THEN the database authorization boundary MUST deny the mutation

**Test evidence:** Database/RLS integration tests MUST cover all three roles, a null-company `cliente`, enumeration attempts, and untrusted mutations; trusted Gate 2 and provisioning regressions MUST show their contracts still work.

### Requirement: Bidirectional Tenant Isolation

For distinct companies A and B, panel APIs and retained browser/RLS operations MUST prevent A from reading or mutating B and B from reading or mutating A. Coverage MUST include products, categories, variants or images where applicable, stock, order list/detail, and restricted operations. Test fixtures MUST be asymmetric enough to detect accidental symmetric or unscoped results.

Browser catalog requests MAY carry tenant-bearing row data required by the retained schema, but database RLS MUST treat those values only as claims to validate, never as authorization authority.

#### Scenario: Company A targets company B

- GIVEN principals and asymmetric commerce fixtures for companies A and B
- WHEN A attempts API access, forged-ID browser reads, inserts, updates, or operations against B
- THEN B's data MUST NOT be read or mutated
- AND no request-supplied tenant value MUST override A's canonical company

#### Scenario: Company B targets company A

- GIVEN the same principals and fixtures
- WHEN B performs the equivalent attempts against A
- THEN A's data MUST NOT be read or mutated
- AND outcomes MUST preserve the same isolation in the reverse direction

**Test evidence:** API and database/RLS integration suites MUST exercise A→B and B→A independently and verify both returned data and persisted state, including privileged query/RPC tenant arguments.

### Requirement: UID-Only Trusted Provisioning

Profile provisioning MUST occur only through a trusted boundary and MUST key identity by `supabase_uid`. Repeating provisioning for the same valid UID/profile association MUST be idempotent. Provisioning MUST NOT adopt, rebind, merge, or reassign a profile by email.

A new auth user profile MUST default to role `cliente`, null company, and an incomplete/onboarding state. Duplicate or conflicting UID/profile candidates, ambiguous normalized emails, and UID/email conflicts MUST fail explicitly without changing ownership, role, or company.

#### Scenario: Provisioning is repeated for the same UID

- GIVEN one valid profile is already bound to an auth UID
- WHEN trusted provisioning is repeated for that UID
- THEN it MUST resolve to the same profile without creating, adopting, or reassigning another profile

#### Scenario: Email matches a different or ambiguous profile

- GIVEN a new or existing auth UID has an email matching one or more profiles not canonically bound to that UID
- WHEN trusted provisioning runs
- THEN provisioning MUST fail explicitly
- AND no profile identity, role, or company assignment MUST change

#### Scenario: New user is provisioned

- GIVEN a new auth UID has no canonical profile or conflict
- WHEN trusted provisioning succeeds
- THEN exactly one UID-bound `cliente` profile MUST exist with null company and incomplete/onboarding state

**Test evidence:** Provisioning integration tests MUST cover UID idempotency, new-user defaults, duplicate email non-adoption, ambiguous email, duplicate UID candidates, and UID/email conflicts while asserting no mutation on failure.

### Requirement: Role, Company, and Deletion Integrity

Each profile MUST belong to at most one company. `admin` and `staff` profiles MUST reference an extant company; a legitimate incomplete `cliente` MAY have no company. Role and company assignment MUST occur together through a trusted operation, and direct authenticated profile writes MUST NOT bypass these invariants.

Company deletion MUST be available only through a trusted server-side boundary and MUST be blocked while dependent users exist. No company deletion path MUST cascade-delete profiles or leave `usuario.empresa_id` null. A future deprovisioning workflow is outside this specification.

#### Scenario: Privileged role lacks a valid company

- GIVEN a profile has role `admin` or `staff`
- WHEN its company is null, missing, or orphaned
- THEN the state MUST be rejected as invalid
- AND the profile MUST NOT receive panel access

#### Scenario: Legitimate incomplete cliente has no company

- GIVEN a profile is a confirmed incomplete/onboarding `cliente`
- WHEN it remains unassigned
- THEN the state MAY persist
- AND it MUST confer neither panel access nor company visibility

#### Scenario: Company with dependent users is deleted

- GIVEN an `empresa` has one or more dependent profiles
- WHEN deletion is attempted through an untrusted or trusted path
- THEN untrusted deletion MUST be denied and trusted deletion MUST be blocked
- AND no dependent profile MUST be deleted or changed to a null company

**Test evidence:** Database constraint, authorization, and deletion integration tests MUST cover valid role/company combinations, invalid privileged states, direct-write attempts, trusted assignment atomicity, and preservation of dependent profiles after failed deletion.

### Requirement: Explicit Two-State Preflight

The Gate 3 preflight MUST have exactly two valid, caller-selected modes: `PRE-MIGRATION` and `POST-MIGRATION`. The caller MUST explicitly select one of those exact modes. A missing, malformed, or unrecognized mode MUST produce `overall_status = unverifiable` and a non-zero exit.

A `PRE-MIGRATION` run MUST produce exactly one of these outcomes:

| `overall_status` | Exit | Meaning |
| --- | ---: | --- |
| `migration_required` | `0` | The database exactly matches the sole reviewed predecessor baseline and all migration-applicability checks are clean. |
| `blocked` | non-zero | A verified dirty-data, structural, history, authorization, or preservation stop condition exists. |
| `unverifiable` | non-zero | Required evidence cannot be obtained or interpreted unambiguously. |

`migration_required` MUST be the only non-blocking `PRE-MIGRATION` outcome. It MUST authorize only a separately reviewed execution of the exact Gate 3 migration identified in the report. It MUST NOT mean Gate 3 is GREEN, MUST NOT authorize runtime or deployment, and MUST NOT permit an unsafe or ambiguous state to remain after migration. `PRE-MIGRATION` MUST NOT emit `pass`.

A `POST-MIGRATION` run MUST produce exactly one of these outcomes:

| `overall_status` | Exit | Meaning |
| --- | ---: | --- |
| `pass` | `0` | The complete Gate 3 target-safe manifest and all preserved invariants match exactly. |
| `blocked` | non-zero | A verified target absence, retained predecessor, regression, drift, dirty-data, or bypass condition exists. |
| `unverifiable` | non-zero | Required evidence cannot be obtained or interpreted unambiguously. |

No other mode, status, or zero-exit combination MUST be accepted.

#### Scenario: Mode is omitted or invalid

- GIVEN the caller omits the mode or supplies anything other than the exact supported values
- WHEN the preflight reporting shell executes
- THEN exactly one report MUST identify the mode as invalid
- AND `overall_status` MUST be `unverifiable`
- AND the process MUST exit non-zero

#### Scenario: PRE proves the exact predecessor

- GIVEN the caller explicitly selects `PRE-MIGRATION`
- AND the database exactly matches the reviewed predecessor manifest
- AND every migration-applicability and preservation check is clean
- WHEN preflight completes
- THEN `overall_status` MUST be `migration_required`
- AND the process MUST exit `0`
- AND the outcome MUST authorize only the separately reviewed migration identity in that report

#### Scenario: POST proves the exact target

- GIVEN the caller explicitly selects `POST-MIGRATION`
- AND the complete target-safe manifest and preserved invariants match exactly
- WHEN preflight completes
- THEN `overall_status` MUST be `pass`
- AND the process MUST exit `0`

### Requirement: Exact PRE-MIGRATION Eligibility

`PRE-MIGRATION` MUST accept one and only one immutable, repository-reviewed predecessor baseline manifest for the single Gate 3 migration. That manifest MUST bind an exact baseline version and aggregate fingerprint to the repository commit, the Gate 3 migration path/name/content hash, the required migration-history predecessor and history-set identity, and a closed finite inventory of database objects.

The closed inventory MUST cover the exact names and definitions or canonical hashes of every relevant column, constraint, index, foreign-key action, RLS/forced-RLS setting, policy, grant, default ACL where relevant, function or procedure signature/body/configuration/owner/ACL, trigger identity/body/function binding/owner, view definition/options/owner/ACL, browser-callable RPC, and storage bucket/object authorization path. Its roots MUST include `auth.users` identity linkage; `public.empresa`, `public.usuario`, and `public.membresia`; the catalog surfaces `public.producto`, `public.categoria`, `public.producto_categoria`, `public.producto_variante`, `public.imagen_producto`, `public.producto_stock_resumen`, and `public.historial_stock`; the `producto-imagenes` bucket and relevant `storage.objects` paths; Gate 2 `public.empresa_dominio`; order and payment surfaces; and every helper or dependent object that can affect those roots. Broad name allowlists, wildcards, ignored counts, truncated inventories, and acceptance of unknown extra objects or permissive paths MUST NOT satisfy the manifest.

A known unsafe predecessor object MAY exist in `PRE-MIGRATION` only when all of the following are true:

1. The predecessor's exact name, definition/hash, ownership, ACL, policies, grants, and dependencies are enumerated in the baseline manifest as `replaceable_by_gate3`.
2. The reviewed migration maps it to an exact target replacement or removal.
3. The migration contains a fail-closed assertion for that exact predecessor before its first mutation, so any absence, extra object, definition mismatch, or concurrent drift aborts the migration without partial change.
4. No alternate path can bypass the future replacement.

An exact `replaceable_by_gate3` predecessor MUST NOT be classified as blocking merely because its target-safe replacement has not yet been applied. Any extra or missing predecessor object, hash mismatch, unexpected permissive path, unsafe object not explicitly marked `replaceable_by_gate3`, or migration/history mismatch MUST instead be `blocked`; inability to prove the state MUST be `unverifiable`. All unrelated Gate 1, Gate 2, company/profile, catalog/stock, storage, checkout, order, payment, and webhook objects MUST already match their required repository-reviewed fingerprints.

`PRE-MIGRATION` data and applicability checks MUST prove all of the following without remediation:

- every required auth UID/profile join is canonical, and no required UID is null, duplicated, orphaned, bound to the wrong identity, or represented by multiple candidate profiles;
- normalized profile/auth emails have no collision, ambiguity, or UID/email conflict, and no provisioning or authorization path depends on email adoption;
- roles are exactly `admin | staff | cliente`; company and onboarding states are valid; privileged profiles have one extant company; legitimate null-company clientes are confirmed incomplete; and no company/profile reference is orphaned;
- existing uniqueness and not-null prerequisites required by the migration are exact, and all rows already satisfy every future Gate 3 foreign key, check, and validation query;
- Gate 3 A/B test principals exist with exactly one canonical profile each and valid asymmetric tenancy fixtures;
- required transaction, lock, migration-history, executor permission, catalog/service-role evidence, and observability prerequisites are available and verifiable; and
- `membresia`, client-supplied `empresa_id`, row ownership metadata, public/anonymous grants, overlapping permissive policies, helpers, RPCs, views, or storage paths provide no unenumerated authorization authority.

Dirty data, a future constraint that cannot be validated without data repair, unknown structural drift, ambiguous state, insufficient permission/evidence, unavailable required lock, failed query, or any other unproven applicability condition MUST produce `blocked` or `unverifiable` and a non-zero exit. Preflight and the migration MUST NOT update, adopt, reassign, delete, or otherwise remediate data.

#### Scenario: Exact unsafe predecessor is replaceable

- GIVEN every unsafe predecessor object exactly matches an entry marked `replaceable_by_gate3`
- AND the identified migration contains the corresponding exact fail-closed replacement assertions
- AND no other stop condition exists
- WHEN `PRE-MIGRATION` runs
- THEN those enumerated predecessor objects MUST be accepted as the reason migration is required
- AND the outcome MUST be `migration_required`, not `pass`

#### Scenario: PRE finds dirty or non-applicable data

- GIVEN a canonical UID/profile, email, role/company/onboarding, orphan-reference, uniqueness/not-null, future-FK/check, or test-principal condition is dirty or cannot be validated without remediation
- WHEN `PRE-MIGRATION` runs
- THEN `migration_required` MUST NOT be emitted
- AND the outcome MUST be `blocked` or `unverifiable` with a non-zero exit
- AND no data MUST change

#### Scenario: PRE finds unknown structural or authorization drift

- GIVEN an expected predecessor is missing or mismatched, an extra object or permissive path exists, migration history differs, an unrelated preserved object regressed, or required evidence cannot be obtained
- WHEN `PRE-MIGRATION` runs
- THEN `migration_required` MUST NOT be emitted
- AND the outcome MUST be `blocked` or `unverifiable` with bounded evidence and a non-zero exit

### Requirement: Exact POST-MIGRATION Safety

`POST-MIGRATION` MUST emit `pass` and exit `0` only when the immutable target manifest matches exactly and is bound to the reported repository commit and exact Gate 3 migration identity. The target manifest MUST use the same closed-inventory and exact-fingerprint rules as the predecessor manifest.

The target manifest MUST prove canonical `auth.uid() -> public.usuario.supabase_uid -> usuario.empresa_id + usuario.rol` authority; the complete role-aware catalog command matrix; own-company-only authenticated `empresa` visibility; target foreign keys, checks, uniqueness, and nullability; UID-only idempotent conflict-rejecting provisioning trigger behavior; exact grants, policies, RLS state, functions, owners, ACLs, views and view options, RPCs, and storage authorization; and unchanged Gate 1, Gate 2, checkout, stock, order, payment, and webhook contracts. It MUST prove that every `replaceable_by_gate3` predecessor is absent or replaced exactly and that no `membresia`, client `empresa_id`, ownership metadata, role-blind rule, public/anonymous grant, overlapping policy, helper, RPC, view, storage path, or other alternate bypass remains.

Any missing target object, retained predecessor, extra object, dirty data, A↔B isolation failure, authorization regression, preserved-surface drift, ambiguity, or unverifiable check MUST produce `blocked` or `unverifiable` and a non-zero exit.

#### Scenario: POST retains a predecessor or bypass

- GIVEN the Gate 3 migration is recorded as applied
- BUT a `replaceable_by_gate3` predecessor or alternate permissive path remains
- WHEN `POST-MIGRATION` runs
- THEN `pass` MUST NOT be emitted
- AND the outcome MUST be `blocked` or `unverifiable` with a non-zero exit

#### Scenario: POST is missing or regresses a target contract

- GIVEN a target FK, check, policy, grant, function, trigger, view option, storage rule, canonical role check, own-company rule, or preserved Gate 1/Gate 2/commerce fingerprint is absent or differs
- WHEN `POST-MIGRATION` runs
- THEN `pass` MUST NOT be emitted
- AND the outcome MUST be `blocked` or `unverifiable` with a non-zero exit

### Requirement: Bounded Read-Only Preflight Evidence

Both preflight modes MUST execute in a repeatable-read, read-only transaction and MUST perform no DDL, DML, remediation, side-effecting function call, or production mutation. Where `psql` can execute the reporting shell, every run MUST emit exactly one bounded, valid, non-secret JSON document, including when a mode is missing or invalid, an expected object is absent, a check query fails, or inspection permission is insufficient. Any inspection statement that may fail MUST execute behind a transaction-preserving error boundary—such as a psql-managed savepoint with `ON_ERROR_ROLLBACK=on`, or an equivalently isolated read-only wrapper—so its SQLSTATE can be recorded without leaving the report transaction aborted. Disabling `ON_ERROR_STOP` alone MUST NOT be treated as error isolation, and no error may be swallowed into a successful status.

The report MUST include `mode`, `overall_status`, preflight contract version, baseline manifest version, target manifest version, repository commit, exact migration identity and hash, required migration-history identity, and an ordered check collection. Each check MUST have a stable name, status, count where meaningful, and only bounded non-secret sample IDs or canonical hashes. A manifest value that cannot be loaded MUST be represented explicitly and MUST make the result `unverifiable`. Reports MUST NOT contain emails, credentials, tokens, keys, raw commerce payloads, or unbounded/raw definitions that may expose secrets.

#### Scenario: Inspection fails after the reporting shell starts

- GIVEN `psql` can execute the reporting shell
- AND an expected object is absent, a query fails, or a required permission is unavailable
- WHEN either preflight mode runs
- THEN exactly one valid bounded JSON document MUST still be emitted
- AND the failing check MUST be explicit
- AND `overall_status` MUST be `blocked` or `unverifiable`
- AND the process MUST exit non-zero

#### Scenario: Preflight runs against any state

- GIVEN a valid, dirty, predecessor, target, or unverifiable database state
- WHEN preflight completes
- THEN data, schema, migration history, ACLs, policies, functions, triggers, views, and storage state MUST remain unchanged

### Requirement: Behavioral Proof of the Two-State Contract

Automated tests MUST behaviorally execute the preflight against disposable databases rather than validate SQL text alone. `PRE-MIGRATION` tests MUST independently cover every mandatory stop class: missing/invalid mode or metadata; canonical UID/profile join and normalized-email conflicts; role/company/onboarding and orphan references; uniqueness/not-null and future FK/check applicability; test-principal readiness; predecessor object/hash/count and migration-history mismatch; trigger/function/owner/ACL drift; grant/policy/RLS/helper/RPC/view/storage drift and unexpected permissive paths; unrelated Gate 1/Gate 2/commerce regression; and query, permission, lock, or evidence failure.

Tests MUST prove that the sole exact predecessor fixture returns only `migration_required` with exit `0`, and that each dirty or unverifiable PRE class returns non-zero without remediation. `POST-MIGRATION` tests MUST prove exact target `pass` and representative failures for a missing target, retained predecessor, alternate bypass, role/company policy regression, Gate 1/Gate 2/commerce drift, dirty data, and unverifiable inspection.

For every tested outcome, the harness MUST prove exactly one bounded non-secret JSON document and MUST compare comprehensive before/after fingerprints covering relevant data, schema, migration history, constraints/indexes, RLS/policies, grants/default ACLs, function/procedure definitions and ownership/ACL/configuration, trigger bindings, view definitions/options/ownership/ACLs, and storage bucket/object authorization state. Static repository assertions and commit-bound API, database matrix, A→B, and B→A receipts MUST complement the database report where SQL alone cannot prove service-role tenant arguments, rejection of client `empresa_id`, or TypeScript/SQL capability parity.

#### Scenario: PRE stop classes are exercised behaviorally

- GIVEN a disposable exact predecessor fixture and one independent fixture for each mandatory PRE stop class
- WHEN the test suite runs the real preflight command against every fixture
- THEN only the exact predecessor fixture MUST return `migration_required` and exit `0`
- AND every dirty or unverifiable fixture MUST emit one report and exit non-zero
- AND every before/after fingerprint MUST be identical for its run

#### Scenario: POST absence and regression classes are exercised behaviorally

- GIVEN a disposable exact target fixture and representative missing-object, retained-predecessor, bypass, regression, dirty-data, and unverifiable fixtures
- WHEN the test suite runs `POST-MIGRATION`
- THEN only the exact target fixture MUST return `pass` and exit `0`
- AND every failing fixture MUST emit one report and exit non-zero
- AND every before/after fingerprint MUST be identical for its run

### Requirement: Preserve Gate 1, Gate 2, and Commerce Contracts

Gate 3 rollout and rollback MUST preserve Gate 1 catalog and stock isolation, Gate 2 two-host storefront resolution, checkout host binding, checkout idempotency, atomic stock behavior, order operations, payment behavior, and webhook idempotency. Rollback MUST NOT restore client-selected panel tenancy, global authenticated company enumeration, email-based profile adoption, destructive company deletion behavior, or privileged null-company states.

If no runtime version can operate safely with the hardened database, the panel MUST remain unavailable rather than bypass authorization. UI rollback MAY occur only while authoritative server and database protections remain active.

#### Scenario: Mandatory regression suite runs

- GIVEN a Gate 3 release candidate
- WHEN release verification is performed
- THEN Gate 1, Gate 2, checkout, stock, order, payment, webhook, lint, strict TypeScript, and build regressions MUST pass before release

#### Scenario: A rollout stage fails

- GIVEN a database, API/server, or UI rollout stage fails
- WHEN rollback is selected
- THEN the system MUST retain a fail-closed authorization posture
- AND MUST NOT restore any prohibited legacy authority or unsafe data behavior

**Test evidence:** Release evidence MUST include the repository's Gate 1 database isolation suite, Gate 2 instance/two-host suites, buyer checkout and checkout-idempotency suites, established order/payment/webhook and atomic-stock suites, `pnpm lint`, `pnpm exec tsc --noEmit`, and the production build. Staged smoke evidence MUST include direct routes, all capability classes, and bidirectional A/B isolation.

## Decisions Required Before Tasks

No unresolved product decisions or user-approval questions remain in the approved proposal.

The Design phase must still select testable technical structures, database transition sequencing, failure-response representation where not fixed above, and reviewable delivery boundaries. These are design-level choices, not changes to the approved behavior. Tasks MUST NOT precede Design under the dependency graph.
