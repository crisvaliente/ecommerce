# Explore — Multi-Tenant Gate 3: Panel Authorization

## Objective and fixed direction

Gate 3 should make panel tenancy and capabilities fail closed around one canonical authority:

`authenticated auth user -> public.usuario.supabase_uid -> public.usuario.empresa_id + public.usuario.rol`

The retained roles are exactly `admin`, `staff`, and `cliente`. This gate must not introduce multi-company memberships, revive `public.membresia`, accept a tenant identifier from the client as authority, or rebuild browser-based catalog CRUD as a BFF. It must preserve the completed Gate 1 database catalog/stock isolation and Gate 2 host-based storefront resolution.

This exploration changes no product code, migrations, tests, configuration, or Gate 1/2 artifacts. Strict TDD applies to a later implementation phase, not to this phase.

## Repository evidence

### Canonical identity is partly established

- `src/lib/panelAuthorization.ts` validates the Supabase auth user, then selects `public.usuario` by `supabase_uid` and derives `empresa_id` and `rol`. It admits only `admin` and `staff` and returns a service-role client.
- `src/context/AuthContext.tsx` also reads `usuario` by `supabase_uid`, exposing the same three-role union and company ID to the UI.
- `supabase/migrations/20260801120000_security_tenancy_hardening.sql` explicitly declares `usuario.empresa_id + usuario.rol` as operational authority, revokes access to legacy `membresia`, and uses this authority in catalog mutation helpers.
- `usuario.supabase_uid` is globally unique in the baseline schema. The current role check is `admin|staff|cliente`.

The authority is therefore conceptually correct, but it is not yet expressed as one reusable panel session/capability contract across server and UI surfaces.

### Panel authorization is fragmented

- `src/components/layout/AdminLayout.tsx` admits `admin` and `staff` with a non-null company.
- `src/pages/panel/index.tsx` independently admits only `admin`, so a valid `staff` user can enter panel sections through the layout but is rejected by the panel home.
- `src/components/layout/panel/Sidebar.tsx` independently duplicates per-link role arrays. It hides Payments from staff, but `src/pages/panel/payments.tsx` itself uses only `AdminLayout`; a staff user navigating directly can render the page.
- `src/lib/orderOperationsUi.ts` and `src/lib/orderOperationsApi.ts` separately encode the admin-only cancellation rule. The API is authoritative, while the UI copy is useful for presentation but creates another capability definition.
- Product/category screens depend directly on `AuthContext` and Supabase RLS. This is compatible with the no-catalog-BFF direction, provided database authorization remains authoritative and the UI fails closed while profile resolution is absent or invalid.

A `PanelPrincipal`/panel-principal boundary and a shared capability vocabulary are therefore justified, but client-side capability checks must remain UX/navigation controls rather than security boundaries.

### Client tenant input still appears in a privileged API

`GET /api/panel/productos` currently requires `?empresa_id=...` and passes it to `authorizePanelAccess(req, empresa_id)`. The server compares it with the canonical profile, so it does not currently permit cross-tenant access, but the contract still presents client input as required tenant selection. Other panel order endpoints correctly derive company only from authorization.

Gate 3 should remove tenant selection from panel API request contracts. If a legacy `empresa_id` is supplied, the endpoint should either reject it as an unsupported field or ignore it consistently; rejecting it is clearer and prevents callers from believing it has authority. The authorized profile company must be the only value used in service-role filters and RPC parameters.

Direct browser catalog mutations necessarily include tenant-bearing row values under the current schema. Those values are data claims checked by RLS, not authorization authority. They can remain in this gate because replacing them with API endpoints would be the excluded catalog BFF rebuild. Their RLS policies and relationship checks must remain the enforcement boundary.

### Global company exposure remains open

The baseline migration grants `SELECT, INSERT` on `public.empresa` to `authenticated` and creates `select_empresa_authenticated ... using (true)`. The later security hardening removes client INSERT policies and replaces mutation policies, but does not remove this global SELECT policy. Consequently, authenticated users can still enumerate every visible `empresa` row through PostgREST even though panel tenancy is single-company.

No current browser product source reads `empresa`; provisioning and Gate 2 tenant resolution use service-role clients. This makes it feasible to replace global authenticated visibility with canonical-profile-scoped visibility without rebuilding the storefront. Exact table grants and all extant policies must be inspected in the target database, not inferred only from migration text.

