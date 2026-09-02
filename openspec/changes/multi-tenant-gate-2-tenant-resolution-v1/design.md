# Design — Multi-Tenant Gate 2: Tenant Resolution v1

## 1. Goal and bounded architecture

Gate 2 changes only the public collection SSR read path from build-time `instanceConfig.store.slug` selection to an authoritative direct-`Host` lookup. The minimum proof is:

```text
Next Pages request
  -> extract exactly one direct Host
  -> pure ASCII normalization
  -> private empresa_dominio lookup (service role)
  -> resolved empresa_id
  -> explicitly scoped product/stock/variant reads
  -> image rows anchored through the scoped product IDs
  -> exact tenant/product object-key validation
  -> sign only ownership-proven image paths
```

Every non-known resolution stops before catalog access. There is no slug, query, cookie, body, origin, referer, forwarding-header, preview-host, or localhost fallback.

This does not change checkout, repeated-checkout, order, payment, webhook, or stock-mutation contracts. In particular, `POST /api/ecommerce/pedido` continues to receive the cart's `empresa_id` and rely on the transactional RPC's company/product/variant validation and existing idempotency behavior.

## 2. Repository facts that constrain the design

- `public.empresa` currently has `id`, required `nombre`, nullable `descripcion`, nullable globally unique `slug`, legacy `owner_auth`/`created_by`, and creation timestamps. It has no status, enabled flag, soft-delete column, hostname, or currency column.
- Therefore, for this v1, an **active valid tenant** means exactly: a normalized `empresa_dominio` row exists and its non-null foreign key points to an extant `empresa.id`. There is no repository-backed company lifecycle state to check. Deleting an `empresa` cascades the mapping; deleting the mapping disables the host.
- `src/lib/supabaseServer.ts` is a service-role client and bypasses RLS. Explicit company predicates, not RLS, are the storefront read boundary.
- Gate 1 keeps `producto_stock_resumen` as `security_invoker=true`, denies anonymous source/view reads, and scopes authenticated product/variant reads by `usuario.empresa_id`. Those policies and grants remain unchanged.
- `producto_variante` has `empresa_id` and a composite foreign key `(empresa_id, producto_id) -> producto(empresa_id, id)`. `imagen_producto` has only `producto_id`. Its row can be anchored through a scoped product, but its mutable `path` and legacy `url_imagen` columns are not constrained to that product or company by the image-row policies.
- Current uploads use the canonical object-key shape `empresa/{empresaId}/producto/{productoId}/{imagenId}.{ext}` and write the same key to both `path` and legacy `url_imagen` (`src/utils/storageProductoImagen.ts` and `ProductForm.tsx`). Storage write policies validate the tenant and product segments, but `imagen_producto` INSERT/UPDATE policies validate only `producto_id`. The storefront service role can sign any key it receives, so row scoping alone is not an object-authorization boundary.
- The only current public SSR commerce reader is `src/pages/coleccion/index.tsx`. `src/pages/index.tsx` has no database reads.

## 3. Additive database contract

Add one migration, named with the next migration timestamp and a suffix such as `multi_tenant_gate_2_empresa_dominio.sql`, containing one transaction and this logical shape:

```sql
create table public.empresa_dominio (
  hostname text primary key,
  empresa_id uuid not null
    references public.empresa(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint empresa_dominio_hostname_length
    check (char_length(hostname) between 1 and 253),
  constraint empresa_dominio_hostname_normalized
    check (
      hostname = lower(hostname)
      and hostname ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$'
    )
);

create index empresa_dominio_empresa_id_idx
  on public.empresa_dominio (empresa_id);

alter table public.empresa_dominio enable row level security;
alter table public.empresa_dominio force row level security;

revoke all on table public.empresa_dominio
  from public, anon, authenticated, service_role;
grant select, insert on table public.empresa_dominio to service_role;
```

No RLS policy is created. Consequently `public`, `anon`, and `authenticated` have neither table privileges nor an RLS path. `service_role` gets only the runtime/provisioning operations required by this change: `SELECT` for resolution and collision checks, and `INSERT` for bootstrap registration. It does not get `UPDATE` or `DELETE`; ownership correction/removal is an explicit database-operator action. Supabase's service role is assumed to retain its deployed `BYPASSRLS` property; the DB regression must prove the resulting contract rather than assuming it.

