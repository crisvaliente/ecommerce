# Proposal — Multi-Tenant Gate 2: Tenant Resolution v1

## Intent

Establish one server-side, authoritative `Host -> empresa` resolution path for the public storefront. Gate 2 must prove that two explicitly mapped hosts select different tenant catalogs, while malformed, unknown, or failed host resolutions fail closed before any catalog or stock read.

This change builds on Gate 1 database isolation without changing its authority model. It replaces the build-time store slug only as the identity selector for storefront reads.

## Current gap

The storefront currently resolves `empresa` from `instance.config.store.slug`, so every host served by the deployment selects the same company. There is no authoritative domain mapping, no strict host parser, and no regression proving that request query/body values cannot override read tenancy. Because storefront SSR uses a service-role client that bypasses RLS, a missing or incorrect `empresa_id` filter can expose another tenant's catalog.

## Scope

- Add an additive, private domain-to-company source of truth, with globally unique normalized hostnames and explicit company ownership.
- Normalize and validate the direct Node/Next `Host` header using a small ASCII-only v1 contract.
- Resolve storefront tenancy server-side before catalog access, with explicit outcomes for invalid host, unknown host, and lookup failure.
- Use the resolved `empresa_id` on all tenant-bearing storefront product, stock, and variant reads; keep image reads anchored to already scoped product IDs.
- Prevent query, body, cookie, `Origin`, `Referer`, and forwarding headers from selecting or overriding storefront tenancy.
- Extend canonical provisioning/bootstrap behavior to register the normalized `APP_BASE_URL` hostname without silently reassigning collisions.
- Document and verify migration-first rollout, explicit production/local mappings, and fail-closed behavior.

## Non-goals

- Dynamic branding, locale, currency, metadata, favicon, or shared public component configuration.
- A domain-management UI, self-service onboarding, wildcard domains, routing rules, domain verification, or domain lifecycle/status workflows.
- Replacing `empresa.slug` as a provisioning identifier or treating it as a hostname.
- Changing panel authorization, authenticated account/order reads, payment behavior, OAuth URLs, or auth storage namespacing.
- Binding checkout/order/payment mutations to the request host. Existing checkout `empresa_id`, transactional ownership validation, stock atomicity, and idempotency semantics remain unchanged because no required defect in those contracts is established within this scope.
- Cleaning up unrelated prototype/debug pages or adding `empresa_id` to image records.
- Supporting internationalized hostnames, Punycode conversion, or trusting `X-Forwarded-Host` in v1.

## Affected surfaces

- Database schema and privileges for the domain mapping.
- Server-side host normalization and tenant resolution.
- `src/pages/coleccion/index.tsx` SSR catalog composition.
- Canonical instance bootstrap/provisioning.
- Unit and database-backed tenant isolation regressions.
- Minimal operational documentation and test command registration needed for rollout and verification.

Gate 1 artifacts and isolation rules remain intact.

## Source-of-truth direction

Introduce a small `public.empresa_dominio` relation whose normalized, port-free `hostname` is globally unique and references exactly one `empresa_id`. It should be additive, cascade when its company is deleted, enforce normalization invariants, and support lookup by company for provisioning. Domain mappings must not be enumerable by `public`, `anon`, or `authenticated`; only the minimum trusted server/provisioning access is allowed.

Removing a mapping disables that host. Duplicate ownership must be rejected rather than reassigned. There is no runtime fallback to `instance.config.store.slug`, including on lookup failure. The instance slug remains only a temporary provisioning and non-routing compatibility input.

## Security and trust boundary

V1 trusts only the direct `context.req.headers.host` value supplied through Node/Next. `X-Forwarded-Host` is not trusted unless a later deployment-specific contract proves that the proxy sanitizes it and explicitly enables it. `Origin`, `Referer`, URL/query values, cookies, and request bodies are never tenant selectors.

The normalizer must reject missing, multiple, or malformed values; whitespace and control characters; schemes, paths, queries, fragments, userinfo, and invalid ports; non-ASCII input; and invalid DNS length or label syntax. It lowercases names, removes a valid port, and consistently removes one terminal DNS dot. `localhost` and supported loopback forms are usable only when explicitly mapped; no local hostname receives an implicit canonical tenant.

Failure behavior is bounded:

- Invalid/missing host: perform no mapping lookup and no catalog/stock reads; return a generic not-found response.
- Unknown host: perform at most the mapping lookup and no catalog/stock reads; return a generic not-found response.
- Mapping infrastructure failure: perform no catalog/stock reads, remain distinguishable in bounded server-side diagnostics, and return a generic unavailable response rather than falling back.
- Known host: select exactly one company and explicitly scope every tenant-bearing service-role read to it.

Logs may contain a bounded failure reason and a safe normalized host, but no secrets or visitor-supplied alternate tenant identifiers.

