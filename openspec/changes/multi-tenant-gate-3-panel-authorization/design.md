# Design — Multi-Tenant Gate 3 Panel Authorization

> **Current checkpoint (supersedes the active P1-planning pointer):** P1.1 and the agreed atomic P1.2+P1.3 integration scope are implemented and reviewed, with the separate canonical `empresa` SELECT prerequisite also implemented; see [the canonical evidence](./p1-plan.md#2026-09-13--p1-implementation-and-native-review-checkpoint). They are not delivered, and no SDD controller, whole-P1, whole-Gate-3, deployment, or P2/P3 closure is claimed. Normative design requirements and historical ledgers remain unchanged. Gate 3 remains OPEN; Unit 3 is FROZEN/NO RESCUE.

## Architecture summary

Gate 3 will use one authority chain everywhere:

```text
authenticated auth UID
  -> exactly one public.usuario row by supabase_uid
  -> usuario.rol + usuario.empresa_id
  -> named capability
  -> tenant-scoped operation
```

The browser and server will import one pure TypeScript capability map, but only the server and database are security boundaries. Panel API authorization will finish before a service-role client is constructed. Browser catalog CRUD will remain direct-to-Supabase; the new Gate 3 migration will replace the effective authenticated catalog policies so every retained direct SELECT/INSERT/UPDATE/DELETE boundary requires both same-company identity and canonical role `admin` or `staff`. A company-bound `cliente` will receive no catalog access. This design does not introduce a catalog BFF.

`CAPABILITIES_BY_ROLE` is the sole TypeScript role/capability definition. SQL independently encodes the same approved matrix at the database boundary because PostgreSQL cannot import TypeScript; command-by-command parity tests are the required drift detector. Neither representation derives authority from request or row-supplied tenant identity: both resolve `auth.uid() -> usuario.supabase_uid -> empresa_id + rol` and fail closed.

Database hardening will be delivered only through one new Gate 3 migration and new preflight files. That migration may drop and recreate effective catalog policies and grants atomically, but existing Gate 1 and Gate 2 migrations and OpenSpec artifacts remain byte-for-byte unchanged. Repository implementation and production rollout are separate activities: apply may build and validate changes locally, but it must not mutate production. Production preflight is read-only, and every production mutation requires separate rollout authorization.

`skill_resolution: paths-injected`.

## Fixed boundaries

### In scope

- A canonical profile and admitted `PanelPrincipal` model.
- One role-to-capability map shared by browser and server TypeScript.
- Independent SQL enforcement of the same matrix for every retained browser catalog table/view/storage command, with parity tests.
- Fail-closed panel layout, routes, navigation, pages, controls, and APIs.
- Canonical server tenant derivation and explicit rejection of legacy `empresa_id`.
- Own-company authenticated `empresa` reads and no authenticated company mutations.
- UID-only trigger and bootstrap profile provisioning.
- Additive profile identity, role/company, and company-deletion integrity.
- Read-only preflight, bidirectional A/B tests, and unchanged Gate 1/2 behavioral plus commerce regressions.

### Explicitly out of scope

- Multi-company membership, tenant switching, or `membresia` as an authority.
- A catalog/category/image BFF.
- New roles, invitations, staff administration UI, or company administration UI.
- Changes to storefront host resolution, checkout tenancy, stock algorithms, payment/webhook semantics, or order state rules.
- Editing Gate 1 or Gate 2 artifacts.
- Production mutation during repository apply.

## TypeScript contracts

### Shared capability module

Create `src/lib/panelCapabilities.ts` as a pure module with no React, Next.js, Supabase, environment, or server-only imports:

```ts
export const PANEL_ROLES = ["admin", "staff", "cliente"] as const;
export type PanelRole = (typeof PANEL_ROLES)[number];

export const PANEL_CAPABILITIES = [
  "panel.enter",
  "catalog.operate",
  "orders.operate",
  "orders.cancel",
  "payments.access",
  "companyRoles.admin",
] as const;
export type PanelCapability = (typeof PANEL_CAPABILITIES)[number];

export const CAPABILITIES_BY_ROLE = {
  admin: [
    "panel.enter",
    "catalog.operate",
    "orders.operate",
    "orders.cancel",
    "payments.access",
    "companyRoles.admin",
  ],
  staff: ["panel.enter", "catalog.operate", "orders.operate"],
  cliente: [],
} as const satisfies Record<PanelRole, readonly PanelCapability[]>;

export function hasPanelCapability(
  role: PanelRole,
  capability: PanelCapability,
): boolean;
```

The exported map is the sole TypeScript role/capability definition: no second TypeScript allowlist may appear in route descriptors, UI helpers, APIs, or tests. Those consumers name a capability and call `hasPanelCapability` rather than listing roles. SQL policies independently express the approved matrix at the database boundary; SQL is not generated from this module and is not a second TypeScript definition. A parity suite exercises every catalog command as `admin`, `staff`, and `cliente` so a TypeScript or SQL change cannot silently drift from the approved table. Business eligibility remains separate: for example, `orders.cancel` allows an admin to request cancellation, while the existing order transition/RPC rules still decide whether that specific order is cancellable.

### Canonical profile and panel principal

Create or keep these server-neutral shapes in the same module or a small `src/lib/panelPrincipal.ts` module:

```ts
export type CanonicalProfile = {
  profileId: string;
  authUserId: string;
  role: PanelRole;
  empresaId: string | null;
  onboarding: boolean;
};

export type PanelPrincipal = {
  authUserId: string;
  profileId: string;
  role: "admin" | "staff";
  empresaId: string;
};
```

A `cliente`, including a legitimate null-company onboarding cliente, may resolve as a canonical profile for browser state and own-company RLS behavior, but never becomes an admitted `PanelPrincipal`. A panel principal therefore makes the privileged invariants unrepresentable in TypeScript: it always has a non-null company and an admitted role.

Runtime parsing must validate UUID-like string fields, the exact role set, boolean onboarding, row count, and company existence. Type assertions alone are not validation.

### Browser resolution state

Refactor `AuthContext` to expose a tagged state instead of inferring authorization from nullable values:

```ts
type ProfileResolution =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "resolved"; sessionUser: User; profile: CanonicalProfile }
  | { status: "denied"; sessionUser: User | null; reason: ClientProfileFailure };

type ClientProfileFailure =
  | "missing_profile"
  | "ambiguous_profile"
  | "invalid_profile"
  | "lookup_failed";
```

The browser query is only a UX projection of the canonical profile. `AuthContext` must remove `ensureProfile`; an authenticated browser must never insert, adopt, or repair a profile. While state is `loading` or `denied`, no panel child or privileged fetch may start. The client may use `hasPanelCapability(profile.role, capability)` for rendering and redirects, but forged/stale state cannot authorize an API or database operation.

### UI guard

`AdminLayout` becomes the single panel content guard and accepts:

```ts
type AdminLayoutProps = {
  requiredCapability?: PanelCapability; // defaults to "panel.enter"
  children: ReactNode;
};
```

It renders only an interstitial until resolution is final and allowed. Anonymous users redirect to login; resolved/denied users without the capability redirect to the existing unauthorized route. A missing company on `admin`/`staff` is invalid, not a route to self-service company creation. The excluded self-service company path must not become a recovery authority.

Page requirements are explicit:

| Surface | Capability |
| --- | --- |
| `/panel` | `panel.enter` |
| product/category routes and controls | `catalog.operate` |
| order list/detail and ordinary operations | `orders.operate` |
| cancellation control | `orders.cancel` plus order eligibility |
| `/panel/payments` | `payments.access` |
| any trusted company/role operation introduced later | `companyRoles.admin` |

Sidebar and public header panel links use the same map. Payments receives a direct page guard. The panel home removes its admin-only copy so staff admission agrees with the layout. `orderOperationsUi.ts` uses `hasPanelCapability` for cancellation visibility and retains its state transition map separately.

## Server authorization architecture

### Separation of authentication, authorization, and privilege

Refactor `src/lib/panelAuthorization.ts` so authorization does not return or construct a service-role client:

```ts
type PanelAuthFailure = {
  ok: false;
  status: 401 | 403 | 500;
  error: "unauthorized" | "forbidden" | "internal_error";
};

type PanelAuthSuccess = { ok: true; principal: PanelPrincipal };

type PanelAuthResult = PanelAuthSuccess | PanelAuthFailure;

export async function authorizePanelRequest(
  req: NextApiRequest,
  requiredCapability: PanelCapability,
): Promise<PanelAuthResult>;

export function createPanelServiceClient(): SupabaseClient;
```

`authorizePanelRequest` reads only the public Supabase URL and anon key, parses the caller token, validates it with `auth.getUser()`, and queries `usuario` under that caller. The service-role environment key is neither read nor passed to `createClient` until the endpoint has an allowed principal. `createPanelServiceClient()` is called by the endpoint immediately before the first privileged query/RPC and only on the success branch.

The profile query uses `.eq("supabase_uid", authUser.id).limit(2)` rather than `.maybeSingle()`, so zero, one, and multiple rows are distinguished even if a target database has constraint drift. It selects only required fields. After validating the row, a company-bound profile gets an authenticated own-company `empresa` existence lookup. A failed query is infrastructure failure; an empty company result is an invalid/orphan profile. No email, host, cookie tenant, slug, owner field, or membership query participates.

### Exact request ordering

Every panel endpoint follows this order:

1. Reject unsupported HTTP methods (`405`) and apply the endpoint's existing rate limit (`429`). These existing transport statuses remain outside the Gate 3 error set.
2. Detect a top-level legacy `empresa_id`; if present, return `400 legacy_tenant_input` before parsing or authorization.
3. Validate route parameters and the complete top-level body/query shape; malformed input returns `400 invalid_request`.
4. Parse credentials and validate the auth user. Missing/rejected credentials return `401 unauthorized`; an auth-provider transport/5xx failure returns `500 internal_error`.
5. For a state-changing cookie-authenticated request, validate trusted origin. Failure returns `403 forbidden`. Bearer-only behavior remains as established by `apiSecurity`.
6. Resolve exactly one canonical profile and extant company. Missing, duplicate, malformed, unknown-role, orphan-company, privileged-null-company, or cliente panel state returns `403 forbidden`. Profile/company lookup operational errors return `500 internal_error`.
7. Check the named capability. Denial returns `403 forbidden` before any resource lookup or service-role construction.
8. Construct the service-role client.
9. Perform a query/RPC with every company filter or tenant argument set from `principal.empresaId`. Request values cannot be forwarded.
10. Validate every required result completely, then construct one response. Any required downstream failure returns `500 internal_error` with no privileged fragments.

For order cancellation, payload parsing determines that `orders.cancel` is required; other accepted transitions require `orders.operate`. Capability is checked before the order RPC. Existing transition-state validation and `409` domain conflict semantics remain unchanged.

### Stable error/status model and precedence

| Status | Public code | Meaning and precedence |
| --- | --- | --- |
| `400` | `legacy_tenant_input` | Exact top-level `empresa_id` was supplied in a supported request location, regardless of value or whether it matches the canonical company. This precedes auth. |
| `400` | `invalid_request` | Invalid route ID, unsupported top-level key, body/query type, or operation shape. This follows legacy detection and precedes auth. |
| `401` | `unauthorized` | No usable credential, rejected/expired credential, or no authenticated auth user. |
| `403` | `forbidden` | Trusted-origin failure, invalid/unadmitted canonical profile, or missing capability. Internal denial reasons are logged but not returned. |
| `404` | `not_found` | After successful capability authorization, the tenant-scoped resource query returns no row, whether the ID is absent or belongs to another company. |
| `500` | `internal_error` | Auth infrastructure unavailable, profile/company/resource lookup error, service-role misconfiguration, query/RPC error, or malformed downstream response. |

Method/rate statuses (`405`, `429`) and existing order-domain `409` responses are preserved. Public payloads always have `{ "error": <stable_code> }`; no database messages, profile state, company existence, or foreign ownership is returned. Logs use an operation name, safe allowlisted error code, and request correlation identifier, but never tokens, service keys, raw payloads, emails, or cross-tenant records.

A malformed resource ID is `400`, not `404`. A validly shaped absent ID and a valid foreign-tenant ID are the same `404 not_found`. An authenticated caller lacking the operation capability gets `403` before resource existence is checked, so it cannot use status differences to enumerate resources.

Principal lookup failure is not treated as absence: an actual query error is `500`, while a successful zero-row lookup is an invalid authenticated profile and returns the non-descriptive `403`. Required secondary lookup failures are fatal. In particular, product stock-summary failure and order item/payment-attempt failure can no longer produce tolerant or partially empty `200` payloads.

### Legacy `empresa_id` boundary

Add a small request-contract helper with endpoint-declared locations:

```ts
rejectLegacyEmpresaId(req, { query: true, body: false }); // GET list
rejectLegacyEmpresaId(req, { query: true, body: true });  // resource/PATCH
```

Detection means own-property presence of the exact key `empresa_id` at the top level. Empty strings, arrays, `null`, matching values, and foreign values all produce `400 legacy_tenant_input`. Query detection includes parsed URL query keys but ignores dynamic route key `id`. Body detection applies only to body formats the endpoint supports (currently parsed JSON object bodies). Nested keys, headers, and cookies are not supported tenant-input locations and are not interpreted as tenant selectors; nested/unknown payloads are rejected by normal complete-shape validation. `empresaId` is not accepted as an alias and is rejected as an unknown key.

The products UI removes the query parameter entirely. The products response also removes `meta.empresa_id` unless a demonstrated UI need exists; tenant IDs are not needed to render the list. Retained browser catalog writes may still carry schema-required `empresa_id`, but those are explicitly outside panel API request contracts and remain claims checked by RLS.

## Database design

### Sole authority and capability parity

`auth.uid() -> public.usuario.supabase_uid -> usuario.empresa_id + usuario.rol` is the only database authority. Gate 3 does not trust a row's `empresa_id`, a storage path, request data, email, host, `membresia`, or ownership metadata by itself. The target preserves the exact restricted, `STABLE`, `SECURITY INVOKER` helpers `can_mutate_catalog_empresa(uuid)` and `can_mutate_catalog_producto(uuid)` for catalog mutations and `soft_delete_imagen_producto(uuid)` for soft deletion, including their canonical role checks, owners, search paths, ACLs, and bodies. New role-aware SELECT policies encode the same predicate directly rather than broadening those helpers. The company helper returns true only when an exact canonical `usuario` row has `supabase_uid = auth.uid()`, `empresa_id = p_empresa_id`, and `rol IN ('admin', 'staff')`; null, duplicate, unknown-role, and lookup-invisible states return false under the preserved unique UID contract. Product-dependent checks additionally prove that the referenced product belongs to that same company.

The SQL predicate is the database's independent encoding of `catalog.operate`, not a generated import of the TypeScript map. Gate 3 must atomically remove every overlapping authenticated/public catalog policy that could OR around it, then create one effective policy per retained command. The target boundary is:

| Direct boundary | Gate 3 effective access |
| --- | --- |
| `producto`, `categoria` | Authenticated `SELECT/INSERT/UPDATE/DELETE` only for canonical `admin`/`staff` in `row.empresa_id`; UPDATE checks both old and new rows. |
| `producto_categoria` | Same role/company rule for all four commands, plus referenced product and category must belong to the row company. |
| `producto_variante` | Same role/company rule for all four commands, plus referenced product must belong to the row company. |
| `imagen_producto` | Same four-command rule through its referenced product/company; soft-deleted rows remain subject to the existing visibility semantics. |
| `producto_stock_resumen` | `SELECT` remains a `security_invoker` view; source `producto`/`producto_variante` policies therefore admit only same-company `admin`/`staff`. No direct mutation grant exists. |
| `storage.objects` in `producto-imagenes` | Authenticated `SELECT/INSERT/DELETE` only for canonical same-company `admin`/`staff`, with validated `empresa/<empresa-id>/producto/<producto-id>/<file>` path and product/company agreement. `UPDATE` remains denied. Drop the permissive `pi_read_public` policy; Gate 2 storefront continues using server-created signed URLs, so public bucket enumeration is not required. |
| `soft_delete_imagen_producto(uuid)` | Retain authenticated execution only with the same canonical `admin`/`staff` product/company check inside the security-definer function. |
| `historial_stock` | It is not a retained browser surface in repository usage; revoke direct authenticated privileges and remove authenticated policies. Trusted commerce/stock routines retain only their separately reviewed service-role/function contracts. |

The migration explicitly normalizes grants as well as policies. `authenticated` receives only the table/view commands listed above; `anon` and `public` receive no direct catalog table/view/storage-object access, while `service_role` keeps the access needed by Gate 2 storefront and trusted commerce. Existing order/payment/checkout RPC grants and atomic stock code are not changed. If preflight finds another effective catalog policy, grant, helper, view, or browser-called RPC not represented in this inventory, rollout is unverifiable and stops rather than leaving an unreviewed bypass.

Replace the global authenticated `empresa` SELECT policy with a direct, non-recursive policy:

```sql
create policy empresa_select_own_company
on public.empresa
for select to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = empresa.id
  )
);
```

This policy reads `usuario`; the retained `usuario_select_self` policy compares only `supabase_uid = auth.uid()` and does not query `empresa`, so the policy graph has no cycle. The catalog predicate also reads only `usuario` (and, for dependent rows, a parent catalog table) and never queries `empresa` through its policy. Do not use `membresia` or a `SECURITY DEFINER` helper to create an alternate policy authority.

Authenticated receives only `SELECT` on `empresa`. Remove authenticated `INSERT`, `UPDATE`, and `DELETE` grants and all company mutation policies, including the current catalog-staff update/delete policies. Service role retains only the company operations required by trusted bootstrap/provisioning and future separately reviewed trusted deletion. No browser company mutation path is introduced.

### New transactional migration

Use one new Gate 3 migration; do not edit historical migrations. It starts `BEGIN`, acquires a transaction advisory lock for Gate 3 and bounded table locks, sets a short `lock_timeout`, performs all dirty-data and expected-schema assertions first, and raises before the first DDL statement if anything is non-zero or unverifiable. Any later statement failure rolls back the entire migration, giving zero partial schema/policy changes.

The migration sequence is:

1. Assert the literal PRE rows for the Gate 3 affected roots and their directional security closure, then verify the named preservation-anchor counts/aggregates defined below. This includes expected columns/types/nullability, UID uniqueness, relevant constraints, RLS/forced-RLS, trigger/function identity, exact database-side exposed-schema/GraphQL reachability, bounded role topology, and absence of an active `membresia` authority. The outer preflight wrapper must already have authenticated and matched the running PostgREST configuration; the migration cannot replace that evidence with repository config. An unknown or additional permissive path aborts before DDL; unrelated platform catalogs are not inventoried.
2. Re-run migration-local data checks while writes are blocked: UID null/duplicate/orphan/wrong binding; normalized email ambiguity and UID/email conflicts; unknown roles; privileged null/orphan company; contradictory onboarding; unconfirmed null-company clientes; and test-principal readiness. Abort on any row. No `UPDATE`/`DELETE` remediation exists in the migration.
3. Preserve the existing `supabase_uid NOT NULL` and unique contract. If either is absent or differently defined, abort rather than silently rebuilding live identity authority. Add `usuario_supabase_uid_auth_fkey` as `FOREIGN KEY (supabase_uid) REFERENCES auth.users(id) ON DELETE RESTRICT NOT VALID`, then validate it. `RESTRICT` prevents auth deletion from silently deleting or orphaning a profile.
4. Add `usuario_privileged_company_check` as `CHECK (rol = 'cliente' OR (empresa_id IS NOT NULL AND onboarding = false)) NOT VALID`, validate it, and retain the existing exact role check and onboarding/company check. This allows incomplete null-company clientes but rejects privileged onboarding/null-company states.
5. Add a separately named `usuario_empresa_restrict_fkey` referencing `empresa(id) ON DELETE RESTRICT NOT VALID`, validate it, then drop the historical `ON DELETE SET NULL`/`CASCADE` FK only after validation. During the short overlap, any delete action is inside the same transaction; failure rolls back all effects. The final FK cannot null or delete profiles.
6. Replace `handle_new_auth_user()` with the UID-only definition, lock down its owner/search path/execute privileges, and recreate/verify the trigger only if its exact expected identity is present. Do not adopt by email.
7. Replace `empresa` policies/grants with own-company read only for authenticated and explicit trusted service-role grants. Preserve Gate 2 `empresa_dominio` policies/grants unchanged.
8. Preserve the exact canonical Gate 1 helpers and atomically replace only the literal catalog, company/profile, membership, stock-history, and `producto-imagenes` policy/grant rows enumerated in the affected-set table below. In particular, add role-aware SELECT, remove `pi_read_public`, enforce the exact storage path grammar, make OLD/NEW checks explicit for UPDATE, and revoke authenticated `historial_stock`. Re-assert `producto_stock_resumen.security_invoker = true`. Do not rewrite platform-wide `storage.objects` ACLs or any unlisted object.
9. Verify all affected POST rows plus the named preservation-anchor counts/aggregates, prove that no reachable permissive policy can OR around the canonical predicate, and assert Gate 1/Gate 2/commerce behavior before commit.

The transition is additive through this new migration: new named constraints coexist with old constraints before old unsafe constraints are removed, while policy/grant replacement occurs atomically in the same transaction. Historical Gate 1/Gate 2 migrations and OpenSpec artifacts are immutable. Objects have Gate 3-specific names so a separately reviewed forward rollback can address them. A failed migration rolls back automatically. After successful rollout, rollback is security-preserving: prefer reverting runtime/UI or disabling the panel; do not restore role-blind catalog access, public storage enumeration, global company enumeration, email adoption, privileged null-company states, or destructive FK actions. Removing validated integrity constraints or catalog policy hardening requires a separate migration and explicit security proof, not an automatic down script.

### Trigger/provisioning behavior

The hardened auth trigger is `SECURITY DEFINER`, owned by a controlled database owner, with `search_path = pg_catalog, public` and no public execute grant. For a new `auth.users` row it:

1. requires a usable UID and normalized email expected by this application;
2. rejects any existing profile with the same normalized email and a different UID;
3. inserts exactly one row keyed by `supabase_uid = NEW.id` (and current compatible profile ID convention), role `cliente`, `empresa_id = NULL`, `onboarding = true`;
4. on a same-UID retry, verifies that the existing row is the same canonical default association and returns without mutation;
5. raises on every UID, profile-ID, or email conflict.

It never updates a row selected by email and never changes an existing row's UID, role, or company while resolving a conflict. Trigger failure aborts auth-user creation in the same database transaction.

Role/company promotion is not exposed to authenticated clients. In this gate the bootstrap service-role path is the trusted assignment boundary: promotion from the exact fresh state (`cliente`, null company, onboarding true) to configured admin/company/onboarding false occurs in one guarded update. Exact desired state is idempotent. Cross-company, unexpected role/onboarding, missing profile for a pre-existing auth user, duplicate UID result, or any normalized-email conflict fails without profile mutation. No general company/role administration API is invented.

## Bounded two-mode preflight

### Decision first

The preflight is a verifier for the **closed Gate 3 authorization surface**, not a dump of the database or of every executable PostgreSQL object. It retains the existing two caller-selected modes and meanings:

| Required mode | Only zero-exit status | Meaning |
| --- | --- | --- |
| `PRE-MIGRATION` | `migration_required` | The exact reviewed predecessor, its Gate 3 affected set, and the bounded preservation anchors match. Only the separately reviewed Gate 3 migration is eligible; runtime rollout is not. |
| `POST-MIGRATION` | `pass` | The exact Gate 3 target, its affected-set closure, and all bounded preservation anchors match. |

Missing, empty, differently cased, or unknown mode is `unverifiable` and non-zero. Confirmed dirty data or drift is `blocked` and non-zero; missing permission, unknown reachability, failed classification, or unavailable evidence is `unverifiable` and non-zero. Neither mode mutates data or schema.

The operational artifact remains `scripts/sql/panel-authorization-preflight.sql`, bound to `gate3-preflight-v2`, predecessor `gate3-predecessor-v2`, target `gate3-target-v2`, repository baseline `526f614be9cc1efc9269bc62996eaa85b3504be2`, and the reserved migration path:

```text
supabase/migrations/20260904120000_multi_tenant_gate_3_panel_authorization.sql
```

The predecessor history receipt remains the reviewed ordered 67-file set with aggregate `2903b6394145b3c902452527ea7842f29b7af31ef0038693dccde5df2a0f8b54`, ending at `20260903130000_checkout_idempotency_service_role_select.sql`. PRE requires Gate 3 absent; POST requires its exact reviewed SHA and history row. A placeholder or missing migration SHA keeps operational execution sealed as `unverifiable`.

### Authoritative root registry

Roots are established from checked-in configuration, an independently authenticated live PostgREST exposure attestation, deterministic static DB/storage/Auth source receipts, reviewed migration replay, bounded role topology, and explicit storage/auth contracts. SQL validates database objects and effective privileges; it does **not** infer TypeScript/Auth call arguments or learn expected objects from the database under test. Repository configuration never substitutes for running exposure evidence.

#### PostgREST and exposed-schema roots

`supabase/config.toml` exposes exactly `public` and `graphql_public`; `extra_search_path = ["public", "extensions"]` is search-path context, not additional API exposure. The configuration file SHA and normalized schema list are sealed inputs.

Within an exposed application schema, a relation/view/routine is a root when either effective `anon`/`authenticated` privilege plus RLS permits a path, a checked-in browser/API receipt names it, or it is an RPC exposed by an effective execute grant. The reviewed root families are:

| Family | Exact roots and commands to receipt |
| --- | --- |
| Canonical identity/company | `public.usuario` `SELECT` (and predecessor browser provisioning writes that Gate 3 removes); `public.empresa` `SELECT` plus predecessor mutation grant/policy paths that Gate 3 removes; `public.membresia` predecessor policy/grant paths, target client access absent. |
| Browser catalog | `public.producto`, `public.categoria`, `public.producto_categoria`, `public.producto_variante`, `public.imagen_producto`: `SELECT/INSERT/UPDATE/DELETE`; `public.producto_stock_resumen`: `SELECT`; `public.soft_delete_imagen_producto(uuid)`: `EXECUTE`. |
| Browser storage | Bucket `producto-imagenes`: authenticated object `SELECT/INSERT/DELETE`, no `UPDATE`; browser code operations `upload`, `remove`, and authenticated `createSignedUrl`. |
| Other repository browser calls | `public.empresa_dominio` `SELECT` from the legacy collection route (expected database denial under Gate 2), `public.favorito` `INSERT`, `public.posts` `SELECT` if that demo route remains build-reachable, and debug-route `public.usuario` `SELECT/UPDATE` attempts. Absence/denial is represented explicitly rather than silently discarded. |
| Other predecessor exposed relations | The reviewed effective authenticated roots `public.carrito`, `public.carrito_producto`, `public.comprobante_pago`, `public.direccion_usuario`, `public.envio`, `public.favorito`, `public.log_actividad`, and `public.notificacion`, with exact grantee/command/RLS state from the pinned replay. They are one named exposure anchor unless a dependency reaches a Gate 3 root. |
| Exposed routines | Only routines in `public`/`graphql_public` with effective `anon` or `authenticated` execute, plus receipt-named RPCs. Known public routine identities are classified explicitly, including `can_manage_producto(uuid)`, `can_manage_producto_member(uuid)`, `current_empresa_id()`, `ensure_personal_org()`, `is_empresa_owner(uuid)`, `owns_carrito(uuid)`, `owns_pedido(uuid)`, `uid()`, and `user_is_member_of(uuid)`. The GraphQL facade below is a first-class application RPC root. Any write-capable, security-definer, membership/owner authority, or unclassified overload blocks. |

`graphql_public` is not empty: it contains the PostgREST-exposed extension facade `graphql_public.graphql(operationName text, query text, variables jsonb, extensions jsonb)`. Extension ownership does not exempt an object in an exposed application schema. The independently authored PRE and POST manifests therefore contain one unchanged `required_safe` row with all of these literal semantic fields:

| GraphQL field | Literal expected identity |
| --- | --- |
| Stable key and shape | `routine:graphql_public.graphql(text,text,jsonb,jsonb)`; argument names are `operationName`, `query`, `variables`, `extensions`; all four defaults are `NULL`; return type `jsonb`; language `sql`. |
| Owner/kind/mode | owner `supabase_admin`; `prokind=f` (function); `SECURITY INVOKER` (`prosecdef=false`); `VOLATILE` (`provolatile=v`). |
| Function config/search path | `proconfig=NULL`: there is no function-local `SET search_path`. The effective request search path is therefore not guessed from the definition; it is bound separately to the authenticated live PostgREST attestation below. |
| Normalized ACL | Sorted entries are `PUBLIC=X/supabase_admin`, `anon=X/supabase_admin`, `authenticated=X/supabase_admin`, `postgres=X/supabase_admin`, `service_role=X/supabase_admin`, and `supabase_admin=X/supabase_admin`. Effective `anon EXECUTE=true` and `authenticated EXECUTE=true` are explicit fields, including grant provenance through both direct ACL and `PUBLIC`; duplicate grant paths are normalized, not discarded. |
| Definition | Exact untruncated `pg_get_functiondef` canonical hash of the SQL facade with its defaults and named call to `graphql.resolve(query text, variables jsonb, "operationName" text, extensions jsonb)`; the body coalesces `variables` to `{}` and forwards the other three arguments. |
| Extension/dependency | Exact extension membership edge with dependency type `e` to pinned `pg_graphql` (reviewed predecessor version `1.5.11`, owner `supabase_admin`, schema `graphql`) and exact outgoing call dependency to the `graphql.resolve(...)` signature. `graphql` internals stop at that extension/version anchor; the exposed facade does not. |
| Exposure binding | `graphql_public` owner `supabase_admin`; sorted schema ACL `supabase_admin=UC/supabase_admin`, `postgres=U*/supabase_admin`, `anon=U/supabase_admin`, `authenticated=U/supabase_admin`, `service_role=U/supabase_admin`, and no PUBLIC USAGE; repository config binding `api.schemas=[public,graphql_public]`; independently authenticated live `db-schemas=[public,graphql_public]`. Both bindings and the routine identity must agree. |

The definition hash is taken from this exact canonical definition, including argument names/defaults and body; formatting is normalized only by the versioned canonicalizer:

```sql
CREATE OR REPLACE FUNCTION graphql_public.graphql(
  "operationName" text DEFAULT NULL::text,
  query text DEFAULT NULL::text,
  variables jsonb DEFAULT NULL::jsonb,
  extensions jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE sql
AS $function$
  select graphql.resolve(
    query := query,
    variables := coalesce(variables, '{}'),
    "operationName" := "operationName",
    extensions := extensions
  );
$function$;
```

The expected API-addressable inventory of `graphql_public` is exactly that one routine and no relation, view, materialized/foreign table, sequence, second routine/overload, or other PostgREST-addressable object. Any additional object in `graphql_public`, including another extension-owned object, enters the blocker set. A changed owner, kind, security mode, volatility, config/search-path behavior, ACL/effective execute, definition, dependency, extension identity/version, schema ACL, or live exposed-schema binding also blocks; it cannot be excused as platform or extension drift.

The checked-in receipt is `scripts/fixtures/panel-authorization-static-receipt-v2.json`. Database/storage records contain `{receipt_group, file_sha256, callsite_id, client=anon|authenticated|service_role, operation, database_object_or_bucket, selected_columns, filter_keys, rpc_argument_names, tenant_argument_source}`. Auth API records contain `{receipt_group="auth-api", file_sha256, callsite_id, operation, source, boundary=browser_anon|browser_session|server_caller_token|service_role_auth_admin, may_create_auth_user, trigger_consequence}`. PRE and POST values are literal, reviewed, and repository-commit-bound; none is generated from the database under test.

The database/storage source set remains exact: browser calls in `src/context/AuthContext.tsx`, `src/pages/panel/categorias/index.tsx`, `src/pages/panel/productos/index.tsx`, `src/pages/panel/productos/ProductForm.tsx`, `src/utils/storageProductoImagen.ts`, `src/pages/coleccion/index.tsx`, `src/pages/nuevo-favorito.tsx`, `src/pages/post.tsx`, and `src/pages/debug/auth.tsx`, `src/pages/debug/deploy.tsx`; panel/server calls in `src/lib/panelAuthorization.ts`, `src/lib/orderOperationsApi.ts`, `src/lib/supabaseServer.ts`, `src/lib/storefrontCatalog.ts`, `src/pages/api/panel/productos.ts`, `src/pages/api/panel/pedidos.ts`, and `src/pages/api/panel/pedidos/[id].ts`; commerce calls in `src/pages/api/ecommerce/pedido.ts`, `src/pages/api/ecommerce/pedido/[id].ts`, `src/pages/api/ecommerce/intento-pago.ts`, `src/pages/api/ecommerce/mi-cuenta/direccion.ts`, and `src/pages/api/webhooks/mercadopago/index.ts`; trusted tooling in `scripts/bootstrap-instance.mjs`, `scripts/bootstrap-smoke-users.mjs`, and `scripts/lib/supabase-bootstrap.mjs`, `scripts/lib/tenant-domain.mjs`.

#### Exact Supabase Auth API source receipt

Repository-wide discovery walks every repository-tracked JavaScript/TypeScript module (`js`, `jsx`, `mjs`, `cjs`, `ts`, `tsx`, `mts`, `cts`) outside dependency/build/generated directories and covers direct, member, destructured, and aliased Supabase Auth API calls plus every Supabase client construction/import. Files are then classified as `production-browser`, `production-server`, `production-tooling`, or `test-fixture`; test-only calls cannot satisfy production coverage, and no unclassified directory/file is ignored. The current production source set and boundaries are:

| Operations | Exact current source files | Boundary and consequence |
| --- | --- | --- |
| `signUp` | `src/pages/auth/register.tsx` | `browser_anon`; may create `auth.users`, so successful creation must fire `auth.users.on_auth_user_created -> public.handle_new_auth_user() -> exactly one UID-keyed default public.usuario`; browser metadata/profile state grants no authority. |
| `signInWithPassword` | `src/pages/auth/login.tsx` | `browser_anon`; creates a session only, never a profile authority. |
| `signInWithOAuth` | `src/pages/auth/login.tsx`, `src/pages/auth/register.tsx`, `src/services/authService.ts` | `browser_anon`; a first provider login may create `auth.users` and must have the same trigger consequence as signup. Redirect and provider metadata are not tenant/role authority. |
| `exchangeCodeForSession` | `src/pages/auth/callback.tsx`, `src/services/authService.ts` | `browser_anon -> browser_session` callback completion; it can materialize the OAuth session but cannot adopt/create/promote a profile outside the auth-user trigger consequence. |
| `resend(type=signup)` | `src/pages/auth/register.tsx` | `browser_anon`; delivery only, no authorization consequence. |
| `getSession` | `src/context/AuthContext.tsx`, `src/pages/mi-cuenta.tsx`, `src/pages/debug/deploy.tsx`, `src/pages/debug/auth.tsx`, `src/pages/panel/productos/index.tsx`, `src/pages/panel/pedidos/index.tsx`, `src/pages/panel/pedidos/[id].tsx`, `src/pages/checkout/resultado.tsx`, `src/components/ui/ShoppingCart.tsx` | `browser_session`; token/UX transport only. A session, claim, or client-cached profile is never authorization authority. Each callsite is separately receipted even where a file has two calls. |
| `getUser` | `src/pages/panel/productos/ProductForm.tsx`, `src/pages/debug/auth.tsx` | `browser_session`; identity/UX observation only and never panel or tenant authority. |
| `onAuthStateChange`, `signOut` | `src/context/AuthContext.tsx` | `browser_session`; lifecycle notification/session revocation only. Components that call the context `signOut` are consumers, not additional direct Supabase Auth roots. |
| implicit persisted-session load, URL detection, and token auto-refresh | `src/lib/supabaseClient.ts` | `browser_session`; exact client options (`persistSession`, `detectSessionInUrl`, `autoRefreshToken`, storage-key source) are receipted as implicit Auth API behavior, not authority. |
| caller-token `getUser` | `src/lib/panelAuthorization.ts`, `src/pages/api/ecommerce/pedido.ts`, `src/pages/api/ecommerce/pedido/[id].ts`, `src/pages/api/ecommerce/intento-pago.ts`, `src/pages/api/ecommerce/mi-cuenta/direccion.ts` | `server_caller_token`; authentication only. Authorization still requires the canonical UID profile and server-derived tenant. |
| `admin.listUsers`, `admin.createUser`, `admin.updateUserById` | `scripts/lib/supabase-bootstrap.mjs` (called only by `scripts/bootstrap-instance.mjs` and `scripts/bootstrap-smoke-users.mjs`) | `service_role_auth_admin`, classified separately from browser/session operations. `createUser` must fire the same auth-user trigger; list/update cannot select a profile by email or grant role/company authority. |

Every row includes a stable AST-derived callsite ID and file SHA, so repeated operations cannot collapse into one observation. The scanner fails on computed Auth method names, unresolved client aliases, a new Supabase client construction or Auth operation outside the exact classified set, deletion/rename without receipt update, source hash drift, or an operation whose boundary/consequence is absent. New Auth operations such as OTP, password reset, anonymous sign-in, MFA, identity linking, session setting/refresh, user update/delete, or any new admin call are blockers until explicitly reviewed. The scanner also proves no browser bundle imports a service-role client/key. No client Auth operation, callback input, JWT claim, provider/email metadata, or session cache becomes authorization authority.

#### Live PostgREST exposure attestation

The repository SHA of `supabase/config.toml` is necessary but insufficient: production can run different PostgREST settings. Both modes require a bounded, non-secret `gate3-postgrest-runtime-v1` attestation supplied to the checked-in wrapper. The wrapper compares it with the reviewed `[api]` values `enabled=true`, normalized ordered `schemas=[public,graphql_public]`, `extra_search_path=[public,extensions]`, and `max_rows=1000`; it also pins effective `db-anon-role=anon` to the role-topology anchor. The required canonical envelope is:

```json
{
  "attestation_version": "gate3-postgrest-runtime-v1",
  "environment": "local-fixture|production",
  "project_ref": "non-secret expected project identity",
  "observed_at": "RFC3339 UTC",
  "expires_at": "RFC3339 UTC",
  "nonce": "single-run non-secret nonce",
  "source_kind": "test-fixture|supabase-control-plane|approved-runtime",
  "source_subject": "bounded control-plane/runtime resource identity",
  "postgrest_release": "version or immutable image digest",
  "effective": {
    "api_enabled": true,
    "db_schemas": ["public", "graphql_public"],
    "db_extra_search_path": ["public", "extensions"],
    "db_anon_role": "anon",
    "db_max_rows": 1000
  },
  "authentication": {
    "method": "test-fixture|authenticated-read-only-control-plane|signed-runtime-evidence",
    "issuer": "non-secret issuer/workflow identity",
    "audience": "gate3-preflight",
    "verified": true
  },
  "evidence_sha256": "sha256 of the canonical evidence payload",
  "signature": "detached signature/reference; omitted only for explicit test fixture mode"
}
```

The production collector is a separately approved, read-only operation. It reads the effective running PostgREST configuration from the authenticated Supabase control plane or an approved runtime endpoint over verified TLS, binds project/resource identity, immutable PostgREST release, nonce, issue/expiry time, and emits only the keys above. Access tokens, headers, database URLs, JWT secrets, service keys, complete environment blocks, and unrelated settings are neither emitted nor hashed into the report. Signature/provenance verification uses a reviewed trust identity outside the evidence file; self-asserted `verified=true` is never sufficient. Collection performs no control-plane, database, branch, migration, or production mutation.

The wrapper requires `--postgrest-attestation <path>`, rejects duplicate/unknown fields, stale or replayed production evidence, wrong project/audience/issuer, unverifiable signature/provenance, an unapproved source kind, and any mismatch with `supabase/config.toml`. It canonicalizes the accepted envelope, hashes it, and passes the hash plus normalized effective fields and verification result into the SQL transaction. The one bounded report includes `postgrest_runtime_attestation_sha256`, source kind, non-secret subject, observed/expiry times, PostgREST release, and comparison status; it never includes the signature or credentials. If evidence is missing, unreadable, unauthenticated, stale, malformed, or mismatched, the wrapper emits the single bounded `unverifiable` report and exits non-zero before treating PRE or POST as eligible. A repository/config hash without this accepted runtime hash can never produce `migration_required` or `pass`.

Local tests use a checked-in explicit fixture attestation with a literal SHA and invoke a test-only `--fixture-attestation` path. That path requires the harness's explicit test marker and a disposable local target; the operational/production mode rejects `source_kind=test-fixture`, unsigned evidence, and fixture flags. Mutation tests independently change `api_enabled`, `db_schemas`, `db_extra_search_path`, `db_anon_role`, `db_max_rows`, subject, freshness, provenance, and hash and require `unverifiable`/non-zero. This test fixture demonstrates consumption and comparison only; it is not production evidence.

#### Service-role and trusted server roots

The source receipt must contain these exact named database roots and command families:

| Boundary | Exact service-role roots |
| --- | --- |
| Panel authorization/APIs | Caller-context `public.usuario SELECT` by `supabase_uid` and `public.empresa SELECT` by canonical company; after authorization, `public.producto SELECT`, `public.producto_stock_resumen SELECT`, `public.pedido SELECT`, `public.pedido_item SELECT`, `public.intento_pago SELECT`, and `public.transicionar_pedido_operacional(uuid,uuid,public.pedido_estado,public.pedido_estado,uuid,text) EXECUTE`. Its `p_empresa_id` must be receipted as `PanelPrincipal.empresaId`. |
| Gate 2 storefront | `public.empresa_dominio SELECT`; `public.producto`, `public.producto_variante`, `public.imagen_producto`, and `public.producto_stock_resumen SELECT`; trusted Storage `createSignedUrl` in `producto-imagenes` only after the exact DB image path has passed company/product/path validation. |
| Instance/bootstrap | Auth-admin list/create/update operations; `public.empresa SELECT/INSERT/UPDATE`; `public.usuario SELECT` and guarded promotion `UPDATE`; `public.empresa_dominio SELECT/INSERT`; optional `public.categoria`, `public.producto`, `public.producto_categoria UPSERT`; `public.direccion_usuario UPSERT`; Storage `listBuckets` restricted in the receipt to checking `producto-imagenes`. |
| Buyer checkout/account | `public.usuario SELECT`; `public.direccion_usuario SELECT/INSERT/UPDATE`; `public.pedido SELECT`; `public.pedido_item SELECT`; `public.intento_pago SELECT/UPDATE`; `public.crear_pedido_con_items_idempotente(uuid,uuid,uuid,jsonb,uuid,text) EXECUTE`; `public.crear_intento_pago(uuid,uuid,public.canal_pago_tipo) EXECUTE`. |
| Payment/webhook | `public.webhook_recepcion_mp INSERT/UPDATE`; `public.intento_pago SELECT/UPDATE`; `public.procesar_notificacion_intento_pago(uuid,public.intento_pago_estado) EXECUTE`; its dependency `public.consolidar_pago_pedido(uuid)`. |

A code receipt proves exact object and argument **names**, not runtime values. API tests separately prove canonical tenant provenance. A new browser/storage path or service-role relation/RPC absent from this receipt is unexpected. Because SQL cannot infer code arguments, a missing or mismatched receipt is `unverifiable`, never accepted from observed SQL behavior.

#### Storage and auth/profile roots

Storage has one application bucket root: `storage.buckets[id = 'producto-imagenes']`, which must remain private. The object root is `storage.objects` restricted to that bucket and the exact path grammar:

```text
empresa/<empresa-uuid>/producto/<producto-uuid>/<non-empty-single-segment-filename>
```

Both UUID segments must pass the canonical UUID shape before casts; the path has exactly five non-empty segments; the filename contains no `/`, `\\`, query/fragment marker, control byte, `.` or `..`; the product exists and belongs to the path company; and canonical `admin`/`staff` authority matches that company. Exact `storage.objects` policy identities, effective relation/schema grants needed by Storage API, bucket metadata, and calls to `can_mutate_catalog_empresa(uuid)`/`can_mutate_catalog_producto(uuid)` are in closure. Object names and metadata payloads are never emitted; only scoped count/hash evidence is retained. Platform storage internals outside this bucket are excluded unless they grant or route access into this path.

The auth/profile chain is rooted at `auth.users`, trigger `auth.users.on_auth_user_created`, `public.handle_new_auth_user()`, `public.usuario`, `public.empresa`, and legacy `public.membresia`. Its closure includes exact `usuario.supabase_uid` uniqueness/not-null state; `usuario_supabase_uid_auth_fkey`; `usuario_empresa_id_fkey`/`usuario_empresa_restrict_fkey`; `usuario_rol_check`; `usuario_empresa_o_onboarding`; `usuario_privileged_company_check`; profile policies/ACLs; company policies/ACLs; trigger binding/enabled state; function owner/security/search path/ACL/body; and every helper actually referenced by those policies or trigger. `public.usuario.usuario_set_uid` and `public.set_supabase_uid_from_jwt()` are explicit predecessor-removal roots, not incidental discoveries.

### Relevant transitive closure

Closure is directional and purpose-limited:

1. **Outgoing behavior edges:** from a root to objects required to execute or interpret it—view rewrite sources, policy expression references, trigger functions, statically recorded routine dependencies, FK targets, check/default expressions, referenced types/domains/operators/casts, and called routines.
2. **Incoming access-changing edges:** into a root or already-reachable node only from policies attached to its relation, view/rewrite definitions exposing it, triggers attached to it, routines/RPCs with an effective client/service receipt that access it, FK/check constraints that govern tenant identity, and relation/routine/schema/default ACL objects that can change effective access.
3. **No general reverse walk:** another table that shares a type, owner, schema, helper, or extension is not pulled in as a sibling. Incoming routines become nodes only when effectively client-callable, named by the static service receipt, or attached as a trigger/policy dependency.

Stable node classes and keys are:

| Class | Stable key rule |
| --- | --- |
| relation/view/materialized view | schema-qualified name and relkind; view definition/options are separate canonical fields |
| policy/rewrite/trigger | relation + object name; trigger constraint binding uses the qualified constraint key, never raw OID |
| function/procedure/aggregate | schema-qualified name plus identity argument types; aggregates only when rooted/reachable |
| type/domain/operator/cast | qualified semantic signature, only when it changes comparisons, path casts, role/state values, or an in-scope signature |
| constraint/index/FK/check | relation + exact object name, including validation/deferrability and FK actions |
| schema/default ACL/ACL/grant | qualified schema/object, owner, grantee and privilege; normalized sorted ACL entries |
| bucket/storage path | exact bucket ID and versioned path-policy key; object data represented by scoped count/hash only |
| migration/history/static receipt | version/path/receipt key and reviewed SHA-256 |
| PostgreSQL role | `role:<normalized-role-name>`; only the four rooted roles below, with literal booleans and safe normalized settings |
| role membership / SET ROLE reachability | `role-membership:<member>-><granted-role>` and `set-role:<session-role>-><target-role>`; names and semantic options only |
| PostgREST runtime attestation | attestation version + environment/project/source subject + canonical evidence SHA-256; never a token, secret, URL credential, or container environment dump |
| dependency | `from_stable_key -> to_stable_key` plus dependency kind; OIDs are joins only and never identity |

#### Bounded role-topology anchor

`role-topology-v1` roots exactly `authenticator`, `anon`, `authenticated`, and `service_role`. It is literal in PRE and POST and contains the four role nodes, every direct `pg_auth_members` edge for which either endpoint is rooted, safe role settings, role-switch defaults, and the complete non-self transitive `SET ROLE` target set from `authenticator`. It does not enumerate all cluster roles. External endpoint names such as `postgres` or `supabase_storage_admin` appear only where needed to identify a direct edge; their unrelated attributes and memberships do not widen the walk.

The reviewed PostgreSQL 15 predecessor/target role rows are:

| Role | `rolsuper` | `rolbypassrls` | `rolinherit` | `rolcanlogin` | `rolreplication` | Exact safe `rolconfig` |
| --- | --- | --- | --- | --- | --- | --- |
| `authenticator` | false | false | false | true | false | `lock_timeout=8s`, `session_preload_libraries=safeupdate`, `statement_timeout=8s` |
| `anon` | false | false | true | false | false | `statement_timeout=3s` |
| `authenticated` | false | false | true | false | false | `statement_timeout=8s` |
| `service_role` | false | **true** | true | false | false | empty |

`service_role.rolbypassrls=true` is an explicit existing trusted-server exception, not an omitted platform detail. It is why service-key provenance and delayed service-client construction remain mandatory. Any superuser bit on a rooted role; bypass-RLS on `authenticator`, `anon`, or `authenticated`; removal/change of the literal `service_role` exception; or any additional bypass/superuser role reachable from a rooted browser role is a blocker.

The direct edge set is exactly: `authenticator -> anon`, `authenticator -> authenticated`, and `authenticator -> service_role`, each granted by `postgres`; `postgres -> anon`, `postgres -> authenticated`, and `postgres -> service_role`, each granted by `supabase_admin`; and `supabase_storage_admin -> authenticator`, granted by `supabase_admin`. All have `admin_option=false`. PostgreSQL 15 does not expose per-membership `inherit_option` or `set_option`; canonical rows contain the literal sentinel `unsupported@postgresql-15`, never an inferred false. On a supported later major version those option fields become mandatory literal booleans and the version-anchor change requires review.

The effective non-self `SET ROLE` target set for an `authenticator` session is exactly `{anon, authenticated, service_role}` and all three are direct membership paths; no transitive extra target is allowed. `anon` and `authenticated` must have zero non-self `SET ROLE` targets and no direct or transitive path to `service_role`, any `rolbypassrls=true` role, or any `rolsuper=true` role. A new/removed membership, changed grantor/admin/inherit/set option, unexpected target, or ambiguous reachability blocks. The expected `authenticator -> service_role` path is classified only for a valid service-role JWT at PostgREST; static receipts prove the browser cannot construct/use that key, and PostgREST release/runtime attestations bind the component that authenticates the claim.

Role settings are normalized as sorted `name=value` text only for the safe literal `rolconfig` values above. `pg_db_role_setting` contributes the equivalent all-database rows for `authenticator`, `anon`, and `authenticated`, plus an exact zero-count assertion for defaults named `role` or `session_authorization` at cluster/current-database/rooted-role scope. Any such role-switch default blocks. The collector uses `pg_roles`, never selects `pg_authid.rolpassword`, and excludes all password/verifier fields. Unrelated database settings—especially application JWT settings—are neither selected, emitted, nor hashed; unknown settings on a rooted role fail classification without exposing their value.

Canonical definitions are untruncated UTF-8 SHA-256 inputs with sorted ACLs/roles/config/options/dependencies. Identifiers and enum/text values use normalized Unicode and deterministic PostgreSQL identifier quoting; booleans and supported-option sentinels are explicit. No expectation comes from runtime output, catalog order, OID, wildcard, prefix allowlist, truncated list, password, token, or secret.

`pg_catalog`, `information_schema`, extension schemas, and Supabase system internals are stop boundaries. Record PostgreSQL major/server version, Supabase CLI/config version, canonicalizer version, and exact extension names/versions as bounded anchors. Do not enumerate ordinary system routines, aggregates, casts, operators, or ACLs merely because they are executable. Include one only when an in-scope root directly relies on its **non-default** semantics and drift could alter authorization; otherwise the version anchor owns that dependency.

### Gate 3 affected set and literal PRE/POST manifest

The affected set contains every object Gate 3 creates, drops, replaces, alters, or whose effective authorization semantics change, plus the security-relevant closure just defined. An unchanged closure node is still literal in both modes with the same hash; it is not moved into the broad preservation aggregate.

Every row has `manifest_version`, `mode`, `stable_key`, `kind`, `expected_count`, `expected_state`, `owner`, `normalized_acl_sha256`, `dependency_sha256`, `canonical_definition_sha256`, `pre_classification`, `post_key`, and `post_state_or_sha256`. Counts are normally `0` or `1`. PRE classifications are `required_safe`, `replaceable_by_gate3`, or `required_absent`. Every replaceable row maps to one exact POST identity or `ABSENT`; self-mapping is allowed only for `CREATE OR REPLACE` when the PRE and POST definition hashes differ and both are literal.

The expected affected root families and commands are closed as follows.

| Root family | Exact PRE identities | Exact POST identities / command result |
| --- | --- | --- |
| Profile integrity | `public.usuario.usuario_empresa_id_fkey`; absence of the two new FKs/check; unchanged `usuario_supabase_uid_unique`, `usuario_rol_check`, `usuario_empresa_o_onboarding`, and `supabase_uid NOT NULL` in closure | Add/validate `usuario_supabase_uid_auth_fkey` (`auth.users(id) ON DELETE RESTRICT`), add/validate `usuario_privileged_company_check`, add/validate `usuario_empresa_restrict_fkey` (`empresa(id) ON DELETE RESTRICT`), then drop exact old company FK. |
| Provisioning | `public.handle_new_auth_user()`, `auth.users.on_auth_user_created`, `public.usuario.usuario_set_uid`, `public.set_supabase_uid_from_jwt()` | Replace function body/owner/security/search path/ACL; recreate/verify exact auth trigger; old usuario trigger and helper `ABSENT`. Commands: `CREATE OR REPLACE FUNCTION`, `REVOKE EXECUTE`, exact `DROP/CREATE TRIGGER`, `DROP FUNCTION`. Auth API `signUp`, first-user OAuth, and admin `createUser` receipts all map to this trigger chain. |
| GraphQL exposed RPC | Exact unchanged `graphql_public.graphql(text,text,jsonb,jsonb)` row: named/default arguments, `jsonb` result, owner `supabase_admin`, function/invoker/volatile, null `proconfig`, normalized ACL and effective anon/authenticated execute, untruncated definition hash, `graphql.resolve(...)` call, `pg_graphql` extension-membership dependency, schema ACL, and repository-plus-live exposed-schema binding | Same literal `required_safe` row in POST. No second `graphql_public` API-addressable object or overload; extension ownership is not an exemption. |
| Auth API static reachability | Exact per-callsite operation/source/boundary rows for signup, password login, OAuth initiation/callback, resend, session/user reads, auth-state subscription, logout, implicit refresh/session options, caller-token validation, and separate auth-admin list/create/update | Same reviewed source closure after intended Gate 3 edits; every user-creation-capable operation retains the exact trigger consequence, and no client operation is authority. New/unclassified calls or source SHA/set drift block. |
| `usuario` access | Policies `usuario_insert_self`, `usuario_update_self`, `usuario_update_own`, `usuario_select_own`, and `usuario_select_self`; exact relation ACL | Only `usuario_select_self` (`SELECT`, authenticated, `supabase_uid = auth.uid()`); authenticated relation command `SELECT` only. Dropped policies map to `ABSENT`; retained policy/ACL get exact target hashes. |
| `empresa` access | Policies `empresa_sel_own`, `empresa_select_members`, `select_empresa_authenticated`, `empresa_update_catalog_staff`, `empresa_delete_catalog_staff`; exact relation ACL | Only `empresa_select_own_company` (`SELECT` authenticated through canonical `usuario`); no PUBLIC/anon/authenticated `INSERT/UPDATE/DELETE`. |
| Membership authority | `membresia_delete_admins`, `membresia_insert_admins`, `membresia_select_members`, `membresia_update_admins`; relation ACL; referenced `user_is_member_of(uuid)` execute/dependency state | All four policies absent; no PUBLIC/anon/authenticated relation privileges; helper remains non-client-executable and unreferenced by any Gate 3 policy. |
| `producto` | `producto_select_tenant_authenticated`, `producto_insert_catalog_staff`, `producto_update_catalog_staff`, `producto_delete_catalog_staff` | `producto_{select,insert,update,delete}_gate3_catalog_roles`; authenticated `SELECT/INSERT/UPDATE/DELETE`, canonical admin/staff same-company; UPDATE checks OLD and NEW. |
| `categoria` | `categoria_select_empresa`, `categoria_insert_catalog_staff`, `categoria_update_catalog_staff`, `categoria_delete_catalog_staff` | `categoria_{select,insert,update,delete}_gate3_catalog_roles`; same command matrix and OLD/NEW rule. |
| `producto_categoria` | `producto_categoria_select_empresa`, `producto_categoria_insert_catalog_staff`, `producto_categoria_update_catalog_staff`, `producto_categoria_delete_catalog_staff` | `producto_categoria_{select,insert,update,delete}_gate3_catalog_roles`; company helper plus both referenced product and category belonging to the row company. |
| `producto_variante` | `producto_variante_select_tenant_authenticated`, `producto_variante_insert_catalog_staff`, `producto_variante_update_catalog_staff`, `producto_variante_delete_catalog_staff` | `producto_variante_{select,insert,update,delete}_gate3_catalog_roles`; company + referenced-product agreement; UPDATE checks OLD and NEW. |
| `imagen_producto` | `ip_sel_auth_manage_producto`, `imagen_producto_insert_catalog_staff`, `imagen_producto_update_catalog_staff`, `imagen_producto_delete_catalog_staff` | `imagen_producto_{select,insert,update,delete}_gate3_catalog_roles`; referenced-product canonical authority; retained soft-delete visibility conditions; UPDATE checks OLD and NEW. |
| Stock view/history | Exact `producto_stock_resumen` definition/options/ACL and its source/helper closure; `historial_stock.hs_sel_owner`, `historial_stock.hs_ins_owner`, and relation ACL | Stock view remains `security_invoker=true`, authenticated/service-role `SELECT` only. `historial_stock` authenticated policies and privileges are absent; trusted stock routines retain their named contracts. |
| Storage | `storage.objects.pi_read_public` and `producto_imagenes_{select,insert,delete}_catalog_staff`; exact bucket row and relevant Storage relation/schema grant path | Public policy absent; `producto_imagenes_{select,insert,delete}_gate3_catalog_roles` enforce exact five-segment/UUID/non-empty filename/product/company/role checks; UPDATE policy absent; bucket remains private. Do not revoke/regrant platform-wide `storage.objects` ACLs unless an exact reviewed ACL replacement proves every other bucket unaffected. |
| Canonical helpers | `can_mutate_catalog_empresa(uuid)`, `can_mutate_catalog_producto(uuid)`, `soft_delete_imagen_producto(uuid)` plus routine ACL/dependencies | Exact same definitions/owners/config/ACLs in PRE and POST unless a separately reviewed target row says otherwise; they are affected-set closure `required_safe`, not unbounded platform preservation. |
| Relation grants/RLS | ACL and RLS nodes for `usuario`, `empresa`, `membresia`, five catalog tables, `producto_stock_resumen`, `historial_stock`, and scoped `storage.objects` path | Exact normalized target commands above; `anon`/PUBLIC have no Gate 3 catalog/company/profile/storage path, and no permissive policy can OR around the command policy. |
| Role topology | Four exact rooted role rows, seven direct membership edges, PostgreSQL-major-aware membership options, safe role settings, zero role-switch defaults, and exact authenticator/anon/authenticated `SET ROLE` reachability | Identical literal PRE/POST `role-topology-v1`; only `service_role` has the classified `rolbypassrls=true` exception. Any unclassified superuser/bypass path, membership, setting, or role-switch target blocks. |
| Running PostgREST exposure | Canonical `gate3-postgrest-runtime-v1` attestation identity and SHA bound to effective `db_schemas`, extra search path, anon role, max rows, release, project/resource, freshness, and authenticated provenance | A separately collected attestation is required for each PRE/POST run and must match the same reviewed config. The evidence hash may differ by run, but its schema/config values and trust policy are literal; absent/unverified/mismatched evidence is `unverifiable`. |

The migration repeats exact PRE hashes/counts for every database `replaceable_by_gate3` row before its first DDL. Runtime attestation and static-source/role preservation are wrapper/preflight stop conditions and are never migration-learned inputs. The POST fixture is independently authored from this table; it cannot be captured from migration output. The stopped placeholder hashes are not valid evidence.

### Critical preservation anchors

Gate 3 does not literal-manifest every row in the database. Unchanged critical contracts are represented by a small number of named, bounded anchors. Each database/static anchor contains an explicit reviewed root-key list, the directional closure rules above, literal expected object count, ordered per-object canonical hashes, and an aggregate SHA-256. PRE and POST aggregate/count must be identical except the migration-history anchor's explicit Gate 3 append. The per-run PostgREST attestation anchor instead has a new authenticated evidence hash for each run; its field schema, trust policy, expected effective values, and repository-config comparison are literal and identical in both modes.

| Anchor | Exact named roots |
| --- | --- |
| `history-and-files-v2` | All 67 ordered predecessor migration paths/file hashes; explicit Gate 1 `20260902120000_multi_tenant_gate_1_catalog_stock_isolation.sql`, Gate 2 `20260903120000_multi_tenant_gate_2_empresa_dominio.sql`, latest predecessor `20260903130000_checkout_idempotency_service_role_select.sql`; POST appends only the reviewed Gate 3 path/SHA/history identity. |
| `exposed-app-roots-v2` | Repository and live-runtime exposure `public`,`graphql_public`; exact other-reachable relations and public routine signatures listed in the root registry; public/graphql schema ACL and relevant default ACL identities; `pg_graphql` bounded extension anchor. The literal `graphql_public.graphql(text,text,jsonb,jsonb)` affected-set row is excluded from this aggregate to avoid double ownership, but its exposed-schema and extension edges must agree with this anchor. |
| `gate2-domain-v2` | `public.empresa_dominio`, `empresa_dominio_pkey`, `empresa_dominio_empresa_id_fkey`, `empresa_dominio_hostname_length`, `empresa_dominio_hostname_normalized`, `empresa_dominio_empresa_id_idx`, exact RLS/forced-RLS and service-role `SELECT/INSERT` ACL. |
| `commerce-orders-v2` | Relations `public.pedido`, `public.pedido_item`, `public.pedido_estado_evento`; type `public.pedido_estado`; routines `crear_pedido_con_items(uuid,uuid,uuid,jsonb)`, `transicionar_pedido_operacional(uuid,uuid,public.pedido_estado,public.pedido_estado,uuid,text)`, `pedido_item_assert_empresa_match()`, `set_pedido_actualizado_en()`, `pedido_estado_evento_prevent_mutation()`; triggers `trg_pedido_item_assert_empresa_match`, `trg_pedido_set_actualizado_en`, `trg_pedido_estado_evento_append_only`; their named tenant/state/FK/check/index/ACL dependencies. The static service receipt independently binds the transition RPC's argument provenance. |
| `commerce-checkout-stock-v2` | `public.checkout_pedido_idempotencia`; `crear_pedido_con_items_idempotente(uuid,uuid,uuid,jsonb,uuid,text)`; `public.producto`/`producto_variante` stock columns and named stock constraints/triggers not replaced by Gate 3; `producto_auto_draft_on_update()`, `set_updated_at()` overload identities, `trg_producto_auto_draft_on_update`, `trg_producto_updated_at`, `trg_producto_variante_set_updated_at`; exact service-role RPC/SELECT ACLs and idempotency indexes. Affected catalog policies/ACLs are excluded. |
| `commerce-payment-v2` | `public.intento_pago`; types `public.intento_pago_estado`, `public.canal_pago_tipo`; routines `crear_intento_pago(uuid,uuid,public.canal_pago_tipo)`, `consolidar_pago_pedido(uuid)`, `procesar_notificacion_intento_pago(uuid,public.intento_pago_estado)`, `intento_pago_assert_empresa_match()`, `set_intento_pago_actualizado_en()`; triggers `trg_intento_pago_assert_empresa_match`, `trg_intento_pago_set_actualizado_en`; exact payment FK/check/index and service-only ACL nodes. |
| `commerce-webhook-v2` | `public.webhook_recepcion_mp`, `ux_mp_webhook_recepcion_x_request_id`, `ux_mp_webhook_recepcion_provider_event_id`, `idx_mp_webhook_recepcion_payment_id`, checks `chk_mp_webhook_recepcion_verification_mode` and `chk_mp_webhook_recepcion_estado`, `set_mp_webhook_recepcion_actualizado_en()`, and `trg_mp_webhook_recepcion_actualizado_en`. |
| `static-code-receipts-v2` | Normalized `supabase/config.toml`; exact browser DB/storage and Auth API callsite groups; panel-service, storefront, bootstrap/auth-admin, buyer checkout/account, payment/webhook source groups; required capability/API tenant-argument/A→B/B→A test receipt hashes. |
| `role-topology-v1` | Exact four rooted role identities/attributes, seven direct membership edges, safe settings, zero role-switch defaults, exact SET ROLE closure, PostgreSQL-major capability sentinel, and PostgREST anon-role binding described above. |
| `postgrest-runtime-v1` | Per-run authenticated non-secret runtime/control-plane attestation hash and exact comparison to reviewed `api.enabled`, `api.schemas`, `api.extra_search_path`, `api.max_rows`, plus `db-anon-role`; fixture provenance is accepted only by the explicit local test harness. |

Gate 1 catalog policies that Gate 3 intentionally replaces are owned by the affected set, not `gate1` preservation. Unchanged stock algorithms, order transitions, checkout idempotency, payment consolidation, and webhook deduplication remain anchors and mandatory behavior suites.

Any anchor count or aggregate mismatch blocks. The report then derives bounded diagnosis **only from that anchor's reviewed key list**, returning expected/actual hash and at most ten missing/extra/changed stable keys. It does not widen discovery to the whole platform.

### Unexpected-object blocker

An observed object enters the blocker set if any one of these is true:

1. it appears in `public` or `graphql_public` with effective `anon`/`authenticated` reachability, or changes either repository or authenticated-live exposed-schema configuration, without an exact affected row or named exposure-anchor identity; every additional `graphql_public` API-addressable object/overload blocks even when extension-owned;
2. it adds or changes a grant, policy, default ACL, view/rewrite, trigger, routine/RPC, FK/check, cast/operator, or dependency that can affect an in-scope root;
3. it adds, removes, renames, or changes a browser DB/storage/Auth call, implicit Auth behavior, caller-token Auth call, auth-admin operation, or service-role root without an exact static receipt row and source hash;
4. it enters the affected-set closure or a named preservation anchor but lacks exact reviewed identity/count/hash;
5. it creates an alternate tenant/role authority through `membresia`, `owner_auth`, `created_by`, email, client `empresa_id`, a client Auth operation/claim/metadata/session, a security-definer bypass, or a permissive OR path;
6. it changes the cardinality, ordered aggregate, or expected count of a closed affected/anchor set;
7. it changes a rooted role attribute, safe setting, direct membership edge/option/grantor, role-switch default, or effective SET ROLE target, or introduces an unclassified superuser/bypass-RLS path; or
8. it lacks a fresh authenticated `gate3-postgrest-runtime-v1` attestation or the effective running schemas/search path/anon role/max rows, project/resource identity, release, trust provenance, or canonical hash does not match its reviewed counterpart.

Unknown reachability, dynamic SQL/Auth dispatch that cannot be classified, denied inspection, a missing/static/runtime receipt, unauthenticated or unavailable runtime evidence, or inability to prove whether an object/path meets these rules is `unverifiable` and non-zero. Confirmed unsafe topology or additional reachable objects are `blocked`; evidence/authentication/classification failure is `unverifiable`. This is an explicit reachability rule, not an allowlist that ignores drift.

### Explicitly out of preflight scope

- Ordinary `pg_catalog`, `information_schema`, extension routines/aggregates/casts/operators and their ACLs that are neither PostgREST-exposed nor a direct non-default dependency of a named root.
- Supabase auth, storage, realtime, GraphQL, vault, and migration-platform internals unrelated to the named `auth.users` trigger chain, `producto-imagenes` path, exposed `graphql_public.graphql(...)` facade, role topology, live exposed-schema boundary, or migration-history receipt. `graphql` extension internals stop at the exact dependency/version anchor; no object in exposed `graphql_public` is excluded as an internal.
- Unrelated schemas, tables, views, routines, and cluster roles with no grant, exposure, static-code receipt, direct rooted-role membership/SET ROLE edge, or directional dependency path into a Gate 3 root.
- Data payloads, emails, auth metadata, JWTs, credentials, provider/webhook payloads, and storage object names. Data preflight uses counts plus bounded non-secret UUIDs only.

Exclusion is always justified by the root and directional-edge rules. It is never a prefix ignore, broad allowlist, or tolerated unknown.

### PRE and POST evaluation

PRE returns `migration_required`/`0` only when metadata and inspection permissions are complete; exact predecessor history/files/static DB/storage/Auth receipts match; every affected PRE row and preservation anchor count/hash matches; `graphql_public.graphql(...)` and the exact role topology match; a fresh authenticated live PostgREST attestation matches reviewed repository exposure; no unexpected object exists; identity/email/role/company/onboarding/orphan/test-principal checks are clean; all future FKs/checks validate without repair; and migration lock/applicability evidence is available. The migration repeats the database affected predecessor assertions under its advisory/table locks. PRE never emits `pass` and never authorizes runtime.

POST returns `pass`/`0` only when exact target history and migration SHA match; all affected POST rows and target data checks match; predecessor removals are absent; all preservation anchors and exact role/GraphQL identities are unchanged; a separately fresh authenticated runtime attestation matches config; actual admin/staff/cliente command behavior and A↔B isolation receipts match; and no unexpected object or static/Auth/runtime receipt drift exists. POST never infers success from a coarse target audit flag.

### One report and reliable process exit

The SQL inspection starts `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` and uses transaction-preserving savepoints (`ON_ERROR_ROLLBACK=on` or explicit savepoints) for fallible checks. It captures SQLSTATE immediately, emits one compact JSON report, and explicitly `ROLLBACK`s. The report remains bounded to 64 KiB and includes mode/status, contract and manifest versions, repository/migration identities, server/repository-config/canonicalizer anchors, GraphQL identity status, role-topology count/aggregate, static Auth reachability aggregate, PostgREST runtime evidence hash/provenance/comparison status, ordered check statuses/counts/aggregates, and bounded stable-key diagnosis. It emits no role password, JWT/control-plane credential, attestation signature, email, URL secret, or raw environment/config dump.

The operational command is a checked-in wrapper, not raw `psql -f`. PostgreSQL 15-era `psql` does not reliably honor `\quit 3`/`\quit 4`; therefore SQL uses plain `\quit` after reporting and the wrapper owns the OS exit code. Before SQL, the wrapper validates and canonical-hashes the mandatory PostgREST attestation; accepted values/hash are injected as data, not executable SQL. It parses exactly one JSON value, validates the mode/status pair and returned attestation hash/comparison, and exits `0` only for `PRE-MIGRATION/migration_required` or `POST-MIGRATION/pass`, `3` for `blocked`, and `4` for `unverifiable`, invalid runtime evidence, malformed/missing/multiple JSON, transport error, or an unsealed operational manifest. If attestation validation fails before database connection, the wrapper itself emits exactly one schema-compatible bounded `unverifiable` JSON value. Tests invoke the actual wrapper as a child process and assert its exit status; source regexes and repository SHA alone are not seal evidence.

### Behavioral harness and read-only proof

Disposable predecessor and target databases exercise the real wrapper. The target fixture must materially revoke authenticated `historial_stock`, implement the full storage path grammar, and execute—not hard-code—the admin/staff/cliente matrix for every catalog relation command, stock-view read, storage `SELECT/INSERT/DELETE`, denied storage `UPDATE`, own-company `empresa`, and profile/provisioning behavior. A→B and B→A are separate asymmetric cases.

Mutations are applied relative to sealed literal expectations, never to a dynamically captured baseline treated as truth. Cases include each affected object class, the GraphQL facade/overload/ACL/definition/extension and exposure edges, policy/rewrite dependency, schema/default/object ACL, trigger binding, stable constraint identity, storage path shape, every Auth API source/boundary/trigger consequence, static receipt/service root, role attributes/memberships/settings/SET ROLE paths, every preservation anchor, dirty data, denied inspection, missing/forged/stale/mismatched PostgREST attestations, and the operational unsealed exit. Before/after fingerprints cover exactly the affected set, data-check projections, named preservation anchors, and non-secret runtime-attestation comparison fields. They need not and must not snapshot unrelated platform/system catalogs. Every case proves one bounded non-secret report, exact exit, and identical before/after database fingerprint.

### Re-estimation basis for the stopped PR1A correction

The reduced model is still literal where Gate 3 changes access, but removes the thousands of unrelated system/platform rows that caused the 7,973-row canonical output.

| Item | Reasoned expectation |
| --- | ---: |
| Unique affected-set stable identities per mode | **145–215**: roughly 30–40 root/RLS/ACL nodes, 25–35 policies, 12–18 constraints/triggers/routines, 15–25 security dependencies, **one fully fielded GraphQL RPC plus its exposure edges**, **18–26 role/membership/setting/reachability nodes**, **34 current direct Auth API callsites plus implicit-client behavior**, and 10–18 storage/config/runtime receipt nodes. |
| Serialized literal PRE + POST rows | **285–420**: unchanged closure rows occur in both modes; removals/additions occur in one mode with exact zero/one mappings; PRE/POST source SHAs remain separately literal. Runtime evidence contributes a per-run hash, not learned manifest rows. |
| Preservation anchors | **10 bounded anchors** as named above, covering approximately **65–100 named DB/role/config root identities** plus **12–20 static/auth/runtime/test receipt groups**; each has a literal count and ordered per-key diagnosis set. |
| PR1A corrective authored lines | **900–1,350 readable lines** across narrowed canonicalization/manifests, GraphQL and role topology, static Auth discovery/receipts, runtime-attestation validation, target fixture corrections, actual behavioral matrix/mutations, and the executable seal wrapper/tests. Generated diagnostic output is excluded but its identity is receipted. |

At the 400 authored-line review budget, **four to five review units are likely** to keep each unit reviewable with its tests and rollback boundary. This is a forecast only: it does not select, approve, or implement a PR1A split. The user must decide delivery structure after a separate re-estimation. Strict TDD, the operational seal, PRE/POST meanings, no production migration in PR1A, no production access, and all canonical authority, bidirectional A/B, Gate 1/Gate 2, checkout, stock, order, payment, and webhook invariants remain mandatory.

## Bootstrap tooling

Refactor `scripts/lib/supabase-bootstrap.mjs` to separate read-only planning from writes:

1. Enumerate all auth users matching the normalized configured email; zero or exactly one is acceptable, more than one fails. Do not return the first match.
2. Query profiles by UID with an array/limit contract and query normalized email only to detect conflicts, never to select an adoption candidate.
3. Finish all conflict, current-company, role, onboarding, and target-company checks before updating auth metadata or profile fields.
4. For a newly created auth user, require the trigger-created default profile. Do not insert a privileged profile directly. If the safe promotion fails, leave the non-privileged default profile and report failure; do not auto-delete/reassign data.
5. For an existing exact canonical profile, accept exact desired state idempotently. Allow only the guarded fresh-cliente-to-configured-admin promotion needed by instance bootstrap. Reject other role/company changes.
6. Update role, company, and onboarding in one statement with predicates for the previously read state and require exactly one returned row. A concurrent mismatch fails closed.
7. Keep smoke buyer provisioning at `cliente`/null/onboarding and keep tenant/domain bootstrap contracts separate.

Bootstrap output remains non-secret. Tests use fakes for zero/one/multiple UID and email results, assert operation order, and assert no profile/auth mutation calls on every conflict branch.

## Test architecture and strict TDD evidence

Every implementation work unit follows red-green-refactor. The evidence receipt records: the focused test command and exact failing assertion before implementation, the same command and exact passing result after implementation, the relevant runtime/DB harness result (or justified `N/A`), and the rollback boundary. Tests ship with the behavior they verify.

### Focused suites

Likely new suites:

- `scripts/panel-capabilities.test.mjs`: every role/capability matrix cell and principal parser state; source checks reject another TypeScript role allowlist.
- `scripts/panel-routes-ui.test.mjs`: loading/failure no-flash behavior, sidebar/direct-route parity, staff home, staff payments denial, cancellation visibility.
- `scripts/panel-authorization-api.test.mjs`: token/profile outcomes, authorization ordering, no service client before capability, legacy-input locations, stable statuses, canonical query/RPC arguments, and no partial payload.
- `scripts/panel-authorization-db.test.mjs`: own-company `empresa` reads for all roles/null-company cliente, mutation denial, profile constraints, FKs, trigger provisioning, company deletion, and command-by-command catalog parity for product/category/bridge/variant/image/storage/stock surfaces.
- `scripts/panel-authorization-preflight.test.mjs`: mandatory explicit-mode semantics, exact predecessor `migration_required`, exact target `pass`, exact GraphQL facade and additional-object blockers, four-role topology/membership/SET ROLE mutations, AST-based DB/storage/Auth source-set drift and all 34 current direct Auth callsites, user-creation trigger consequences, authenticated runtime-attestation success/failure/mismatch cases, all other PRE stop classes, representative POST regressions, one-document/error-path behavior, and read-only fingerprints bounded to the affected set, data projections, and named anchors.
- Expanded bootstrap tests for UID-only behavior and no mutation on conflict.

Use real local `auth.users` identities and asymmetric A/B fixtures: canonical `admin`, `staff`, and company-bound `cliente` profiles for each company, with different products, categories, bridge rows, variant/image ownership, storage objects, stock values, order counts/states, and payment attempts. Execute A→B and B→A independently. For APIs, spies must prove both returned content and exact `.eq("empresa_id", principal.empresaId)`/`p_empresa_id` arguments. For direct RLS, test every supported SELECT/INSERT/UPDATE/DELETE command: admin and staff may operate only their own company; cliente may perform none, including same-company reads; all roles remain unable to cross tenants. Assert forged row IDs/company IDs/storage paths, old-to-new tenant moves, RPC calls, view reads, and persisted state after denial. Policy/grant fingerprint assertions prove no permissive policy is silently OR-combined with the Gate 3 policy.

Required failure cases include unauthenticated, auth unavailable, missing profile, duplicate profile, malformed role, null privileged company, orphan company, cliente with and without company, capability denial, matching/foreign/empty/array legacy fields, missing/foreign resources, primary and secondary lookup errors, RPC error, and malformed privileged downstream data. Database parity cases additionally include a same-company cliente attempting every catalog command, public/anon storage selection, stale role-blind policy detection, and an UPDATE that tries to move a permitted old row into another company. Preflight failures additionally cover a changed/additional GraphQL object or overload, owner/security/volatility/config/ACL/definition/extension/exposure drift, every rooted role boolean and membership option, an extra SET ROLE/bypass path, each new/unclassified Auth method/source/boundary, missing trigger consequence, and unavailable/unsigned/stale/wrong-project/mismatched live PostgREST evidence.

### Mandatory regressions

The release receipt must include:

```sh
pnpm test:instance-config
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs
node --test scripts/storefront-tenant-db.test.mjs
node --test scripts/catalog-stock-isolation-db.test.mjs
pnpm test:buyer-checkout
pnpm test:checkout-idempotency
node --test scripts/order-operations-api.test.mjs
node --test scripts/order-operations-ui.test.mjs
node --test scripts/order-operations-db.test.mjs
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Any established atomic-stock, payment, or webhook suite present at implementation time is also mandatory. Gate 1 and Gate 2 migration files and OpenSpec artifacts remain byte-for-byte unchanged. Gate 1 behavioral assertions also remain unchanged; its DB fixture setup/cleanup receives only the auth-FK compatibility maintenance described below.

## Likely files touched during later implementation

No files below are changed by this Design phase.

| Area | Likely files |
| --- | --- |
| Shared contract | new `src/lib/panelCapabilities.ts`; possibly new `src/lib/panelPrincipal.ts` |
| Server auth/API | `src/lib/panelAuthorization.ts`, `src/lib/orderOperationsApi.ts`, `src/pages/api/panel/productos.ts`, `src/pages/api/panel/pedidos.ts`, `src/pages/api/panel/pedidos/[id].ts` |
| Browser state/guards | `src/context/AuthContext.tsx`, `src/components/layout/AdminLayout.tsx`, `src/components/layout/panel/Sidebar.tsx`, `src/components/common/Header.tsx` |
| Panel pages/controls | `src/pages/panel/index.tsx`, `src/pages/panel/payments.tsx`, product/category/order pages, `src/lib/orderOperationsUi.ts` |
| Database | one new `supabase/migrations/20260904120000_multi_tenant_gate_3_panel_authorization.sql` only; no historical migration edits |
| Preflight | replace the stopped draft with `scripts/sql/panel-authorization-preflight.sql`; a wrapper that owns process exit and requires runtime evidence; `scripts/fixtures/panel-authorization-static-receipt-v2.json`; literal GraphQL/role manifests; `scripts/fixtures/panel-authorization-postgrest-attestation-v1.json` for explicit local tests only; a read-only production evidence collector invoked only after separate approval; a local-only focused harness; bounded manifest/anchor fixture support; and no production-default command |
| Bootstrap | `scripts/lib/supabase-bootstrap.mjs`, bootstrap-focused tests |
| Gate 3 tests/scripts | new focused API/UI/DB/preflight test files and `package.json` script entries |
| Existing regression fixtures | setup/cleanup only in `scripts/catalog-stock-isolation-db.test.mjs` (and any other suite that inserts an orphan `usuario.supabase_uid`, such as `scripts/order-operations-db.test.mjs`); create and clean up a real auth identity, with all behavioral assertions unchanged |

Product/category/image files are changed only where needed to remove misleading client authority or add capability gating; their direct Supabase data path remains. Gate 1/2 migrations, specs, and OpenSpec artifacts are not modified. The Gate 1 test file exception is narrowly limited to fixture setup/cleanup required by the validated auth FK.

## Delivery forecast only — no split selected

This Design does not approve a PR1A split, a branch, a commit, or implementation. The stopped PR1A correction is re-estimated above at 900–1,350 authored lines and likely needs four to five review units under the 400-line budget, but delivery structure remains a user decision after separate re-estimation.

If later authorized, every work unit must keep its strict-TDD evidence with the behavior it verifies: focused RED and GREEN results, actual local runtime/database harness result, and an exact rollback boundary. The operational preflight remains sealed until a real reviewed Gate 3 migration SHA exists; PR1A cannot add or run that production migration. Later Gate 3 database, server/API, bootstrap, UI, and release work retains the dependency order already defined by this Design, but no PR boundaries are selected here.

## Fixture compatibility and risks

The validated `usuario.supabase_uid -> auth.users.id` FK remains mandatory. Later DB Tasks may change only setup/cleanup in `scripts/catalog-stock-isolation-db.test.mjs` and any observed orphan-UID regression such as `scripts/order-operations-db.test.mjs`: create a real local auth identity first, reuse the trigger-created UID profile, assign fixture state without email adoption, and clean up dependent rows → profile → auth user → company idempotently. All behavioral assertions and Gate 1/Gate 2 migration/OpenSpec artifacts remain unchanged.

| Risk | Fail-closed treatment |
| --- | --- |
| Manifest accidentally learns unsafe local state | Generate literals only from fresh pinned predecessor/independent target fixtures; compare reviewed canonical source and hashes. Local observations are evidence of stop cases only. |
| Migration hash cannot exist during PR1A | Keep operational success sealed off. Test-only receipt exercises logic; the real hash is pinned only beside the one migration and any byte change reopens review. |
| Directional closure misses an alternate path | Compare the affected closure, literal GraphQL facade, four-role topology/SET ROLE closure, and exposed-application routine/root anchor counts and aggregates; extras block. Do not scan executable system routines or use wildcard allowlists. |
| Missing object/permission causes pre-report abort | Use OID-safe discovery, guarded queries, captured SQLSTATE, preinitialized results, one final report, then explicit exit. Unsupported failures are `unverifiable`. |
| Report/fingerprint leaks secrets | Emit IDs/counts/object keys/digests only; exclude email, auth metadata, URLs, raw definitions/payloads/storage names; enforce 64 KiB and leak-pattern tests. |
| Current predecessor data cannot satisfy future constraints | PRE is `blocked`; migration repeats checks under locks and performs no remediation. Remediation needs a separate decision. |
| Public storage removal breaks storefront images | Trusted signed-URL regression must pass; do not restore public enumeration as a workaround. |
| Policy graph recurses or same-company cliente remains allowed | Real-role command matrix and direct policy graph tests must pass in both tenants before POST can pass. |
| Preserved Gate 1/Gate 2/commerce object drifts | Each named anchor's PRE/POST count and ordered aggregate must be identical except the explicit history append; behavioral suites remain release gates. |
| SQL cannot prove service-role/TypeScript/Auth behavior | Require exact commit-bound external receipt hashes with operation/source/boundary and trigger consequence; absence, source-set drift, or mismatch is unverifiable. No browser Auth operation becomes authority. |
| Repository API config differs from running PostgREST | Require fresh authenticated, hash-bound runtime/control-plane evidence in both modes; config SHA alone cannot pass. Production collection is separate, read-only, and explicitly approved. |
| Trusted `service_role` bypass expands through role topology | Pin its one existing bypass exception and exact authenticator SET ROLE closure; block every other superuser/bypass, membership, option, setting, or target path. Never expose role passwords/settings secrets. |
| Locks or production-size validation are uncertain | PRE checks observable prerequisites; migration uses advisory/table locks and timeout. Any uncertainty/timeout stops rollout. |

Exact live production state remains unknown until a separately authorized read-only PRE run. Production remediation is not part of Gate 3 apply.

## Final execution order and rollback

1. **If separately authorized, correct the stopped PR1A locally only:** implement the bounded affected manifest and named anchors, including the exact GraphQL facade, complete Auth API reachability receipt, four-role/SET ROLE topology, and mandatory runtime-attestation contract defined by R1-003 through R1-006, with executable behavior and wrapper-owned seal. Do not run against production and do not add a production migration.
2. **Review that correction fresh:** require actual storage/history behavior, literal hashes/mappings, directional closure, sealed-target comparison, and executed non-zero operational seal evidence. Operational success remains sealed pending the real migration hash; this Design does not choose a PR split.
3. **Write Gate 3 DB tests, then the sole migration:** assert exact predecessor before first DDL, apply locally, seal its SHA/history, and prove POST target. Reset local state on failure.
4. **Run Gate 1/Gate 2/commerce DB regressions immediately:** both A→B and B→A remain isolated; admin/staff catalog remains allowed and same-company cliente is denied.
5. **Implement server/API tests then enforcement:** canonical principal only, delayed service role, no client `empresa_id`, no partial privileged response.
6. **Implement provisioning tests then UID-only bootstrap:** no email adoption or mutation on conflicts.
7. **Implement UI/route tests then guards:** no protected flash; navigation/direct routes match capabilities.
8. **Run complete parity and release receipts:** any failure blocks rollout.
9. **After separate production-read approval only, collect fresh authenticated PostgREST evidence and run PRE-MIGRATION:** collection and SQL are read-only; retain the attestation hash and single JSON report. Only `migration_required`/0 with matched live evidence authorizes separate review of the exact migration; it does not authorize runtime/API/UI.
10. **After separate migration authorization, apply only the hash-bound migration, separately recollect fresh runtime evidence, and immediately run POST-MIGRATION:** anything except `pass`/0 with authenticated matching exposure stops with panel/runtime rollout forbidden.
11. **After another explicit rollout authorization, deploy server/API then UI and run smoke/A↔B checks.** Repository apply performs no production mutation, and rollback never restores client tenancy, global empresa reads, email adoption, destructive FK behavior, or role-blind catalog access.