The primary key is the global ownership constraint. The regex plus length checks reject uppercase, ports, terminal dots, empty labels, invalid label edges, underscores, and non-ASCII storage. The application normalizer remains mandatory because the table check does not parse request authorities. No `empresa` column or policy is changed, and `empresa.slug` remains a nullable provisioning identifier rather than a hostname.

The migration is additive and contains no seed tied to this repository's current `raeyz` hostname. Environment-specific mappings are provisioned after migration.

## 4. Direct Host authority and normalization

### 4.1 Current Pages Router source

`getServerSideProps(context)` uses only `context.req`, specifically Node's direct `req.headers.host`. `req.rawHeaders` is inspected only to prove that exactly one case-insensitive `Host` field arrived; it is not an alternate selector. The extraction contract is:

```ts
type DirectHostRequest = Pick<IncomingMessage, "headers" | "rawHeaders">;

type DirectHostExtraction =
  | { ok: true; rawHost: string }
  | { ok: false; reason: "missing_host" | "multiple_host_values" | "invalid_host_value" };

extractDirectHost(request: DirectHostRequest): DirectHostExtraction;
```

Extraction succeeds only when `rawHeaders` contains exactly one `Host` field, `headers.host` is one string, and both values are identical. Array-valued, repeated, comma-combined, absent, or inconsistent representations fail. This preserves `req.headers.host` as the selected authority while using the only available Node evidence to reject duplicates.

`X-Forwarded-Host` is never read. Neither are `Origin`, `Referer`, `context.query`, request body, cookies, or any other header. Existing `apiSecurity.ts` origin checks and forwarding-IP handling are unrelated and are not reused for tenant selection.

### 4.2 Pure normalizer

Place the pure extraction/normalization contract in `src/lib/storefrontTenant.ts` unless implementation size clearly warrants a small `src/lib/storefrontHost.ts`; do not duplicate it in bootstrap.

```ts
type HostNormalizationResult =
  | { ok: true; hostname: string }
  | { ok: false; reason: "invalid_host" };

normalizeStorefrontHost(rawHost: string): HostNormalizationResult;
```

Algorithm, in order:

1. Reject empty input; leading, trailing, or internal whitespace; ASCII control/DEL; any non-ASCII code point; comma; scheme markers; `/`, `\\`, `?`, `#`, `@`, `%`, or brackets.
2. Permit at most one colon. If present, split it as a port, require only decimal digits, and require numeric range `1..65535`; remove it. Empty, signed, fractional, out-of-range, or multi-colon ports are invalid. This intentionally rejects IPv6 literals in v1.
3. If the hostname ends in `..`, reject it. Remove exactly one terminal `.`.
4. Lowercase, require total normalized length `1..253`, split on `.`, and require each label to be `1..63` ASCII letters/digits/hyphens without a leading or trailing hyphen.
5. Return only the port-free normalized hostname.

Thus `SHOP.EXAMPLE.COM.:443 -> shop.example.com` and `localhost:3000 -> localhost`. IPv4-shaped values satisfy the same label grammar and, like `localhost` or `tenant-a.localhost`, resolve only when explicitly registered. IPv6, Punycode conversion from Unicode input, wildcard matching, suffix matching, and implicit local mappings are excluded.

## 5. Resolver contract and dependency seams

Replace the Gate 1 slug resolver with these unions:

```ts
type StorefrontTenant = {
  empresaId: string;
  hostname: string;
};

type StorefrontTenantResolution =
  | { ok: true; tenant: StorefrontTenant }
  | {
      ok: false;
      reason: "invalid_host";
      detail: "missing_host" | "multiple_host_values" | "invalid_host_value" | "invalid_host";
    }
  | { ok: false; reason: "unknown_host"; hostname: string }
  | { ok: false; reason: "lookup_failed"; hostname: string };

type TenantDomainLookup = (hostname: string) => Promise<{
  data: { empresa_id: string } | null;
  error: unknown;
}>;

resolveStorefrontTenant(
  request: DirectHostRequest,
  findByHostname: TenantDomainLookup,
): Promise<StorefrontTenantResolution>;
```

Behavior is exact:

- Extraction/normalization failure returns `invalid_host` without invoking `findByHostname`.
- A successful lookup with `data: null` and no error returns `unknown_host`.
- A returned error, thrown exception, or row without a syntactically valid UUID `empresa_id` returns `lookup_failed`.
- A valid row returns `{ empresaId: data.empresa_id, hostname }`.
- It never imports or accepts `instanceConfig`, a slug, query data, or a default company.

The production lookup adapter remains beside the SSR composition and performs only:

```ts
supabaseServer
  .from("empresa_dominio")
  .select("empresa_id")
  .eq("hostname", hostname)
  .maybeSingle()
```

The injected lookup seam gives unit tests deterministic unknown/error/throw outcomes. Keep logging out of the pure resolver. At the SSR boundary, log exactly one bounded event for `lookup_failed`, for example `console.error("[storefront-tenant] lookup_failed", { hostname })`; do not log the Supabase error object, credentials, raw malformed Host, query/body/cookie values, or alternate tenant identifiers. Invalid/unknown requests are normal 404 outcomes and need no error log in v1.

For catalog composition testability, extract the existing SSR reads into a small server-only function (prefer `src/lib/storefrontCatalog.ts`) with an injected Supabase-compatible client and the sole identity argument `empresaId`. Its public contract is `loadStorefrontCatalog(empresaId, client)`. It must not accept request/query/slug/domain data. Keep the image object-key validator in this server-only catalog boundary (or a pure helper imported by it), and inject/spy the signing callback in tests. This creates a narrow seam for asserting query scoping and proving that rejected keys never reach signing without changing commerce semantics.

## 6. SSR response mechanics

`getServerSideProps` accepts the real context and reads only `context.req` for tenancy.

- `invalid_host` or `unknown_host`: return `{ notFound: true }`. Next Pages renders the existing generic `src/pages/404.tsx` with HTTP 404. No company or catalog read follows; unknown host has only the registry read.
- `lookup_failed`: set `context.res.statusCode = 503`, set `Cache-Control: no-store`, and return props representing a generic unavailable state with `empresaId: null`, empty products, and a bounded internal UI code such as `storefront_unavailable`. No catalog callback follows.
- Known host: load the catalog for exactly the resolved ID and render normally.

There is no redirect, rewrite, `resolvedUrl` reconstruction, call to the canonical `APP_BASE_URL`, or slug fallback. The global `_app` shell and its current Raeyz metadata/header/footer may still appear on the 404/503 pages because branding is intentionally instance-wide in v1; this presentation is not tenant resolution and must never trigger a company/catalog query.

## 7. Catalog data flow under service-role access

For a known host, preserve the current read order and add all available company predicates:

1. `producto`: select published products with `.eq("empresa_id", empresaId)` and `.eq("estado", "published")`. These globally unique product IDs become the only downstream anchor.
2. `producto_stock_resumen`: use `.eq("empresa_id", empresaId)`.
3. `producto_variante`: if scoped product IDs are non-empty, use both `.eq("empresa_id", empresaId)` and `.in("producto_id", scopedProductIds)`, plus existing `activo` and ordering predicates. The composite FK supports this defense in depth.
4. `imagen_producto`: it has no `empresa_id`; read only `.in("producto_id", scopedProductIds)`, retaining the active/deleted and ordering predicates. Never derive image product IDs from variants, query input, or an unscoped read. Before signing, validate each row against both the resolved `empresaId` and that row's scoped `producto_id` using the rule below.
5. Build page/cart data with the resolved `empresaId` exactly as today.

### 7.1 Row-to-object isolation rule (R1-001)

The signing boundary must derive, rather than accept, the only allowed prefix for each image row:

```ts
const allowedPrefix = `empresa/${empresaId}/producto/${row.producto_id}/`;
```

A small pure helper such as `resolveStorefrontImageObjectPath(empresaId, row)` returns a storage object key or `null`. It applies these rules before any `createSignedUrl` call:

1. `row.producto_id` must be in the exact `scopedProductIds` set produced by the resolved-company product query. Do not trust membership merely because the database query used `.in(...)`.
2. Resolve the candidate without repair or fallback:
   - when both `path` and `url_imagen` are present, they must be byte-for-byte equal; otherwise reject the row;
   - when `path` is present, it is authoritative;
   - only when `path` is `null` may legacy `url_imagen` be the candidate.
   Empty strings count as present but invalid. An invalid present `path` must never fall back to a seemingly valid legacy value.