## Compatibility boundary

The public catalog becomes host-selected, but branding, locale, UYU currency, page metadata, shared visual assets, auth namespace, bootstrap slug, and `APP_BASE_URL`-based OAuth/payment behavior remain instance-wide. This intentionally permits two hosts to display different catalogs with shared Raeyz presentation in v1.

Local development continues to use explicit mappings derived from configured URLs, including normalization such as `localhost:3000 -> localhost`. Preview domains, `127.0.0.1`, IPv6 literals, aliases, and other local names fail closed unless individually supported by the normalizer and explicitly registered.

## Rollout and rollback

Roll out in this order:

1. Apply the additive domain mapping migration and its private privilege contract.
2. Register and verify every intended canonical production and local hostname; reject collisions.
3. Validate the deployed proxy/platform `Host` behavior.
4. Deploy host-based resolution and catalog scoping.
5. Run two-host and fail-closed production-equivalent smoke checks.

Rollback the runtime resolver/catalog integration if necessary while retaining the additive mapping table and data for diagnosis or a later redeploy. Database removal, if ultimately required, occurs only after runtime rollback and confirmation that no deployed process depends on it. Rollback must not introduce a lookup-failure fallback or weaken existing Gate 1 isolation. Operational lockout from a missing mapping is addressed by correcting the mapping or reverting runtime code, never by silently selecting the configured slug.

## Mandatory regressions

- Host normalization table tests: casing, valid ports, terminal dot, explicit local hosts, missing/multiple values, whitespace/control input, malformed labels/ports, schemes, paths, queries, fragments, userinfo, and non-ASCII rejection.
- Resolver failure tests proving invalid hosts skip mapping lookup, and invalid/unknown/lookup-failed hosts execute no catalog or stock callbacks.
- Query-override attacks proving `empresa_id`, slug, or domain query variants never become resolver input or alter the selected tenant; body values likewise do not select storefront read tenancy.
- Database-backed two-company/two-domain fixtures with distinct catalog and stock data, verified in both A-to-B and B-to-A directions.
- Duplicate hostname assignment rejection and proof that `anon` and `authenticated` cannot enumerate mappings.
- Explicit `empresa_id` scoping for products, stock summaries, and variants; image access remains reachable only from scoped product IDs.
- Preservation of Gate 1 catalog/stock PostgREST regressions, buyer checkout, checkout idempotency, Order Operations where present, instance configuration, lint, strict TypeScript, and build validation.

## Measurable success criteria

- Two registered hosts resolve to two different expected `empresa_id` values and return only their own distinct products, variants, and stock in both test directions.
- A visitor-supplied tenant identifier cannot change the tenant selected by `Host`.
- Every malformed or unknown host produces no tenant catalog/stock query; an infrastructure lookup failure also produces no fallback or catalog/stock query.
- The domain mapping enforces unique ownership and is unreadable to public, anonymous, and authenticated roles.
- The canonical configured production and local hostnames can be provisioned idempotently, while collisions fail explicitly.
- Existing Gate 1 isolation and checkout/payment/order integrity regressions continue to pass without mutation-contract changes.

## Risks

- **Proxy ambiguity:** the repository does not prove how the production platform preserves incoming custom domains. Trusting the wrong header can misroute tenants.
- **Service-role blast radius:** any tenant-bearing read missing the resolved company filter can cross tenant boundaries because RLS is bypassed.
- **Operational lockout:** deploying resolution before mappings exist correctly makes the storefront unavailable.
- **Partial visual tenancy:** different catalogs retain shared branding and locale, which may confuse users until a later gate.
- **Local/preview friction:** unregistered aliases intentionally fail closed.
- **Legacy grants:** the new mapping must be private independently of historical `empresa` policies.
- **Review workload:** exploration forecasts 475–790 changed lines, above the 400-line review budget. Planning may define reviewable work units, but this proposal does not choose or create chained PRs; delivery strategy requires a later explicit decision before apply.

## Unresolved deployment validation

Before release, confirm in the actual hosting path that custom-domain requests preserve the intended authority in the direct Node/Next `Host` header and that malformed or duplicate header handling matches the resolver contract. Also inventory and explicitly register required production, local, health-check, and preview hostnames. Any future need for `X-Forwarded-Host` requires a separate deployment-specific trust contract, sanitization guarantee, and regression coverage.

## Bounded assumptions

- Host normalization is ASCII-only in v1.
- Unknown and malformed hosts are externally indistinguishable generic not-found outcomes; infrastructure lookup failure remains distinguishable server-side and may produce a generic unavailable response.
- Explicit mapping is required for every accepted hostname, including normalized localhost development.
- Existing transactional checkout validation is sufficient for this read-resolution gate; no host-binding change is implied.