### Provisioning and profile integrity have historical contradictions

- `20251229072838_usuario-contrato-tenancy-roles.sql` made `empresa_id` mandatory and used `ON DELETE CASCADE`.
- `20260105224857_fix_usuario_onboarding_empresa.sql` later made it nullable, added `onboarding`, and replaced the FK with `ON DELETE SET NULL`.
- The current check only says `onboarding = true OR empresa_id IS NOT NULL`; it permits `admin` or `staff` with no company when `onboarding=true`.
- `20260726000000_p0_lockdown_usuario_direct_writes.sql` revokes authenticated INSERT/UPDATE on `usuario`, while `AuthContext.ensureProfile` still attempts a browser insert. Correct provisioning now depends on the auth trigger or trusted service-role tooling.
- `handle_new_auth_user()` inserts a `cliente` profile with no company, but on unique violation it falls back to `UPDATE ... WHERE correo = new.email`. Global email uniqueness was removed in favor of tenant-scoped email uniqueness, so email is not a safe identity key. That fallback can be ambiguous and must not rebind a profile to another auth user.
- `scripts/lib/supabase-bootstrap.mjs` similarly considers email as a fallback, though it explicitly detects some UID/email conflicts and cross-tenant assignment. It is service-role tooling and should fail closed on every ambiguous or conflicting identity instead of adopting by email.

The gate should harden profile creation/assignment and FK/check semantics additively and only after data preflight. It should not reopen self-service company creation or invent a full onboarding product flow.

## Recommended minimum contract

### 1. One panel principal model

Define one small, shared model derived from the canonical profile, conceptually:

- authenticated user ID;
- canonical `empresaId`;
- canonical role (`admin|staff` for panel admission; `cliente` is an explicit denied state);
- named capabilities, not scattered role arrays;
- explicit failure outcomes such as unauthenticated, missing profile, ambiguous profile, invalid role, missing company, forbidden capability, and infrastructure failure.

Likely capabilities from current behavior are:

| Capability | admin | staff | cliente |
| --- | --- | --- | --- |
| Enter panel/home | yes | yes | no |
| Read/manage catalog and categories | yes | yes | no |
| Read orders and perform ordinary operational transitions | yes | yes | no |
| Cancel a pending order | yes | no | no |
| Access payment configuration placeholder | yes | no | no |

The precise names belong in proposal/design, but there should be one mapping consumed by `PanelPrincipal`/layout, sidebar, pages, and server authorization. Server APIs and database policies remain authoritative even when the UI uses the same capability semantics.

Every unresolved, malformed, duplicate, missing-company, unknown-role, or lookup-error state must deny panel content and privileged reads. Redirects must not briefly render protected children. A route hidden in navigation must also be guarded on direct navigation.

### 2. Server-derived tenant only

`authorizePanelAccess` should expose canonical principal resolution without accepting a requested company. Every panel API using service role must take `empresaId` only from that result and apply it to every tenant-bearing query/RPC.

For `/api/panel/productos`, remove the required tenant query contract and reject supplied tenant selectors. Continue explicitly filtering both `producto` and `producto_stock_resumen` by the authorized company. Order list/detail/transition behavior already follows the desired pattern and should be preserved.

Do not migrate ProductForm/category browser CRUD to server endpoints in this gate. Instead, retain explicit company predicates where present and prove that RLS rejects forged A-to-B IDs and tenant-bearing inserts/updates in both directions.

### 3. Close authenticated global `empresa` visibility

Replace permissive company SELECT with a policy that exposes at most the row whose ID equals the canonical authenticated user's `usuario.empresa_id`. Anonymous access should remain absent unless an independently justified public contract exists; Gate 2 does not need it because its private domain registry and storefront reads use service role.

Remove stale broad table privileges where safe, but preserve the minimum authenticated SELECT needed by any retained own-company UI and preserve service-role provisioning/resolution. Do not make `membresia`, `owner_auth`, `created_by`, host, query, cookie, or instance slug alternate panel authorities.

### 4. Safe profile provisioning and referential integrity

A later design should use a trusted, idempotent UID-keyed provisioning boundary. It must:

- create or find by `supabase_uid`, never adopt by email;
- reject duplicate/conflicting UID or email situations without reassignment;
- default new auth users to `cliente`, `empresa_id=null`, onboarding/incomplete;
- require `admin` and `staff` to have an extant company before they can become panel principals;
- assign role/company together through a trusted server/service operation, not direct authenticated writes;
- preserve exactly one company per user;
- define company deletion behavior deliberately rather than relying on the historical CASCADE/SET NULL drift.

A safe likely invariant is that privileged roles cannot have a null company, while a pre-onboarding `cliente` may. Whether deletion is `RESTRICT` (preferred for avoiding silent de-authorization/data loss) or an explicit controlled deprovisioning workflow is a proposal/design decision. Any FK replacement should minimize locking (for example, add a separately named constraint `NOT VALID`, validate after cleanup, then retire the old constraint) and must not silently cascade user or commerce data.

## Open data-integrity preconditions

Before any constraint, policy, or trigger rollout, the target database must be audited and remediation explicitly approved for:

1. zero duplicate non-null `usuario.supabase_uid` values and zero profiles whose UID does not correspond to the intended auth user;
2. zero `admin`/`staff` rows with null `empresa_id`, `onboarding=true` in contradiction with panel readiness, invalid roles, or orphan company references;
3. all intended `cliente` null-company rows being genuine incomplete/onboarding users, not damaged tenant assignments;
4. duplicate/ambiguous normalized emails across profile rows, especially any rows that the current trigger/bootstrap might adopt by email;
5. exact live FK definition and deletion action for `usuario.empresa_id`, plus dependent data that could be affected by company deletion;
6. exact live grants/policies on `empresa`, `usuario`, catalog, storage, order, payment, and Gate 2 domain tables, because historical migrations contain superseded permissive policies;
7. one canonical `usuario` row for each Gate 3 A/B test principal and no active authorization dependency on `membresia`;
8. existing service-role provisioning users/scripts remaining idempotent after UID-only conflict handling.

Unknown or dirty data must block constraint validation and role/company reassignment. The migration must report actionable counts and fail rather than guessing ownership.

## Scope and non-goals

### In scope

- Canonical panel principal resolution from auth UID to one `usuario` profile.
- Central panel admission and named capabilities for `admin` and `staff`; explicit denial for `cliente`.
- Consistent direct-route, navigation, page, and API fail-closed behavior.
- Removal/rejection of client tenant selection in panel API contracts.
- Own-company-only `empresa` visibility for authenticated users.
- Trusted UID-only profile provisioning hardening and safe role/company invariants/FK transition.
- Bidirectional tenant isolation for panel APIs and retained browser/RLS catalog operations.
- Regression preservation for Gate 1, Gate 2, checkout, stock, orders, and payments.

### Non-goals

- Multi-company memberships, tenant switching, invitations, or revival/removal of legacy `membresia` data.
- New roles or conversion to the legacy `rol_membresia` enum.
- Rebuilding all catalog/category/image CRUD behind a BFF.
- Self-service company registration, organization management, staff management, or a complete onboarding UI.
- Storefront host resolution, branding, locale/currency, payment account tenancy, or checkout host binding changes.
- Changes to order states, payment idempotency/consolidation, or atomic stock semantics.
- Cleanup of unrelated debug/prototype routes unless evidence proves they participate in panel authorization.

## Likely affected surfaces

Exact files belong to later design, but the probable surface is:

- `src/lib/panelAuthorization.ts` — canonical server principal, no requested company parameter.
- A small shared capability module and a centralized `PanelPrincipal`/guard boundary.
- `src/components/layout/AdminLayout.tsx` and `src/components/layout/panel/Sidebar.tsx`.
- `src/pages/panel/index.tsx`, `payments.tsx`, and pages needing explicit capabilities.
- `src/pages/api/panel/productos.ts`; order panel APIs mainly as preservation/regression targets.
- `src/context/AuthContext.tsx` — fail-closed profile state and removal of ineffective/untrusted self-provisioning behavior, without making it server authority.
- An additive migration covering company visibility and carefully staged profile/FK/check/trigger hardening.
- `scripts/lib/supabase-bootstrap.mjs` and smoke provisioning for UID-only conflict behavior.
- New focused unit/API/database tests and package scripts; existing Gate 1/2 and commerce tests remain mandatory regressions.

