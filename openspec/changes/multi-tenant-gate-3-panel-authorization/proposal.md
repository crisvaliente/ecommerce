# Proposal — Multi-Tenant Gate 3: Panel Authorization

> **Current checkpoint (supersedes the active P1-planning pointer):** P1.1 and the agreed atomic P1.2+P1.3 integration scope are implemented and reviewed, with the separate canonical `empresa` SELECT prerequisite also implemented; see [the canonical evidence](./p1-plan.md#2026-09-13--p1-implementation-and-native-review-checkpoint). They are not delivered, and no SDD controller, whole-P1, whole-Gate-3, deployment, or P2/P3 closure is claimed. Approved security MUSTs and historical ledgers remain unchanged. Gate 1/2/Unit 1A remain CLOSED, Gate 3 remains OPEN, and Unit 3 remains FROZEN — NO RESCUE.

## Intent

Make panel tenancy and authorization fail closed around one canonical authority:

`authenticated auth user -> public.usuario.supabase_uid -> public.usuario.empresa_id + public.usuario.rol`

Gate 3 gives `admin`, `staff`, and `cliente` one explicit capability contract, removes client-selected tenancy from privileged panel APIs, limits authenticated company visibility to the user's own company, and hardens profile lifecycle rules without weakening Gate 1 catalog/stock isolation or Gate 2 host-based storefront resolution.

## Business problem and current gap

Panel access rules are currently duplicated across layouts, pages, navigation, APIs, RLS, and UI helpers. Those copies disagree: for example, `staff` can pass the panel layout but not the panel home, while a hidden payment link does not prevent direct page access. A privileged product API still requires a caller-provided `empresa_id`, even though the server compares it with the profile company. Authenticated users can also enumerate `empresa` globally under a permissive policy.

Profile provisioning and referential integrity have drifted as well. Historical behavior permits nullable company assignments in states that are unsafe for privileged roles, uses ambiguous email-based adoption paths, and may null user company assignments when an `empresa` is deleted. These gaps make authorization difficult to explain and increase the risk of tenant exposure, accidental lockout, or identity reassignment.

The desired product outcome is a predictable panel in which each user sees and can perform only the actions allowed by their canonical profile, direct navigation agrees with visible navigation, tenant identity never comes from the request, and inconsistent production data stops deployment instead of being guessed or silently repaired.

## Scope

- Resolve one panel principal from the authenticated auth UID and exactly one canonical `usuario` row.
- Centralize panel admission and named capability semantics for the existing `admin`, `staff`, and `cliente` roles.
- Apply the same capability decisions to panel home, navigation, direct page access, server APIs, and operation controls, while keeping APIs and database policies authoritative.
- Deny protected content while authentication/profile resolution is missing, malformed, ambiguous, invalid, or failed.
- Remove tenant selection from panel API contracts; reject legacy `empresa_id` inputs explicitly with HTTP `400`.
- Derive every service-role tenant filter and RPC argument exclusively from the canonical profile company.
- Restrict authenticated `empresa` reads to the caller's own canonical company row.
- Harden trusted profile provisioning to be UID-keyed, idempotent, and conflict-rejecting rather than email-adopting.
- Enforce valid role/company invariants and block `empresa` deletion so it cannot cascade users or leave `usuario.empresa_id` null.
- Validate bidirectional A-to-B and B-to-A isolation for panel APIs and retained browser/RLS catalog operations.
- Preserve Gate 1, Gate 2, checkout, stock, order, payment, and webhook integrity contracts.

## Non-goals

- Multi-company membership, tenant switching, invitations, or revival of `public.membresia` as an authority.
- New roles or replacement of the exact `admin | staff | cliente` role set.
- A catalog/category/image BFF rewrite; retained browser catalog operations continue to rely on authoritative RLS.
- Self-service company creation, company administration UI, staff/role administration, or a complete onboarding product flow.
- Changes to storefront host resolution, branding, locale/currency, checkout host binding, payment tenancy, order states, payment idempotency, or atomic stock semantics.
- Automatic cleanup, reassignment, or correction of inconsistent profiles found during preflight.
- Modification of Gate 1 or Gate 2 artifacts.

## Explicit authorization and lifecycle decisions

| Subject | Decision |
| --- | --- |
| Canonical authority | Only the authenticated auth user mapped through `usuario.supabase_uid` to `usuario.empresa_id + usuario.rol` determines panel tenant and role. Client input, email, host, cookie, slug, `membresia`, or ownership metadata cannot override it. |
| `admin` | May enter the panel, operate catalog and orders, cancel eligible orders, access payment configuration surfaces, and use authorized company/role administration capabilities where such trusted operations already exist or are introduced within this gate's backend hardening. |
| `staff` | May enter the panel and operate catalog and ordinary order workflows. May not access payments, cancel orders, or administer `empresa`, users, or roles. Hidden controls are not sufficient; direct pages and server operations must also deny access. |
| `cliente` | May read only their own `empresa` row when they have a company assignment. They have no panel admission, panel capability, or global company enumeration. A legitimate incomplete `cliente` may have no company and then reads no `empresa` row. |
| Unresolved/invalid principal | Unauthenticated, missing, duplicate/ambiguous, lookup-failed, unknown-role, orphan-company, or privileged null-company states fail closed without rendering protected content. |
| Company membership | Every profile belongs to at most one company. This gate introduces no membership collection or tenant switching. |
| Company deletion | `empresa` deletion is blocked by referential integrity and permitted only through a trusted server-side boundary. It must never cascade-delete profiles or produce `usuario.empresa_id = null`; any future deprovisioning workflow is separate scope. |
| Legacy tenant input | Any legacy panel API receiving `empresa_id` in a supported request location returns HTTP `400` explicitly. It is neither ignored nor compared as authorization input. |
| Inconsistent existing data | Preflight records actionable evidence and stops rollout. No migration, trigger, bootstrap script, or operator path auto-corrects, adopts, reassigns, or deletes affected profiles. Remediation requires a separate explicit decision. |

The shared capability vocabulary is a consistency mechanism, not a replacement for server checks or RLS. At minimum it must distinguish panel entry, catalog operation, ordinary order operation, order cancellation, payment access, and company/role administration.

## Affected areas

- `src/lib/panelAuthorization.ts` and a small shared principal/capability contract.
- `src/context/AuthContext.tsx` profile resolution and fail-closed client state, without making the browser authoritative.
- `src/components/layout/AdminLayout.tsx`, `src/components/layout/panel/Sidebar.tsx`, and centralized panel route/content guards.
- Panel home, payments, catalog, categories, orders, and any page exposing restricted operations.
- `src/pages/api/panel/productos.ts` and other panel APIs that accept tenant selectors or perform service-role queries/RPCs.
- Database policies/grants for `empresa`, profile role/company constraints, the `usuario.empresa_id` foreign key, and trusted profile provisioning behavior.
- Trusted bootstrap/provisioning tooling that currently considers email fallback.
- Focused unit, route, API, and database isolation tests, plus existing Gate 1/2 and commerce regression suites.

Product/category browser CRUD is primarily a validation surface. Changes there are limited to eliminating misleading authority and preserving explicit tenant scoping under RLS, not moving those workflows behind new APIs.

## Deployment and mandatory preflight stop conditions

Deployment is migration-first and must be staged:

1. Run a read-only production-equivalent preflight and retain counts plus non-secret identifiers sufficient for review.
2. Stop if any condition below is non-zero, ambiguous, or unverifiable. Do not apply constraints, policies, provisioning changes, or runtime authorization changes.
3. After separately approved remediation and a clean rerun, apply additive integrity/provisioning safeguards and least-privilege `empresa` visibility changes.
4. Validate database behavior with two-company principals before deploying server authorization and API contract changes.
5. Deploy the canonical principal/capability boundary and explicit legacy-input rejection.
6. Deploy UI/navigation integration only with compatible server enforcement already active.
7. Run production-equivalent direct-route, capability, and bidirectional tenant-isolation smoke checks before completing rollout.

Rollout stops with evidence when preflight finds or cannot rule out:

- duplicate non-null `usuario.supabase_uid`, a UID bound to the wrong auth identity, multiple candidate profiles, or reliance on email adoption;
- `admin` or `staff` with null/orphan company, contradictory onboarding state, unknown role, or otherwise invalid panel readiness;
- a null-company `cliente` that cannot be confirmed as a legitimate incomplete/onboarding profile;
- ambiguous normalized email collisions or UID/email conflicts;
- an unknown or unsafe live `usuario.empresa_id` foreign-key/delete action, or dependent data that makes deletion behavior uncertain;
- live grants/policies that differ materially from the reviewed model on `empresa`, `usuario`, catalog, storage, orders, payments, or Gate 2 domain tables;
- Gate 3 test principals without exactly one canonical profile, or any active authorization dependency on `membresia`;
- provisioning/bootstrap paths that cannot prove UID-only idempotency and explicit conflict failure;
- inability to prove that every service-role panel read/mutation is canonically tenant-scoped or that retained browser mutations remain protected by RLS.

Evidence must be actionable but must not expose secrets. Dirty data is never fixed as a side effect of rollout.

## Staged rollback

Rollback must preserve the fail-closed security posture:

1. If preflight or database validation fails, stop before runtime deployment and roll back only the uncommitted/failed database stage. Preserve evidence; do not weaken policies or repair data automatically.
2. If server/API deployment fails, disable affected panel routes or revert to the last database-compatible server version as one coherent unit. Do not restore client-selected tenancy or email-based profile adoption.
3. If UI integration fails, roll back the UI layer while retaining authoritative server capability checks, canonical tenant derivation, and database restrictions.
4. Keep validated integrity constraints, blocked company deletion, and own-company `empresa` visibility in place unless a separately reviewed migration proves their removal safe. Database rollback must never restore global company enumeration, `ON DELETE SET NULL`/cascade profile damage, or privileged null-company states.
5. If no compatible runtime can operate safely with the hardened database, keep the panel unavailable while checkout/storefront preservation is assessed; availability does not justify bypassing authorization.

Gate 1 and Gate 2 protections remain intact throughout rollout and rollback.

## Success criteria

- `admin`, `staff`, and `cliente` outcomes match the decision table on navigation, direct routes, rendered controls, server APIs, and database access.
- `staff` can enter panel/home and operate catalog and ordinary order workflows, but direct or indirect attempts to access payments, cancel orders, or administer company/roles are denied authoritatively.
- `cliente` cannot enter or enumerate the panel and can read at most their own assigned `empresa` row; a company-less legitimate `cliente` reads none.
- Every unresolved or invalid principal state denies protected content without a transient protected-content render.
- Supplying `empresa_id` to a legacy panel API produces HTTP `400`; no request tenant value reaches a privileged filter or RPC argument.
- Two distinct companies with asymmetric fixtures cannot read or mutate one another's products, categories, stock, orders, or restricted operations in either direction.
- Authenticated users cannot enumerate `empresa`; service-role provisioning and Gate 2 resolution continue to function through their trusted contracts.
- Profile creation is idempotent by `supabase_uid`; duplicate email never causes adoption or reassignment, and every conflict fails explicitly.
- `admin` and `staff` cannot exist without a valid company, while legitimate incomplete `cliente` profiles may remain company-less.
- Deleting an `empresa` through untrusted access is impossible, and attempted trusted deletion is blocked while dependent users exist; no path leaves their `empresa_id` null.
- Any inconsistent preflight result halts deployment with reviewable evidence and no automatic mutation.
- Existing Gate 1 isolation, Gate 2 two-host resolution, checkout/idempotency, stock atomicity, order operations, payment/webhook, strict TypeScript, lint, and build regressions remain green.

## Risks and tradeoffs

- **Operational lockout:** fail-closed profile checks may deny legitimate users whose data is already inconsistent. This is intentional; preflight and explicit remediation are required.
- **Service-role blast radius:** one missing canonical company filter can expose another tenant despite UI controls or RLS. Bidirectional API tests and query/RPC argument assertions are mandatory.
- **UI/server drift:** a shared capability map can still diverge from authoritative APIs or policies. Direct-route and server/database tests must verify every restricted capability.
- **Migration locking and drift:** replacing constraints or policies against an unknown live schema can interrupt service. Use additive, validated transitions only after exact live inspection.
- **Provisioning interruption:** removing email adoption may surface historical conflicts as explicit failures. This is safer than silent identity reassignment but increases short-term operator work.
- **Deletion rigidity:** blocking company deletion avoids profile/data corruption but defers legitimate deprovisioning to a future controlled workflow.
- **Catalog split boundary:** keeping browser CRUD avoids a broad BFF rewrite, but requires continued confidence in RLS and forged-ID regression coverage.
- **Support impact:** explicit HTTP `400` responses will break legacy callers still sending `empresa_id`; callers must remove the field rather than receive a compatibility grace period.
- **Cross-gate regression:** broad privilege cleanup could accidentally affect catalog, checkout, payments, or host resolution. Gate 1/2 and commerce suites are release gates.

## Review workload forecast

The exploration forecasts approximately **550–1,000 changed lines**, above the session's 400-line review budget:

| Review unit | Estimated changed lines |
| --- | ---: |
| Principal/capability model and UI integration | 140–240 |
| Panel API tenant-contract cleanup and tests | 100–180 |
| Company RLS plus profile/FK/provisioning migration and DB tests | 180–320 |
| Trusted bootstrap/provisioning hardening and tests | 90–170 |
| Cross-gate regression/documentation adjustments | 40–90 |
| **Total** | **550–1,000** |

Later planning should forecast dependency-ordered, reviewable slices—preflight/invariants, canonical server/API enforcement, then UI consolidation and full A/B regressions. This proposal does not choose a PR split or authorize implementation; any delivery decision remains gated before apply.

## Proposal status

The proposal question round is complete. The accepted product decisions are incorporated above without unresolved proposal questions. `skill_resolution: paths-injected`.