3. The candidate must start with the exact, case-sensitive `allowedPrefix`. The suffix after that prefix must be one non-empty filename segment: no `/`, `\\`, ASCII control characters, `?`, or `#`. Do not trim, URL-decode, normalize dot segments, parse an absolute URL, or accept a bucket-qualified key. These checks match the current uploader's `empresa/{empresaId}/producto/{productoId}/{imagenId}.{ext}` convention while keeping the ownership decision dependent only on the resolved company and scoped product.
4. Reject with `null` on every mismatch. Rejected rows are silently omitted from storefront image output and never passed to the service-role signing API. Continue to the next already ordered row for that product; if none proves ownership, expose `imagen_url: null`.

Legacy `url_imagen` is therefore compatibility input only when `path IS NULL` and its value is already a canonical object key for the resolved company and scoped product. Historical absolute URLs, signed URLs, old product-only keys, malformed keys, and foreign-company/product keys fail closed; Gate 2 does not migrate or rewrite them. Newly uploaded rows already write identical canonical keys to both columns, so this rule requires no schema or storage-policy migration.

Empty product IDs skip variant, image, and signing calls. Filter all image rows through this helper before constructing signing promises; the service-role signer must receive no unvalidated value. This server-side boundary is deliberately scoped to public storefront composition and does not broaden Gate 2 into panel, schema, bucket, or storage-policy cleanup.

Current stock/variant display fallback semantics remain unchanged. Image fallback changes only as required above: an unauthorized or ambiguous row is skipped in favor of the next ownership-proven row. No catalog error or rejected image may initiate a second tenant resolution, alternate path fallback, or canonical-company fallback.

## 8. Query-parameter and alternate-input attacks

A request such as:

```text
GET /coleccion?empresa_id=<B>&slug=b&domain=b&hostname=b.example.test
Host: a.example.test
X-Forwarded-Host: b.example.test
```

must resolve only A. `getServerSideProps` must not destructure or pass `context.query`; the resolver accepts only the request header projection, and the catalog loader accepts only the resolved UUID. A GET body, cookies, `Origin`, and `Referer` are equally ineffective. Regression tests must use valid identifiers for company B, not merely malformed noise, and assert both returned data and recorded lookup/catalog arguments.

## 9. Provisioning and local development

### 9.1 Canonical bootstrap

After `ensureTenant` resolves/creates the configured slug company, `scripts/bootstrap-instance.mjs` must:

1. Reject non-ASCII in the raw `APP_BASE_URL` before `URL` parsing can silently convert Unicode to Punycode.
2. Continue using `parseAppBaseUrl`/`getAppBaseUrl` for the existing origin contract.
3. Pass `new URL(appBaseUrl).host` through the same `normalizeStorefrontHost` function used at runtime (`localhost:3000 -> localhost`).
4. Attempt a plain `INSERT` of `{ hostname, empresa_id: tenant.id }`; never use an upsert that can overwrite ownership.
5. On PostgreSQL unique violation `23505`, read the row by hostname. Treat the same `empresa_id` as idempotent success; if it differs, throw an explicit collision error and preserve the row. Propagate every other insert/read error.
6. Include the hostname and whether it was created/already present in the existing non-secret JSON bootstrap output.

The unique primary key makes this collision-safe under concurrent bootstrap attempts. Migration must precede bootstrap.

### 9.2 Two-host local proof

Keep `APP_BASE_URL=http://localhost:3000` and explicitly register `localhost` for the canonical company. The DB/integration fixture creates a second company and distinct mappings such as `tenant-a.localhost` and `tenant-b.localhost`; it must clean them up through the service role or direct local SQL as appropriate. Exercise the app with explicit Host headers (for example `curl -H 'Host: tenant-a.localhost:3000' http://127.0.0.1:3000/coleccion`) or collision-safe `--resolve` entries. Do not depend on workstation wildcard DNS behavior.

Aliases, `127.0.0.1`, preview hosts, and health-check hosts are separate mappings. Additional production aliases are inserted by an operator using trusted SQL/service credentials with the same normalize/insert/compare rule; they are not inferred from slug or DNS suffix.