ProductForm/category code is primarily a validation target. Changes there should be limited to removing misleading client authority or adding explicit scoping, not moving the feature behind a new BFF.

## Risks

- **Migration lockout:** existing privileged users with null/mismatched companies could lose panel access. Preflight and explicit remediation are mandatory.
- **Destructive FK behavior:** changing deletion semantics carelessly can delete users, null privileged assignments, or interact with dependent commerce rows. Prefer a staged validated constraint and an explicit deletion policy.
- **UI/server drift:** a centralized UI capability map can still diverge from APIs/RLS. Security tests must target server and database enforcement, not merely hidden links.
- **Service-role blast radius:** panel APIs bypass RLS. A missing canonical company filter can expose another tenant; both A→B and B→A tests are required.
- **Email-based identity takeover:** trigger or bootstrap adoption by non-unique email can bind the wrong profile. UID-only identity and conflict rejection are essential.
- **RLS recursion/availability:** company policies that query `usuario` must work with existing forced RLS and self-select policy. The implementation should avoid recursive policy designs and fail closed on profile lookup errors.
- **Over-centralization:** capabilities should centralize authorization semantics, not absorb catalog business logic or create an oversized BFF.
- **Gate regression:** broad policy cleanup must not weaken Gate 1 catalog/stock protections or Gate 2's private domain registry and service-role resolver.

## Likely validation boundaries for later phases

Strict TDD should cover at least:

1. principal/capability table tests for admin, staff, cliente, unauthenticated, missing profile, null company, invalid role, duplicate/error outcomes;
2. route-level tests proving no protected content flash and that direct navigation obeys the same capability as sidebar visibility;
3. panel API tests proving tenant query/body/header/cookie inputs are rejected or ineffective and service-role queries use only the profile company;
4. A→B and B→A API tests for products, stock, order list/detail, and operations, with non-revealing cross-tenant outcomes;
5. authenticated PostgREST tests proving each principal can see at most its own `empresa` and cannot enumerate the other company;
6. direct-browser RLS tests for catalog/category/product/variant/image/storage reads and mutations, including forged tenant IDs in both directions;
7. provisioning tests for UID idempotency, duplicate email non-adoption, UID/email conflict failure, valid cliente-without-company creation, and invalid privileged-without-company rejection;
8. migration preflight/constraint tests, including company deletion behavior and validation against dirty fixture rows;
9. preservation of Gate 1 catalog/stock tests, Gate 2 resolver/two-host tests, checkout/idempotency, Order Operations API/UI/DB, payment/webhook behavior, lint, TypeScript, and build.

Use deliberately different A/B products, categories, stock, orders, and roles to avoid symmetric false positives. Assert not only empty/404 responses but also that privileged query/RPC parameters never contain visitor-selected company IDs.

## Workload forecast

A focused implementation is likely larger than the 400-line review budget:

| Work unit | Estimate |
| --- | ---: |
| Principal/capability model and UI integration | 140–240 |
| Panel API tenant-contract cleanup and tests | 100–180 |
| Company RLS plus profile/FK/trigger migration and DB tests | 180–320 |
| Provisioning hardening and tests | 90–170 |
| Cross-gate regression/documentation adjustments | 40–90 |
| **Total** | **550–1,000** |

With the session's auto-forecast strategy, later planning should identify reviewable, dependency-ordered slices. A sensible order is database preflight/invariants, canonical server principal/API cleanup, then UI capability consolidation and complete A/B regressions. No delivery decision is made in exploration.

## Evidence limitation

The request references audit observations 2784 and 2785. This session is configured for repo-local OpenSpec and exposes no Engram read operation, so those observations could not be retrieved directly. The conclusions above rely on the user-approved direction and current repository evidence; later proposal/design should reconcile any additional findings from those observations if they become available.

## Recommended next phase

Proceed only when explicitly approved to an SDD proposal. Before proposal, settle: (1) `empresa` visibility for company-bound clientes, if any; (2) desired company deletion behavior (`RESTRICT` versus a controlled deprovisioning operation); (3) whether legacy tenant fields should be rejected or ignored at panel APIs; and (4) the intended treatment of existing dirty privileged profiles discovered by preflight.