## 10. Deployment/proxy assumptions and unproven constraints

Release assumes the deployed proxy terminates requests without replacing the custom-domain authority and presents exactly one sanitized custom-domain value as Node/Next's direct `Host`. The repository contains no ingress, Vercel, load-balancer, or proxy configuration proving this. It also cannot prove whether the production adapter preserves duplicate Host evidence in `rawHeaders`.

Before runtime enablement, production-equivalent probes must compare the externally requested custom domain with server-observed `headers.host`/Host multiplicity in a safe temporary diagnostic or platform logs. If the platform exposes the original authority only through `X-Forwarded-Host`, this v1 must not ship as designed; trusting that header requires a separate explicit proxy sanitization contract and tests. Preview/platform domains intentionally 404 unless mapped.

The repository also does not identify the final production canonical hostname or required health-check hostnames. Operations must supply and verify that inventory before release.

## 11. Rollout and rollback

Rollout order:

1. Apply the additive migration.
2. Run DB privilege/constraint tests.
3. Run canonical bootstrap to register the normalized production and local `APP_BASE_URL` host; register every intended alias separately.
4. Verify mappings by trusted query and verify anon/authenticated denial.
5. Validate direct production `Host` preservation and duplicate handling.
6. Deploy resolver/catalog runtime.
7. Smoke host A, host B, unknown host, malformed host, conflicting query parameters, and forced lookup failure. Confirm 404/503 status and no cross-tenant reads.

Rollback order:

1. Roll back the runtime resolver/catalog deployment if routing causes lockout; do not add a fallback.
2. Retain `empresa_dominio` and its data for diagnosis/redeploy.
3. Confirm Gate 1 and checkout/order/payment regressions still pass.
4. Only after no deployed runtime/bootstrap depends on it, optionally remove mappings and then drop the additive table in a separate operator-reviewed migration.

If a mapping is missing or colliding, fix it or revert runtime. Never reassign it with upsert and never select `instanceConfig.store.slug` on failure.

## 12. Remaining `instance.config` dependencies

Removed only from the public collection identity query: `store.slug` no longer selects the SSR read tenant.

Retained intentionally:

- `store.slug`, name, and description in bootstrap company provisioning;
- store name/logo/hero/favicon in collection presentation, `_app`, Header, Footer, `RayzSection`, and `ProductCard`;
- locale and fixed UYU currency in `_document`/formatters;
- `instanceKey` in the browser auth storage namespace and deterministic bootstrap IDs;
- fixed storage bucket/path contract;
- `APP_BASE_URL` for canonical provisioning, OAuth callbacks, API origin allowlisting, Mercado Pago webhook URL, and payment return URLs;
- panel branding.

Two hosts therefore get different catalogs but shared branding, locale, currency, auth namespace, OAuth, and payment URL behavior. No consumer outside the collection read identity path is migrated in Gate 2.

## 13. Strict TDD and verification evidence

Implementation records evidence in the eventual tasks/verification artifacts, not in this design file.

### RED

1. Expand `scripts/storefront-tenant.test.mjs` first with table cases for extraction, casing, valid ports, one trailing dot, localhost/IPv4-shaped hosts, missing/repeated/array/comma values, whitespace/control, schemes, paths, query, fragment, userinfo, backslash, percent, malformed labels/ports, multi-dot endings, IPv6, non-ASCII, and DNS length boundaries.
2. Add resolver tests where invalid input never calls lookup; unknown/error/thrown/malformed-row outcomes fail closed; two valid hosts return distinct IDs; and no configured slug exists in the API.
3. Add SSR/catalog orchestration tests that fail until query/body/cookie/Origin/Referer/`X-Forwarded-Host` values are ignored and catalog callbacks are never called for invalid/unknown/lookup-failed outcomes.
4. Add image signing-boundary tests that attach a tenant-B canonical object key to a tenant-A product image row and, independently, a tenant-A key to a tenant-B product image row. In both directions, assert the signing spy is never called with the foreign key and the resulting product has no foreign `imagen_url`. Include `path`/`url_imagen` mismatch, invalid-present-`path` with valid legacy value, `path IS NULL` with a valid same-tenant canonical legacy key, and legacy absolute/old-format keys.
5. Add a DB-backed test that fails before `empresa_dominio` exists and before two-host catalog isolation/scoping is implemented. Its two-company fixture must persist the cross-wired image rows through the same allowed image-row write path (or trusted fixture SQL), proving the scenario is realistic rather than only passing fabricated helper input.
6. Add bootstrap helper tests that fail until same-owner repetition succeeds and cross-owner collision fails without mutation.

Capture failing assertion names/output, not merely a claim that tests were red.

### GREEN

Implement only the migration, pure resolver, SSR response branch, explicit variant company filter, pre-sign image object-key validator/filter, DB fixture, and bootstrap registration required to pass. Preserve current checkout/order/payment code untouched. Do not add an image schema/storage migration for R1-001.

### TRIANGULATE

- Run host A -> company A and host B -> company B with deliberately different product names, variant IDs/sizes, stock values, and image anchors.
- Test both A-to-B and B-to-A catalog exclusions.
- In each direction, cross-wire a local product's image row to the other tenant's real canonical private object key. Assert that key is absent from signer arguments and response props, while a valid same-product key can still be signed; if only the foreign row exists, `imagen_url` is `null`.
- Repeat each with valid B identifiers in A's query parameters and conflicting forwarding/origin headers.
- Assert invalid host performs zero mapping and catalog calls; unknown performs one mapping and zero catalog calls; lookup failure performs zero catalog calls and returns 503/no-store.
- Assert duplicate hostname insertion is rejected, same-owner bootstrap is idempotent, another-owner bootstrap preserves existing ownership, company deletion removes its mapping, and anon/authenticated enumeration is denied.

### REFACTOR

After green/triangulation, remove the old slug resolver and duplicate normalization helpers, keep unions exhaustive under strict TypeScript, keep query composition in one server-only function, and rerun every command. Do not refactor unrelated pages, branding, APIs, or commerce mutations.

### Required commands

Run from a reset local Supabase stack where DB tests are enabled:

```bash
pnpm exec supabase db reset --local
pnpm test:instance-config
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs
node --test scripts/storefront-tenant-db.test.mjs
node --test scripts/catalog-stock-isolation-db.test.mjs
pnpm test:buyer-checkout
pnpm test:checkout-idempotency
pnpm test:checkout-idempotency:db
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/order-operations-api.test.mjs scripts/order-operations-ui.test.mjs
node --test scripts/order-operations-db.test.mjs
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Register a minimal `test:storefront-tenant:db` package script only if needed for discoverability; do not rename existing required commands. A production-equivalent two-host HTTP smoke is additionally required because repo-local unit/DB tests cannot prove proxy behavior.

## 14. Likely file changes and reviewable work units

No files are changed during design except this artifact. Likely implementation surface:

- `supabase/migrations/<timestamp>_multi_tenant_gate_2_empresa_dominio.sql`
- `src/lib/storefrontTenant.ts`
- likely `src/lib/storefrontCatalog.ts` (catalog composition plus the pure pre-sign row-to-object validator; only extract another file if it reduces net complexity)
- `src/pages/coleccion/index.tsx`
- `scripts/storefront-tenant.test.mjs`
- new `scripts/storefront-tenant-db.test.mjs`
- `scripts/bootstrap-instance.mjs`
- `scripts/instance-config.test.mjs` or a narrowly named bootstrap-helper test if helper extraction requires it
- `package.json` only for the new DB command
- `README.md` and `local-env.sample` only for the minimum mapping/Host rollout instructions if tasks approve operational-doc changes

Reviewable work units:

1. **Domain contract and resolver RED/GREEN**: migration, grants/RLS/constraints, pure Host extraction/normalization/resolver, unit and DB registry tests.
2. **Storefront integration and bidirectional proof**: SSR 404/503 mechanics, catalog extraction/scoping, pre-sign row-to-object validation, query-override tests, and two-host catalog/stock/cross-wired-image regressions.
3. **Provisioning and rollout evidence**: collision-safe bootstrap, minimal command/docs updates, full regression and production-equivalent smoke record.

Keep tests with the code they prove and avoid unrelated cleanup. The exploration estimate of 475–790 changed lines remains plausible and exceeds the 400-line review budget. Because `chained_pr_strategy` is `ask-always`, apply must pause for an explicit delivery decision; this design defines work units but does not choose stacked/chained PRs.
